import AnswerSheet from "../models/AnswerSheet.js";
import User from "../models/User.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { ROLES } from "../constants/roles.js";
import Notification from "../models/Notification.js";
import logger from "../utils/logger.js";
import fs from "fs";
import path from "path";

export const createAnswerSheet = async (data, userId) => {
  // Validate student exists
  const student = await User.findOne({ _id: data.student, isDeleted: false, role: ROLES.STUDENT });
  if (!student) {
    throw new ApiError(
      STATUS_CODES.NOT_FOUND,
      "Student reference not found, is inactive, or role is invalid"
    );
  }

  // Validate subject exists
  const subject = await Subject.findOne({ _id: data.subject, isDeleted: false });
  if (!subject) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Subject reference not found or is inactive");
  }

  // Validate exam exists
  const exam = await Exam.findOne({ _id: data.exam, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam reference not found or is inactive");
  }

  const answerSheet = await AnswerSheet.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
  return answerSheet;
};

export const getAnswerSheetById = async (id) => {
  const answerSheet = await AnswerSheet.findOne({ _id: id, isDeleted: false })
    .populate("student", "name email rollNo department semester")
    .populate("subject", "name code semester")
    .populate("exam", "title examType totalMarks duration")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");
  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }
  return answerSheet;
};

export const getAllAnswerSheets = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    sort = "-createdAt",
    student,
    subject,
    exam,
    submissionStatus,
    ...filters
  } = query;

  const mongoQuery = { isDeleted: false };

  if (student) {
    mongoQuery.student = student;
  }

  if (subject) {
    mongoQuery.subject = subject;
  }

  if (exam) {
    mongoQuery.exam = exam;
  }

  if (submissionStatus) {
    mongoQuery.submissionStatus = submissionStatus;
  }

  Object.assign(mongoQuery, filters);

  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Number(limit);

  const total = await AnswerSheet.countDocuments(mongoQuery);
  const data = await AnswerSheet.find(mongoQuery)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate("student", "name email rollNo department semester")
    .populate("subject", "name code semester")
    .populate("exam", "title examType totalMarks duration")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  return {
    data,
    pagination: {
      total,
      page: Number(page),
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

export const updateAnswerSheet = async (id, data, userId) => {
  const answerSheet = await AnswerSheet.findOne({ _id: id, isDeleted: false });
  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }

  if (data.student) {
    const student = await User.findOne({
      _id: data.student,
      isDeleted: false,
      role: ROLES.STUDENT,
    });
    if (!student) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Student reference not found or is invalid");
    }
  }

  if (data.subject) {
    const subject = await Subject.findOne({ _id: data.subject, isDeleted: false });
    if (!subject) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Subject reference not found or is inactive");
    }
  }

  if (data.exam) {
    const exam = await Exam.findOne({ _id: data.exam, isDeleted: false });
    if (!exam) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam reference not found or is inactive");
    }
  }

  Object.assign(answerSheet, data);
  answerSheet.updatedBy = userId;

  await answerSheet.save();
  return answerSheet;
};

export const deleteAnswerSheet = async (id, userId) => {
  const answerSheet = await AnswerSheet.findOne({ _id: id, isDeleted: false });
  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }

  // Verify ownership
  if (answerSheet.facultyId && answerSheet.facultyId.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this answer sheet");
  }

  // Check if safe to delete
  if (answerSheet.processingStatus === "processing") {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      "Cannot delete answer sheet while it is processing"
    );
  }

  // Delete file from local uploads folder
  const filePath = answerSheet.uploadedFileUrl;
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      logger.error(`Failed to delete local file ${filePath}: ${err.message}`);
    }
  }

  // Try calling Python FastAPI OCR service to delete there if possible
  try {
    const uvicornUrl = `http://127.0.0.1:8000/api/v1/faculty/answer-sheets/${id}`;
    await fetch(uvicornUrl, {
      method: "DELETE",
      headers: {
        "X-User-Role": "faculty",
      },
    });
  } catch (err) {
    logger.warn(`Failed to delete answer sheet from Python OCR: ${err.message}`);
  }

  answerSheet.isDeleted = true;
  answerSheet.updatedBy = userId;

  await answerSheet.save();
  return answerSheet;
};

export const getExamAnswerSheets = async (examId, userId, userRole) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // If role is faculty, ensure ownership
  if (userRole === ROLES.FACULTY && exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this exam");
  }

  const sheets = await AnswerSheet.find({ exam: examId, isDeleted: false })
    .populate("student", "name email rollNo department semester")
    .sort("-createdAt")
    .lean();

  const sheetIds = sheets.map((s) => s._id);
  // Import Evaluation model dynamically or check if Evaluation model is already loaded
  const Evaluation = mongoose.model("Evaluation");
  const evaluations = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    isDeleted: false,
  }).lean();

  sheets.forEach((sheet) => {
    const matchingEval = evaluations.find(
      (ev) => ev.answerSheet.toString() === sheet._id.toString()
    );
    if (matchingEval) {
      sheet.evaluation = {
        _id: matchingEval._id,
        obtainedMarks: matchingEval.obtainedMarks,
        totalMarks: matchingEval.totalMarks,
        percentage: matchingEval.percentage,
        evaluationStatus: matchingEval.evaluationStatus,
        grade: matchingEval.grade,
      };
    }
  });

  return sheets;
};

