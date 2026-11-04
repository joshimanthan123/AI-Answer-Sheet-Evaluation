import mongoose from "mongoose";
import Exam from "../models/Exam.js";
import Subject from "../models/Subject.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { ROLES } from "../constants/roles.js";

/**
 * Ensures user has authorization to access analytics for the exam.
 */
const verifyExamAccess = async (examId, userId, userRole) => {
  if (userRole !== ROLES.FACULTY && userRole !== ROLES.ADMIN) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. Student role is not authorized to access analytics.");
  }
  const exam = await Exam.findOne({ _id: examId, isDeleted: { $ne: true } }).populate(
    "subject",
    "name code semester faculty"
  );
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam layout not found");
  }
  if (userRole === ROLES.FACULTY && exam.createdBy && exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not have permission to access analytics for this exam.");
  }
  return exam;
};

/**
 * Resolves passing rule configuration for an exam.
 */
const resolvePassingRule = (exam) => {
  if (exam.passingMarks !== undefined && exam.passingMarks !== null && !isNaN(exam.passingMarks)) {
    return { hasPassingRule: true, passingMarks: Number(exam.passingMarks) };
  }
  if (
    exam.passingPercentage !== undefined &&
    exam.passingPercentage !== null &&
    !isNaN(exam.passingPercentage)
  ) {
    const marks = Math.round((Number(exam.totalMarks) * Number(exam.passingPercentage)) / 100);
    return { hasPassingRule: true, passingMarks: marks };
  }
  return { hasPassingRule: false, passingMarks: null };
};

/**
 * Returns list of accessible exams for dropdown selection.
 */
export const getAccessibleExams = async (userId, userRole) => {
  const query = { isDeleted: { $ne: true } };
  if (userRole === ROLES.FACULTY) {
    query.createdBy = userId;
  }

  const exams = await Exam.find(query)
    .populate("subject", "name code")
    .sort({ createdAt: -1 })
    .lean();

  return exams.map((e) => ({
    id: e._id.toString(),
    _id: e._id.toString(),
    title: e.title,
    examCode: e.examCode || e.code || "",
    subjectName: e.subject?.name || e.subjectName || "",
    subjectCode: e.subject?.code || e.subjectCode || "",
    totalMarks: e.totalMarks,
    passingMarks: e.passingMarks,
    examDate: e.examDate,
    status: e.examStatus || "Active",
  }));
};

/**
 * Returns overview summary cards data.
 */
export const getExamOverviewAnalytics = async (examId, userId, userRole) => {
  const exam = await verifyExamAccess(examId, userId, userRole);
  const { hasPassingRule, passingMarks } = resolvePassingRule(exam);

  const sheets = await AnswerSheet.find({ exam: examId, isDeleted: { $ne: true } }).lean();
  const sheetIds = sheets.map((s) => s._id);

  const allEvals = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    isDeleted: { $ne: true },
  }).lean();

  const totalStudents = sheets.length;
  const finalized = allEvals.filter((e) => e.evaluationStatus === "finalized");
  const finalizedCount = finalized.length;
  const pendingCount = totalStudents - finalizedCount;

  let averageFinalMarks = 0;
  let averagePercentage = 0;
  let highestFinalMarks = 0;
  let lowestFinalMarks = 0;

  if (finalizedCount > 0) {
    let sumMarks = 0;
    let sumPercent = 0;
    highestFinalMarks = -Infinity;
    lowestFinalMarks = Infinity;

    finalized.forEach((e) => {
      const marks = e.obtainedMarks || 0;
      const percent = e.percentage || 0;
      sumMarks += marks;
      sumPercent += percent;

      if (marks > highestFinalMarks) highestFinalMarks = marks;
      if (marks < lowestFinalMarks) lowestFinalMarks = marks;
    });

    averageFinalMarks = parseFloat((sumMarks / finalizedCount).toFixed(2));
    averagePercentage = parseFloat((sumPercent / finalizedCount).toFixed(2));
    if (lowestFinalMarks === Infinity) lowestFinalMarks = 0;
    if (highestFinalMarks === -Infinity) highestFinalMarks = 0;
  }

  return {
    examId: exam._id.toString(),
    examTitle: exam.title,
    totalMarks: exam.totalMarks,
    totalStudents,
    finalizedStudents: finalizedCount,
    pendingEvaluations: pendingCount,
    averageFinalMarks,
    averagePercentage,
    highestFinalMarks,
    lowestFinalMarks,
    hasPassingRule,
    passingMarks,
  };
};

/**
 * Returns student performance distribution and sortable table data.
 */
