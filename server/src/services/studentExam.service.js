import mongoose from "mongoose";
import User from "../models/User.js";
import Exam from "../models/Exam.js";
import Subject from "../models/Subject.js";
import Course from "../models/Course.js";
import Department from "../models/Department.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import evaluationPipelineService from "./ai/evaluationPipeline.service.js";
import logger from "../utils/logger.js";

// Helper to determine if a submission status is finalized/locked
export const isSubmissionLocked = (status) => {
  if (!status) return false;
  return ["Submitted", "Pending AI Evaluation", "Faculty Review", "Published", "Completed"].includes(status);
};


// Reusable logic to get student eligible subject ids
export const getStudentEligibleSubjectIds = async (student) => {
  if (!student) return [];
  
  const allSubjects = await Subject.find({
    isDeleted: { $ne: true },
  }).populate({
    path: "course",
    populate: { path: "department" }
  }).lean();

  if (!allSubjects || allSubjects.length === 0) return [];

  let filtered = allSubjects;

  if (student.semester) {
    const studentSemStr = student.semester.toString().trim();
    filtered = filtered.filter(sub => {
      if (!sub.semester) return true;
      return sub.semester.toString().trim() === studentSemStr;
    });
  }

  if (student.department) {
    const studentDeptStr = student.department.toString().toLowerCase().trim();
    
    // Helper to get common abbreviations/aliases
    const getAliases = (str) => {
      const aliases = new Set([str]);
      if (str.includes("computer") || str.includes("ce") || str === "cs") {
        aliases.add("computer");
        aliases.add("engineering");
        aliases.add("ce");
        aliases.add("cs");
      }
      if (str.includes("information") || str.includes("it")) {
        aliases.add("information");
        aliases.add("technology");
        aliases.add("it");
      }
      return Array.from(aliases);
    };

    const studentAliases = getAliases(studentDeptStr);

    filtered = filtered.filter(sub => {
      const course = sub.course;
      if (!course || !course.department) return true;
      const dept = course.department;
      const deptIdStr = typeof dept === "object" && dept._id ? dept._id.toString().toLowerCase() : (typeof dept === "string" ? dept.toLowerCase() : "");
      const deptNameStr = typeof dept === "object" && dept.name ? dept.name.toLowerCase() : "";
      const deptCodeStr = typeof dept === "object" && dept.code ? dept.code.toLowerCase() : "";

      // General / Default course subjects are open to all students
      if (
        deptNameStr.includes("general") ||
        deptCodeStr.includes("gen") ||
        deptCodeStr.includes("get")
      ) {
        return true;
      }

      if (deptIdStr === studentDeptStr) return true;

      // Check if any alias matches name or code
      for (const alias of studentAliases) {
        if (alias.length <= 2) {
          // Short code (e.g. "ce", "ec", "it", "cs"): match exact code or word boundary
          const regex = new RegExp(`\\b${alias}\\b`, "i");
          if (
            deptCodeStr === alias ||
            deptCodeStr.startsWith(alias + "-") ||
            deptCodeStr.startsWith(alias + "_") ||
            regex.test(deptNameStr)
          ) {
            return true;
          }
        } else {
          // Longer terms (e.g. "computer", "engineering", "information"): substring match is safe
          if (
            (deptNameStr && deptNameStr.includes(alias)) ||
            (deptCodeStr && deptCodeStr.includes(alias))
          ) {
            return true;
          }
        }
      }

      return false;
    });
  }

  return filtered.map(sub => sub._id.toString());
};

// Centralized status and canEnter calculator
export const getExamStatusAndEligibility = (exam, submission, evaluation, now = new Date()) => {
  const subStatus = submission ? submission.submissionStatus : "not_started";
  const ocrStr = submission ? (submission.ocrStatus || "") : "";
  const processingStr = submission ? (submission.processingStatus || "") : "";
  const uploadStr = submission ? (submission.uploadStatus || "") : "";
  const evalStatus = evaluation ? evaluation.evaluationStatus : null;

  const alreadySubmitted = submission && ["Submitted", "Pending AI Evaluation", "Faculty Review", "Published", "Completed"].includes(subStatus);
  const alreadyStarted = submission && ["Started", "Auto Saving"].includes(subStatus);

  const examDate = exam.examDate ? new Date(exam.examDate) : null;
  const start = exam.startTime ? new Date(exam.startTime) : examDate;
  const end = exam.endTime ? new Date(exam.endTime) : (start ? new Date(start.getTime() + (exam.duration || 60) * 60 * 1000) : null);

  let status = "expired";
  let canEnter = false;
  let reason = null;

  // Determine stage and status based on priority list
  if (evalStatus === "PUBLISHED" || evalStatus === "published" || subStatus === "Published" || uploadStr === "Published" || submission?.resultPublication?.status === "RESULT_PUBLISHED") {
    status = "published";
    canEnter = false;
    reason = "Results have been published.";
  } else if (subStatus === "Faculty Review" || uploadStr === "Faculty Review" || evalStatus === "FACULTY_REVIEW") {
    status = "reviewed";
    canEnter = false;
    reason = "Submission is under review.";
  } else if (subStatus === "Pending AI Evaluation" || uploadStr === "AI Evaluation" || ["AI_PENDING", "LLM_PROCESSING", "GRADING", "AI_COMPLETED"].includes(evalStatus)) {
    status = "processing";
    canEnter = false;
    reason = "Answers are undergoing AI evaluation.";
  } else if (processingStr === "processing" || ocrStr === "processing" || uploadStr === "HWR Processing") {
    status = "processing";
    canEnter = false;
    reason = "Handwriting recognition is processing.";
  } else if (alreadySubmitted) {
    status = "submitted";
    canEnter = false;
    reason = "You have already submitted this exam.";
  } else if (alreadyStarted && (!end || now <= end)) {
    status = "in_progress";
    canEnter = true;
  } else if (start && now < start) {
    status = "upcoming";
    canEnter = false;
    reason = "Exam has not started yet.";
  } else if (end && now > end) {
    status = "expired";
    canEnter = false;
    reason = "Exam duration has expired.";
  } else {
    status = "active";
    canEnter = true;
  }

  return { status, canEnter, reason, startTime: start, endTime: end };
};

