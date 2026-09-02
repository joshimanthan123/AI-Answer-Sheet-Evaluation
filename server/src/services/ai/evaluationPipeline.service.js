import AnswerSheet from "../../models/AnswerSheet.js";
import Exam from "../../models/Exam.js";
import Evaluation from "../../models/Evaluation.js";
import Notification from "../../models/Notification.js";
import HwrProviderFactory from "./hwr/providerFactory.js";
import LlmProviderFactory from "./providers/providerFactory.js";
import promptService from "./prompt.service.js";
import similarityService from "./similarity.service.js";
import gradingService from "./grading.service.js";
import feedbackService from "./feedback.service.js";
import AnswerKey from "../../models/AnswerKey.js";
import logger from "../../utils/logger.js";
import ApiError from "../../utils/ApiError.js";
import { STATUS_CODES } from "../../constants/statusCodes.js";
import env from "../../config/env.js";
import {
  ACTIVE_EVALUATION_STATES,
  validateMarks,
  calculateEvaluationSummary,
} from "../../utils/evaluationValidator.js";

export class EvaluationPipelineService {
  async queueEvaluation(answerSheetId, userId, options = {}) {
    const { scope = "FULL_SHEET", questionNumber = null, reEvaluate = false } = options;

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

    // Eligibility check: Completed OCR/HWR processing
    if (
      answerSheet.processingStatus !== "completed" &&
      answerSheet.processingStatus !== "ready_for_evaluation" &&
      answerSheet.ocrStatus !== "completed"
    ) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, "OCR_NOT_COMPLETED");
    }

    // Eligibility check: Segmented answers exist
    if (!answerSheet.answers || answerSheet.answers.length === 0) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, "NO_DIGITAL_ANSWERS");
    }

    // Check if an approved AnswerKey exists for this exam
    const answerKey = await AnswerKey.findOne({
      examId: exam._id,
      isActive: true,
      uploadStatus: "Approved",
    });

    if (!answerKey) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, "ANSWER_KEY_NOT_FOUND");
    }

    // Resolve question references & Validate max marks
    for (const q of exam.questions) {
      if (q.maximumMarks === undefined || q.maximumMarks <= 0 || isNaN(q.maximumMarks)) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, "INVALID_MAX_MARKS");
      }
    }

    if (scope === "QUESTION") {
      const matchQ = exam.questions.find(
        (eq) => eq.questionNumber.toString() === questionNumber.toString()
      );
      if (!matchQ) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, "QUESTION_NOT_FOUND");
      }
    }

    // Concurrency Lock Check using atomic update
    const attemptsCount = (answerSheet.evaluationAttempt || 0) + 1;

    const query = {
      _id: answerSheetId,
      isDeleted: false,
      evaluationStatus: { $nin: ACTIVE_EVALUATION_STATES },
    };

    const updateData = {
      $set: {
        evaluationStatus: "QUEUED_FOR_EVALUATION",
        evaluationProgress: 0,
        evaluationCurrentStep: "Queued for evaluation",
        evaluationStartedAt: new Date(),
        evaluationError: null,
      },
      $inc: { evaluationAttempt: 1 },
    };

    const updatedSheet = await AnswerSheet.findOneAndUpdate(query, updateData, { new: true });

    if (!updatedSheet) {
      // Check if it exists at all
      const exists = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
      if (!exists) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, "ANSWER_SHEET_NOT_FOUND");
      }
      // If it exists but wasn't updated, evaluation is already running
      throw new ApiError(STATUS_CODES.CONFLICT, "EVALUATION_ALREADY_RUNNING");
    }

    // Find or create Evaluation record
    let evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
    if (!evaluation) {
      evaluation = await Evaluation.create({
        answerSheet: answerSheetId,
        evaluationType: "AI",
        obtainedMarks: 0,
        totalMarks: exam.totalMarks || 10,
        percentage: 0,
        evaluationStatus: "QUEUED_FOR_EVALUATION",
        createdBy: userId,
        updatedBy: userId,
      });
    } else {
      evaluation.evaluationStatus = "QUEUED_FOR_EVALUATION";
      evaluation.updatedBy = userId;
      await evaluation.save();
    }

    // Register starting audit trail history entry
    const llmProvider = LlmProviderFactory.getProvider();
    const mockOrRealName = llmProvider.constructor.name === "MockLlmProvider" ? "Mock" : "OpenAI";
    const runModel = env.AI?.LLM_MODEL_NAME || "gpt-4o";

    evaluation.evaluationHistory.push({
      attempt: attemptsCount,
      scope,
      questionNumber,
      provider: mockOrRealName,
      model: runModel,
      startedAt: new Date(),
      status: "QUEUED_FOR_EVALUATION",
      summary: `Started ${scope.toLowerCase()} evaluation (attempt #${attemptsCount})`,
    });
    await evaluation.save();

    // Start background processing async (do not await)
    this.runPipeline(evaluation._id, answerSheetId, userId, attemptsCount, {
      scope,
      questionNumber,
      reEvaluate,
    }).catch((err) => {
      logger.error(
        `Background AI Evaluation failure for answerSheet ${answerSheetId}: ${err.message}`
      );
    });

    return evaluation;
  }

  async runPipeline(evaluationId, answerSheetId, userId, attemptNo, options = {}) {
    const { scope = "FULL_SHEET", questionNumber = null, reEvaluate = false } = options;
    const totalStart = Date.now();
    logger.info(
      `Starting AI Evaluation Pipeline run for answerSheetId = ${answerSheetId}, attempt = ${attemptNo}, scope = ${scope}...`
    );

    let evaluation = await Evaluation.findById(evaluationId);
    let answerSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
    if (!evaluation || !answerSheet) return;

    // Helper functions inside pipeline to update status and progress
    const updateProgress = async (status, progress, currentStep) => {
      try {
        await AnswerSheet.updateOne(
          { _id: answerSheetId },
          {
            $set: {
              evaluationStatus: status,
              evaluationProgress: progress,
              evaluationCurrentStep: currentStep,
            },
          }
        );
        await Evaluation.updateOne({ _id: evaluationId }, { $set: { evaluationStatus: status } });
      } catch (err) {
        logger.error(`Error updating evaluation progress: ${err.message}`);
      }
    };

    try {
      // --- STAGE 1 (10%): LOADING_ANSWER_KEY ---
      await updateProgress("LOADING_ANSWER_KEY", 10, "Loading exam details and answer keys...");

      const exam = await Exam.findOne({ _id: answerSheet.exam, isDeleted: false });
      if (!exam) {
        throw new Error("EXAM_NOT_FOUND");
      }

      const answerKey = await AnswerKey.findOne({
        examId: exam._id,
        isActive: true,
        uploadStatus: "Approved",
      });
      if (!answerKey) {
        throw new Error("ANSWER_KEY_NOT_FOUND");
      }

      const llmProvider = LlmProviderFactory.getProvider();
      const providerName = llmProvider.constructor.name === "MockLlmProvider" ? "Mock" : "OpenAI";
      const modelName = env.AI?.LLM_MODEL_NAME || "gpt-4o";

      // --- STAGE 2 (20%): BUILDING_PROMPT / AI_EVALUATING loop ---
      const previousQuestionsMap = new Map();
      if (evaluation.questions && evaluation.questions.length > 0) {
        evaluation.questions.forEach((q) => {
          previousQuestionsMap.set(q.questionId.toString(), q.toObject());
        });
      }

      const targetQuestions = [];
      if (scope === "QUESTION") {
        const qToEvaluate = exam.questions.find(
          (eq) => eq.questionNumber.toString() === questionNumber.toString()
        );
        if (!qToEvaluate) {
          throw new Error("QUESTION_NOT_FOUND");
        }
        targetQuestions.push(qToEvaluate);
      } else {
        targetQuestions.push(...exam.questions);
      }

      // Track newly evaluated question results
      const newQuestionResults = [];
      let totalHwrMs = 0;
      let totalLlmMs = 0;
      let promptTokensSum = 0;
      let completionTokensSum = 0;
      let totalPromptText = "";

      let failedQuestionsCount = 0;
      const totalQuestionsCount = targetQuestions.length;
      let questionIndex = 0;

      for (const examQuestion of targetQuestions) {
        questionIndex++;
        const questionId = examQuestion._id;
        const maxMarks = examQuestion.maximumMarks;

        // Calculate progress dynamically: from 20% to 85%
        const currentProgress = Math.round(20 + (questionIndex / totalQuestionsCount) * 65);
        await updateProgress(
          "AI_EVALUATING",
          currentProgress,
          `Evaluating question Q${examQuestion.questionNumber} (${questionIndex} of ${totalQuestionsCount})...`
        );

        // Find answer in answersheet
        const answerData = answerSheet.answers.find(
          (ans) =>
            (ans.questionId && ans.questionId.toString() === questionId.toString()) ||
            (ans.questionNumber && ans.questionNumber === examQuestion.questionNumber)
        );

        const parsedKeyAnswer = answerKey.parsedAnswers.find(
          (pa) =>
            (pa.questionId && pa.questionId.toString() === questionId.toString()) ||
            pa.questionNumber === examQuestion.questionNumber
        );

        const modelAnswer = parsedKeyAnswer ? parsedKeyAnswer.answerText : examQuestion.modelAnswer;
        const keywords =
          parsedKeyAnswer && parsedKeyAnswer.keywords?.length > 0
            ? parsedKeyAnswer.keywords
            : examQuestion.keywords || [];

        // Build criteria/rubrics array
        const rubricList = [];
        if (examQuestion.partialMarkingRules && examQuestion.partialMarkingRules.length > 0) {
          examQuestion.partialMarkingRules.forEach((r) => {
            rubricList.push({ criteria: r.criterion, marks: r.marks, description: r.description });
          });
        } else if (examQuestion.evaluationCriteria) {
          const ec = examQuestion.evaluationCriteria;
          if (ec.conceptualUnderstanding > 0)
            rubricList.push({
              criteria: "Conceptual Understanding",
              marks: ec.conceptualUnderstanding,
            });
          if (ec.keywordAccuracy > 0)
            rubricList.push({ criteria: "Keyword Accuracy", marks: ec.keywordAccuracy });
          if (ec.completeness > 0)
            rubricList.push({ criteria: "Completeness", marks: ec.completeness });
          if (ec.correctness > 0)
            rubricList.push({ criteria: "Correctness", marks: ec.correctness });
        }
        if (rubricList.length === 0) {
          const r =
            parsedKeyAnswer && parsedKeyAnswer.rubric?.length > 0
              ? parsedKeyAnswer.rubric
              : examQuestion.rubric;
          if (Array.isArray(r)) {
            rubricList.push(...r);
          } else if (r) {
            rubricList.push({
              criteria: "General Correctness",
              marks: maxMarks,
              description: String(r),
            });
          }
        }

        const rubricText =
          rubricList.length > 0
            ? rubricList
                .map(
                  (r, i) =>
                    `${i + 1}. Criteria: "${r.criteria || r.criterion}", Marks: ${r.marks || r.maxMarks}${r.description ? `, Description: ${r.description}` : ""}`
                )
                .join("\n")
            : "No detailed grading rubric provided. Grade based on correct facts matching model answer.";

        const keywordsText =
          keywords.length > 0 ? `Expected keywords/concepts to check: ${keywords.join(", ")}` : "";

        // Handle case where student answer is missing or completely blank
        if (!answerData || !answerData.recognizedText || !answerData.recognizedText.trim()) {
          const defaultCriteriaScores = rubricList.map((rub) => ({
            criterion: rub.criteria || rub.criterion,
            marksAwarded: 0,
            maxMarks: rub.marks || rub.maxMarks || 0,
          }));

          newQuestionResults.push({
            questionId,
            recognizedText: "",
            studentAnswer: "",
            modelAnswer: modelAnswer || "",
            similarityScore: 0,
            aiMarks: 0,
            aiAwardedMarks: 0,
            finalAwardedMarks: 0,
            feedback: "No answer was detected for this question.",
            confidence: 1.0,
            criteriaScores: defaultCriteriaScores,
            matchedKeywords: [],
            missingKeywords: keywords,
            keywordScore: 0,
            semanticScore: 0,
            wasOverridden: false,
            maximumMarks: maxMarks,
            provider: providerName,
            model: modelName,
            evaluationAttempt: attemptNo,
            startedAt: new Date(),
            completedAt: new Date(),
          });
          continue;
        }

        try {
          // --- STAGE 2.1: BUILDING_PROMPT WITH DELIMITERS AND CONFIDENCE ---
          const studentOCRText = answerData.recognizedText;
          const sanitizedStudentText = `<StudentAnswer>\n${studentOCRText}\n</StudentAnswer>`;

          const prompt = `
You are an expert academic evaluator. Analyze the student's answer and grade it out of ${maxMarks} marks based on the model answer and rubric.

QUESTION:
"${examQuestion.questionText}"

STUDENT ANSWER CONTENT:
${sanitizedStudentText}

MODEL ANSWER:
"${modelAnswer}"

${keywordsText}

GRADING RUBRIC GUIDELINES:
${rubricText}

Provide an accurate evaluation. Award partial marks if student is partially correct. Do not go below 0 or exceed the maximum allowed marks (${maxMarks}).
Return your assessment strictly in the following JSON structure:
{
  "marks": <float_value_awarded>,
  "similarity": <float_value_from_0_to_1>,
  "strengths": <string_summarizing_good_details>,
  "weaknesses": <string_summarizing_missing_details>,
  "suggestions": <string_improvement_tips_or_comments>,
  "justification": <string_reasoning_for_awarded_marks>,
  "confidence": <float_value_from_0_to_1>,
  "criteriaScores": [
    {
      "criterion": "<criterion_name_from_guidelines>",
      "marksAwarded": <float_marks_awarded>,
      "maxMarks": <float_max_marks>
    }
  ],
  "matchedKeywords": [
    "<matching_keyword_1>",
    "<matching_keyword_2>"
  ],
  "missingKeywords": [
    "<missing_keyword_1>"
  ]
}
`;

          totalPromptText += `[Q: ${examQuestion.questionNumber}] [Attempt #${attemptNo}] ${prompt}\n\n`;

          const qEvalStart = Date.now();
          const llmStart = Date.now();
          const llmResult = await llmProvider.evaluate(prompt, maxMarks);
          const llmDuration = Date.now() - llmStart;
          totalLlmMs += llmDuration;

          promptTokensSum += llmResult.tokensUsed?.promptTokens || 0;
          completionTokensSum += llmResult.tokensUsed?.completionTokens || 0;

          // --- STAGE 3: VALIDATING_RESULT (Marks checker) ---
          await updateProgress(
            "VALIDATING_RESULT",
            85,
            `Validating scoring for question Q${examQuestion.questionNumber}...`
          );

          const validation = validateMarks(llmResult.marks, maxMarks);
          if (!validation.valid) {
            throw new Error(`EVALUATION_VALIDATION_FAILED: ${validation.error}`);
          }
          const finalScore = validation.marks;

          // OCR Confidence warnings (Part 10)
          const warningsList = [];
          const ocrConfidence = answerData.confidenceLevel || answerData.confidence || "HIGH";
          if (ocrConfidence === "MEDIUM") {
            warningsList.push({
              code: "MEDIUM_OCR_CONFIDENCE",
              message:
                "Evaluation is based on medium-confidence OCR transcription. Flagged for review.",
            });
          } else if (ocrConfidence === "LOW") {
            warningsList.push({
              code: "LOW_OCR_CONFIDENCE",
              message:
                "Evaluation is based on low-confidence OCR transcription. Review is highly recommended.",
            });
          }

          if (validation.clamped && validation.warning) {
            warningsList.push(validation.warning);
          }

          // Calculate similarity metrics
          const similarityResult = similarityService.calculateSimilarity(
            studentOCRText,
            modelAnswer
          );

          // Validate and clamp criteria values
          const validatedCriteria = (llmResult.criteriaScores || []).map((cs) => {
            const matchRub = rubricList.find(
              (rub) =>
                (rub.criteria && rub.criteria.toLowerCase() === cs.criterion.toLowerCase()) ||
                (rub.criterion && rub.criterion.toLowerCase() === cs.criterion.toLowerCase())
            );
            const criterionMax = matchRub ? matchRub.marks || matchRub.maxMarks : cs.maxMarks || 0;
            const csValidation = validateMarks(cs.marksAwarded, criterionMax);
            return {
              criterion: cs.criterion,
              marksAwarded: csValidation.valid ? csValidation.marks : 0,
              maxMarks: criterionMax,
            };
          });

          const formattedFeedback = feedbackService.formatFeedback(
            llmResult.strengths,
            llmResult.weaknesses,
            llmResult.suggestions
          );

          newQuestionResults.push({
            questionId,
            recognizedText: studentOCRText,
            studentAnswer: studentOCRText,
            modelAnswer,
            similarityScore: Math.round(similarityResult.similarityScore * 100),
            aiMarks: finalScore,
            aiAwardedMarks: finalScore,
            finalAwardedMarks: finalScore,
            confidence: llmResult.confidence || 0.85,
            feedback: `${formattedFeedback.strengths} | ${formattedFeedback.weaknesses} | ${formattedFeedback.suggestions}`,
            criteriaScores: validatedCriteria,
            matchedKeywords: llmResult.matchedKeywords || [],
            missingKeywords: llmResult.missingKeywords || [],
            keywordScore: (llmResult.matchedKeywords || []).length,
            semanticScore: Math.round(similarityResult.similarityScore * 100),
            wasOverridden: false,
            maximumMarks: maxMarks,
            provider: providerName,
            model: modelName,
            evaluationAttempt: attemptNo,
            startedAt: new Date(qEvalStart),
            completedAt: new Date(),
            warnings: warningsList,
          });
        } catch (err) {
          logger.error(
            `Failed to evaluate question Q${examQuestion.questionNumber}: ${err.message}`
          );
          failedQuestionsCount++;

          newQuestionResults.push({
            questionId,
            recognizedText: answerData ? answerData.recognizedText : "",
            studentAnswer: answerData ? answerData.recognizedText : "",
            modelAnswer: modelAnswer || "",
            similarityScore: 0,
            aiMarks: 0,
            aiAwardedMarks: 0,
            finalAwardedMarks: 0,
            feedback: `Failed: ${err.message}`,
            confidence: 0,
            criteriaScores: [],
            matchedKeywords: [],
            missingKeywords: keywords,
            keywordScore: 0,
            semanticScore: 0,
            wasOverridden: false,
            maximumMarks: maxMarks,
            provider: providerName,
            model: modelName,
            evaluationAttempt: attemptNo,
            startedAt: new Date(),
            completedAt: new Date(),
            errorMessage: err.message,
          });
        }
      }

      // --- STAGE 5 (100%): EVALUATION_COMPLETED & MERGING ---
      await updateProgress("VALIDATING_RESULT", 95, "Merging results and recalculating summary...");

      let finalQuestionsList = [];
      if (scope === "QUESTION") {
        const newResult = newQuestionResults[0];
        const prevResult = previousQuestionsMap.get(newResult.questionId.toString());

        if (newResult.errorMessage && prevResult && !prevResult.errorMessage) {
          logger.info(
            `Single question re-evaluation failed. Preserving previous valid evaluation for Q${questionNumber}.`
          );
          finalQuestionsList = Array.from(previousQuestionsMap.values());
        } else {
          for (const eq of exam.questions) {
            if (eq.questionNumber.toString() === questionNumber.toString()) {
              finalQuestionsList.push(newResult);
            } else {
              const prev = previousQuestionsMap.get(eq._id.toString());
              if (prev) {
                finalQuestionsList.push(prev);
              } else {
                finalQuestionsList.push({
                  questionId: eq._id,
                  recognizedText: "",
                  studentAnswer: "",
                  modelAnswer: eq.modelAnswer || "",
                  similarityScore: 0,
                  aiMarks: 0,
                  aiAwardedMarks: 0,
                  finalAwardedMarks: 0,
                  feedback: "Evaluation pending",
                  maximumMarks: eq.maximumMarks,
                });
              }
            }
          }
        }
      } else {
        // Full sheet scope
        for (const eq of exam.questions) {
          const newRes = newQuestionResults.find(
            (n) => n.questionId.toString() === eq._id.toString()
          );
          const prevRes = previousQuestionsMap.get(eq._id.toString());

          if (newRes && newRes.errorMessage && prevRes && !prevRes.errorMessage) {
            finalQuestionsList.push(prevRes);
          } else if (newRes) {
            finalQuestionsList.push(newRes);
          } else {
            finalQuestionsList.push({
              questionId: eq._id,
              recognizedText: "",
              studentAnswer: "",
              modelAnswer: eq.modelAnswer || "",
              similarityScore: 0,
              maximumMarks: eq.maximumMarks,
            });
          }
        }
      }

      const finalFailedCount = finalQuestionsList.filter((q) => q.errorMessage).length;
      const summary = calculateEvaluationSummary(finalQuestionsList);
      const percent = summary.percentage;
      const finalGrade = gradingService.calculateGrade(percent);
      const totalDuration = Date.now() - totalStart;

      // Update Evaluation Document
      evaluation.questions = finalQuestionsList;
      evaluation.obtainedMarks = summary.totalAwardedMarks;
      evaluation.totalMarks = summary.totalMaximumMarks;
      evaluation.percentage = percent;
      evaluation.grade = finalGrade;
      evaluation.aiMetadata = {
        promptText: totalPromptText.substring(0, 5000),
        modelUsed: modelName,
        promptVersion: "1.2",
        evaluatedAt: new Date(),
        tokenUsage: {
          promptTokens: promptTokensSum,
          completionTokens: completionTokensSum,
          totalTokens: promptTokensSum + completionTokensSum,
        },
        durations: {
          hwrMs: totalHwrMs,
          llmMs: totalLlmMs,
          totalMs: totalDuration,
        },
      };

      // Determine final status
      let finalStatus = "READY_FOR_FACULTY_REVIEW";
      if (finalFailedCount > 0) {
        if (finalFailedCount === finalQuestionsList.length) {
          finalStatus = "EVALUATION_FAILED";
        } else {
          finalStatus = "PARTIALLY_EVALUATED";
        }
      }

      evaluation.evaluationStatus = finalStatus;
      await evaluation.save();

      // Finalize audit trail history item for this attempt
      const historyItem = evaluation.evaluationHistory.find((h) => h.attempt === attemptNo);
      if (historyItem) {
        historyItem.status = finalStatus;
        historyItem.completedAt = new Date();
        historyItem.summary = `${scope.toLowerCase()} evaluation (attempt #${attemptNo}) resolved with status: ${finalStatus}. percentage: ${percent}%`;
        await evaluation.save();
      }

      // Update Answer Sheet
      answerSheet.evaluationStatus = finalStatus;
      answerSheet.evaluationProgress = 100;
      answerSheet.evaluationCurrentStep =
        finalStatus === "READY_FOR_FACULTY_REVIEW"
          ? "Evaluation completed"
          : "Partial evaluation completed with errors";
      answerSheet.evaluationCompletedAt = new Date();
      answerSheet.evaluationSummary = {
        totalQuestions: exam.questions.length,
        evaluatedQuestions: summary.evaluatedQuestions,
        failedQuestions: finalFailedCount,
        totalMaximumMarks: summary.totalMaximumMarks,
        totalAwardedMarks: summary.totalAwardedMarks,
        percentage: percent,
      };

      if (finalStatus === "READY_FOR_FACULTY_REVIEW") {
        answerSheet.submissionStatus = "Faculty Review";
        answerSheet.reviewStatus = "READY_FOR_FACULTY_REVIEW";
      } else {
        answerSheet.submissionStatus = "Pending AI Evaluation";
        answerSheet.evaluationError =
          finalStatus === "EVALUATION_FAILED" ? "All questions failed evaluation." : null;
      }
      await answerSheet.save();

      logger.info(
        `AI Evaluation Pipeline complete: status = ${finalStatus}, percentage = ${percent}%, failed = ${finalFailedCount}`
      );

      // Notifications
      const examCreator = exam.createdBy;
      if (examCreator) {
        await Notification.create({
          user: examCreator,
          title: `AI Evaluation: ${finalStatus.replace(/_/g, " ")}`,
          message: `Evaluation completed for exam "${exam.title}" with status "${finalStatus}".`,
          type: "Faculty Review Pending",
          createdBy: userId,
          updatedBy: userId,
        });
      }
    } catch (err) {
      logger.error(`Critical pipeline failure: ${err.message}`);

      await AnswerSheet.updateOne(
        { _id: answerSheetId },
        {
          $set: {
            evaluationStatus: "EVALUATION_FAILED",
            evaluationProgress: 100,
            evaluationCurrentStep: "Pipeline crashed",
            evaluationError: err.message,
            evaluationCompletedAt: new Date(),
          },
        }
      );

      await Evaluation.updateOne(
        { _id: evaluationId },
        { $set: { evaluationStatus: "EVALUATION_FAILED" } }
      );

      const historyItem = evaluation.evaluationHistory?.find((h) => h.attempt === attemptNo);
      if (historyItem) {
        historyItem.status = "EVALUATION_FAILED";
        historyItem.completedAt = new Date();
        historyItem.error = err.message;
        await evaluation.save();
      }

      await Notification.create({
        user: userId,
        title: "AI Pipeline Crash",
        message: `Evaluation pipeline crashed: ${err.message}`,
        type: "System Notification",
        createdBy: userId,
        updatedBy: userId,
      });
    }
  }
}

export default new EvaluationPipelineService();