export const getStudentPerformanceAnalytics = async (examId, query = {}, userId, userRole) => {
  const exam = await verifyExamAccess(examId, userId, userRole);
  const { hasPassingRule, passingMarks } = resolvePassingRule(exam);

  const { search = "", status = "", sortBy = "obtainedMarks", order = "desc" } = query;

  const sheets = await AnswerSheet.find({ exam: examId, isDeleted: { $ne: true } })
    .populate("student", "name email rollNo")
    .lean();

  const sheetIds = sheets.map((s) => s._id);

  const evals = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    isDeleted: { $ne: true },
  })
    .populate({
      path: "answerSheet",
      populate: { path: "student", select: "name email rollNo" },
    })
    .lean();

  const evalMap = new Map();
  evals.forEach((e) => {
    if (e.answerSheet) {
      evalMap.set(e.answerSheet._id.toString(), e);
    }
  });

  const performanceList = [];
  const distribution = {
    "0-20%": 0,
    "21-40%": 0,
    "41-60%": 0,
    "61-80%": 0,
    "81-100%": 0,
  };

  let passCount = 0;
  let failCount = 0;

  sheets.forEach((sheet) => {
    const student = sheet.student;
    const e = evalMap.get(sheet._id.toString());
    const isFinalized = e?.evaluationStatus === "finalized";

    const studentIdentifier =
      sheet.studentIdentifier || student?.rollNo || student?.name || "Unknown Candidate";
    const studentName = student?.name || "Unknown Candidate";

    const obtainedMarks = isFinalized ? (e.obtainedMarks || 0) : 0;
    const totalMarks = e?.totalMarks || exam.totalMarks;
    const percentage = isFinalized ? (e.percentage || 0) : 0;

    let resultStatus = "Pending";
    if (isFinalized) {
      if (hasPassingRule && passingMarks !== null) {
        if (obtainedMarks >= passingMarks) {
          resultStatus = "PASS";
          passCount++;
        } else {
          resultStatus = "FAIL";
          failCount++;
        }
      } else {
        resultStatus = "Finalized";
      }

      // Add to distribution chart calculation
      if (percentage <= 20) distribution["0-20%"]++;
      else if (percentage <= 40) distribution["21-40%"]++;
      else if (percentage <= 60) distribution["41-60%"]++;
      else if (percentage <= 80) distribution["61-80%"]++;
      else distribution["81-100%"]++;
    }

    performanceList.push({
      evaluationId: e?._id?.toString() || null,
      answerSheetId: sheet._id.toString(),
      studentIdentifier,
      studentName,
      obtainedMarks,
      totalMarks,
      percentage,
      status: isFinalized ? "Finalized" : "Pending",
      isFinalized,
      resultStatus,
      submittedAt: sheet.submittedAt || sheet.createdAt,
    });
  });

  // Apply search filter
  let filtered = performanceList;
  if (search) {
    const rx = new RegExp(search, "i");
    filtered = filtered.filter(
      (item) => rx.test(item.studentIdentifier) || rx.test(item.studentName)
    );
  }

  // Apply status filter
  if (status) {
    if (status === "finalized") {
      filtered = filtered.filter((item) => item.isFinalized);
    } else if (status === "pending") {
      filtered = filtered.filter((item) => !item.isFinalized);
    } else if (status === "pass" && hasPassingRule) {
      filtered = filtered.filter((item) => item.resultStatus === "PASS");
    } else if (status === "fail" && hasPassingRule) {
      filtered = filtered.filter((item) => item.resultStatus === "FAIL");
    }
  }

  // Apply sorting
  const dir = order === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    if (sortBy === "obtainedMarks" || sortBy === "finalMarks") {
      return (a.obtainedMarks - b.obtainedMarks) * dir;
    }
    if (sortBy === "percentage") {
      return (a.percentage - b.percentage) * dir;
    }
    if (sortBy === "studentName" || sortBy === "student") {
      return a.studentName.localeCompare(b.studentName) * dir;
    }
    return 0;
  });

  const finalizedCount = performanceList.filter((p) => p.isFinalized).length;

  return {
    examId: exam._id.toString(),
    distribution,
    passFailAnalytics: {
      hasPassingRule,
      passingMarks,
      passCount,
      failCount,
      passPercentage:
        hasPassingRule && finalizedCount > 0
          ? parseFloat(((passCount / finalizedCount) * 100).toFixed(2))
          : 0,
      message: hasPassingRule
        ? null
        : "Pass/fail analytics unavailable because no passing threshold is configured.",
    },
    students: filtered,
    totalCount: filtered.length,
  };
};

/**
 * Returns question-wise performance table, chart, and difficulty indicator.
 */
export const getQuestionPerformanceAnalytics = async (examId, userId, userRole) => {
  const exam = await verifyExamAccess(examId, userId, userRole);

  const sheets = await AnswerSheet.find({ exam: examId, isDeleted: { $ne: true } }).lean();
  const sheetIds = sheets.map((s) => s._id);

  const finalizedEvals = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    evaluationStatus: "finalized",
    isDeleted: { $ne: true },
  }).lean();

  const questionsList = exam.questions || [];
  const questionAnalytics = [];

  questionsList.forEach((q) => {
    const qid = q._id.toString();
    const finalScores = [];
    const aiScores = [];
    let overriddenCount = 0;

    finalizedEvals.forEach((e) => {
      const evalQuestions = (e.questionScores && e.questionScores.length > 0) ? e.questionScores : (e.questions || []);
      const eq = evalQuestions.find((line) => line.questionId && line.questionId.toString() === qid);
      if (eq) {
        const aiScoreVal = eq.aiMarks !== undefined ? eq.aiMarks : (eq.aiAwardedMarks || 0);
        const finalScoreVal =
          eq.finalMarks !== undefined && eq.finalMarks !== null
            ? eq.finalMarks
            : (eq.finalAwardedMarks !== undefined && eq.finalAwardedMarks !== null
              ? eq.finalAwardedMarks
              : aiScoreVal);

        aiScores.push(aiScoreVal);
        finalScores.push(finalScoreVal);

        if (eq.isOverridden || eq.wasOverridden || eq.reviewType === "overridden") {
          overriddenCount++;
        }
      }
    });

    const maxMarks = q.maximumMarks || q.maxMarks || 0;
    let averageMarks = 0;
    let aiAverageMarks = 0;
    let averagePercentage = 0;
    let highestMarks = 0;
    let lowestMarks = 0;

    if (finalScores.length > 0) {
      const totalScore = finalScores.reduce((s, val) => s + val, 0);
      const totalAiScore = aiScores.reduce((s, val) => s + val, 0);

      averageMarks = parseFloat((totalScore / finalScores.length).toFixed(2));
      aiAverageMarks = parseFloat((totalAiScore / aiScores.length).toFixed(2));

      averagePercentage =
        maxMarks > 0 ? parseFloat(((averageMarks / maxMarks) * 100).toFixed(2)) : 0;
      highestMarks = Math.max(...finalScores);
      lowestMarks = Math.min(...finalScores);
    }

    // Descriptive wording for observed performance (as strictly required)
    let observedPerformanceLabel = "Moderate observed performance";
    if (averagePercentage >= 80) {
      observedPerformanceLabel = "Higher observed performance";
    } else if (averagePercentage < 60) {
      observedPerformanceLabel = "Lower observed performance";
    }

    questionAnalytics.push({
      questionId: qid,
      questionNumber: q.questionNumber,
      questionText: q.questionText || "",
      maxMarks,
      averageMarks,
      aiAverageMarks,
      averagePercentage,
      highestMarks,
      lowestMarks,
      finalizedAnswers: finalScores.length,
      overriddenCount,
      observedPerformanceLabel,
    });
  });

  const lowerPerformingQuestions = questionAnalytics
    .filter((q) => q.averagePercentage < 60)
    .map((q) => ({
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      averagePercentage: q.averagePercentage,
      averageMarks: q.averageMarks,
      maxMarks: q.maxMarks,
    }));

  return {
    examId: exam._id.toString(),
    totalQuestions: questionsList.length,
    finalizedCount: finalizedEvals.length,
    questions: questionAnalytics,
    lowerPerformingQuestions,
  };
};

