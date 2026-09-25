import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { ROLES } from "../constants/roles.js";

/**
 * Ensures Faculty user owns the exam.
 */
const verifyExamOwnership = async (examId, userId, userRole) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: { $ne: true } }).populate(
    "subject",
    "name code semester faculty"
  );
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam layout not found");
  }
  if (userRole === ROLES.FACULTY && exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam registry.");
  }
  return exam;
};

/**
 * Helper to resolve passing marks rule for an exam.
 * Returns { hasPassingRule: boolean, passingMarks: number | null }
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
 * Returns paginated results list for an exam.
 */
export const getResultsForExam = async (examId, query = {}, userId, userRole) => {
  const exam = await verifyExamOwnership(examId, userId, userRole);
  const { hasPassingRule, passingMarks } = resolvePassingRule(exam);

  const {
    page = 1,
    limit = 10,
    search = "",
    status = "",
    sortBy = "updatedAt",
    order = "desc",
  } = query;

  const sheets = await AnswerSheet.find({ exam: examId, isDeleted: { $ne: true } }).populate(
    "student",
    "name email rollNo"
  );

  const sheetIds = sheets.map((s) => s._id);

  const evalQuery = { answerSheet: { $in: sheetIds }, isDeleted: { $ne: true } };

  // Filter sheets if searching
  if (search) {
    const rx = new RegExp(search, "i");
    const matchedSheetIds = sheets
      .filter(
        (s) =>
          rx.test(s.studentIdentifier || "") ||
          rx.test(s.uploadedFileName || "") ||
          (s.student && (rx.test(s.student.name || "") || rx.test(s.student.rollNo || "")))
      )
      .map((s) => s._id);
    evalQuery.answerSheet = { $in: matchedSheetIds };
  }

  // Handle status filter mapping
  if (status) {
    if (status === "finalized") {
      evalQuery.evaluationStatus = "finalized";
    } else if (status === "pending_finalization" || status === "pending") {
      evalQuery.evaluationStatus = { $ne: "finalized" };
    } else if (status === "processing") {
      evalQuery.evaluationStatus = { $in: ["pending", "queued", "processing"] };
    } else if (status === "failed") {
      evalQuery.evaluationStatus = "failed";
    } else if (status === "pass" && hasPassingRule) {
      evalQuery.evaluationStatus = "finalized";
      evalQuery.obtainedMarks = { $gte: passingMarks };
    } else if (status === "fail" && hasPassingRule) {
      evalQuery.evaluationStatus = "finalized";
      evalQuery.obtainedMarks = { $lt: passingMarks };
    }
  }

  const total = await Evaluation.countDocuments(evalQuery);

  let sortOption = {};
  if (sortBy) {
    const direction = order === "asc" ? 1 : -1;
    if (sortBy === "totalMarks" || sortBy === "obtainedMarks") {
      sortOption.obtainedMarks = direction;
    } else if (sortBy === "percentage") {
      sortOption.percentage = direction;
    } else {
      sortOption[sortBy] = direction;
    }
  } else {
    sortOption.updatedAt = -1;
  }

  const limitNum = parseInt(limit, 10) || 10;
  const pageNum = parseInt(page, 10) || 1;
  const skipNum = (pageNum - 1) * limitNum;

  const evals = await Evaluation.find(evalQuery)
    .populate({
      path: "answerSheet",
      populate: { path: "student", select: "name email rollNo" },
    })
    .sort(sortOption)
    .skip(skipNum)
    .limit(limitNum);

  const results = evals.map((e) => {
    const sheet = e.answerSheet;
    const student = sheet?.student;

    // Sum AI total marks for comparison
    const aiTotalMarks = e.questions.reduce(
      (sum, q) => sum + (q.aiAwardedMarks !== undefined ? q.aiAwardedMarks : (q.aiMarks || 0)),
      0
    );

    // Sum Final Faculty Marks (from Phase 4B)
    const finalTotalMarks =
      e.evaluationStatus === "finalized"
        ? e.obtainedMarks
        : e.questions.reduce(
            (sum, q) =>
              sum +
              (q.finalAwardedMarks !== undefined && q.finalAwardedMarks !== null
                ? q.finalAwardedMarks
                : q.aiAwardedMarks || 0),
            0
          );

    const isFinalized = e.evaluationStatus === "finalized";

    let resultStatus = "Not Configured";
    if (isFinalized) {
      if (hasPassingRule) {
        resultStatus = finalTotalMarks >= passingMarks ? "PASS" : "FAIL";
      }
    } else {
      resultStatus = "Pending";
    }

    return {
      evaluationId: e._id,
      answerSheetId: sheet?._id,
      studentIdentifier:
        sheet?.studentIdentifier || student?.rollNo || student?.name || "Unknown Candidate",
      studentName: student?.name || "Unknown Candidate",
      filename: sheet?.uploadedFileName || "Scan",
      aiTotalMarks,
      obtainedMarks: finalTotalMarks,
      finalTotalMarks,
      totalMarks: e.totalMarks,
      percentage: e.percentage,
      status: e.evaluationStatus,
      isFinalized,
      resultStatus,
      hasPassingRule,
      passingMarks,
      finalizedAt: e.updatedAt,
    };
  });

  return {
    results,
    hasPassingRule,
    passingMarks,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * Returns overall exam statistics, AI vs Faculty metrics, and question-wise aggregates.
 */
export const getExamAnalytics = async (examId, userId, userRole) => {
  const exam = await verifyExamOwnership(examId, userId, userRole);
  const { hasPassingRule, passingMarks } = resolvePassingRule(exam);

  const sheets = await AnswerSheet.find({ exam: examId, isDeleted: { $ne: true } });
  const sheetIds = sheets.map((s) => s._id);

  const allEvals = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    isDeleted: { $ne: true },
  });

  const totalAnswerSheets = sheets.length;
  const finalized = allEvals.filter((e) => e.evaluationStatus === "finalized");
  const finalizedCount = finalized.length;

  const pendingReview = allEvals.filter((e) =>
    ["completed", "reviewed", "EVALUATION_COMPLETED", "READY_FOR_FACULTY_REVIEW"].includes(
      e.evaluationStatus
    )
  ).length;
  const processing = allEvals.filter((e) =>
    ["pending", "queued", "processing", "HWR_PROCESSING", "LLM_PROCESSING", "GRADING"].includes(
      e.evaluationStatus
    )
  ).length;
  const failed = allEvals.filter((e) => e.evaluationStatus === "failed" || e.evaluationStatus === "EVALUATION_FAILED").length;

  let averageMarks = 0;
  let averagePercentage = 0;
  let highestScore = 0;
  let lowestScore = 0;
  let passCount = 0;
  let failCount = 0;

  // AI vs Faculty metrics
  let totalAIMarksSum = 0;
  let totalFinalMarksSum = 0;
  let totalQuestionsEvaluated = 0;
  let aiAcceptedCount = 0;
  let aiOverriddenCount = 0;
  let marksIncreasedCount = 0;
  let marksDecreasedCount = 0;

  const distribution = {
    "0-20%": 0,
    "21-40%": 0,
    "41-60%": 0,
    "61-80%": 0,
    "81-100%": 0,
  };

  if (finalizedCount > 0) {
    let sumMarks = 0;
    let sumPercent = 0;
    highestScore = -Infinity;
    lowestScore = Infinity;

    finalized.forEach((e) => {
      const marks = e.obtainedMarks;
      const percent = e.percentage;

      sumMarks += marks;
      sumPercent += percent;

      if (marks > highestScore) highestScore = marks;
      if (marks < lowestScore) lowestScore = marks;

      if (hasPassingRule && passingMarks !== null) {
        if (marks >= passingMarks) {
          passCount++;
        } else {
          failCount++;
        }
      }

      if (percent <= 20) distribution["0-20%"]++;
      else if (percent <= 40) distribution["21-40%"]++;
      else if (percent <= 60) distribution["41-60%"]++;
      else if (percent <= 80) distribution["61-80%"]++;
      else distribution["81-100%"]++;

      // Per-question AI vs Faculty metrics accumulation
      (e.questions || []).forEach((q) => {
        totalQuestionsEvaluated++;
        const aiScore = q.aiAwardedMarks !== undefined ? q.aiAwardedMarks : (q.aiMarks || 0);
        const finalScore =
          q.finalAwardedMarks !== undefined && q.finalAwardedMarks !== null
            ? q.finalAwardedMarks
            : aiScore;

        totalAIMarksSum += aiScore;
        totalFinalMarksSum += finalScore;

        if (q.wasOverridden || q.reviewType === "overridden") {
          aiOverriddenCount++;
          if (finalScore > aiScore) marksIncreasedCount++;
          else if (finalScore < aiScore) marksDecreasedCount++;
        } else {
          aiAcceptedCount++;
        }
      });
    });

    averageMarks = parseFloat((sumMarks / finalizedCount).toFixed(2));
    averagePercentage = parseFloat((sumPercent / finalizedCount).toFixed(2));
    if (lowestScore === Infinity) lowestScore = 0;
    if (highestScore === -Infinity) highestScore = 0;
  }

  const averageAIMarks = finalizedCount > 0 ? parseFloat((totalAIMarksSum / finalizedCount).toFixed(2)) : 0;
  const averageFinalMarks = averageMarks;
  const averageDifference = parseFloat((averageFinalMarks - averageAIMarks).toFixed(2));

  const passPercentage =
    hasPassingRule && finalizedCount > 0
      ? parseFloat(((passCount / finalizedCount) * 100).toFixed(2))
      : 0;

  // Question-wise aggregates
  const questionAnalytics = [];
  const questionsList = exam.questions || [];

  questionsList.forEach((q) => {
    const qid = q._id.toString();
    const finalScores = [];
    const aiScores = [];
    let qOverridden = 0;

    finalized.forEach((e) => {
      const eq = e.questions.find((eqLine) => eqLine.questionId.toString() === qid);
      if (eq) {
        const aiScoreVal = eq.aiAwardedMarks !== undefined ? eq.aiAwardedMarks : (eq.aiMarks || 0);
        const finalScoreVal =
          eq.finalAwardedMarks !== undefined && eq.finalAwardedMarks !== null
            ? eq.finalAwardedMarks
            : aiScoreVal;

        aiScores.push(aiScoreVal);
        finalScores.push(finalScoreVal);

        if (eq.wasOverridden || eq.reviewType === "overridden") {
          qOverridden++;
        }
      }
    });

    const maxMarks = q.maximumMarks || 0;
    let averageMarks = 0;
    let aiAverageMarks = 0;
    let averagePercentage = 0;
    let highestMarks = 0;
    let lowestMarks = 0;
    let zeroCount = 0;
    let fullMarksCount = 0;

    if (finalScores.length > 0) {
      const totalScore = finalScores.reduce((s, val) => s + val, 0);
      const totalAiScore = aiScores.reduce((s, val) => s + val, 0);

      averageMarks = parseFloat((totalScore / finalScores.length).toFixed(2));
      aiAverageMarks = parseFloat((totalAiScore / aiScores.length).toFixed(2));

      averagePercentage =
        maxMarks > 0 ? parseFloat(((averageMarks / maxMarks) * 100).toFixed(2)) : 0;
      highestMarks = Math.max(...finalScores);
      lowestMarks = Math.min(...finalScores);
      zeroCount = finalScores.filter((s) => s === 0).length;
      fullMarksCount = finalScores.filter((s) => s === maxMarks).length;
    }

    let performanceDifficulty = "moderate";
    if (averagePercentage < 40) {
      performanceDifficulty = "difficult";
    } else if (averagePercentage > 70) {
      performanceDifficulty = "easy";
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
      zeroCount,
      fullMarksCount,
      overriddenCount: qOverridden,
      performanceDifficulty,
    });
  });

  const insights = [];
  if (finalizedCount > 0 && questionAnalytics.length > 0) {
    const hardest = [...questionAnalytics].sort(
      (a, b) => a.averagePercentage - b.averagePercentage
    )[0];
    if (hardest && hardest.averagePercentage < 50) {
      insights.push(
        `Question Q${hardest.questionNumber} had the lowest performance average of ${hardest.averagePercentage}%.`
      );
    }

    const easiest = [...questionAnalytics].sort(
      (a, b) => b.averagePercentage - a.averagePercentage
    )[0];
    if (easiest && easiest.averagePercentage > 75) {
      insights.push(
        `Question Q${easiest.questionNumber} was answered correctly by most candidates with an average score of ${easiest.averagePercentage}%.`
      );
    }

    insights.push(
      `The average finalized exam performance across candidates was ${averagePercentage}%.`
    );

    if (aiOverriddenCount > 0) {
      insights.push(
        `Faculty modified ${aiOverriddenCount} question evaluations (${marksIncreasedCount} increased, ${marksDecreasedCount} decreased).`
      );
    } else {
      insights.push(`Faculty accepted all AI evaluations without modification.`);
    }

    const highScorers = finalized.filter((e) => e.percentage >= 80).length;
    if (highScorers > 0) {
      insights.push(`${highScorers} candidate(s) achieved top performance marks above 80%.`);
    }
  } else {
    insights.push("No finalized evaluation records compiled yet for this exam.");
  }

  return {
    totalAnswerSheets,
    totalEvaluated: finalizedCount + pendingReview + failed,
    finalizedResults: finalizedCount,
    pendingReview,
    processing,
    failed,
    averageMarks,
    averagePercentage,
    highestScore,
    lowestScore,
    passCount,
    failCount,
    passPercentage,
    hasPassingRule,
    passingMarks,
    distribution,
    aiFacultyComparison: {
      averageAIMarks,
      averageFinalMarks,
      averageDifference,
      aiAcceptedCount,
      aiOverriddenCount,
    },
    facultyOverrideSummary: {
      totalQuestions: totalQuestionsEvaluated,
      aiAccepted: aiAcceptedCount,
      aiOverridden: aiOverriddenCount,
      marksIncreased: marksIncreasedCount,
      marksDecreased: marksDecreasedCount,
    },
    questionAnalytics,
    insights,
  };
};

