import AnswerSheet from "../../models/AnswerSheet.js";
import Exam from "../../models/Exam.js";
import Evaluation from "../../models/Evaluation.js";
import LlmProviderFactory from "./providers/providerFactory.js";
import promptService from "./prompt.service.js";
import borderlineDetectionService from "./borderlineDetection.service.js";
import referenceRetrievalService from "./referenceRetrieval.service.js";
import logger from "../../utils/logger.js";
import ApiError from "../../utils/ApiError.js";
import { STATUS_CODES } from "../../constants/statusCodes.js";

export class ReferenceAwareEvaluationService {
  /**
   * Evaluates or re-evaluates a specific question on an answer sheet using reference-aware adaptive analysis.
   * @param {Object} params
   * @param {String} params.answerSheetId
   * @param {String} params.questionId
   * @param {String} params.userId
   * @returns {Object} Updated question evaluation result
   */
  async evaluateQuestionWithReferences(params) {
    const { answerSheetId, questionId, userId } = params || {};

    // 1. Fetch AnswerSheet and Exam
    const answerSheet = await AnswerSheet.findOne({
      _id: answerSheetId,
      isDeleted: false,
    }).populate("exam");

    if (!answerSheet) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "ANSWER_SHEET_NOT_FOUND");
    }

    const exam = answerSheet.exam;
    if (!exam) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "EXAM_NOT_FOUND");
    }

    // 2. Fetch existing Evaluation document
    let evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
    if (!evaluation) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, "EVALUATION_NOT_FOUND_RUN_NORMAL_FIRST");
    }

    // 3. Find question in exam and answerSheet
    const examQuestion = exam.questions.find(
      (q) => q._id.toString() === questionId.toString() || q.questionNumber.toString() === questionId.toString()
    );

    if (!examQuestion) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "QUESTION_NOT_FOUND");
    }

    const maxMarks = examQuestion.maximumMarks || 10;
    const modelAnswer = examQuestion.evaluationConfig?.modelAnswer || examQuestion.modelAnswer || "";
    const rubricList = examQuestion.evaluationConfig?.rubric || examQuestion.rubric || [];
    const keywords = examQuestion.evaluationConfig?.keywords || [];

    const answerData =
      answerSheet.answers?.find(
        (a) =>
          (a.questionId && a.questionId.toString() === examQuestion._id.toString()) ||
          (a.questionNumber && a.questionNumber === examQuestion.questionNumber)
      ) ||
      answerSheet.digital_answers?.find(
        (da) =>
          (da.question_id && da.question_id.toString() === examQuestion._id.toString()) ||
          (da.question_number && String(da.question_number) === String(examQuestion.questionNumber))
      );

    const studentAnswerText = answerData?.recognizedText || answerData?.text || "";

    if (!studentAnswerText.trim()) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, "NO_STUDENT_ANSWER_TEXT");
    }

    // 4. Find existing question evaluation inside Evaluation document
    const qIndex = evaluation.questions.findIndex(
      (q) => q.questionId.toString() === examQuestion._id.toString()
    );

    let existingQEval = qIndex >= 0 ? evaluation.questions[qIndex] : null;

    // 5. Borderline Detection
    const borderlineResult = borderlineDetectionService.detectBorderline(
      existingQEval || { aiMarks: 0, confidence: 0.5 },
      maxMarks,
      rubricList
    );

    // 6. Historical Reference Retrieval
    const references = await referenceRetrievalService.getRelevantReferences({
      subjectId: exam.subject || answerSheet.subject,
      questionId: examQuestion._id,
      questionNumber: examQuestion.questionNumber,
      questionText: examQuestion.questionText,
      studentAnswer: studentAnswerText,
      maxMarks,
    });

    // Handle case when no historical references are found
    if (!references || references.length === 0) {
      logger.info(`No approved historical references found for Q${examQuestion.questionNumber}. Marking reference-aware status as unavailable.`);
      if (existingQEval) {
        existingQEval.borderlineEvaluation = borderlineResult;
        existingQEval.referenceAwareEvaluation = {
          status: "unavailable",
          marksAwarded: existingQEval.aiMarks || existingQEval.aiEvaluation?.marksAwarded || 0,
          maxMarks,
          percentage: existingQEval.aiEvaluation?.percentage || 0,
          confidence: existingQEval.confidence || 0.7,
          criteria: existingQEval.criteria || [],
          matchedConcepts: existingQEval.matchedConcepts || [],
          missingConcepts: existingQEval.missingConcepts || [],
          feedback: existingQEval.feedback || "No historical references available for comparison.",
          referencesUsed: [],
          analysis: "No approved historical references matched current question/subject.",
          referenceAnalysis: {
            used: false,
            referencesConsidered: 0,
            relevanceSummary: "No approved historical references found.",
            interpretationGuidance: "Standard AI evaluation applies.",
            markTransfer: false,
          },
          evaluatedAt: new Date(),
          evaluationVersion: 1,
        };
        await evaluation.save();
      }
      return existingQEval;
    }

    // 7. Build Reference-Aware LLM Prompt
    const prompt = promptService.buildReferenceAwarePrompt({
      questionText: examQuestion.questionText,
      studentAnswer: studentAnswerText,
      modelAnswer,
      rubric: rubricList,
      maximumMarks: maxMarks,
      keywords,
      normalEvaluation: existingQEval
        ? {
            marksAwarded: existingQEval.aiMarks || existingQEval.aiEvaluation?.marksAwarded || 0,
            confidence: existingQEval.confidence || 0.8,
            feedback: existingQEval.feedback || "",
          }
        : null,
      historicalReferences: references,
    });

    // 8. Execute LLM Call
    const llmProvider = LlmProviderFactory.getProvider();
    const llmResult = await llmProvider.evaluate(prompt, maxMarks);

    // Validate LLM output bounds
    const rawMarks = llmResult.marksAwarded !== undefined ? Number(llmResult.marksAwarded) : 0;
    const finalRefMarks = Math.min(Math.max(rawMarks, 0), maxMarks);
    const refPercentage = maxMarks > 0 ? Number(((finalRefMarks / maxMarks) * 100).toFixed(2)) : 0;

    const refCriteria = llmResult.criteria || [];
    const refMatched = llmResult.matchedConcepts || [];
    const refMissing = llmResult.missingConcepts || [];
    const refFeedback = llmResult.feedback || "Reference-aware adaptive evaluation complete.";
    const refConfidence = llmResult.confidence !== undefined ? Math.min(Math.max(Number(llmResult.confidence), 0), 1) : 0.85;

    const refAnalysisObj = llmResult.referenceAnalysis || {
      used: true,
      referencesConsidered: references.length,
      relevanceSummary: `Analyzed against ${references.length} approved historical reference(s).`,
      interpretationGuidance: "Provided contextual guidance based on previous faculty-approved evaluations.",
      markTransfer: false, // MANDATORY: Must be false
    };

    // Ensure markTransfer is strictly false
    refAnalysisObj.markTransfer = false;

    // Build referencesUsed array for storage
    const referencesUsedStorage = references.map((r) => ({
      referenceId: r.referenceId,
      similarity: r.similarity,
      marksAwarded: r.marksAwarded,
      maxMarks: r.maxMarks,
      academicYear: r.academicYear,
      questionText: r.questionText,
      studentAnswer: r.studentAnswer,
      modelAnswer: r.modelAnswer,
      relevanceSummary: r.relevanceSummary,
    }));

    const refAwareEvalDoc = {
      status: "completed",
      marksAwarded: finalRefMarks,
      maxMarks,
      percentage: refPercentage,
      confidence: refConfidence,
      criteria: refCriteria,
      matchedConcepts: refMatched,
      missingConcepts: refMissing,
      feedback: refFeedback,
      referencesUsed: referencesUsedStorage,
      analysis: refFeedback,
      referenceAnalysis: refAnalysisObj,
      evaluatedAt: new Date(),
      evaluationVersion: 1,
    };

    // Update Evaluation document
    if (qIndex >= 0) {
      evaluation.questions[qIndex].borderlineEvaluation = borderlineResult;
      evaluation.questions[qIndex].referenceAwareEvaluation = refAwareEvalDoc;
    } else {
      evaluation.questions.push({
        questionId: examQuestion._id,
        questionNumber: examQuestion.questionNumber,
        recognizedText: studentAnswerText,
        studentAnswer: studentAnswerText,
        modelAnswer,
        maximumMarks: maxMarks,
        aiMarks: finalRefMarks,
        borderlineEvaluation: borderlineResult,
        referenceAwareEvaluation: refAwareEvalDoc,
        facultyEvaluation: { status: "pending", finalMarks: null },
      });
    }

    await evaluation.save();

    // 9. Audit Logging
    logger.info(`[AUDIT LOG] Action: REFERENCE_AWARE_EVALUATION, AnswerSheet: ${answerSheetId}, Question: ${examQuestion.questionNumber}, NormalMarks: ${existingQEval ? existingQEval.aiMarks : null}, RefMarks: ${finalRefMarks}, RefsConsidered: ${references.length}, IsBorderline: ${borderlineResult.isBorderline}`);

    logger.info(
      `Reference-aware evaluation complete for Q${examQuestion.questionNumber}: refMarks = ${finalRefMarks}/${maxMarks}, confidence = ${refConfidence}`
    );

    return qIndex >= 0 ? evaluation.questions[qIndex] : evaluation.questions[evaluation.questions.length - 1];
  }

  /**
   * Retrieves reference evidence and borderline status for a specific question.
   */
  async getQuestionReferenceEvidence(answerSheetId, questionId) {
    const answerSheet = await AnswerSheet.findOne({
      _id: answerSheetId,
      isDeleted: false,
    }).populate("exam");

    if (!answerSheet) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "ANSWER_SHEET_NOT_FOUND");
    }

    const evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
    if (!evaluation) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "EVALUATION_NOT_FOUND");
    }

    const qEval = evaluation.questions.find(
      (q) => q.questionId.toString() === questionId.toString() || q.questionNumber.toString() === questionId.toString()
    );

    if (!qEval) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "QUESTION_EVALUATION_NOT_FOUND");
    }

    // Retrieve live top references for context
    const references = await referenceRetrievalService.getRelevantReferences({
      subjectId: answerSheet.exam?.subject || answerSheet.subject,
      questionId: qEval.questionId,
      questionNumber: qEval.questionNumber,
      questionText: qEval.questionText || "",
      studentAnswer: qEval.studentAnswer || qEval.recognizedText || "",
      maxMarks: qEval.maximumMarks,
    });

    const borderlineResult = borderlineDetectionService.detectBorderline(
      qEval,
      qEval.maximumMarks,
      qEval.criteria || []
    );

    return {
      questionId: qEval.questionId,
      questionNumber: qEval.questionNumber,
      aiEvaluation: qEval.aiEvaluation || {
        marksAwarded: qEval.aiMarks,
        maxMarks: qEval.maximumMarks,
        confidence: qEval.confidence,
        feedback: qEval.feedback,
      },
      borderlineEvaluation: qEval.borderlineEvaluation || borderlineResult,
      referenceAwareEvaluation: qEval.referenceAwareEvaluation || null,
      facultyEvaluation: qEval.facultyEvaluation || { status: "pending", finalMarks: null },
      references,
    };
  }
}

export default new ReferenceAwareEvaluationService();