/**
 * Returns mark distribution counts and pass/fail statistics for GET /api/analytics/exam/:examId/distribution
 */
export const getExamDistributionAnalytics = async (examId, userId, userRole) => {
  const studentPerformance = await getStudentPerformanceAnalytics(examId, {}, userId, userRole);
  return {
    examId: studentPerformance.examId,
    distribution: studentPerformance.distribution,
    passFailAnalytics: studentPerformance.passFailAnalytics,
  };
};

/**
 * Returns authenticated student's overall performance metrics.
 * GET /api/analytics/student/me
 */
export const getStudentMeAnalytics = async (studentId) => {
  const studentObjId = new mongoose.Types.ObjectId(studentId);

  // Find all answer sheets for this student with published / finalized evaluations
  const sheets = await AnswerSheet.find({
    student: studentObjId,
    isDeleted: { $ne: true },
  })
    .populate("exam", "title examDate totalMarks passingMarks")
    .populate("subject", "name code")
    .lean();

  const sheetIds = sheets.map((s) => s._id);

  const evals = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    evaluationStatus: { $in: ["finalized", "PUBLISHED", "completed"] },
    isDeleted: { $ne: true },
  }).lean();

  if (evals.length === 0) {
    return {
      totalExams: 0,
      averagePercentage: 0,
      highestPercentage: 0,
      lowestPercentage: 0,
      hasResults: false,
    };
  }

  let totalPctSum = 0;
  let highestPct = -Infinity;
  let lowestPct = Infinity;

  evals.forEach((e) => {
    const pct = e.percentage || 0;
    totalPctSum += pct;
    if (pct > highestPct) highestPct = pct;
    if (pct < lowestPct) lowestPct = pct;
  });

  const count = evals.length;
  const avgPct = parseFloat((totalPctSum / count).toFixed(1));
  if (highestPct === -Infinity) highestPct = 0;
  if (lowestPct === Infinity) lowestPct = 0;

  return {
    totalExams: count,
    averagePercentage: avgPct,
    highestPercentage: parseFloat(highestPct.toFixed(1)),
    lowestPercentage: parseFloat(lowestPct.toFixed(1)),
    hasResults: true,
  };
};

/**
 * Returns authenticated student's historical performance trend over time.
 * GET /api/analytics/student/me/trends
 */
export const getStudentMeTrends = async (studentId) => {
  const studentObjId = new mongoose.Types.ObjectId(studentId);

  const sheets = await AnswerSheet.find({
    student: studentObjId,
    isDeleted: { $ne: true },
  })
    .populate("exam", "title examDate totalMarks passingMarks examCode code")
    .populate("subject", "name code")
    .lean();

  const sheetIds = sheets.map((s) => s._id);

  const evals = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    evaluationStatus: { $in: ["finalized", "PUBLISHED", "completed"] },
    isDeleted: { $ne: true },
  })
    .populate({
      path: "answerSheet",
      populate: [
        { path: "exam", select: "title examDate totalMarks passingMarks code" },
        { path: "subject", select: "name code" },
      ],
    })
    .lean();

  const trends = evals.map((e) => {
    const sheet = e.answerSheet || {};
    const exam = sheet.exam || {};
    const subject = sheet.subject || {};

    const obtainedMarks = e.obtainedMarks || 0;
    const totalMarks = e.totalMarks || exam.totalMarks || 100;
    const percentage = e.percentage !== undefined ? e.percentage : parseFloat(((obtainedMarks / totalMarks) * 100).toFixed(1));

    return {
      evaluationId: e._id.toString(),
      answerSheetId: sheet._id ? sheet._id.toString() : null,
      examId: exam._id ? exam._id.toString() : null,
      examTitle: exam.title || "Exam",
      subjectName: subject.name || "Subject",
      subjectCode: subject.code || "",
      examDate: exam.examDate || e.createdAt,
      obtainedMarks,
      totalMarks,
      percentage: parseFloat(Number(percentage).toFixed(1)),
      grade: e.grade || "N/A",
      publishedAt: e.publishedAt || e.finalizedAt || e.updatedAt,
    };
  });

  // Sort chronologically by examDate
  trends.sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());

  return trends;
};

/**
 * Returns authenticated student's question-wise performance for a selected exam.
 * GET /api/analytics/student/me/exam/:examId
 */