// Retrieve eligible student exams
export const getStudentExams = async (studentId, query = {}) => {
  const student = await User.findById(studentId).lean();
  if (!student) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Student not found");
  }

  // Determine eligible subjects first
  const eligibleSubjectIds = await getStudentEligibleSubjectIds(student);
  const subjectMatch = { $in: eligibleSubjectIds };

  const { page = 1, limit = 10, status, search } = query;

  // Search filtering
  const mongoQuery = {
    $or: [{ isPublished: true }, { examStatus: { $in: ["Published", "Active", "Completed"] } }],
    isDeleted: { $ne: true },
    subject: subjectMatch,
  };

  // Fetch candidate exams after eligibility filter (newest first)
  let candidateExams = await Exam.find(mongoQuery)
    .populate("subject", "name code semester")
    .sort({ startTime: -1, examDate: -1, createdAt: -1 })
    .lean();

  if (search && search.trim() !== "") {
    const sTerm = search.trim().toLowerCase();
    candidateExams = candidateExams.filter(exam => {
      const titleMatch = exam.title && exam.title.toLowerCase().includes(sTerm);
      const subNameMatch = exam.subject && exam.subject.name && exam.subject.name.toLowerCase().includes(sTerm);
      const subCodeMatch = exam.subject && exam.subject.code && exam.subject.code.toLowerCase().includes(sTerm);
      return titleMatch || subNameMatch || subCodeMatch;
    });
  }

  const now = new Date();

  // Fetch student answer sheets and evaluations
  const studentSubmissions = await AnswerSheet.find({
    student: studentId,
    isDeleted: { $ne: true },
  }).lean();

  const studentSubmissionIds = studentSubmissions.map(s => s._id);
  const evaluations = await Evaluation.find({
    answerSheet: { $in: studentSubmissionIds },
    isDeleted: { $ne: true },
  }).lean();

  // Map each exam
  const mappedExams = [];
  for (const exam of candidateExams) {
    const submission = studentSubmissions.find(s => s.exam.toString() === exam._id.toString());
    const evaluation = submission ? evaluations.find(ev => ev.answerSheet.toString() === submission._id.toString()) : null;

    const { status: resolvedStatus, canEnter, reason, startTime, endTime } = getExamStatusAndEligibility(exam, submission, evaluation, now);

    const subStatus = submission ? submission.submissionStatus : "not_started";
    let normSubmissionStatus = "not_started";
    if (submission) {
      if (["Submitted", "Pending AI Evaluation", "Faculty Review", "Published", "Completed"].includes(subStatus)) {
        normSubmissionStatus = "submitted";
      } else if (["Started", "Auto Saving"].includes(subStatus)) {
        normSubmissionStatus = "in_progress";
      }
    }

    mappedExams.push({
      id: exam._id,
      title: exam.title,
      subject: exam.subject ? exam.subject.name : "",
      subjectCode: exam.subject ? exam.subject.code : "",
      semester: exam.subject ? exam.subject.semester : null,
      department: student.department || "",
      startTime,
      endTime,
      duration: exam.duration,
      totalMarks: exam.totalMarks,
      status: resolvedStatus,
      submissionStatus: normSubmissionStatus,
      canEnter,
      reason,
      createdAt: exam.createdAt,
    });
  }

  // Sort mapped exams by status priority then by startTime/createdAt descending
  const statusPriorityMap = {
    active: 1,
    in_progress: 2,
    upcoming: 3,
    processing: 4,
    reviewed: 5,
    published: 6,
    submitted: 7,
    expired: 8,
  };

  mappedExams.sort((a, b) => {
    const pA = statusPriorityMap[a.status] || 99;
    const pB = statusPriorityMap[b.status] || 99;
    if (pA !== pB) return pA - pB;
    const dateA = a.startTime ? new Date(a.startTime).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const dateB = b.startTime ? new Date(b.startTime).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return dateB - dateA;
  });

  // Filter based on status parameter if provided
  let filteredExams = mappedExams;
  if (status) {
    const sLower = status.toLowerCase();
    filteredExams = mappedExams.filter(e => {
      if (sLower === "active") return e.status === "active";
      if (sLower === "upcoming") return e.status === "upcoming";
      if (sLower === "in_progress") return e.status === "in_progress";
      if (sLower === "submitted") return ["submitted", "processing", "reviewed"].includes(e.status);
      if (sLower === "published") return e.status === "published";
      if (sLower === "completed") return ["submitted", "processing", "reviewed", "published"].includes(e.status);
      if (sLower === "expired") return e.status === "expired";
      return true;
    });
  }

  // Paginate manually after mapping and filtering
  const total = filteredExams.length;
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const totalPages = Math.ceil(total / limitNum);
  const paginatedExams = filteredExams.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  return {
    exams: paginatedExams,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
    }
  };
};

