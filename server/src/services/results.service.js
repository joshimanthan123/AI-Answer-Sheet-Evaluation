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
 * Returns paginated results list for an exam.
 */
export const getResultsForExam = async (examId, query = {}, userId, userRole) => {
  await verifyExamOwnership(examId, userId, userRole);

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
    } else if (status === "pending_finalization") {
      evalQuery.evaluationStatus = { $in: ["completed", "reviewed"] };
    } else if (status === "processing") {
      evalQuery.evaluationStatus = { $in: ["pending", "queued", "processing"] };
    } else if (status === "failed") {
      evalQuery.evaluationStatus = "failed";
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
    return {
      evaluationId: e._id,
      answerSheetId: sheet?._id,
      studentIdentifier:
        sheet?.studentIdentifier || student?.rollNo || student?.name || "Unknown Candidate",
      studentName: student?.name || "Unknown Candidate",
      filename: sheet?.uploadedFileName || "Scan",
      obtainedMarks: e.obtainedMarks,
      totalMarks: e.totalMarks,
      percentage: e.percentage,
      status: e.evaluationStatus,
      finalizedAt: e.updatedAt,
    };
  });

  return {
    results,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * Returns overall exam statistics and question-wise aggregates.
 */
export const getExamAnalytics = async (examId, userId, userRole) => {
  const exam = await verifyExamOwnership(examId, userId, userRole);

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
    ["completed", "reviewed"].includes(e.evaluationStatus)
  ).length;
  const processing = allEvals.filter((e) =>
    ["pending", "queued", "processing"].includes(e.evaluationStatus)
  ).length;
  const failed = allEvals.filter((e) => e.evaluationStatus === "failed").length;

  let averageMarks = 0;
  let averagePercentage = 0;
  let highestScore = 0;
  let lowestScore = 0;
  let passCount = 0;
  let failCount = 0;

  const passingMarks = exam.passingMarks || Math.round(exam.totalMarks * 0.4);

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

      if (marks >= passingMarks) {
        passCount++;
      } else {
        failCount++;
      }

      if (percent <= 20) distribution["0-20%"]++;
      else if (percent <= 40) distribution["21-40%"]++;
      else if (percent <= 60) distribution["41-60%"]++;
      else if (percent <= 80) distribution["61-80%"]++;
      else distribution["81-100%"]++;
    });

    averageMarks = parseFloat((sumMarks / finalizedCount).toFixed(2));
    averagePercentage = parseFloat((sumPercent / finalizedCount).toFixed(2));
    if (lowestScore === Infinity) lowestScore = 0;
    if (highestScore === -Infinity) highestScore = 0;
  }

  const passPercentage =
    finalizedCount > 0 ? parseFloat(((passCount / finalizedCount) * 100).toFixed(2)) : 0;

  // Question-wise aggregates
  const questionAnalytics = [];
  const questionsList = exam.questions || [];

  questionsList.forEach((q) => {
    const qid = q._id.toString();
    const scores = [];

    finalized.forEach((e) => {
      const eq = e.questions.find((eqLine) => eqLine.questionId.toString() === qid);
      if (eq) {
        const scoreVal =
          eq.finalAwardedMarks !== undefined && eq.finalAwardedMarks !== null
            ? eq.finalAwardedMarks
            : eq.aiAwardedMarks;
        scores.push(scoreVal);
      }
    });

    const maxMarks = q.maximumMarks || 0;
    let averageMarks = 0;
    let averagePercentage = 0;
    let highestMarks = 0;
    let lowestMarks = 0;
    let zeroCount = 0;
    let fullMarksCount = 0;

    if (scores.length > 0) {
      const totalScore = scores.reduce((s, val) => s + val, 0);
      averageMarks = parseFloat((totalScore / scores.length).toFixed(2));
      averagePercentage =
        maxMarks > 0 ? parseFloat(((averageMarks / maxMarks) * 100).toFixed(2)) : 0;
      highestMarks = Math.max(...scores);
      lowestMarks = Math.min(...scores);
      zeroCount = scores.filter((s) => s === 0).length;
      fullMarksCount = scores.filter((s) => s === maxMarks).length;
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
      maxMarks,
      averageMarks,
      averagePercentage,
      highestMarks,
      lowestMarks,
      zeroCount,
      fullMarksCount,
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
        `Question ${hardest.questionNumber} had the lowest performance average of ${hardest.averagePercentage}%.`
      );
    }

    const easiest = [...questionAnalytics].sort(
      (a, b) => b.averagePercentage - a.averagePercentage
    )[0];
    if (easiest && easiest.averagePercentage > 75) {
      insights.push(
        `Question ${easiest.questionNumber} was answered correctly by most candidates with an average score of ${easiest.averagePercentage}%.`
      );
    }

    insights.push(
      `The average exam grade performance across candidates was ${averagePercentage}%.`
    );

    const highScorers = finalized.filter((e) => e.percentage >= 80).length;
    if (highScorers > 0) {
      insights.push(`${highScorers} candidate(s) achieved excellent marks above 80%.`);
    }
  } else {
    insights.push("No finalized analytics profiles compiled yet.");
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
    distribution,
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
    obtainedMarks: e.obtainedMarks,
    totalMarks: e.totalMarks,
    percentage: e.percentage,
    grade: e.grade,
    status: e.evaluationStatus,
    publicationStatus: sheet?.resultPublication?.status || "NOT_READY",
    finalizedAt: e.updatedAt,
    strengths: e.strengths,
    weaknesses: e.weaknesses,
    suggestions: e.suggestions,
    questions: e.questions.map((q) => {
      // Find matching exam question max marks
      const eq = exam.questions?.find((examQ) => examQ._id.toString() === q.questionId.toString());
      return {
        questionId: q.questionId,
        questionNumber: eq?.questionNumber || 1,
        questionText: eq?.questionText || "",
        maxMarks: eq?.maximumMarks || 0,
        recognizedText: q.recognizedText,
        studentAnswer: q.studentAnswer,
        modelAnswer: eq?.modelAnswer || q.modelAnswer || "",
        aiAwardedMarks: q.aiAwardedMarks,
        finalAwardedMarks:
          q.finalAwardedMarks !== undefined && q.finalAwardedMarks !== null
            ? q.finalAwardedMarks
            : q.aiAwardedMarks,
        wasOverridden: q.wasOverridden,
        overrideReason: q.overrideReason,
        facultyComment: q.facultyComment,
        feedback: q.feedback,
        matchedKeywords: q.matchedKeywords || [],
        missingKeywords: q.missingKeywords || [],
        criteriaScores: q.criteriaScores || [],
      };
    }),
  };
};