export const getStudentMeExamDetails = async (studentId, examId) => {
  const studentObjId = new mongoose.Types.ObjectId(studentId);
  const examObjId = new mongoose.Types.ObjectId(examId);

  const sheet = await AnswerSheet.findOne({
    student: studentObjId,
    exam: examObjId,
    isDeleted: { $ne: true },
  })
    .populate("exam", "title examDate totalMarks questions")
    .populate("subject", "name code")
    .lean();

  if (!sheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "No evaluation submission found for this exam.");
  }

  const evaluation = await Evaluation.findOne({
    answerSheet: sheet._id,
    evaluationStatus: { $in: ["finalized", "PUBLISHED", "completed"] },
    isDeleted: { $ne: true },
  }).lean();

  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation results for this exam are not published yet.");
  }

  const questionsMap = new Map();
  if (sheet.exam && Array.isArray(sheet.exam.questions)) {
    sheet.exam.questions.forEach((q) => {
      questionsMap.set(q._id.toString(), q);
    });
  }

  const rawQuestions = (evaluation.questionScores && evaluation.questionScores.length > 0)
    ? evaluation.questionScores
    : (evaluation.questions || []);

  const questionPerformance = rawQuestions.map((q, idx) => {
    const examQ = questionsMap.get(q.questionId ? q.questionId.toString() : "") || {};
    const maxMarks = q.maxMarks || q.maximumMarks || examQ.maximumMarks || examQ.maxMarks || 10;
    const aiScore = q.aiMarks !== undefined ? q.aiMarks : (q.aiAwardedMarks || 0);
    const finalScore = q.finalMarks !== undefined && q.finalMarks !== null ? q.finalMarks : (q.finalAwardedMarks !== undefined ? q.finalAwardedMarks : aiScore);
    const pct = maxMarks > 0 ? parseFloat(((finalScore / maxMarks) * 100).toFixed(1)) : 0;

    return {
      questionId: q.questionId ? q.questionId.toString() : `q_${idx}`,
      questionNumber: q.questionNumber || (idx + 1).toString(),
      questionText: examQ.questionText || (q.studentAnswer ? "Question " + (idx + 1) : "Question"),
      maximumMarks: maxMarks,
      obtainedMarks: finalScore,
      aiMarks: aiScore,
      percentage: pct,
      wasOverridden: Boolean(q.isOverridden || q.wasOverridden),
      confidence: q.confidence !== undefined ? q.confidence : 0.9,
      feedback: q.overrideComment || q.feedback || q.facultyComment || "",
      matchedConcepts: q.matchedConcepts || q.aiEvaluation?.matchedConcepts || q.matchedKeywords || [],
      missingConcepts: q.missingConcepts || q.aiEvaluation?.missingConcepts || q.missingKeywords || [],
    };
  });

  return {
    examId: sheet.exam._id.toString(),
    examTitle: sheet.exam.title,
    subjectName: sheet.subject?.name || "",
    subjectCode: sheet.subject?.code || "",
    totalMarks: evaluation.totalMarks || sheet.exam.totalMarks,
    obtainedMarks: evaluation.obtainedMarks,
    percentage: evaluation.percentage,
    grade: evaluation.grade || "N/A",
    questions: questionPerformance,
  };
};

/**
 * Returns Admin aggregate system metrics.
 * GET /api/analytics/admin/overview
 */
export const getAdminOverviewAnalytics = async () => {
  const [
    totalExams,
    totalEvaluations,
    publishedResults,
    pendingEvaluations,
    totalStudentsEvaluatedDocs,
    totalFaculty,
    avgEvalDoc,
  ] = await Promise.all([
    Exam.countDocuments({ isDeleted: { $ne: true } }),
    Evaluation.countDocuments({ isDeleted: { $ne: true } }),
    Evaluation.countDocuments({ isDeleted: { $ne: true }, evaluationStatus: { $in: ["finalized", "PUBLISHED"] } }),
    Evaluation.countDocuments({ isDeleted: { $ne: true }, evaluationStatus: { $nin: ["finalized", "PUBLISHED"] } }),
    AnswerSheet.distinct("student", { isDeleted: { $ne: true } }),
    User.countDocuments({ role: ROLES.FACULTY, isDeleted: { $ne: true } }),
    Evaluation.aggregate([
      { $match: { isDeleted: { $ne: true }, evaluationStatus: { $in: ["finalized", "PUBLISHED"] } } },
      { $group: { _id: null, avgPercentage: { $avg: "$percentage" } } },
    ]),
  ]);

  const averageEvaluationPercentage =
    avgEvalDoc.length > 0 && avgEvalDoc[0].avgPercentage !== null
      ? parseFloat(avgEvalDoc[0].avgPercentage.toFixed(1))
      : 0;

  return {
    totalExams,
    totalEvaluations,
    publishedResults,
    pendingEvaluations,
    totalStudentsEvaluated: totalStudentsEvaluatedDocs.length,
    totalFaculty,
    averageEvaluationPercentage,
  };
};

/**
 * Returns Admin exam-level comparison.
 * GET /api/analytics/admin/exams
 */
export const getAdminExamsAnalytics = async () => {
  const exams = await Exam.find({ isDeleted: { $ne: true } })
    .populate("subject", "name code")
    .sort({ examDate: -1 })
    .lean();

  const examIds = exams.map((e) => e._id);

  const evaluations = await Evaluation.find({
    isDeleted: { $ne: true },
    evaluationStatus: { $in: ["finalized", "PUBLISHED"] },
  })
    .populate("answerSheet", "exam")
    .lean();

  const examStatsMap = new Map();
  exams.forEach((ex) => {
    examStatsMap.set(ex._id.toString(), {
      examId: ex._id.toString(),
      title: ex.title,
      subjectCode: ex.subject?.code || "",
      subjectName: ex.subject?.name || "",
      examDate: ex.examDate,
      totalMarks: ex.totalMarks,
      passingMarks: ex.passingMarks || (ex.passingPercentage ? Math.round((ex.totalMarks * ex.passingPercentage) / 100) : null),
      totalEvaluated: 0,
      totalObtainedMarks: 0,
      sumPercentage: 0,
      highestMarks: 0,
      lowestMarks: Infinity,
      passCount: 0,
      failCount: 0,
    });
  });

  evaluations.forEach((e) => {
    const examIdStr = e.answerSheet?.exam ? e.answerSheet.exam.toString() : e.examId ? e.examId.toString() : null;
    if (examIdStr && examStatsMap.has(examIdStr)) {
      const stat = examStatsMap.get(examIdStr);
      const marks = e.obtainedMarks || 0;
      const pct = e.percentage || 0;

      stat.totalEvaluated += 1;
      stat.totalObtainedMarks += marks;
      stat.sumPercentage += pct;
      if (marks > stat.highestMarks) stat.highestMarks = marks;
      if (marks < stat.lowestMarks) stat.lowestMarks = marks;

      if (stat.passingMarks !== null) {
        if (marks >= stat.passingMarks) stat.passCount += 1;
        else stat.failCount += 1;
      }
    }
  });

  const result = [];
  for (const [_, stat] of examStatsMap.entries()) {
    const total = stat.totalEvaluated;
    const avgMarks = total > 0 ? parseFloat((stat.totalObtainedMarks / total).toFixed(1)) : 0;
    const avgPct = total > 0 ? parseFloat((stat.sumPercentage / total).toFixed(1)) : 0;
    const passRate = total > 0 && stat.passingMarks !== null ? parseFloat(((stat.passCount / total) * 100).toFixed(1)) : null;

    result.push({
      examId: stat.examId,
      title: stat.title,
      subjectCode: stat.subjectCode,
      subjectName: stat.subjectName,
      examDate: stat.examDate,
      totalMarks: stat.totalMarks,
      totalEvaluated: total,
      averageMarks: avgMarks,
      averagePercentage: avgPct,
      highestMarks: total > 0 ? stat.highestMarks : 0,
      lowestMarks: total > 0 && stat.lowestMarks !== Infinity ? stat.lowestMarks : 0,
      passCount: stat.passCount,
      failCount: stat.failCount,
      passRate,
    });
  }

  return result;
};