// Retrieve eligible student exam details by ID
export const getStudentExamById = async (studentId, examId) => {
  const student = await User.findById(studentId).lean();
  if (!student) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Student not found");
  }

  const exam = await Exam.findOne({ _id: examId, isDeleted: { $ne: true } })
    .populate("subject", "name code semester")
    .lean();

  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Check eligibility
  const eligibleSubjectIds = await getStudentEligibleSubjectIds(student);
  const isEligible = eligibleSubjectIds.includes(exam.subject._id.toString());
  if (!isEligible) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You are not eligible to access this exam");
  }

  const submission = await AnswerSheet.findOne({
    student: studentId,
    exam: examId,
    isDeleted: { $ne: true },
  }).lean();

  const evaluation = submission ? await Evaluation.findOne({
    answerSheet: submission._id,
    isDeleted: { $ne: true },
  }).lean() : null;

  const { status, canEnter, reason, startTime, endTime } = getExamStatusAndEligibility(exam, submission, evaluation, new Date());

  return {
    id: exam._id,
    title: exam.title,
    subject: exam.subject ? exam.subject.name : "",
    subjectCode: exam.subject ? exam.subject.code : "",
    description: exam.description || "",
    instructions: exam.instructions && exam.instructions.length > 0 ? exam.instructions : ["Answer all questions.", "Submit before the timer expires."],
    startTime,
    endTime,
    duration: exam.duration,
    totalMarks: exam.totalMarks,
    status,
    canEnter,
    reason,
  };
};

// Retrieve eligible student exam eligibility specifically
export const getStudentExamEligibility = async (studentId, examId) => {
  const student = await User.findById(studentId).lean();
  if (!student) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Student not found");
  }

  const exam = await Exam.findOne({ _id: examId, isDeleted: false }).lean();
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  const eligibleSubjectIds = await getStudentEligibleSubjectIds(student);
  const isEligible = eligibleSubjectIds.includes(exam.subject.toString());

  if (!isEligible) {
    return {
      eligible: false,
      canEnter: false,
      reason: "You are not eligible for this subject/exam.",
      status: "not_eligible"
    };
  }

  const submission = await AnswerSheet.findOne({
    student: studentId,
    exam: examId,
    isDeleted: false,
  }).lean();

  const evaluation = submission ? await Evaluation.findOne({
    answerSheet: submission._id,
    isDeleted: false,
  }).lean() : null;

  const { status, canEnter, reason } = getExamStatusAndEligibility(exam, submission, evaluation, new Date());

  return {
    eligible: true,
    canEnter,
    reason,
    status
  };
};

// Retrieve student exam workspace data
export const getStudentExamWorkspace = async (studentId, examId) => {
  const student = await User.findById(studentId).lean();
  if (!student) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Student not found");
  }

  const exam = await Exam.findOne({ _id: examId, isDeleted: false })
    .populate("subject", "name code semester")
    .lean();

  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Verify subject/course eligibility
  const eligibleSubjectIds = await getStudentEligibleSubjectIds(student);
  const isEligible = eligibleSubjectIds.includes(exam.subject._id.toString());
  if (!isEligible) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You are not eligible to access this exam");
  }

  // Load existing submission
  const submission = await AnswerSheet.findOne({
    student: studentId,
    exam: examId,
    isDeleted: false,
  }).lean();

  const evaluation = submission ? await Evaluation.findOne({
    answerSheet: submission._id,
    isDeleted: false,
  }).lean() : null;

  const { status } = getExamStatusAndEligibility(exam, submission, evaluation, new Date());

  // Enforce access validation block
  if (status === "upcoming") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "This exam has not started yet");
  }
  if (status === "expired") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "This exam is no longer available");
  }
  if (status === "submitted" || status === "processing" || status === "reviewed" || status === "published") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "This exam has already been submitted");
  }

  // Format safe list of questions (remove answers or points information not meant for students)
  const safeQuestions = (exam.questions || []).map(q => ({
    id: q._id || q.questionNumber.toString(),
    questionNumber: q.questionNumber,
    questionText: q.questionText,
    maximumMarks: q.maximumMarks || q.marks,
    required: q.required !== false,
  }));

  return {
    exam: {
      id: exam._id,
      title: exam.title,
      subject: exam.subject ? exam.subject.name : "",
      subjectCode: exam.subject ? exam.subject.code : "",
      duration: exam.duration,
      totalMarks: exam.totalMarks,
      startTime: exam.startTime,
      endTime: exam.endTime,
      instructions: exam.instructions && exam.instructions.length > 0 ? exam.instructions : ["Answer all questions.", "Make sure to write clearly on the digital canvas.", "Autosave processes your edits in the background."],
    },
    questions: safeQuestions,
    submission: submission ? {
      id: submission._id,
      status: submission.submissionStatus,
      startedAt: submission.createdAt,
      lastSavedAt: submission.lastSavedAt,
      answers: submission.answers || [],
    } : null,
    serverTime: new Date().toISOString(),
  };
};

