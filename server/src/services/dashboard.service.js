import User from "../models/User.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import Notification from "../models/Notification.js";
import Subject from "../models/Subject.js";
import { ROLES } from "../constants/roles.js";
import { getStudentEligibleSubjectIds, getExamStatusAndEligibility, mapInternalStatusToPipeline } from "./studentExam.service.js";

export const getStudentDashboard = async (studentId) => {
  const now = new Date();

  // 1. Fetch student info
  const student = await User.findById(studentId).lean();

  // 2. Determine eligible subjects dynamically
  const eligibleSubjectIds = await getStudentEligibleSubjectIds(student);
  const subjectMatch = { $in: eligibleSubjectIds };

  // 3. Upcoming & Active Candidate Exams
  const candidateExams = await Exam.find({
    isPublished: true,
    isDeleted: false,
    examStatus: { $in: ["Active", "Published"] },
    subject: subjectMatch,
  }).populate("subject", "name code").lean();

  // 4. Student submissions (answer sheets)
  const studentSubmissions = await AnswerSheet.find({
    student: studentId,
    isDeleted: false,
  }).lean();

  const studentSubmissionIds = studentSubmissions.map(s => s._id);
  const evaluations = await Evaluation.find({
    answerSheet: { $in: studentSubmissionIds },
    isDeleted: false,
  }).lean();

  const activeExamsList = [];
  const upcomingExamsList = [];

  for (const exam of candidateExams) {
    const submission = studentSubmissions.find(s => s.exam.toString() === exam._id.toString());
    const evaluation = submission ? evaluations.find(ev => ev.answerSheet.toString() === submission._id.toString()) : null;

    const { status: resolvedStatus, canEnter, reason, startTime, endTime } = getExamStatusAndEligibility(exam, submission, evaluation, now);

    const subStatus = submission ? submission.submissionStatus : "not_started";
    let normStatus = "not_started";
    if (["Submitted", "Pending AI Evaluation", "Faculty Review", "Published", "Completed"].includes(subStatus)) {
      normStatus = "submitted";
    } else if (["Started", "Auto Saving"].includes(subStatus)) {
      normStatus = "in_progress";
    }

    if (resolvedStatus === "active" || resolvedStatus === "in_progress") {
      activeExamsList.push({
        ...exam,
        submissionStatus: normStatus,
      });
    } else if (resolvedStatus === "upcoming") {
      upcomingExamsList.push(exam);
    }
  }

  // 5. Completed Exams Count (any exam with a meaningful submission)
  const completedExams = studentSubmissions.filter(sheet => {
    const status = sheet.submissionStatus || "";
    return !["Draft", "Pending", "Started", "Auto Saving"].includes(status);
  });

  // 6. Average Marks (published finalized results only)
  const studentAnswerSheetIds = studentSubmissions.map(s => s._id);
  const publishedEvaluations = await Evaluation.find({
    answerSheet: { $in: studentAnswerSheetIds },
    isDeleted: false,
    evaluationStatus: { $in: ["PUBLISHED", "published", "finalized"] },
  }).lean();

  let averageMarks = null;
  if (publishedEvaluations.length > 0) {
    const totalPercentage = publishedEvaluations.reduce((sum, ev) => sum + (ev.percentage || 0), 0);
    averageMarks = Math.round((totalPercentage / publishedEvaluations.length) * 10) / 10;
  }

  // 7. Active Exam Gate (first active exam, mapped fields only)
  let activeExam = null;
  if (activeExamsList.length > 0) {
    const firstActive = activeExamsList[0];
    const examDate = firstActive.examDate ? new Date(firstActive.examDate) : null;
    const start = firstActive.startTime ? new Date(firstActive.startTime) : examDate;
    const end = firstActive.endTime ? new Date(firstActive.endTime) : (start ? new Date(start.getTime() + (firstActive.duration || 60) * 60 * 1000) : null);

    activeExam = {
      id: firstActive._id,
      title: firstActive.title,
      subject: firstActive.subject ? firstActive.subject.name : "",
      subjectCode: firstActive.subject ? firstActive.subject.code : "",
      startTime: start,
      endTime: end,
      duration: firstActive.duration,
      status: "active",
      submissionStatus: firstActive.submissionStatus,
    };
  }

  // 8. Latest Published Result (most recently published evaluation details)
  const latestPublishedEvaluation = await Evaluation.findOne({
    answerSheet: { $in: studentAnswerSheetIds },
    isDeleted: false,
    evaluationStatus: { $in: ["PUBLISHED", "published", "finalized"] },
  })
    .populate({
      path: "answerSheet",
      populate: [
        { path: "exam", select: "title totalMarks" },
        { path: "subject", select: "code" }
      ]
    })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  let latestResult = null;
  if (latestPublishedEvaluation && latestPublishedEvaluation.answerSheet && latestPublishedEvaluation.answerSheet.exam) {
    const sheet = latestPublishedEvaluation.answerSheet;
    const exam = sheet.exam;
    const subCode = sheet.subject ? sheet.subject.code : "";

    latestResult = {
      id: latestPublishedEvaluation._id,
      examId: exam._id,
      examTitle: exam.title,
      subjectCode: subCode,
      marksObtained: latestPublishedEvaluation.obtainedMarks,
      totalMarks: latestPublishedEvaluation.totalMarks,
      percentage: latestPublishedEvaluation.percentage,
      grade: latestPublishedEvaluation.grade || "",
      publishedAt: latestPublishedEvaluation.updatedAt || latestPublishedEvaluation.createdAt,
    };
  }

  // 9. Dynamic AI Grading Pipeline (latest response state)
  const latestSubmission = studentSubmissions.length > 0 ? studentSubmissions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] : null;

  let pipeline = {
    submissionId: null,
    status: "idle",
    currentStage: null,
    progress: 0,
  };

  if (latestSubmission) {
    const submissionEvaluation = await Evaluation.findOne({
      answerSheet: latestSubmission._id,
      isDeleted: false,
    }).lean();

    const pipelineData = mapInternalStatusToPipeline(latestSubmission, submissionEvaluation);
    pipeline = {
      submissionId: latestSubmission._id,
      status: pipelineData.status,
      currentStage: pipelineData.stage,
      progress: pipelineData.progress,
    };
  }

  return {
    activeExams: activeExamsList.length,
    upcomingExams: upcomingExamsList.length,
    completedExams: completedExams.length,
    averageMarks,
    activeExam,
    latestResult,
    pipeline,
  };
};