/**
 * Returns AI vs Faculty evaluation comparison analytics & difference distribution.
 */
export const getAIVsFacultyAnalytics = async (examId, userId, userRole) => {
  const exam = await verifyExamAccess(examId, userId, userRole);

  const sheets = await AnswerSheet.find({ exam: examId, isDeleted: { $ne: true } }).lean();
  const sheetIds = sheets.map((s) => s._id);

  const finalizedEvals = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    evaluationStatus: "finalized",
    isDeleted: { $ne: true },
  }).lean();

  let totalAIMarksSum = 0;
  let totalFacultyMarksSum = 0;
  let questionsAccepted = 0;
  let questionsOverridden = 0;
  let marksIncreased = 0;
  let marksDecreased = 0;
  let marksUnchanged = 0;

  const differenceDistribution = {
    "-5 or lower": 0,
    "-4 to -3": 0,
    "-2 to -1": 0,
    "0": 0,
    "+1 to +2": 0,
    "+3 to +4": 0,
    "+5 or higher": 0,
  };

  finalizedEvals.forEach((e) => {
    (e.questions || []).forEach((q) => {
      const aiScore = q.aiAwardedMarks !== undefined ? q.aiAwardedMarks : (q.aiMarks || 0);
      const finalScore =
        q.finalAwardedMarks !== undefined && q.finalAwardedMarks !== null
          ? q.finalAwardedMarks
          : aiScore;

      totalAIMarksSum += aiScore;
      totalFacultyMarksSum += finalScore;

      const diff = parseFloat((finalScore - aiScore).toFixed(2));

      if (q.wasOverridden || q.reviewType === "overridden") {
        questionsOverridden++;
        if (diff > 0) marksIncreased++;
        else if (diff < 0) marksDecreased++;
        else marksUnchanged++;
      } else {
        questionsAccepted++;
        marksUnchanged++;
      }

      // Difference distribution categorization
      if (diff <= -5) differenceDistribution["-5 or lower"]++;
      else if (diff >= -4 && diff <= -3) differenceDistribution["-4 to -3"]++;
      else if (diff >= -2 && diff <= -1) differenceDistribution["-2 to -1"]++;
      else if (diff === 0) differenceDistribution["0"]++;
      else if (diff >= 1 && diff <= 2) differenceDistribution["+1 to +2"]++;
      else if (diff >= 3 && diff <= 4) differenceDistribution["+3 to +4"]++;
      else if (diff >= 5) differenceDistribution["+5 or higher"]++;
    });
  });

  const finalizedCount = finalizedEvals.length;
  const averageAIMarks = finalizedCount > 0 ? parseFloat((totalAIMarksSum / finalizedCount).toFixed(2)) : 0;
  const averageFacultyMarks = finalizedCount > 0 ? parseFloat((totalFacultyMarksSum / finalizedCount).toFixed(2)) : 0;
  const averageDifference = parseFloat((averageFacultyMarks - averageAIMarks).toFixed(2));

  return {
    examId: exam._id.toString(),
    finalizedCount,
    averageAIMarks,
    averageFacultyMarks,
    averageDifference,
    questionsAccepted,
    questionsOverridden,
    markChanges: {
      marksIncreased,
      marksDecreased,
      marksUnchanged,
    },
    differenceDistribution,
  };
};

/**
 * Returns AI Confidence Analytics and Confidence vs Faculty Override distribution table.
 */
export const getConfidenceAnalytics = async (examId, userId, userRole) => {
  const exam = await verifyExamAccess(examId, userId, userRole);

  const sheets = await AnswerSheet.find({ exam: examId, isDeleted: { $ne: true } }).lean();
  const sheetIds = sheets.map((s) => s._id);

  const finalizedEvals = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    evaluationStatus: "finalized",
    isDeleted: { $ne: true },
  }).lean();

  let confidenceSum = 0;
  let totalEvaluatedQuestions = 0;

  let highCount = 0; // 90-100%
  let modCount = 0;  // 75-89%
  let lowCount = 0;  // Below 75%

  let highOverrides = 0;
  let modOverrides = 0;
  let lowOverrides = 0;

  finalizedEvals.forEach((e) => {
    (e.questions || []).forEach((q) => {
      totalEvaluatedQuestions++;
      // Retrieve confidence (0-1 or 0-100)
      let confVal = q.confidence !== undefined ? q.confidence : (q.aiEvaluation?.confidence || 0.85);
      if (confVal <= 1.0) confVal = confVal * 100;
      confVal = Math.min(100, Math.max(0, confVal));

      confidenceSum += confVal;

      const isOverridden = Boolean(q.wasOverridden || q.reviewType === "overridden");

      if (confVal >= 90) {
        highCount++;
        if (isOverridden) highOverrides++;
      } else if (confVal >= 75) {
        modCount++;
        if (isOverridden) modOverrides++;
      } else {
        lowCount++;
        if (isOverridden) lowOverrides++;
      }
    });
  });

  const averageConfidence =
    totalEvaluatedQuestions > 0 ? parseFloat((confidenceSum / totalEvaluatedQuestions).toFixed(1)) : 0;

  const observedOverrideDistribution = [
    { range: "90–100% (High)", evaluations: highCount, overrides: highOverrides },
    { range: "75–89% (Moderate)", evaluations: modCount, overrides: modOverrides },
    { range: "Below 75% (Low)", evaluations: lowCount, overrides: lowOverrides },
  ];

  return {
    examId: exam._id.toString(),
    totalEvaluatedQuestions,
    averageConfidence,
    highConfidenceCount: highCount,
    moderateConfidenceCount: modCount,
    lowConfidenceCount: lowCount,
    observedOverrideDistribution,
  };
};