// Start or resume an exam submission for a student
export const startStudentExam = async (studentId, examId) => {
  const student = await User.findById(studentId).lean();
  if (!student) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Student not found");
  }

  const exam = await Exam.findOne({ _id: examId, isDeleted: false })
    .populate("subject", "name code semester")
    .lean();

  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Check eligibility
  const eligibleSubjectIds = await getStudentEligibleSubjectIds(student);
  const isEligible = eligibleSubjectIds.includes(exam.subject._id.toString());
  if (!isEligible) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You are not eligible to access this exam");
  }

  // Check existing submission
  let submission = await AnswerSheet.findOne({
    student: studentId,
    exam: examId,
    isDeleted: false,
  });

  const evaluation = submission ? await Evaluation.findOne({
    answerSheet: submission._id,
    isDeleted: false,
  }).lean() : null;

  const { status, canEnter } = getExamStatusAndEligibility(exam, submission, evaluation, new Date());

  if (!canEnter) {
    if (status === "upcoming") {
      throw new ApiError(STATUS_CODES.FORBIDDEN, "This exam has not started yet");
    }
    if (status === "expired") {
      throw new ApiError(STATUS_CODES.FORBIDDEN, "This exam is no longer available");
    }
    if (status === "submitted" || status === "processing" || status === "reviewed" || status === "published") {
      throw new ApiError(STATUS_CODES.FORBIDDEN, "This exam has already been submitted");
    }
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Exam is not currently accessible");
  }

  if (!submission) {
    // Start new draft submission (autonomously ensure idempotency)
    submission = await AnswerSheet.create({
      student: studentId,
      subject: exam.subject._id,
      exam: examId,
      submissionStatus: "Started",
      submissionType: "DIGITAL",
      attemptNo: 1,
      answers: [],
      createdBy: studentId,
    });
  }

  return {
    id: submission._id,
    status: submission.submissionStatus,
    startedAt: submission.createdAt,
    lastSavedAt: submission.lastSavedAt,
  };
};

// Autosave answers to the database
export const autosaveStudentExamAnswer = async (studentId, examId, payload) => {
  const { questionId, handwrittenData, recognizedText } = payload;
  if (!questionId) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "questionId is required");
  }

  const student = await User.findById(studentId).lean();
  if (!student) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Student not found");
  }

  const exam = await Exam.findOne({ _id: examId, isDeleted: false }).lean();
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Check eligibility
  const eligibleSubjectIds = await getStudentEligibleSubjectIds(student);
  const isEligible = eligibleSubjectIds.includes(exam.subject.toString());
  if (!isEligible) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You are not eligible to access this exam");
  }

  // Load existing submission
  const submission = await AnswerSheet.findOne({
    student: studentId,
    exam: examId,
    isDeleted: false,
  });

  if (!submission) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "In-progress answer sheet not found. Call start exam first.");
  }

  if (isSubmissionLocked(submission.submissionStatus)) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "This exam has already been submitted and is locked");
  }

  const evaluation = await Evaluation.findOne({
    answerSheet: submission._id,
    isDeleted: false,
  }).lean();

  const { status, canEnter } = getExamStatusAndEligibility(exam, submission, evaluation, new Date());

  // Enforce authoritative time check & submission status check
  if (!canEnter || ["submitted", "processing", "reviewed", "published"].includes(status)) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Exam is closed or already submitted");
  }

  // Avoid overriding entire answers array. Implement atomic Upsert on Mongoose AnswerSheet.
  // We locate index in answers array
  const existingAnswerIndex = submission.answers.findIndex(
    ans => ans.questionId.toString() === questionId.toString()
  );

  if (existingAnswerIndex !== -1) {
    // If it exists, update the specific fields
    submission.answers[existingAnswerIndex].handwrittenData = typeof handwrittenData === "string" ? handwrittenData : JSON.stringify(handwrittenData);
    if (recognizedText) {
      submission.answers[existingAnswerIndex].recognizedText = recognizedText;
    }
    submission.answers[existingAnswerIndex].submissionTime = new Date();
  } else {
    // If it does not exist, push a new item to the array
    submission.answers.push({
      questionId: new mongoose.Types.ObjectId(questionId),
      handwrittenData: typeof handwrittenData === "string" ? handwrittenData : JSON.stringify(handwrittenData),
      recognizedText: recognizedText || "",
      submissionTime: new Date(),
    });
  }

  submission.lastSavedAt = new Date();
  submission.submissionStatus = "Auto Saving";
  await submission.save();

  return {
    success: true,
    lastSavedAt: submission.lastSavedAt,
    status: submission.submissionStatus,
  };
};