export const getFacultyDashboard = async (facultyId) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // 1. Subjects owned by this faculty
  const facultySubjects = await Subject.find({ faculty: facultyId, isDeleted: false });
  const subjectIds = facultySubjects.map((s) => s._id);

  // 2. Exams created by or matching subjects of this faculty
  const facultyExams = await Exam.find({
    $or: [{ createdBy: facultyId }, { subject: { $in: subjectIds } }],
    isDeleted: false,
  });
  const examIds = facultyExams.map((e) => e._id);

  // 3. Today's Exams created by this faculty
  const todaysExams = await Exam.find({
    createdBy: facultyId,
    examDate: { $gte: todayStart, $lte: todayEnd },
    isDeleted: false,
  }).populate("subject", "name code");

  // 4. Statistics Counts
  const totalSubjects = facultySubjects.length;
  const totalExams = facultyExams.length;
  const totalAnswerSheets = await AnswerSheet.countDocuments({
    exam: { $in: examIds },
    isDeleted: false,
  });

  const pendingEvaluations = await AnswerSheet.countDocuments({
    exam: { $in: examIds },
    submissionStatus: { $in: ["Submitted", "Pending AI Evaluation", "Faculty Review"] },
    isDeleted: false,
  });

  const completedEvaluations = await AnswerSheet.countDocuments({
    exam: { $in: examIds },
    submissionStatus: "Published",
    isDeleted: false,
  });

  // 5. Query evaluations for charts & calculations
  const evaluations = await Evaluation.find({
    answerSheet: {
      $in: await AnswerSheet.find({ exam: { $in: examIds }, isDeleted: false }).distinct("_id"),
    },
    isDeleted: false,
  }).populate({
    path: "answerSheet",
    populate: { path: "exam", select: "title" },
  });

  const distribution = [
    { label: "<40%", amt: 0, color: "bg-red-500" },
    { label: "40-60%", amt: 0, color: "bg-amber-500" },
    { label: "60-80%", amt: 0, color: "bg-primary" },
    { label: "80-100%", amt: 0, color: "bg-green-600" },
  ];

  let totalPercentageSum = 0;
  let publishedEvaluationCount = 0;
  let discrepancyFlags = 0;

  evaluations.forEach((ev) => {
    if (ev.evaluationStatus === "PUBLISHED") {
      totalPercentageSum += ev.percentage || 0;
      publishedEvaluationCount++;

      const pct = ev.percentage || 0;
      if (pct < 40) distribution[0].amt++;
      else if (pct < 60) distribution[1].amt++;
      else if (pct < 80) distribution[2].amt++;
      else distribution[3].amt++;
    }
    if (ev.evaluationStatus === "FACULTY_REVIEW") {
      discrepancyFlags++;
    }
  });

  const averageClassMarks =
    publishedEvaluationCount > 0 ? (totalPercentageSum / publishedEvaluationCount).toFixed(1) : "0";

  // 6. Recent Submissions
  const recentSubmissions = await AnswerSheet.find({
    exam: { $in: examIds },
    isDeleted: false,
  })
    .populate("student", "name email rollNo")
    .populate("exam", "title")
    .populate("subject", "name code")
    .sort("-createdAt")
    .limit(10);

  // 7. Dynamic Recent Activity compile
  const recentActivity = [];

  recentSubmissions.forEach((sheet) => {
    recentActivity.push({
      type: "answer_sheet_uploaded",
      message: `Answer sheet uploaded by ${sheet.student?.name || "Student"} for "${sheet.exam?.title || "Exam"}"`,
      createdAt: sheet.createdAt,
    });
  });

  evaluations.forEach((ev) => {
    if (ev.evaluationStatus === "PUBLISHED") {
      recentActivity.push({
        type: "evaluation_completed",
        message: `Evaluation published for exam "${ev.answerSheet?.exam?.title || "Exam"}"`,
        createdAt: ev.updatedAt || ev.createdAt,
      });
    } else if (ev.evaluationStatus === "FACULTY_REVIEW") {
      recentActivity.push({
        type: "evaluation_started",
        message: `Manual review pending for exam "${ev.answerSheet?.exam?.title || "Exam"}"`,
        createdAt: ev.updatedAt || ev.createdAt,
      });
    }
  });

  // Sort activity by date newest first and limit to 5
  recentActivity.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const finalRecentActivity = recentActivity.slice(0, 5);

  return {
    statistics: {
      totalSubjects,
      totalExams,
      totalAnswerSheets,
      pendingEvaluations,
      completedEvaluations,
      discrepancyFlags,
      averageClassMarks,
    },
    todaysExamsCount: todaysExams.length,
    todaysExams,
    recentSubmissions: recentSubmissions.slice(0, 5),
    recentActivity: finalRecentActivity,
    chartData: {
      markDistribution: distribution,
    },
  };
};

export const getAdminDashboard = async () => {
  const totalStudents = await User.countDocuments({ role: ROLES.STUDENT, isDeleted: false });
  const totalFaculty = await User.countDocuments({ role: ROLES.FACULTY, isDeleted: false });

  const totalExams = await Exam.countDocuments({ isDeleted: false });
  const totalSubjects = await Subject.countDocuments({ isDeleted: false });

  const activeExamsCount = await Exam.countDocuments({ examStatus: "Active", isDeleted: false });
  const completedExamsCount = await Exam.countDocuments({
    examStatus: "Completed",
    isDeleted: false,
  });

  return {
    summary: {
      totalStudents,
      totalFaculty,
      totalExams,
      totalSubjects,
      activeExamsCount,
      completedExamsCount,
    },
    systemStatistics: {
      activeExams: await Exam.find({ examStatus: "Active", isDeleted: false })
        .populate("subject", "name code")
        .populate("createdBy", "name email")
        .limit(5),
      recentUsers: await User.find({ isDeleted: false })
        .select("name email role createdAt")
        .sort("-createdAt")
        .limit(10),
    },
  };
};

export default {
  getStudentDashboard,
  getFacultyDashboard,
  getAdminDashboard,
};