/**
 * Returns CSV string representing results list.
 */
export const exportExamResultsCSV = async (examId, userId, userRole) => {
  await verifyExamOwnership(examId, userId, userRole);

  const sheets = await AnswerSheet.find({ exam: examId, isDeleted: { $ne: true } }).populate(
    "student",
    "name email rollNo"
  );

  const sheetIds = sheets.map((s) => s._id);
  const evals = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    evaluationStatus: "finalized",
    isDeleted: { $ne: true },
  }).populate({
    path: "answerSheet",
    populate: { path: "student", select: "name email rollNo" },
  });

  let fileRows = [
    "Student Identifier,Candidate Name,Filename,Total Marks,Maximum Marks,Percentage,Evaluation Status,Finalized Date",
  ];

  evals.forEach((e) => {
    const s = e.answerSheet;
    const student = s?.student;
    const identifier =
      s?.studentIdentifier || student?.rollNo || student?.name || "Unknown Candidate";
    const name = student?.name || "Unknown Candidate";
    const filename = s?.uploadedFileName || "Scan";
    const dateStr = new Date(e.updatedAt).toISOString().split("T")[0];

    // Escape commas
    const escId = "\"" + identifier.replace(/"/g, "\"\"") + "\"";
    const escName = "\"" + name.replace(/"/g, "\"\"") + "\"";
    const escFile = "\"" + filename.replace(/"/g, "\"\"") + "\"";

    fileRows.push(
      `${escId},${escName},${escFile},${e.obtainedMarks},${e.totalMarks},${e.percentage}%,${e.evaluationStatus},${dateStr}`
    );
  });

  return fileRows.join("\n");
};

