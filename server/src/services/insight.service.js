import mongoose from "mongoose";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import Exam from "../models/Exam.js";
import { getConsolidatedAnalytics, getQuestionPerformanceAnalytics, getAdminOverviewAnalytics } from "./analytics.service.js";

/**
 * Generates personal insights for an authenticated student based strictly on their published results.
 * @param {string} studentId
 */
export const getStudentInsights = async (studentId) => {
  const studentObjId = new mongoose.Types.ObjectId(studentId);

  const sheets = await AnswerSheet.find({
    student: studentObjId,
    isDeleted: { $ne: true },
    "resultPublication.status": "RESULT_PUBLISHED",
  })
    .sort({ "resultPublication.publishedAt": 1 })
    .populate("exam", "title totalMarks examDate")
    .lean();

  if (!sheets || sheets.length === 0) {
    return [
      {
        type: "STUDENT_TREND",
        title: "Insufficient Data",
        message: "Not enough published results to calculate a trend yet.",
        severity: "INFO",
        metric: null,
      },
    ];
  }

  const sheetIds = sheets.map((s) => s._id);
  const evals = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    evaluationStatus: { $in: ["finalized", "PUBLISHED", "completed"] },
    isDeleted: { $ne: true },
  }).lean();

  const evalMap = new Map();
  evals.forEach((e) => evalMap.set(e.answerSheet.toString(), e));

  const validEntries = [];
  sheets.forEach((s) => {
    const ev = evalMap.get(s._id.toString());
    if (ev) {
      const obtainedMarks = ev.obtainedMarks || 0;
      const totalMarks = ev.totalMarks || s.exam?.totalMarks || 100;
      const percentage = ev.percentage !== undefined
        ? Number(ev.percentage)
        : parseFloat(((obtainedMarks / totalMarks) * 100).toFixed(1));

      validEntries.push({
        examTitle: s.exam?.title || "Exam",
        obtainedMarks,
        totalMarks,
        percentage,
        publishedAt: s.resultPublication?.publishedAt || ev.updatedAt,
      });
    }
  });

  if (validEntries.length === 0) {
    return [
      {
        type: "STUDENT_TREND",
        title: "Insufficient Data",
        message: "Not enough published results to calculate a trend yet.",
        severity: "INFO",
        metric: null,
      },
    ];
  }

  const percentages = validEntries.map((e) => e.percentage);
  const totalSum = percentages.reduce((acc, p) => acc + p, 0);
  const averagePercentage = parseFloat((totalSum / validEntries.length).toFixed(1));
  const highestPercentage = Math.max(...percentages);
  const latestEntry = validEntries[validEntries.length - 1];

  const insights = [];

  // Average Performance
  insights.push({
    type: "EXAM_PERFORMANCE",
    title: "Average Score",
    message: `Your average score across ${validEntries.length} published exam(s) is ${averagePercentage}%.`,
    severity: "INFO",
    metric: averagePercentage,
  });

  // Highest Performance
  insights.push({
    type: "EXAM_PERFORMANCE",
    title: "Highest Score",
    message: `Your highest recorded score is ${highestPercentage}%.`,
    severity: "SUCCESS",
    metric: highestPercentage,
  });

  // Latest Result & Trend Comparison
  if (validEntries.length >= 2) {
    const previousEntry = validEntries[validEntries.length - 2];
    const diff = parseFloat((latestEntry.percentage - previousEntry.percentage).toFixed(1));
    const direction = diff >= 0 ? "increased" : "decreased";
    const changeAbs = Math.abs(diff);

    insights.push({
      type: "STUDENT_TREND",
      title: "Performance Trend",
      message: `Your performance ${direction} by ${changeAbs} percentage points compared to your previous published exam (${previousEntry.examTitle}).`,
      severity: diff >= 0 ? "SUCCESS" : "WARNING",
      metric: diff,
    });
  } else {
    insights.push({
      type: "STUDENT_TREND",
      title: "Latest Result",
      message: `Your latest published result for "${latestEntry.examTitle}" is ${latestEntry.percentage}%.`,
      severity: "INFO",
      metric: latestEntry.percentage,
    });
  }

  return insights;
};