export const retryAnswerSheet = async (answerSheetId, userId) => {
  const answerSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }

  // Verify ownership
  if (answerSheet.facultyId && answerSheet.facultyId.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this answer sheet");
  }

  // Verify it is not already processing
  if (answerSheet.processingStatus === "processing") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Answer sheet is already processing");
  }

  const filePath = answerSheet.uploadedFileUrl;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      "Original file is missing from server storage, please re-upload"
    );
  }

  const fileBuffer = fs.readFileSync(filePath);

  answerSheet.processingStatus = "processing";
  answerSheet.ocrStatus = "processing";
  answerSheet.segmentationStatus = "processing";
  answerSheet.errorMessage = undefined;
  answerSheet.updatedBy = userId;
  await answerSheet.save();

  processAnswerSheetBackground(
    answerSheet._id,
    fileBuffer,
    answerSheet.fileType || "application/pdf",
    answerSheet.uploadedFileName,
    answerSheet.exam,
    answerSheet.student,
    userId
  ).catch((err) =>
    logger.error(`Background OCR Retry failed for sheet ${answerSheet._id}: ${err.message}`)
  );

  return answerSheet;
};

export const uploadAnswerSheets = async (examId, files, studentIdentifier, userId) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  if (exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this exam");
  }

  const results = [];

  for (const file of files) {
    try {
      let identifier = studentIdentifier;
      if (!identifier) {
        const baseName =
          file.originalname.substring(0, file.originalname.lastIndexOf(".")) || file.originalname;
        identifier = baseName.trim();
      }

      let student = await User.findOne({
        $or: [{ email: identifier }, { rollNo: identifier }, { name: identifier }],
        role: ROLES.STUDENT,
        isDeleted: false,
      });

      if (!student) {
        const dummyEmail = `${identifier.replace(/\s+/g, "").toLowerCase()}_${Date.now()}@dummy.student.com`;
        student = await User.create({
          name: identifier,
          email: dummyEmail,
          rollNo: identifier,
          role: ROLES.STUDENT,
          password: "password123",
        });
      }

      let answerSheet = await AnswerSheet.findOne({
        student: student._id,
        exam: examId,
        isDeleted: false,
      });

      if (!answerSheet) {
        answerSheet = await AnswerSheet.create({
          student: student._id,
          subject: exam.subject,
          exam: examId,
          facultyId: userId,
          submissionType: "UPLOAD",
          uploadedFileName: file.originalname,
          uploadedFileUrl: file.path, // Store local uploaded path
          fileType: file.mimetype,
          fileSize: file.size,
          uploadStatus: "Uploaded",
          processingStatus: "uploaded",
          ocrStatus: "pending",
          segmentationStatus: "pending",
          isFinalSubmission: true,
          createdBy: userId,
          updatedBy: userId,
          studentIdentifier: identifier,
        });
      } else {
        answerSheet.uploadedFileName = file.originalname;
        answerSheet.uploadedFileUrl = file.path;
        answerSheet.fileType = file.mimetype;
        answerSheet.fileSize = file.size;
        answerSheet.uploadStatus = "Uploaded";
        answerSheet.processingStatus = "uploaded";
        answerSheet.ocrStatus = "pending";
        answerSheet.segmentationStatus = "pending";
        answerSheet.studentIdentifier = identifier;
        answerSheet.updatedBy = userId;
        await answerSheet.save();
      }

      processAnswerSheetBackground(
        answerSheet._id,
        file.buffer ? file.buffer : fs.readFileSync(file.path),
        file.mimetype,
        file.originalname,
        examId,
        student._id,
        userId
      ).catch((err) =>
        logger.error(`Background OCR failed for sheet ${answerSheet._id}: ${err.message}`)
      );

      results.push({
        filename: file.originalname,
        answerSheetId: answerSheet._id,
        status: "processing",
      });
    } catch (error) {
      logger.error(`Failed to process upload for file ${file.originalname}: ${error.message}`);
      results.push({
        filename: file.originalname,
        error: error.message,
        status: "failed",
      });
    }
  }

  return results;
};