/**
 * Returns fully hydrated individual result for details view.
 */
export const getIndividualResult = async (evaluationId, userId, userRole) => {
  const e = await Evaluation.findById(evaluationId).populate({
    path: "answerSheet",
    populate: [
      { path: "student", select: "name email rollNo" },
      { path: "exam" },
      { path: "subject" },
    ],
  });

  if (!e) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Evaluation details not found");
  }

  const sheet = e.answerSheet;
  const exam = sheet?.exam;
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam association missing");
  }

  if (userRole === ROLES.FACULTY && exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this exam.");
  }

  // Student authorization check: student can only view their own result, and only if published
  if (userRole === ROLES.STUDENT) {
    if (!sheet.student || sheet.student._id.toString() !== userId.toString()) {
      throw new ApiError(
        STATUS_CODES.FORBIDDEN,
        "Access denied. You can only view your own evaluation results."
      );
    }
    const publicationStatus = sheet?.resultPublication?.status || "NOT_READY";
    if (publicationStatus !== "RESULT_PUBLISHED") {
      throw new ApiError(
        STATUS_CODES.FORBIDDEN,
        "Results for this evaluation have not been published by the faculty yet."
      );
    }
  }

  const { hasPassingRule, passingMarks } = resolvePassingRule(exam);
  const isFinalized = ["FINALIZED", "finalized", "PUBLISHED", "published"].includes(e.evaluationStatus);

  // Compute question-wise breakdown and totals
  let aiTotalMarks = 0;
  let finalTotalMarks = 0;
  let pendingQuestionsCount = 0;

  const questions = e.questions.map((q) => {
    const eq = exam.questions?.find((examQ) => examQ._id.toString() === q.questionId.toString());
    const aiScore = q.aiAwardedMarks !== undefined ? q.aiAwardedMarks : (q.aiMarks || 0);
    const finalScore =
      q.finalAwardedMarks !== undefined && q.finalAwardedMarks !== null
        ? q.finalAwardedMarks
        : aiScore;

    aiTotalMarks += aiScore;
    finalTotalMarks += finalScore;

    if (q.reviewStatus !== "finalized" && q.facultyEvaluation?.status !== "finalized") {
      pendingQuestionsCount++;
    }

    return {
      questionId: q.questionId,
      questionNumber: eq?.questionNumber || q.questionNumber || 1,
      questionText: eq?.questionText || "",
      maxMarks: eq?.maximumMarks || q.maximumMarks || 0,
      recognizedText: q.recognizedText,
      studentAnswer: q.studentAnswer,
      modelAnswer: eq?.modelAnswer || q.modelAnswer || "",
      aiAwardedMarks: aiScore,
      finalAwardedMarks: finalScore,
      differenceMarks: parseFloat((finalScore - aiScore).toFixed(2)),
      wasOverridden: Boolean(q.wasOverridden || q.reviewType === "overridden"),
      overrideReason: q.overrideReason || q.facultyEvaluation?.overrideReason || "",
      facultyComment: q.facultyComment || q.facultyEvaluation?.comment || "",
      feedback: q.feedback,
      matchedKeywords: q.matchedKeywords || [],
      missingKeywords: q.missingKeywords || [],
      criteriaScores: q.criteriaScores || [],
    };
  });

  const totalMaxMarks = e.totalMarks;
  const percentage = totalMaxMarks > 0 ? parseFloat(((finalTotalMarks / totalMaxMarks) * 100).toFixed(2)) : 0;

  let resultStatus = "Not Configured";
  if (isFinalized) {
    if (hasPassingRule && passingMarks !== null) {
      resultStatus = finalTotalMarks >= passingMarks ? "PASS" : "FAIL";
    }
  } else {
    resultStatus = "Pending";
  }

  return {
    evaluationId: e._id,
    answerSheetId: sheet?._id,
    studentIdentifier:
      sheet?.studentIdentifier ||
      sheet?.student?.rollNo ||
      sheet?.student?.name ||
      "Unknown Candidate",
    studentName: sheet?.student?.name,
    filename: sheet?.uploadedFileName,
    examId: exam._id,
    examTitle: exam.title,
    examCode: exam.examCode,
    subjectName: sheet?.subject?.name,
    subjectCode: sheet?.subject?.code,
    obtainedMarks: isFinalized ? e.obtainedMarks : finalTotalMarks,
    aiTotalMarks: parseFloat(aiTotalMarks.toFixed(2)),
    finalTotalMarks: isFinalized ? e.obtainedMarks : finalTotalMarks,
    differenceMarks: parseFloat(((isFinalized ? e.obtainedMarks : finalTotalMarks) - aiTotalMarks).toFixed(2)),
    totalMarks: totalMaxMarks,
    percentage,
    grade: e.grade,
    status: e.evaluationStatus,
    isFinalized,
    pendingQuestionsCount,
    resultStatus,
    hasPassingRule,
    passingMarks,
    publicationStatus: sheet?.resultPublication?.status || "NOT_READY",
    finalizedAt: e.updatedAt,
    strengths: e.strengths,
    weaknesses: e.weaknesses,
    suggestions: e.suggestions,
    questions,
  };
};