/**
 * Returns review workload & override reason analysis.
 */
export const getOverrideAnalytics = async (examId, userId, userRole) => {
  const exam = await verifyExamAccess(examId, userId, userRole);

  const sheets = await AnswerSheet.find({ exam: examId, isDeleted: { $ne: true } }).lean();
  const sheetIds = sheets.map((s) => s._id);

  const allEvals = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    isDeleted: { $ne: true },
  })
    .populate({
      path: "answerSheet",
      populate: { path: "student", select: "name email rollNo" },
    })
    .lean();

  const totalEvaluations = allEvals.length;
  const finalized = allEvals.filter((e) => e.evaluationStatus === "finalized");
  const finalizedCount = finalized.length;
  const pendingCount = totalEvaluations - finalizedCount;

  let overriddenCount = 0;
  const reasonCounts = {};
  const reviewComments = [];
  const reviewDurations = [];

  allEvals.forEach((e) => {
    const student = e.answerSheet?.student;
    const studentIdentifier =
      e.answerSheet?.studentIdentifier || student?.rollNo || student?.name || "Unknown Candidate";
    const studentName = student?.name || "Unknown Candidate";

    let sheetHasOverride = false;

    // Check review time only if reliable timestamps exist
    if (e.finalizedAt && e.reviewStartedAt) {
      const durationMin = (new Date(e.finalizedAt) - new Date(e.reviewStartedAt)) / (1000 * 60);
      if (durationMin > 0 && durationMin < 1440) {
        reviewDurations.push(durationMin);
      }
    }

    (e.questions || []).forEach((q) => {
      if (q.wasOverridden || q.reviewType === "overridden") {
        sheetHasOverride = true;
        const reason = q.overrideReason || q.facultyEvaluation?.overrideReason || "Other";
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;

        if (q.facultyComment || q.facultyEvaluation?.comment || q.overrideReason) {
          reviewComments.push({
            evaluationId: e._id.toString(),
            studentIdentifier,
            studentName,
            questionNumber: q.questionNumber || "N/A",
            aiMarks: q.aiAwardedMarks !== undefined ? q.aiAwardedMarks : (q.aiMarks || 0),
            finalMarks: q.finalAwardedMarks !== undefined ? q.finalAwardedMarks : q.aiMarks,
            reason,
            comment: q.facultyComment || q.facultyEvaluation?.comment || "",
            reviewedAt: e.updatedAt || e.finalizedAt || new Date(),
          });
        }
      }
    });

    if (sheetHasOverride) overriddenCount++;
  });

  const averageReviewTimeMinutes =
    reviewDurations.length > 0
      ? parseFloat((reviewDurations.reduce((a, b) => a + b, 0) / reviewDurations.length).toFixed(1))
      : null;

  // Format reasons array for charts
  const overrideReasons = Object.keys(reasonCounts).map((reason) => ({
    reason,
    count: reasonCounts[reason],
  }));

  return {
    examId: exam._id.toString(),
    reviewWorkload: {
      totalEvaluations,
      reviewed: finalizedCount,
      pending: pendingCount,
      overridden: overriddenCount,
      finalized: finalizedCount,
      averageReviewTimeMinutes,
    },
    overrideReasons,
    reviewComments,
  };
};

/**
 * Returns consolidated analytical dataset for dashboard loading.
 */
export const getConsolidatedAnalytics = async (examId, userId, userRole) => {
  const overview = await getExamOverviewAnalytics(examId, userId, userRole);
  const studentPerformance = await getStudentPerformanceAnalytics(examId, {}, userId, userRole);
  const questionPerformance = await getQuestionPerformanceAnalytics(examId, userId, userRole);
  const aiVsFaculty = await getAIVsFacultyAnalytics(examId, userId, userRole);
  const confidence = await getConfidenceAnalytics(examId, userId, userRole);
  const overrides = await getOverrideAnalytics(examId, userId, userRole);

  return {
    overview,
    studentPerformance,
    questionPerformance,
    aiVsFaculty,
    confidence,
    overrides,
  };
};

/**
 * Generates CSV string representation for Analytics export.
 */
export const generateAnalyticsCSV = async (examId, userId, userRole) => {
  const consolidated = await getConsolidatedAnalytics(examId, userId, userRole);
  const { overview, studentPerformance, questionPerformance, aiVsFaculty, overrides } = consolidated;

  const lines = [];

  lines.push(`"EVALUATION ANALYTICS REPORT"`);
  lines.push(`"Exam Title","${overview.examTitle.replace(/"/g, '""')}"`);
  lines.push(`"Total Students",${overview.totalStudents}`);
  lines.push(`"Finalized Students",${overview.finalizedStudents}`);
  lines.push(`"Average Final Marks",${overview.averageFinalMarks} / ${overview.totalMarks}`);
  lines.push(`"Average Percentage",${overview.averagePercentage}%`);
  lines.push(`"Highest Marks",${overview.highestFinalMarks}`);
  lines.push(`"Lowest Marks",${overview.lowestFinalMarks}`);
  lines.push("");

  lines.push(`"QUESTION PERFORMANCE"`);
  lines.push(`"Question","Max Marks","Average Final Marks","Average Percentage","Finalized Answers","Observed Performance"`);
  questionPerformance.questions.forEach((q) => {
    lines.push(`"Q${q.questionNumber}",${q.maxMarks},${q.averageMarks},${q.averagePercentage}%,${q.finalizedAnswers},"${q.observedPerformanceLabel}"`);
  });
  lines.push("");

  lines.push(`"AI VS FACULTY EVALUATION"`);
  lines.push(`"AI Average Marks",${aiVsFaculty.averageAIMarks}`);
  lines.push(`"Faculty Average Marks",${aiVsFaculty.averageFacultyMarks}`);
  lines.push(`"Average Difference",${aiVsFaculty.averageDifference}`);
  lines.push(`"Questions Accepted",${aiVsFaculty.questionsAccepted}`);
  lines.push(`"Questions Overridden",${aiVsFaculty.questionsOverridden}`);
  lines.push("");

  lines.push(`"OVERRIDE REASONS"`);
  lines.push(`"Reason","Count"`);
  overrides.overrideReasons.forEach((r) => {
    lines.push(`"${r.reason.replace(/"/g, '""')}",${r.count}`);
  });
  lines.push("");

  lines.push(`"STUDENT PERFORMANCE LIST"`);
  lines.push(`"Enrollment / Identifier","Student Name","Final Marks","Total Marks","Percentage","Result Status","Evaluation Status"`);
  studentPerformance.students.forEach((s) => {
    lines.push(`"${s.studentIdentifier.replace(/"/g, '""')}","${s.studentName.replace(/"/g, '""')}",${s.obtainedMarks},${s.totalMarks},${s.percentage}%,"${s.resultStatus}","${s.status}"`);
  });

  return lines.join("\n");
};

