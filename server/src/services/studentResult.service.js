import mongoose from "mongoose";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";

/**
 * Retrieves published results belonging to the authenticated student.
 * @param {string} studentId User ID of the student.
 * @param {object} filters Course and pagination filters.
 */
export const getStudentResults = async (studentId, filters = {}) => {
  const query = {
    student: studentId,
    isDeleted: false,
    "resultPublication.status": "RESULT_PUBLISHED",
  };

  // Optional exam or subject filters
  if (filters.examId) query.exam = filters.examId;

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await AnswerSheet.countDocuments(query);
  const sheets = await AnswerSheet.find(query)
    .sort("-resultPublication.publishedAt")
    .skip(skip)
    .limit(limit)
    .populate("exam", "title examDate")
    .populate("subject", "name");

  const data = [];
  for (const as of sheets) {
    const evaluation = await Evaluation.findOne({ answerSheet: as._id, isDeleted: false });
    data.push({
      answerSheetId: as._id,
      examName: as.exam?.title || "Exam",
      course: as.subject?.name || "N/A",
      examDate: as.exam?.examDate || as.createdAt,
      totalFinalMarks: as.evaluationSummary?.totalAwardedMarks || evaluation?.obtainedMarks || 0,
      maximumMarks: as.evaluationSummary?.totalMaximumMarks || evaluation?.totalMarks || 10,
      percentage: as.evaluationSummary?.percentage || evaluation?.percentage || 0,
      grade: evaluation?.grade || "F",
      publishedAt: as.resultPublication?.publishedAt,
    });
  }

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Retrieves student-safe result details after verification of ownership and publication status.
 * @param {string} answerSheetId AnswerSheet ID.
 * @param {string} studentId Student's user ID.
 */
export const getStudentResultDetails = async (answerSheetId, studentId) => {
  const ansSheet = await AnswerSheet.findOne({
    _id: answerSheetId,
    student: studentId,
    isDeleted: false
  }).populate("student").populate("exam").populate("subject");

  if (!ansSheet) {
    // Return generic 404 to avoid leaking draft existence
    throw new ApiError(STATUS_CODES.NOT_FOUND, "RESULT_NOT_AVAILABLE: The requested result is not available.");
  }

  if (ansSheet.resultPublication?.status !== "RESULT_PUBLISHED") {
    // Return generic 404
    throw new ApiError(STATUS_CODES.NOT_FOUND, "RESULT_NOT_AVAILABLE: The requested result is not available.");
  }

  const evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
  if (!evaluation) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "RESULT_NOT_AVAILABLE: Detailed evaluation records not found.");
  }

  const totalScore = ansSheet.evaluationSummary?.totalMaximumMarks || evaluation.totalMarks || 10;
  const finalScore = ansSheet.evaluationSummary?.totalAwardedMarks || evaluation.obtainedMarks || 0;
  const percentage = ansSheet.evaluationSummary?.percentage || evaluation.percentage || 0;

  const evaluationDTO = {
    id: ansSheet._id,
    answerSheetId: ansSheet._id,
    subjectName: ansSheet.subject?.name || "Subject",
    subjectCode: ansSheet.subject?.code || "",
    examName: ansSheet.exam?.title || "Exam",
    date: ansSheet.resultPublication?.publishedAt
      ? new Date(ansSheet.resultPublication.publishedAt).toLocaleDateString()
      : new Date(ansSheet.createdAt).toLocaleDateString(),
    createdAt: ansSheet.createdAt,
    finalScore,
    totalScore,
    percentage,
    grade: evaluation.grade || "F",
    similarityIndex: evaluation.similarityIndex || 0,
    strengths: evaluation.strengths || [],
    weaknesses: evaluation.weaknesses || [],
    suggestions: evaluation.suggestions || [],
    status: 'approved',
    answerSheet: {
      _id: ansSheet._id,
      student: {
        name: ansSheet.student?.name || "Student",
        rollNo: ansSheet.student?.rollNo || "N/A"
      },
      exam: {
        _id: ansSheet.exam?._id || "",
        title: ansSheet.exam?.title || "Exam"
      },
      subject: {
        code: ansSheet.subject?.code || "",
        name: ansSheet.subject?.name || ""
      }
    }
  };

  const examQuestions = ansSheet.exam?.questions || [];
  const questionsDTO = evaluation.questions.map((q, idx) => {
    const examQ = examQuestions.find(eq => eq._id.toString() === q.questionId.toString());
    const finalMarksAwarded = q.facultyAwardedMarks !== undefined && q.facultyAwardedMarks !== null
      ? q.facultyAwardedMarks
      : q.aiAwardedMarks;

    return {
      id: q._id || q.questionId || String(idx),
      questionId: q.questionId || String(idx),
      questionNumber: examQ ? examQ.questionNumber : (idx + 1),
      questionText: examQ ? examQ.questionText : (q.questionText || `Question ${idx + 1}`),
      weight: examQ?.maximumMarks || q.maximumMarks || 10,
      expectedAnswer: examQ?.modelAnswer || "",
      studentAnswer: q.studentAnswer || "",
      status: q.status || 'match', 
      conceptMatch: q.confidence !== undefined ? Math.round(q.confidence * 100) : 100,
      score: finalMarksAwarded,
      feedback: q.facultyComment || q.feedback || ""
    };
  });

  return {
    evaluation: evaluationDTO,
    questions: questionsDTO
  };
};

export default {
  getStudentResults,
  getStudentResultDetails
};