// Finalize, lock and submit an exam for AI processing
export const submitStudentExam = async (studentId, examId) => {
  const student = await User.findById(studentId).lean();
  if (!student) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Student not found");
  }

  const exam = await Exam.findOne({ _id: examId, isDeleted: false })
    .populate("subject", "name code semester")
    .lean();

  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // 1. Verify eligibility
  const eligibleSubjectIds = await getStudentEligibleSubjectIds(student);
  const isEligible = eligibleSubjectIds.includes(exam.subject._id.toString());
  if (!isEligible) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You are not eligible to access this exam");
  }

  // 2. Retrieve existing submission
  const submission = await AnswerSheet.findOne({
    student: studentId,
    exam: examId,
    isDeleted: false,
  });

  if (!submission) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "No active exam session found. Start the exam first.");
  }

  const evaluation = await Evaluation.findOne({
    answerSheet: submission._id,
    isDeleted: false,
  }).lean();

  // 3. Verify already submitted
  if (isSubmissionLocked(submission.submissionStatus)) {
    return {
      submissionId: submission._id,
      submissionStatus: submission.submissionStatus,
      submittedAt: submission.submittedAt,
      alreadySubmitted: true
    };
  }

  // 4. Verify Submission window
  const { status } = getExamStatusAndEligibility(exam, submission, evaluation, new Date());
  if (status === "expired") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "This exam duration has expired and cannot be submitted");
  }
  if (status === "upcoming") {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "This exam has not started yet");
  }

  // 5. Perform atomic finalization
  const finalizedSheet = await AnswerSheet.findOneAndUpdate(
    {
      student: studentId,
      exam: examId,
      submissionStatus: { $in: ["Started", "Draft", "Auto Saving", "Pending"] },
      isDeleted: false
    },
    {
      $set: {
        submissionStatus: "Submitted",
        submittedAt: new Date(),
        processingStatus: "processing",
        ocrStatus: "processing"
      }
    },
    { new: true }
  );

  if (!finalizedSheet) {
    // Check if already submitted by concurrent request
    const reloaded = await AnswerSheet.findOne({
      student: studentId,
      exam: examId,
      isDeleted: false
    });
    if (reloaded && isSubmissionLocked(reloaded.submissionStatus)) {
      return {
        submissionId: reloaded._id,
        submissionStatus: reloaded.submissionStatus,
        submittedAt: reloaded.submittedAt,
        alreadySubmitted: true
      };
    }
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Failed to lock the exam sheet for submission.");
  }

  // 6. Trigger pipeline queue in background asynchronously (do not await)
  processDigitalExamHWRBackground(finalizedSheet._id, studentId, studentId).catch((err) => {
    logger.error(`Failed to trigger background HWR for AnswerSheet ${finalizedSheet._id}: ${err.message}`);
  });

  return {
    submissionId: finalizedSheet._id,
    submissionStatus: finalizedSheet.submissionStatus,
    submittedAt: finalizedSheet.submittedAt,
    alreadySubmitted: false
  };
};