export const processAnswerSheetBackground = async (
  sheetId,
  fileBuffer,
  mimeType,
  originalName,
  examId,
  studentId,
  userId
) => {
  try {
    const answerSheet = await AnswerSheet.findById(sheetId);
    if (!answerSheet) return;

    answerSheet.processingStatus = "processing";
    answerSheet.ocrStatus = "processing";
    answerSheet.segmentationStatus = "processing";
    await answerSheet.save();

    const uvicornUrl = "http://127.0.0.1:8000/api/v1/student/answer-sheets";
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append("file", blob, originalName);
    formData.append("exam_id", examId);
    formData.append("sheet_id", sheetId.toString());

    const response = await fetch(uvicornUrl, {
      method: "POST",
      headers: {
        "X-User-Id": studentId.toString(),
        "X-User-Role": "student",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Uvicorn returned status ${response.status}: ${errorText}`);
    }

    const ocrResult = await response.json();
    if (!ocrResult.success || !ocrResult.data) {
      throw new Error(ocrResult.message || "Failed to process in python service");
    }

    const { pages, digital_answers } = ocrResult.data;

    const exam = await Exam.findById(examId);
    if (!exam) {
      throw new Error("Exam not found during processing map");
    }

    const answers = [];
    const rawTextParts = [];

    if (digital_answers && Array.isArray(digital_answers)) {
      for (const ans of digital_answers) {
        const qNum = parseInt(ans.question_number.replace(/\D/g, ""), 10);
        let questionId = null;
        if (!isNaN(qNum) && qNum > 0 && qNum <= exam.questions.length) {
          questionId = exam.questions[qNum - 1]._id;
        } else {
          continue;
        }

        answers.push({
          questionId,
          handwrittenData: "",
          recognizedText: ans.text,
          hwrStatus: "Completed",
          submissionTime: new Date(),
        });

        rawTextParts.push(`Q${ans.question_number}: ${ans.text}`);
      }
    }

    const mappedPages = [];
    if (pages && Array.isArray(pages)) {
      for (const p of pages) {
        mappedPages.push({
          pageNumber: p.page_number,
          originalFileReference: p.original_file_reference,
          processedFileReference: p.processed_file_reference,
          width: p.width,
          height: p.height,
          processingStatus: p.processing_status,
        });
      }
    }

    answerSheet.answers = answers;
    answerSheet.pages = mappedPages;
    answerSheet.extractedText = rawTextParts.join("\n\n");
    answerSheet.processingStatus = "completed";
    answerSheet.ocrStatus = "completed";
    answerSheet.segmentationStatus = "completed";
    answerSheet.uploadStatus = "HWR Processing";
    answerSheet.submissionStatus = "Pending AI Evaluation";
    answerSheet.errorMessage = undefined;
    answerSheet.updatedBy = userId;

    await answerSheet.save();
    logger.info(`Background OCR completed successfully for AnswerSheet ${sheetId}`);
  } catch (error) {
    logger.error(`Background OCR pipeline failed for AnswerSheet ${sheetId}: ${error.message}`);
    try {
      await AnswerSheet.findByIdAndUpdate(sheetId, {
        processingStatus: "failed",
        ocrStatus: "failed",
        segmentationStatus: "failed",
        uploadStatus: "Failed",
        errorMessage: error.message,
      });
    } catch (dbErr) {
      logger.error(`Failed to save error status for AnswerSheet ${sheetId}: ${dbErr.message}`);
    }
  }
};

export const startExam = async (examId, userId) => {
  // Validate student exists
  const student = await User.findOne({ _id: userId, isDeleted: false, role: ROLES.STUDENT });
  if (!student) {
    throw new ApiError(
      STATUS_CODES.NOT_FOUND,
      "Student reference not found, is inactive, or role is invalid"
    );
  }

  // Validate exam exists
  const exam = await Exam.findOne({ _id: examId, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam reference not found or is inactive");
  }

  // Verify exam is published
  if (!exam.isPublished) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Exam is not published yet");
  }

  // Verify exam timing (if startTime/endTime are defined)
  const now = new Date();
  if (exam.startTime && now < exam.startTime) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Exam has not started yet");
  }
  if (exam.endTime && now > exam.endTime && !exam.allowLateSubmission) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Exam submission time has expired");
  }

  // Check if an AnswerSheet for this student and exam already exists
  let answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  });

  if (answerSheet) {
    // If it exists but is already submitted/completed/evaluated/published, student cannot restart/resume/edit
    if (
      ["Submitted", "Pending AI Evaluation", "Faculty Review", "Published", "Completed"].includes(
        answerSheet.submissionStatus
      )
    ) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, "Exam has already been submitted");
    }

    // Student resumes existing session
    answerSheet.submissionStatus = "Started";
    await answerSheet.save();
    logger.info(`Student ${userId} resumed exam ${examId}`);
    return answerSheet;
  }

  // Create empty answers array based on the exam questions
  const answers = exam.questions.map((q) => ({
    questionId: q._id,
    handwrittenData: "",
    recognizedText: "",
    hwrStatus: "Pending",
    submissionTime: new Date(),
  }));

  answerSheet = await AnswerSheet.create({
    student: userId,
    subject: exam.subject,
    exam: examId,
    submissionStatus: "Started",
    answers,
    totalQuestions: exam.questions.length,
    createdBy: userId,
    updatedBy: userId,
  });

  // Track event audit log
  logger.info(`Student ${userId} started exam ${examId}`);

  // Create notification for student
  await Notification.create({
    user: userId,
    title: "Exam Started",
    message: `You have successfully started the exam "${exam.title}". All the best!`,
    type: "Exam Started",
    createdBy: userId,
    updatedBy: userId,
  });

  return answerSheet;
};

export const autoSaveAnswer = async (examId, answerData, userId) => {
  const answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  });

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam session not found");
  }

  if (
    ["Submitted", "Pending AI Evaluation", "Faculty Review", "Published", "Completed"].includes(
      answerSheet.submissionStatus
    )
  ) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Cannot modify answers after final submission");
  }

  const { questionId, handwrittenData, recognizedText, deviceInfo } = answerData;

  const answerIndex = answerSheet.answers.findIndex(
    (ans) => ans.questionId.toString() === questionId
  );

  if (answerIndex > -1) {
    if (handwrittenData !== undefined) {
      answerSheet.answers[answerIndex].handwrittenData = handwrittenData;
    }
    if (recognizedText !== undefined) {
      answerSheet.answers[answerIndex].recognizedText = recognizedText;
    }
    answerSheet.answers[answerIndex].submissionTime = new Date();
    answerSheet.answers[answerIndex].hwrStatus = "Pending";
  } else {
    answerSheet.answers.push({
      questionId,
      handwrittenData: handwrittenData || "",
      recognizedText: recognizedText || "",
      hwrStatus: "Pending",
      submissionTime: new Date(),
    });
  }

  answerSheet.submissionStatus = "Auto Saving";
  answerSheet.lastSavedAt = new Date();
  if (deviceInfo) {
    answerSheet.deviceInfo = deviceInfo;
  }
  answerSheet.updatedBy = userId;

  await answerSheet.save();
  return answerSheet;
};

export const submitExam = async (examId, userId) => {
  const answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  }).populate("exam", "title createdBy");

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer session not found");
  }

  if (
    ["Submitted", "Pending AI Evaluation", "Faculty Review", "Published", "Completed"].includes(
      answerSheet.submissionStatus
    )
  ) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Exam has already been submitted");
  }

  answerSheet.submissionStatus = "Submitted";
  answerSheet.submittedAt = new Date();
  answerSheet.updatedBy = userId;

  await answerSheet.save();

  logger.info(`Student ${userId} submitted exam ${examId}`);

  // Create notifications
  // 1. Notify Student
  await Notification.create({
    user: userId,
    title: "Exam Submitted",
    message: `Your exam "${answerSheet.exam.title}" was submitted successfully.`,
    type: "Exam Submitted",
    createdBy: userId,
    updatedBy: userId,
  });

  // 2. Notify Faculty Creator
  if (answerSheet.exam.createdBy) {
    await Notification.create({
      user: answerSheet.exam.createdBy,
      title: "New Exam Submission",
      message: `A student has submitted answers for "${answerSheet.exam.title}". Review is pending.`,
      type: "Faculty Review Pending",
      createdBy: userId,
      updatedBy: userId,
    });
  }

  return answerSheet;
};

export const getSubmissionStatus = async (examId, userId) => {
  const answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  })
    .populate("student", "name email rollNo department semester")
    .populate("subject", "name code semester")
    .populate("exam", "title examType totalMarks duration startTime endTime isPublished");

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found for this student and exam");
  }

  return {
    submissionStatus: answerSheet.submissionStatus,
    submittedAt: answerSheet.submittedAt,
    totalQuestions: answerSheet.totalQuestions,
    answersCount: answerSheet.answers.length,
  };
};

export const getReviewStatus = async (examId, userId) => {
  const answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  });

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "No exam session found");
  }

  const reviewQuestions = answerSheet.answers.map((ans) => {
    const hasData = !!(ans.handwrittenData || ans.recognizedText);
    return {
      questionId: ans.questionId,
      status: hasData ? "Answered" : "Not Answered",
      lastSavedAt: ans.submissionTime,
    };
  });

  return {
    submissionStatus: answerSheet.submissionStatus,
    lastSavedAt: answerSheet.lastSavedAt,
    reviewQuestions,
  };
};

export default {
  createAnswerSheet,
  getAnswerSheetById,
  getAllAnswerSheets,
  updateAnswerSheet,
  deleteAnswerSheet,
  startExam,
  autoSaveAnswer,
  submitExam,
  getSubmissionStatus,
  getReviewStatus,
};