/**
 * Generates exam-level structured insights for Faculty view.
 * @param {string} examId
 * @param {string} userId
 * @param {string} userRole
 */
export const getFacultyInsights = async (examId, userId, userRole) => {
  const consolidated = await getConsolidatedAnalytics(examId, userId, userRole);
  const questionAnalytics = await getQuestionPerformanceAnalytics(examId, userId, userRole);

  const insights = [];

  const { overview, distribution, passFailAnalytics } = consolidated;

  // 1. Overall Average Score
  if (overview && overview.finalizedStudents > 0) {
    insights.push({
      type: "EXAM_PERFORMANCE",
      title: "Average Performance",
      message: `Students scored an average of ${overview.averagePercentage}% in this exam (Highest: ${overview.highestFinalMarks}, Lowest: ${overview.lowestFinalMarks}).`,
      severity: overview.averagePercentage >= 70 ? "SUCCESS" : overview.averagePercentage >= 50 ? "INFO" : "WARNING",
      metric: overview.averagePercentage,
    });
  }

  // 2. Pass Rate Insight
  if (passFailAnalytics && passFailAnalytics.hasPassingRule && overview.finalizedStudents > 0) {
    insights.push({
      type: "PASS_RATE",
      title: "Pass Rate",
      message: `${passFailAnalytics.passPercentage}% of published results meet the configured pass criterion (${passFailAnalytics.passCount} passed, ${passFailAnalytics.failCount} failed).`,
      severity: passFailAnalytics.passPercentage >= 75 ? "SUCCESS" : "WARNING",
      metric: passFailAnalytics.passPercentage,
    });
  }

  // 3. Question Performance / Lowest Performing Question
  const questions = questionAnalytics.questions || [];
  if (questions.length > 0) {
    const sortedByAvg = [...questions].sort((a, b) => a.averagePercentage - b.averagePercentage);
    const lowestQ = sortedByAvg[0];

    insights.push({
      type: "QUESTION_PERFORMANCE",
      title: "Question Performance Insights",
      message: `Question Q${lowestQ.questionNumber} recorded the lowest class average score at ${lowestQ.averagePercentage}% of maximum marks.`,
      severity: lowestQ.averagePercentage < 50 ? "WARNING" : "INFO",
      metric: lowestQ.averagePercentage,
    });
  }

  // 4. Mark Distribution Range
  if (distribution) {
    const bandEntries = Object.entries(distribution);
    bandEntries.sort((a, b) => b[1] - a[1]);
    const topBand = bandEntries[0];

    if (topBand && topBand[1] > 0) {
      insights.push({
        type: "MARK_DISTRIBUTION",
        title: "Score Concentration",
        message: `Most students (${topBand[1]}) fall within the ${topBand[0]} score range.`,
        severity: "INFO",
        metric: topBand[1],
      });
    }
  }

  return insights;
};

/**
 * Generates system-level aggregate insights for Admin view.
 */
export const getAdminInsights = async () => {
  const adminOverview = await getAdminOverviewAnalytics();

  const insights = [];

  insights.push({
    type: "EXAM_PERFORMANCE",
    title: "System Evaluation Volume",
    message: `Total published evaluations across system: ${adminOverview.publishedResults} (Out of ${adminOverview.totalEvaluations} total evaluations).`,
    severity: "INFO",
    metric: adminOverview.publishedResults,
  });

  insights.push({
    type: "EXAM_PERFORMANCE",
    title: "System Average Score",
    message: `Average percentage across all published exam results is ${adminOverview.averagePercentage}%.`,
    severity: adminOverview.averagePercentage >= 70 ? "SUCCESS" : "INFO",
    metric: adminOverview.averagePercentage,
  });

  insights.push({
    type: "SYSTEM_STATUS",
    title: "Evaluation Progress",
    message: `${adminOverview.pendingEvaluations} evaluation(s) currently pending faculty review or publication.`,
    severity: adminOverview.pendingEvaluations > 0 ? "WARNING" : "SUCCESS",
    metric: adminOverview.pendingEvaluations,
  });

  return insights;
};

export default {
  getStudentInsights,
  getFacultyInsights,
  getAdminInsights,
};