/**
 * Generates Printable HTML / PDF report content for Analytics export.
 */
export const generateAnalyticsHTML = async (examId, userId, userRole) => {
  const consolidated = await getConsolidatedAnalytics(examId, userId, userRole);
  const { overview, studentPerformance, questionPerformance, aiVsFaculty, confidence, overrides } = consolidated;

  const dateStr = new Date().toLocaleDateString();

  const qRows = questionPerformance.questions
    .map(
      (q) => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:center;">Q${q.questionNumber}</td>
      <td style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:right;">${q.maxMarks}</td>
      <td style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:right;">${q.aiAverageMarks || 0}</td>
      <td style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:bold;">${q.averageMarks} (${q.averagePercentage}%)</td>
      <td style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:center;">${q.finalizedAnswers}</td>
      <td style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:center;">${q.observedPerformanceLabel}</td>
    </tr>
  `
    )
    .join("");

  const studentRows = studentPerformance.students
    .map(
      (s) => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${s.studentIdentifier}</td>
      <td style="padding:8px; border-bottom:1px solid #e5e7eb;">${s.studentName}</td>
      <td style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:bold;">${s.obtainedMarks} / ${s.totalMarks}</td>
      <td style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:right;">${s.percentage}%</td>
      <td style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:center;">${s.resultStatus}</td>
    </tr>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Evaluation Analytics Report - ${overview.examTitle}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; color: #111827; line-height: 1.5; padding: 30px; max-width: 900px; margin: 0 auto; }
        .header { border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: 800; color: #1e40af; margin: 0; }
        .subtitle { font-size: 14px; color: #4b5563; margin: 4px 0 0 0; }
        .meta-grid { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 24px; background: #f8fafc; padding: 12px 16px; border-radius: 8px; }
        .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .card { background: #f1f5f9; padding: 12px; border-radius: 8px; text-align: center; }
        .card-num { font-size: 20px; font-weight: 700; color: #0f172a; }
        .card-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
        h2 { font-size: 16px; font-weight: 700; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-top: 24px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
        th { background: #1e40af; color: white; padding: 8px; text-align: left; }
      </style>
    </head>
    <body onload="window.print()">
      <div class="header">
        <h1 class="title">AI-Based Answer Sheet Evaluation System</h1>
        <p class="subtitle">Evaluation Analytics & Performance Insights Report</p>
      </div>

      <div class="meta-grid">
        <div>
          <strong>Exam Title:</strong> ${overview.examTitle}<br/>
          <strong>Total Maximum Marks:</strong> ${overview.totalMarks}
        </div>
        <div style="text-align: right;">
          <strong>Date Generated:</strong> ${dateStr}<br/>
          <strong>Passing Rule:</strong> ${overview.hasPassingRule ? `Configured (${overview.passingMarks} Marks)` : "Not Configured"}
        </div>
      </div>

      <h2>Overview Summary</h2>
      <div class="cards">
        <div class="card">
          <div class="card-num">${overview.totalStudents}</div>
          <div class="card-label">Total Students</div>
        </div>
        <div class="card">
          <div class="card-num">${overview.finalizedStudents}</div>
          <div class="card-label">Finalized</div>
        </div>
        <div class="card">
          <div class="card-num">${overview.averageFinalMarks} / ${overview.totalMarks}</div>
          <div class="card-label">Average Score</div>
        </div>
        <div class="card">
          <div class="card-num">${overview.averagePercentage}%</div>
          <div class="card-label">Average %</div>
        </div>
      </div>

      <h2>Question-Wise Observed Performance</h2>
      <table>
        <thead>
          <tr>
            <th>Question</th>
            <th style="text-align:right;">Max</th>
            <th style="text-align:right;">AI Avg</th>
            <th style="text-align:right;">Faculty Final Avg</th>
            <th style="text-align:center;">Finalized</th>
            <th style="text-align:center;">Observed Performance</th>
          </tr>
        </thead>
        <tbody>
          ${qRows}
        </tbody>
      </table>

      <h2>AI vs Faculty Evaluation Comparison</h2>
      <div class="cards">
        <div class="card">
          <div class="card-num">${aiVsFaculty.averageAIMarks}</div>
          <div class="card-label">AI Average</div>
        </div>
        <div class="card">
          <div class="card-num">${aiVsFaculty.averageFacultyMarks}</div>
          <div class="card-label">Faculty Average</div>
        </div>
        <div class="card">
          <div class="card-num">${aiVsFaculty.averageDifference > 0 ? "+" : ""}${aiVsFaculty.averageDifference}</div>
          <div class="card-label">Average Difference</div>
        </div>
        <div class="card">
          <div class="card-num">${aiVsFaculty.questionsOverridden}</div>
          <div class="card-label">Overridden Questions</div>
        </div>
      </div>

      <h2>Student Performance Results</h2>
      <table>
        <thead>
          <tr>
            <th>Enrollment / Identifier</th>
            <th>Candidate Name</th>
            <th style="text-align:right;">Final Marks</th>
            <th style="text-align:right;">Percentage</th>
            <th style="text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${studentRows}
        </tbody>
      </table>
    </body>
    </html>
  `;
};

/**
 * Generates Excel-compatible Workbook XML format for Excel Analytics export.
 */
export const generateAnalyticsExcel = async (examId, userId, userRole) => {
  const consolidated = await getConsolidatedAnalytics(examId, userId, userRole);
  const { overview, studentPerformance, questionPerformance, aiVsFaculty, confidence, overrides } = consolidated;

  // Build multi-sheet SpreadsheetML XML structure for Excel
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1E40AF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Bold"><Font ss:Bold="1"/></Style>
 </Styles>
 <Worksheet ss:Name="Overview">
  <Table>
   <Row><Cell ss:StyleID="Bold"><Data ss:Type="String">Exam Title</Data></Cell><Cell><Data ss:Type="String">${overview.examTitle}</Data></Cell></Row>
   <Row><Cell ss:StyleID="Bold"><Data ss:Type="String">Total Candidates</Data></Cell><Cell><Data ss:Type="Number">${overview.totalStudents}</Data></Cell></Row>
   <Row><Cell ss:StyleID="Bold"><Data ss:Type="String">Finalized Candidates</Data></Cell><Cell><Data ss:Type="Number">${overview.finalizedStudents}</Data></Cell></Row>
   <Row><Cell ss:StyleID="Bold"><Data ss:Type="String">Average Final Marks</Data></Cell><Cell><Data ss:Type="Number">${overview.averageFinalMarks}</Data></Cell></Row>
   <Row><Cell ss:StyleID="Bold"><Data ss:Type="String">Average Percentage</Data></Cell><Cell><Data ss:Type="Number">${overview.averagePercentage}</Data></Cell></Row>
   <Row><Cell ss:StyleID="Bold"><Data ss:Type="String">Highest Marks</Data></Cell><Cell><Data ss:Type="Number">${overview.highestFinalMarks}</Data></Cell></Row>
   <Row><Cell ss:StyleID="Bold"><Data ss:Type="String">Lowest Marks</Data></Cell><Cell><Data ss:Type="Number">${overview.lowestFinalMarks}</Data></Cell></Row>
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Student Performance">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Identifier</Data></Cell>
    <Cell><Data ss:Type="String">Student Name</Data></Cell>
    <Cell><Data ss:Type="String">Obtained Marks</Data></Cell>
    <Cell><Data ss:Type="String">Total Marks</Data></Cell>
    <Cell><Data ss:Type="String">Percentage</Data></Cell>
    <Cell><Data ss:Type="String">Result Status</Data></Cell>
   </Row>
   ${studentPerformance.students
     .map(
       (s) => `<Row>
    <Cell><Data ss:Type="String">${s.studentIdentifier}</Data></Cell>
    <Cell><Data ss:Type="String">${s.studentName}</Data></Cell>
    <Cell><Data ss:Type="Number">${s.obtainedMarks}</Data></Cell>
    <Cell><Data ss:Type="Number">${s.totalMarks}</Data></Cell>
    <Cell><Data ss:Type="Number">${s.percentage}</Data></Cell>
    <Cell><Data ss:Type="String">${s.resultStatus}</Data></Cell>
   </Row>`
     )
     .join("\n")}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Question Performance">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Question</Data></Cell>
    <Cell><Data ss:Type="String">Max Marks</Data></Cell>
    <Cell><Data ss:Type="String">Average Final Marks</Data></Cell>
    <Cell><Data ss:Type="String">Average %</Data></Cell>
    <Cell><Data ss:Type="String">Observed Performance</Data></Cell>
   </Row>
   ${questionPerformance.questions
     .map(
       (q) => `<Row>
    <Cell><Data ss:Type="String">Q${q.questionNumber}</Data></Cell>
    <Cell><Data ss:Type="Number">${q.maxMarks}</Data></Cell>
    <Cell><Data ss:Type="Number">${q.averageMarks}</Data></Cell>
    <Cell><Data ss:Type="Number">${q.averagePercentage}</Data></Cell>
    <Cell><Data ss:Type="String">${q.observedPerformanceLabel}</Data></Cell>
   </Row>`
     )
     .join("\n")}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="AI vs Faculty">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Metric</Data></Cell>
    <Cell><Data ss:Type="String">Value</Data></Cell>
   </Row>
   <Row><Cell><Data ss:Type="String">Average AI Marks</Data></Cell><Cell><Data ss:Type="Number">${aiVsFaculty.averageAIMarks}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Average Faculty Marks</Data></Cell><Cell><Data ss:Type="Number">${aiVsFaculty.averageFacultyMarks}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Average Difference</Data></Cell><Cell><Data ss:Type="Number">${aiVsFaculty.averageDifference}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Questions Accepted</Data></Cell><Cell><Data ss:Type="Number">${aiVsFaculty.questionsAccepted}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Questions Overridden</Data></Cell><Cell><Data ss:Type="Number">${aiVsFaculty.questionsOverridden}</Data></Cell></Row>
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Override Reasons">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Override Reason</Data></Cell>
    <Cell><Data ss:Type="String">Count</Data></Cell>
   </Row>
   ${overrides.overrideReasons
     .map(
       (r) => `<Row>
    <Cell><Data ss:Type="String">${r.reason}</Data></Cell>
    <Cell><Data ss:Type="Number">${r.count}</Data></Cell>
   </Row>`
     )
     .join("\n")}
  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
};

export default {
  getAccessibleExams,
  getExamOverviewAnalytics,
  getStudentPerformanceAnalytics,
  getQuestionPerformanceAnalytics,
  getExamDistributionAnalytics,
  getAIVsFacultyAnalytics,
  getConfidenceAnalytics,
  getOverrideAnalytics,
  getConsolidatedAnalytics,
  getStudentMeAnalytics,
  getStudentMeTrends,
  getStudentMeExamDetails,
  getAdminOverviewAnalytics,
  getAdminExamsAnalytics,
  generateAnalyticsCSV,
  generateAnalyticsHTML,
  generateAnalyticsExcel,
};