/**
 * Returns CSV string representing results list with per-question dynamic columns.
 */
export const exportExamResultsCSV = async (examId, userId, userRole) => {
  const exam = await verifyExamOwnership(examId, userId, userRole);
  const { hasPassingRule, passingMarks } = resolvePassingRule(exam);

  const sheets = await AnswerSheet.find({ exam: examId, isDeleted: { $ne: true } }).populate(
    "student",
    "name email rollNo"
  );

  const sheetIds = sheets.map((s) => s._id);
  const evals = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    isDeleted: { $ne: true },
  }).populate({
    path: "answerSheet",
    populate: { path: "student", select: "name email rollNo" },
  });

  const sortedExamQuestions = [...(exam.questions || [])].sort(
    (a, b) => a.questionNumber - b.questionNumber
  );

  // Dynamic headers: Enrollment Number, Student Name, Exam, Q1 AI, Q1 Final, Q2 AI, Q2 Final, ..., AI Total, Final Total, Max Marks, Percentage, Status, Review Status
  const qHeaders = sortedExamQuestions.flatMap((q) => [
    `Q${q.questionNumber} AI`,
    `Q${q.questionNumber} Final`,
  ]);

  const headers = [
    "Enrollment Number",
    "Candidate Name",
    "Exam Title",
    ...qHeaders,
    "AI Total Marks",
    "Final Total Marks",
    "Maximum Marks",
    "Percentage",
    "Result Status",
    "Review Status",
    "Finalized Date",
  ];

  const fileRows = [headers.join(",")];

  evals.forEach((e) => {
    const s = e.answerSheet;
    const student = s?.student;
    const identifier =
      s?.studentIdentifier || student?.rollNo || student?.name || "Unknown Candidate";
    const name = student?.name || "Unknown Candidate";
    const dateStr = new Date(e.updatedAt).toISOString().split("T")[0];

    const isFinalized = e.evaluationStatus === "finalized";
    const finalMarksTotal = isFinalized ? e.obtainedMarks : e.obtainedMarks || 0;

    let resultStatus = "Not Configured";
    if (isFinalized) {
      if (hasPassingRule && passingMarks !== null) {
        resultStatus = finalMarksTotal >= passingMarks ? "PASS" : "FAIL";
      }
    } else {
      resultStatus = "Pending";
    }

    let aiTotal = 0;
    const qCols = sortedExamQuestions.flatMap((q) => {
      const qid = q._id.toString();
      const eq = (e.questions || []).find((eqLine) => eqLine.questionId.toString() === qid);
      if (eq) {
        const aiScore = eq.aiAwardedMarks !== undefined ? eq.aiAwardedMarks : (eq.aiMarks || 0);
        const finalScore =
          eq.finalAwardedMarks !== undefined && eq.finalAwardedMarks !== null
            ? eq.finalAwardedMarks
            : aiScore;
        aiTotal += aiScore;
        return [aiScore, finalScore];
      }
      return ["-", "-"];
    });

    const escId = "\"" + identifier.replace(/"/g, "\"\"") + "\"";
    const escName = "\"" + name.replace(/"/g, "\"\"") + "\"";
    const escExam = "\"" + exam.title.replace(/"/g, "\"\"") + "\"";

    const row = [
      escId,
      escName,
      escExam,
      ...qCols,
      aiTotal,
      finalMarksTotal,
      e.totalMarks,
      `${e.percentage}%`,
      resultStatus,
      e.evaluationStatus,
      dateStr,
    ];

    fileRows.push(row.join(","));
  });

  return fileRows.join("\n");
};