/**
 * Returns HTML representation of summary report.
 */
export const generateExamSummaryHTML = (exam, analytics, results) => {
  const dateStr = new Date().toLocaleDateString();
  const rows = results
    .map(
      (r) => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #ddd;">${r.studentIdentifier}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd;">${r.studentName}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd;">${r.filename}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${r.obtainedMarks} / ${r.totalMarks}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${r.percentage}%</td>
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
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${q.averageMarks} (${q.averagePercentage}%)</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${q.highestMarks}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">${q.lowestMarks}</td>
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
        .card { background: #f3f4f6; padding: 12px; rounded: 8px; border-radius: 8px; text-align: center; }
        .card-val { font-size: 18px; font-weight: bold; color: #111827; }
        .card-lbl { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-top:4px;}
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px; }
        th { background: #1e3a8a; color: white; padding: 8px; text-align: left; }
      </style>
    </head>
    <body onload="window.print()">
      <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
        <h1 style="margin:0; font-size:24px;">AI-Based Automated Answer Sheet Evaluation</h1>
        <h2 style="margin:5px 0 0 0; font-size:16px; font-weight:normal; color:#555;">Class-Level Exam Summary Report</h2>
      </div>

      <div style="display:flex; justify-content:space-between; margin-bottom: 20px; font-size:12px;">
        <div>
          <strong>Exam Title:</strong> ${exam.title}<br/>
          <strong>Exam Code:</strong> ${exam.examCode || "N/A"}<br/>
          <strong>Subject:</strong> ${exam.subject?.code} - ${exam.subject?.name}
        </div>
        <div style="text-align:right;">
          <strong>Date Generated:</strong> ${dateStr}<br/>
          <strong>Finalized Stats Reference:</strong> ${analytics.finalizedResults} scripts
        </div>
      </div>

      <h2>Performance Statistics</h2>
      <div class="grid">
        <div class="card">
          <div class="card-val">${analytics.totalAnswerSheets}</div>
          <div class="card-lbl">Total Scans</div>
        </div>
        <div class="card">
          <div class="card-val">${analytics.finalizedResults}</div>
          <div class="card-lbl">Finalized</div>
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

      <h2>Question Performance Analysis</h2>
      <table>
        <thead>
          <tr>
            <th style="text-align:center;">Question</th>
            <th style="text-align:right;">Max Marks</th>
            <th style="text-align:right;">Average score</th>
            <th style="text-align:right;">Highest Marks</th>
            <th style="text-align:right;">Lowest Marks</th>
            <th style="text-align:center;">Performance Difficulty</th>
          </tr>
        </thead>
        <tbody>
          ${qRows}
        </tbody>
      </table>

      <h2>Student Results Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Student Identifier</th>
            <th>Candidate Name</th>
            <th>Filename</th>
            <th style="text-align:right;">Marks Obtained</th>
            <th style="text-align:right;">Percentage</th>
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
  const dateStr = new Date(result.finalizedAt || Date.now()).toLocaleDateString();

  const qRows = result.questions
    .map((q) => {
      const isOverride = q.wasOverridden
        ? "<span style=\"color:#d97706; font-size:10px; font-weight:bold; margin-left:8px;\">[FACULTY OVERRIDDEN]</span>"
        : "";

      return `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size:12px; background:#fff;">
        <div style="display:flex; justify-content:space-between; font-weight:bold; border-bottom:1px solid #eee; padding-bottom:6px; margin-bottom:6px; background:#f9fafb; padding:4px 8px; margin:-12px -12px 10px -12px; border-radius: 8px 8px 0 0;">
          <span>Question ${q.questionNumber} ${isOverride}</span>
          <span>Marks Obtained: ${q.finalAwardedMarks} / ${q.maxMarks}</span>
        </div>
        <div style="margin-bottom:8px;"><strong>Question Text:</strong> ${q.questionText}</div>
        <div style="margin-bottom:8px; background:#f0f9ff; padding:8px; border-radius:6px; font-family:monospace; white-space:pre-wrap;"><strong>Student Transcription:</strong> ${q.studentAnswer || q.recognizedText || "[No Written Answer Extracted]"}</div>
        <div style="margin-bottom:8px;"><strong>AI Semantic Rubric Feedback:</strong> ${q.feedback || "None"}</div>
        ${q.matchedKeywords.length ? `<div style="margin-bottom:4px; font-size:11px;">🌱 <strong>Matched Keywords:</strong> ${q.matchedKeywords.join(", ")}</div>` : ""}
        ${q.missingKeywords.length ? `<div style="margin-bottom:4px; font-size:11px; color:#b91c1c;">⚠️ <strong>Missing Key Concepts:</strong> ${q.missingKeywords.join(", ")}</div>` : ""}
        ${q.facultyComment ? `<div style="margin-top:8px; padding:6px; border-left:3px solid #d97706; background:#fffbeb; font-size:11.5px;">✍️ <strong>Faculty Override Justification:</strong> "${q.facultyComment}"</div>` : ""}
      </div>
    `;
    })
    .join("");

  return `
    <html>
    <head>
      <title>Individual Evaluation Report - ${result.studentIdentifier}</title>
      <style>
        body { font-family: sans-serif; color: #333; line-height: 1.4; padding: 20px; background:#f9fafb; }
        h1, h2 { color: #1e3a8a; }
      </style>
    </head>
    <body onload="window.print()">
      <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 25px; background:white; padding:15px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <h1 style="margin:0; font-size:22px;">AI-Based Automated Answer Sheet Evaluation</h1>
        <h2 style="margin:5px 0 0 0; font-size:15px; font-weight:normal; color:#555;">Candidate Individual Performance Report</h2>
      </div>

      <div style="display:flex; justify-content:space-between; margin-bottom: 25px; font-size:12px; background:white; padding:15px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div>
          <strong>Student Identifier:</strong> ${result.studentIdentifier}<br/>
          <strong>Candidate Name:</strong> ${result.studentName}<br/>
          <strong>Scan Filename:</strong> ${result.filename}
        </div>
        <div style="text-align:right;">
          <strong>Exam:</strong> ${result.examTitle} (${result.examCode})<br/>
          <strong>Subject:</strong> ${result.subjectCode} - ${result.subjectName}<br/>
          <strong>Finalized Date:</strong> ${dateStr}
        </div>
      </div>

      <div style="background:#1e3a8a; color:white; padding:15px; border-radius:8px; text-align:center; font-size:20px; font-weight:bold; margin-bottom:25px;">
        FINAL GRADE PERFORMANCE: ${result.obtainedMarks} / ${result.totalMarks} (${result.percentage}%) • GRADE ${result.grade || "F"}
      </div>

      <h2>Evaluation Strengths & Weaknesses</h2>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:25px; font-size:12px;">
        <div style="background:#ecfdf5; border-left:4px solid #10b981; padding:12px; border-radius:6px;">
          <strong style="color:#065f46; display:block; margin-bottom:6px;">Conceptual Strengths</strong>
          ${result.strengths || "None noted during AI rubrics checks."}
        </div>
        <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:12px; border-radius:6px;">
          <strong style="color:#991b1b; display:block; margin-bottom:6px;">Key Improvements Required</strong>
          ${result.weaknesses || "Critical issues were not detected."}
        </div>
      </div>

      <h2>Question-wise Assessment Details</h2>
      ${qRows}
    </body>
    </html>
  `;
};