// Background worker running real digital canvas strokes HWR/OCR processing
export const processDigitalExamHWRBackground = async (sheetId, studentId, userId) => {
  try {
    const answerSheet = await AnswerSheet.findById(sheetId);
    if (!answerSheet) return;

    logger.info(`Starting background HWR processing for digital AnswerSheet ${sheetId}`);

    const exam = await Exam.findById(answerSheet.exam);
    if (!exam) {
      throw new Error("Exam not found during HWR processing");
    }

    const uvicornUrl = "http://127.0.0.1:8000/api/v1/ocr/recognize-strokes";
    const updatedAnswers = [];
    const rawTextParts = [];

    for (const ansItem of answerSheet.answers) {
      if (!ansItem.handwrittenData) {
        updatedAnswers.push({
          questionId: ansItem.questionId,
          handwrittenData: "",
          recognizedText: "",
          hwrStatus: "Completed",
          confidence: 1.0,
          confidenceLevel: "HIGH",
          submissionTime: ansItem.submissionTime || new Date(),
        });
        continue;
      }

      let parsedHandwritten;
      try {
        parsedHandwritten = JSON.parse(ansItem.handwrittenData);
      } catch (e) {
        parsedHandwritten = null;
      }

      const matchedQ = exam.questions.find(q => q._id.toString() === ansItem.questionId.toString());
      const qNum = matchedQ ? matchedQ.questionNumber : 1;

      if (!parsedHandwritten || !parsedHandwritten.strokes || !Array.isArray(parsedHandwritten.strokes)) {
        updatedAnswers.push({
          questionId: ansItem.questionId,
          handwrittenData: ansItem.handwrittenData,
          recognizedText: ansItem.recognizedText || "",
          hwrStatus: "Completed",
          confidence: 1.0,
          confidenceLevel: "HIGH",
          submissionTime: ansItem.submissionTime || new Date(),
        });
        continue;
      }

      // Format payload for FastAPI recognize-strokes endpoint
      const payload = {
        strokes: parsedHandwritten.strokes.map(st => ({
          points: (st.points || []).map(p => ({ x: p.x, y: p.y })),
          color: st.color || "#0000FF",
          width: st.width || 3
        })),
        width: 800,
        height: 600,
        page_num: qNum
      };

      let recognizedText = "";
      let confidence = 1.0;
      let ocrQualityStatus = "HIGH";
      let needsReview = false;
      let provider = "paddle";
      let qualityReasons = [];

      try {
        logger.info(`Sending ${payload.strokes.length} strokes of question ${ansItem.questionId} (Q${qNum}) to FastAPI for OCR...`);

        const response = await fetch(uvicornUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`FastAPI strokes OCR returned status ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log("OCR response:", result.data);
        if (!result.success || !result.data) {
          throw new Error(result.message || "Failed to process strokes in python service");
        }

        const hwrResult = result.data;
        recognizedText = (hwrResult.text || "").trim();
        console.log("Extracted OCR text:", recognizedText);
        confidence = hwrResult.confidence ?? 1.0;
        ocrQualityStatus = hwrResult.ocrQualityStatus || "HIGH";
        needsReview = hwrResult.needsReview ?? false;
        provider = hwrResult.provider || "paddle";
        qualityReasons = hwrResult.qualityReasons || [];
      } catch (ocrErr) {
        logger.warn(`FastAPI stroke recognition bypassed/failed for Q${qNum}: ${ocrErr.message}`);
        const fallbackCandidate = ansItem.recognizedText || ansItem.text || "";
        if (fallbackCandidate.startsWith("Transcribed canvas response") || fallbackCandidate.startsWith("Digitized canvas answer")) {
          recognizedText = "";
        } else {
          recognizedText = fallbackCandidate;
        }
        provider = "fallback";
      }

      let confidenceLevel = "HIGH";
      if (confidence < 0.6 || needsReview || ocrQualityStatus === "NEEDS_REVIEW") {
        confidenceLevel = "LOW";
      } else if (confidence < 0.85 || ocrQualityStatus === "MEDIUM") {
        confidenceLevel = "MEDIUM";
      }

      updatedAnswers.push({
        questionId: ansItem.questionId,
        handwrittenData: ansItem.handwrittenData,
        recognizedText,
        hwrStatus: "Completed",
        confidence,
        confidenceLevel,
        ocrQualityStatus,
        needsReview,
        provider,
        qualityReasons,
        submissionTime: ansItem.submissionTime || new Date(),
      });

      rawTextParts.push(`Q${qNum}: ${recognizedText}`);
    }

    const digitalAnswers = updatedAnswers.map((ans, idx) => {
      const matchedQ = exam.questions ? exam.questions.find(q => q._id.toString() === ans.questionId.toString()) : null;
      const qNum = matchedQ ? matchedQ.questionNumber : (idx + 1);
      const qText = matchedQ ? matchedQ.questionText : "";
      const maxMarks = matchedQ ? (matchedQ.maximumMarks || matchedQ.marks || 10) : 10;
      let strokes = [];
      if (ans.handwrittenData) {
        try {
          const parsed = typeof ans.handwrittenData === "string" ? JSON.parse(ans.handwrittenData) : ans.handwrittenData;
          if (parsed && Array.isArray(parsed.strokes)) strokes = parsed.strokes;
        } catch (e) {}
      }
      return {
        question_id: ans.questionId,
        question_number: String(qNum),
        question_text: qText,
        max_marks: maxMarks,
        text: ans.recognizedText || "",
        answer_text: ans.recognizedText || "",
        recognizedText: ans.recognizedText || "",
        handwrittenData: ans.handwrittenData || "",
        strokes,
        page_number: 1,
        confidence: ans.confidence ?? 1.0,
      };
    });

    answerSheet.answers = updatedAnswers;
    answerSheet.digital_answers = digitalAnswers;
    answerSheet.extractedText = rawTextParts.join("\n\n");
    answerSheet.processingStatus = "completed";
    answerSheet.ocrStatus = "completed";
    answerSheet.segmentationStatus = "completed";  // Digital is pre-segmented by question, mark completed
    answerSheet.submissionStatus = "Pending AI Evaluation";
    answerSheet.updatedBy = userId;

    await answerSheet.save();
    logger.info(`Background HWR completed successfully for digital AnswerSheet ${sheetId}`);

    // Automatically trigger AI evaluation queueing logic
    evaluationPipelineService.queueEvaluation(sheetId, studentId).catch(async (err) => {
      if (err.message === "ANSWER_KEY_NOT_FOUND") {
        // Not a real failure: the exam has no approved answer key yet. Mark the
        // sheet as awaiting the key (instead of logging a misleading error) so it
        // can be picked up automatically once faculty approves the answer key.
        logger.warn(
          `Digital AnswerSheet ${sheetId}: AI evaluation deferred — no approved answer key for this exam yet. Marking AWAITING_ANSWER_KEY.`
        );
        try {
          await AnswerSheet.findByIdAndUpdate(sheetId, {
            evaluationStatus: "AWAITING_ANSWER_KEY",
            evaluationCurrentStep: "Waiting for an approved answer key",
            evaluationError: null,
          });
        } catch (dbErr) {
          logger.error(
            `Failed to set AWAITING_ANSWER_KEY status for digital AnswerSheet ${sheetId}: ${dbErr.message}`
          );
        }
      } else {
        logger.error(
          `Failed to trigger background evaluation pipeline after digital HWR: ${err.message}`
        );
      }
    });

  } catch (error) {
    logger.error(`Background HWR pipeline failed for digital AnswerSheet ${sheetId}: ${error.message}`);
    try {
      await AnswerSheet.findByIdAndUpdate(sheetId, {
        processingStatus: "failed",
        ocrStatus: "failed",
        segmentationStatus: "failed",
        submissionStatus: "Failed",
        errorMessage: error.message,
        updatedBy: userId,
      });
    } catch (dbErr) {
      logger.error(`Failed to log error status for digital AnswerSheet ${sheetId}: ${dbErr.message}`);
    }
  }
};

// Map internal statuses to dynamic pipeline steps for student
export const mapInternalStatusToPipeline = (submission, evaluation) => {
  if (!submission) {
    return {
      status: "draft",
      stage: "Student Writes on iPad",
      progress: 0,
      isTerminal: false,
      isFailed: false,
    };
  }

  const subStatus = submission.submissionStatus || "";
  const processingStatus = submission.processingStatus || "";
  const ocrStatus = submission.ocrStatus || "";
  const segmentationStatus = submission.segmentationStatus || "";
  const uploadStatus = submission.uploadStatus || "";
  const evalStatus = evaluation ? evaluation.evaluationStatus : null;

  // 1. Check for failure states
  const hasFailed =
    processingStatus === "failed" ||
    ocrStatus === "failed" ||
    segmentationStatus === "failed" ||
    subStatus === "Failed" ||
    uploadStatus === "Failed" ||
    evalStatus === "FAILED" ||
    evalStatus === "failed";

  // Determine normalized progress by stage
  let status = "draft";
  let stage = "Student Writes on iPad";
  let progress = 0;

  if (
    ["PUBLISHED", "published", "finalized"].includes(evalStatus) ||
    subStatus === "Published" ||
    uploadStatus === "Published"
  ) {
    progress = 100;
    stage = "Results Published";
    status = "published";
  } else if (
    ["FACULTY_REVIEW", "reviewed", "completed"].includes(evalStatus) ||
    subStatus === "Faculty Review" ||
    uploadStatus === "Faculty Review"
  ) {
    progress = 80;
    stage = "Faculty Review";
    status = "faculty_review";
  } else if (
    ["AI_PENDING", "LLM_PROCESSING", "GRADING", "AI_COMPLETED", "FAILED", "failed", "processing", "queued"].includes(
      evalStatus
    ) ||
    subStatus === "Pending AI Evaluation" ||
    uploadStatus === "AI Evaluation"
  ) {
    progress = 60;
    stage = "AI Evaluation";
    status = "evaluating";
  } else if (
    processingStatus === "processing" ||
    ocrStatus === "processing" ||
    uploadStatus === "HWR Processing" ||
    ocrStatus === "completed" ||
    segmentationStatus === "processing"
  ) {
    progress = 40;
    stage = "Handwriting Recognition";
    status = "processing";
  } else if (
    subStatus === "Submitted" ||
    uploadStatus === "Uploaded" ||
    processingStatus === "ready_for_evaluation"
  ) {
    progress = 20;
    stage = "Submit Exam";
    status = "submitted";
  }

  // 2. If it has failed:
  // - status = "failed"
  // - stage = "Processing Delayed"
  // - progress = last successfully reached progress
  if (hasFailed) {
    return {
      status: "failed",
      stage: "Processing Delayed",
      progress: progress > 0 ? progress : 20,
      isTerminal: true,
      isFailed: true,
    };
  }

  const isTerminal = status === "published";

  return {
    status,
    stage,
    progress,
    isTerminal,
    isFailed: false,
  };
};

// Fetch submission and linked pipeline tracking detail
export const getStudentSubmissionStatus = async (studentId, examId) => {
  const student = await User.findById(studentId).lean();
  if (!student) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Student not found");
  }

  const exam = await Exam.findOne({ _id: examId, isDeleted: false })
    .populate("subject", "name code semester")
    .lean();

  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Verify eligibility
  const eligibleSubjectIds = await getStudentEligibleSubjectIds(student);
  const isEligible = eligibleSubjectIds.includes(exam.subject._id.toString());
  if (!isEligible) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You are not eligible to access this exam");
  }

  const submission = await AnswerSheet.findOne({
    student: studentId,
    exam: examId,
    isDeleted: false,
  }).lean();

  if (!submission) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "No active exam session found. Start the exam first.");
  }

  const evaluation = await Evaluation.findOne({
    answerSheet: submission._id,
    isDeleted: false,
  }).lean();

  const pipeline = mapInternalStatusToPipeline(submission, evaluation);

  return {
    submissionId: submission._id,
    submissionStatus: submission.submissionStatus,
    processingStatus: submission.processingStatus,
    submittedAt: submission.submittedAt,
    updatedAt: submission.updatedAt,
    pipeline,
  };
};

// Fetch finalized/published student result safely
export const getStudentExamResult = async (studentId, examId) => {
  const student = await User.findById(studentId).lean();
  if (!student) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Student not found");
  }

  const exam = await Exam.findOne({ _id: examId, isDeleted: false })
    .populate("subject", "name code")
    .lean();

  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // Verify eligibility
  const eligibleSubjectIds = await getStudentEligibleSubjectIds(student);
  const isEligible = eligibleSubjectIds.includes(exam.subject._id.toString());
  if (!isEligible) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You are not eligible to access this exam");
  }

  const submission = await AnswerSheet.findOne({
    student: studentId,
    exam: examId,
    isDeleted: false,
  }).lean();

  if (!submission) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "No submission found for this exam.");
  }

  const evaluation = await Evaluation.findOne({
    answerSheet: submission._id,
    isDeleted: false,
  }).lean();

  if (
    !evaluation ||
    submission.evaluationStatus === "EVALUATION_FAILED" ||
    evaluation.evaluationStatus === "EVALUATION_FAILED" ||
    evaluation.evaluationStatus === "FAILED" ||
    evaluation.evaluationStatus === "failed" ||
    submission.resultPublication?.status !== "RESULT_PUBLISHED" ||
    !["PUBLISHED", "published", "RESULT_PUBLISHED"].includes(evaluation.evaluationStatus)
  ) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Result is not available yet.");
  }

  // Join evaluation.questions with exam.questions using questionId
  const questionsList = [];
  const evalQuestions = evaluation.questions || [];
  const examQuestions = exam.questions || [];

  for (const eq of evalQuestions) {
    const matchedExQ = examQuestions.find(ex => ex._id.toString() === eq.questionId.toString());
    questionsList.push({
      questionId: eq.questionId,
      questionNumber: matchedExQ ? matchedExQ.questionNumber : undefined,
      questionText: matchedExQ ? matchedExQ.questionText : "",
      obtainedMarks: eq.finalAwardedMarks ?? eq.aiAwardedMarks ?? 0,
      maxMarks: matchedExQ ? matchedExQ.maximumMarks : eq.maxMarks ?? 0,
      feedback: eq.feedback || "",
    });
  }

  const response = {
    exam: {
      name: exam.title,
      subjectCode: exam.subject ? exam.subject.code : "",
    },
    result: {
      obtainedMarks: evaluation.obtainedMarks,
      totalMarks: evaluation.totalMarks,
      percentage: evaluation.percentage,
      status: "Published",
    },
    questions: questionsList,
  };

  if (evaluation.grade) {
    response.result.grade = evaluation.grade;
  }

  return response;
};

// Retrieve all published results/evaluations for a student
export const getStudentResults = async (studentId) => {
  const student = await User.findById(studentId).lean();
  if (!student) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Student not found");
  }

  // Find all answer sheets for the student
  const submissions = await AnswerSheet.find({ student: studentId, isDeleted: false }).lean();
  const submissionIds = submissions.map(s => s._id);

  // Find all published evaluations for those answer sheets
  const evaluations = await Evaluation.find({
    answerSheet: { $in: submissionIds },
    evaluationStatus: { $in: ["PUBLISHED", "published", "finalized"] },
    isDeleted: false
  }).populate({
    path: "answerSheet",
    populate: { path: "exam", populate: { path: "subject" } }
  }).lean();

  // Map to format required by UI Results page
  return evaluations.map(ev => {
    const exam = ev.answerSheet?.exam;
    const subject = exam?.subject;
    return {
      id: ev._id,
      examId: exam?._id,
      examName: exam?.title || "Exam",
      subjectName: subject?.name || "Subject",
      subjectCode: subject?.code || "",
      finalScore: ev.obtainedMarks,
      totalScore: ev.totalMarks,
      grade: ev.grade || "N/A",
      status: ev.evaluationStatus.toLowerCase() === "published" ? "approved" : "pending",
      date: ev.updatedAt ? new Date(ev.updatedAt).toLocaleDateString() : new Date().toLocaleDateString()
    };
  });
};

export const requestReevaluation = async (studentId, evaluationId) => {
  const evaluation = await Evaluation.findOne({ _id: evaluationId, isDeleted: false })
    .populate("answerSheet");

  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation record not found");
  }

  // Enforce IDOR protection: assert the student owns the answer sheet of this evaluation
  if (evaluation.answerSheet?.student.toString() !== studentId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this answer sheet.");
  }

  // Update status to FACULTY_REVIEW and save
  evaluation.evaluationStatus = "FACULTY_REVIEW";
  await evaluation.save();

  return { message: "Re-evaluation request successfully registered with the faculty head." };
};

export default {
  requestReevaluation,
  getStudentEligibleSubjectIds,
  getExamStatusAndEligibility,
  getStudentExams,
  getStudentExamById,
  getStudentExamEligibility,
  getStudentExamWorkspace,
  startStudentExam,
  autosaveStudentExamAnswer,
  submitStudentExam,
  mapInternalStatusToPipeline,
  getStudentSubmissionStatus,
  getStudentExamResult,
  getStudentResults,
};