/**
 * Returns HTML representation of summary report.
 */
export const generateExamSummaryHTML = (exam, analytics, results) => {
  const dateStr = new Date().toLocaleDateString();
  const { hasPassingRule, passingMarks } = resolvePassingRule(exam);

  const rows = results
    .map(
      (r) => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #ddd;">${r.studentIdentifier}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd;">${r.studentName}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${r.aiTotalMarks}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right; font-weight:bold;">${r.obtainedMarks} / ${r.totalMarks}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${r.percentage}%</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center;">
        <span style="font-weight:bold; padding:2px 6px; border-radius:4px; font-size:10px; ${
          r.resultStatus === "PASS"
            ? "background:#d1fae5; color:#065f46;"
            : r.resultStatus === "FAIL"
            ? "background:#fee2e2; color:#991b1b;"
            : "background:#f3f4f6; color:#4b5563;"
        }">${r.resultStatus}</span>
      </td>
      <td style="padding:8px; border-bottom:1px solid #ddd;">${r.status}</td>
    </tr>
  `
    )
    .join("");

  const qRows = analytics.questionAnalytics
    .map(
      (q) => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center;">Q${q.questionNumber}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${q.maxMarks}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${q.aiAverageMarks || 0}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right; font-weight:bold;">${q.averageMarks} (${q.averagePercentage}%)</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center;">${q.overriddenCount || 0}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center;">${q.performanceDifficulty.toUpperCase()}</td>
    </tr>
  `
    )
    .join("");

  return `
    <html>
    <head>
      <title>Exam Evaluation Summary Report</title>
      <style>
        body { font-family: sans-serif; color: #333; line-height: 1.4; padding: 20px; }
        h1, h2 { color: #1e3a8a; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
        .card { background: #f3f4f6; padding: 12px; border-radius: 8px; text-align: center; }
        .card-val { font-size: 18px; font-weight: bold; color: #111827; }
        .card-lbl { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-top:4px;}
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px; }
        th { background: #1e3a8a; color: white; padding: 8px; text-align: left; }
      </style>
    </head>
    <body onload="window.print()">
      <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
        <h1 style="margin:0; font-size:24px;">AI-Based Automated Answer Sheet Evaluation</h1>
        <h2 style="margin:5px 0 0 0; font-size:16px; font-weight:normal; color:#555;">Class-Level Academic Result & Evaluation Summary</h2>
      </div>

      <div style="display:flex; justify-content:space-between; margin-bottom: 20px; font-size:12px;">
        <div>
          <strong>Exam Title:</strong> ${exam.title}<br/>
          <strong>Exam Code:</strong> ${exam.examCode || "N/A"}<br/>
          <strong>Subject:</strong> ${exam.subject?.code} - ${exam.subject?.name}
        </div>
        <div style="text-align:right;">
          <strong>Date Generated:</strong> ${dateStr}<br/>
          <strong>Passing Rule:</strong> ${hasPassingRule ? `Configured (${passingMarks} Marks)` : "Not Configured"}<br/>
          <strong>Finalized Stats Reference:</strong> ${analytics.finalizedResults} scripts
        </div>
      </div>

      <h2>Performance Statistics</h2>
      <div class="grid">
        <div class="card">
          <div class="card-val">${analytics.totalAnswerSheets}</div>
          <div class="card-lbl">Total Answer Sheets</div>
        </div>
        <div class="card">
          <div class="card-val">${analytics.finalizedResults}</div>
          <div class="card-lbl">Finalized Results</div>
        </div>
        <div class="card">
          <div class="card-val">${analytics.averagePercentage}%</div>
          <div class="card-lbl">Class Average</div>
        </div>
        <div class="card">
          <div class="card-val">${analytics.highestScore} / ${exam.totalMarks}</div>
          <div class="card-lbl">Highest Score</div>
        </div>
      </div>

      <h2>AI vs Faculty Audit Summary</h2>
      <div class="grid">
        <div class="card">
          <div class="card-val">${analytics.aiFacultyComparison?.averageAIMarks || 0}</div>
          <div class="card-lbl">Avg AI Marks</div>
        </div>
        <div class="card">
          <div class="card-val">${analytics.aiFacultyComparison?.averageFinalMarks || 0}</div>
          <div class="card-lbl">Avg Final Marks</div>
        </div>
        <div class="card">
          <div class="card-val">${analytics.facultyOverrideSummary?.aiAccepted || 0}</div>
          <div class="card-lbl">AI Accepted</div>
        </div>
        <div class="card">
          <div class="card-val">${analytics.facultyOverrideSummary?.aiOverridden || 0}</div>
          <div class="card-lbl">Faculty Overridden</div>
        </div>
      </div>

      <h2>Question Performance Analysis</h2>
      <table>
        <thead>
          <tr>
            <th style="text-align:center;">Question</th>
            <th style="text-align:right;">Max Marks</th>
            <th style="text-align:right;">Avg AI Marks</th>
            <th style="text-align:right;">Avg Final Marks</th>
            <th style="text-align:center;">Overridden Count</th>
            <th style="text-align:center;">Difficulty</th>
          </tr>
        </thead>
        <tbody>
          ${qRows}
        </tbody>
      </table>

      <h2>Student Academic Results</h2>
      <table>
        <thead>
          <tr>
            <th>Enrollment Number</th>
            <th>Candidate Name</th>
            <th style="text-align:right;">AI Marks</th>
            <th style="text-align:right;">Faculty Final Marks</th>
            <th style="text-align:right;">Percentage</th>
            <th style="text-align:center;">Result Status</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </body>
    </html>
  `;
};

/**
 * Returns HTML representation of individual report.
 */
export const generateIndividualReportHTML = (result) => {
  const evalDateStr = result.evaluatedAt ? new Date(result.evaluatedAt).toLocaleDateString() : "N/A";
  const finalDateStr = result.finalizedAt ? new Date(result.finalizedAt).toLocaleDateString() : new Date().toLocaleDateString();
  const pubDateStr = result.publishedAt ? new Date(result.publishedAt).toLocaleDateString() : (result.publicationStatus === "RESULT_PUBLISHED" ? new Date().toLocaleDateString() : "Not Published");

  const qTableRows = result.questions
    .map((q) => {
      const isOverride = q.wasOverridden
        ? `<span style="color:#d97706; font-size:10px; font-weight:bold; margin-left:6px;">[FACULTY OVERRIDDEN: ${q.differenceMarks > 0 ? "+" : ""}${q.differenceMarks}]</span>`
        : "";

      return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding:10px; text-align:center; font-weight:bold;">Q${q.questionNumber} ${isOverride}</td>
        <td style="padding:10px; text-align:right; font-weight:bold; color:#4b5563;">${q.aiAwardedMarks}</td>
        <td style="padding:10px; text-align:right; font-weight:bold; color:#1e3a8a;">${q.finalAwardedMarks}</td>
        <td style="padding:10px; text-align:right; font-weight:bold;">${q.maxMarks}</td>
        <td style="padding:10px; font-size:11px;">
          <div><strong>Student Transcription:</strong> <span style="font-family:monospace; color:#374151;">${q.studentAnswer || q.recognizedText || "[No Text Extracted]"}</span></div>
          <div style="margin-top:4px;"><strong>AI Feedback:</strong> ${q.feedback || "None"}</div>
          ${q.matchedKeywords.length ? `<div style="margin-top:3px; color:#065f46;">🌱 <strong>Matched Concepts:</strong> ${q.matchedKeywords.join(", ")}</div>` : ""}
          ${q.missingKeywords.length ? `<div style="margin-top:3px; color:#991b1b;">⚠️ <strong>Missing Concepts:</strong> ${q.missingKeywords.join(", ")}</div>` : ""}
          ${q.wasOverridden && (q.facultyComment || q.overrideReason) ? `<div style="margin-top:4px; padding:4px 6px; background:#fffbeb; border-left:3px solid #d97706;">✍️ <strong>Faculty Remarks:</strong> "${q.facultyComment || q.overrideReason}"</div>` : ""}
        </td>
      </tr>
    `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>CHARUSAT - Evaluation Report (${result.studentIdentifier})</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; line-height: 1.5; padding: 25px; background:#ffffff; }
        .header { border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center; }
        .institution-title { font-size: 26px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.5px; }
        .sub-title { font-size: 14px; font-weight: 600; color: #4b5563; text-transform: uppercase; }
        .section-title { font-size: 14px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 12px; }
        .score-banner { background: #1e3a8a; color: white; padding: 15px; border-radius: 8px; text-align: center; margin-top: 20px; margin-bottom: 20px; }
        .score-val { font-size: 24px; font-weight: 900; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th { background: #1e3a8a; color: white; padding: 8px; text-align: left; }
        @media print {
          body { padding: 0; background: white; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body onload="window.print()">
      <div class="header">
        <div>
          <div class="institution-title">CHARUSAT</div>
          <div class="sub-title">AI-Based Automated Answer Sheet Evaluation System</div>
        </div>
        <div style="text-align:right;">
          <span style="font-size:12px; font-weight:bold; background:#e0e7ff; color:#3730a3; padding:4px 10px; border-radius:12px;">EVALUATION REPORT</span>
        </div>
      </div>

      <div class="grid-info">
        <div>
          <div style="font-size:14px; font-weight:bold; color:#111827; margin-bottom:6px;">Student Information</div>
          <strong>Student / Roll No:</strong> ${result.studentIdentifier}<br/>
          <strong>Student Name:</strong> ${result.studentName || "N/A"}<br/>
          <strong>Evaluation Status:</strong> <span style="font-weight:bold; color:#1e3a8a;">${(result.status || "FINALIZED").toUpperCase()}</span><br/>
          <strong>Publication Status:</strong> ${result.publicationStatus || "NOT_READY"}
        </div>
        <div>
          <div style="font-size:14px; font-weight:bold; color:#111827; margin-bottom:6px;">Exam Information</div>
          <strong>Exam Title:</strong> ${result.examTitle} (${result.examCode || "N/A"})<br/>
          <strong>Subject:</strong> ${result.subjectCode || ""} ${result.subjectName || ""}<br/>
          <strong>Evaluation Date:</strong> ${evalDateStr}<br/>
          <strong>Finalization Date:</strong> ${finalDateStr}<br/>
          <strong>Publication Date:</strong> ${pubDateStr}
        </div>
      </div>

      <div class="score-banner">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; opacity:0.9;">Official Final Evaluation Marks</div>
        <div class="score-val">${result.obtainedMarks} / ${result.totalMarks} Marks (${result.percentage}%)</div>
        <div style="font-size:12px; margin-top:4px;">Result Status: <strong>${result.resultStatus || (result.percentage >= 40 ? "PASS" : "FAIL")}</strong></div>
      </div>

      <div class="section-title">Question-wise Evaluation & Audit Details</div>
      <table>
        <thead>
          <tr>
            <th style="width:10%; text-align:center;">Question</th>
            <th style="width:10%; text-align:right;">AI Marks</th>
            <th style="width:12%; text-align:right;">Faculty Final Marks</th>
            <th style="width:10%; text-align:right;">Max Marks</th>
            <th style="width:58%;">Evaluation Feedback & Transcription</th>
          </tr>
        </thead>
        <tbody>
          ${qTableRows}
        </tbody>
      </table>

      ${result.facultyRemarks ? `
        <div class="section-title">Overall Faculty Remarks</div>
        <div style="background:#fffbeb; border:1px solid #fef3c7; border-left:4px solid #d97706; padding:12px; border-radius:6px; font-size:12px; font-style:italic;">
          "${result.facultyRemarks}"
        </div>
      ` : ""}
    </body>
    </html>
  `;
};

export default {
  getResultsForExam,
  getExamAnalytics,
  getIndividualResult,
  exportExamResultsCSV,
  generateExamSummaryHTML,
  generateIndividualReportHTML,
};
