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
  validateAiEvaluationResponse,
} from "../../utils/evaluationValidator.js";


export class EvaluationPipelineService {
  async triggerEvaluation(params) {
    const { answerSheetId, userId, scope, questionNumber, reEvaluate } = params || {};
    return this.queueEvaluation(answerSheetId, userId, { scope, questionNumber, reEvaluate });
  }

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

    // Check if an approved AnswerKey exists or exam questions have model answers configured
    const answerKey = await AnswerKey.findOne({
      examId: exam._id,
      isActive: true,
      uploadStatus: "Approved",
    });

    const hasExamModelAnswers = exam.questions?.some((q) => q.modelAnswer || q.evaluationConfig?.modelAnswer);

    if (!answerKey && !hasExamModelAnswers) {
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
      const hasExamModelAnswers = exam.questions?.some((q) => q.modelAnswer || q.evaluationConfig?.modelAnswer);

      if (!answerKey && !hasExamModelAnswers) {
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
        const maxMarks = examQuestion.maximumMarks || 10;
        const configVersion = examQuestion.evaluationConfig?.version || 1;
        const modelAnswer = examQuestion.evaluationConfig?.modelAnswer || examQuestion.modelAnswer || "";
        const rubricList = examQuestion.evaluationConfig?.rubric || examQuestion.rubric || [];
        const keywords = examQuestion.evaluationConfig?.keywords || [];

        const answerData =
          answerSheet.answers.find(
            (a) =>
              (a.questionId && a.questionId.toString() === questionId.toString()) ||
              (a.questionNumber && a.questionNumber === examQuestion.questionNumber)
          ) ||
          answerSheet.digital_answers?.find(
            (da) =>
              (da.question_id && da.question_id.toString() === questionId.toString()) ||
              (da.question_number && String(da.question_number) === String(examQuestion.questionNumber))
          );

        // Check for OCR Failure on answerSheet or answerData
        const isOcrFailed =
          answerSheet.ocrStatus === "failed" ||
          (answerData && answerData.hwrStatus === "Failed") ||
          (answerData && answerData.ocrQualityStatus === "NEEDS_REVIEW" && !answerData.recognizedText);


        if (isOcrFailed) {
          logger.warn(`OCR processing failed for question Q${examQuestion.questionNumber}. Marking review_required/failed.`);
          newQuestionResults.push({
            questionId,
            questionNumber: examQuestion.questionNumber,
            recognizedText: "",
            studentAnswer: "",
            modelAnswer: modelAnswer || "",
            similarityScore: 0,
            aiMarks: 0,
            aiAwardedMarks: 0,
            finalAwardedMarks: null,
            status: "failed",
            evaluationStatus: "failed",
            reason: "OCR text unavailable; manual review required.",
            errorMessage: "OCR text unavailable; manual review required.",
            feedback: "OCR text unavailable; manual review required.",
            confidence: 0,
            criteriaScores: [],
            criteria: [],
            matchedConcepts: [],
            missingConcepts: keywords,
            matchedKeywords: [],
            missingKeywords: keywords,
            maximumMarks: maxMarks,
            provider: providerName,
            model: modelName,
            evaluationConfigVersion: configVersion,
            evaluationAttempt: attemptNo,
            startedAt: new Date(),
            completedAt: new Date(),
            aiEvaluation: {
              marksAwarded: 0,
              maxMarks,
              percentage: 0,
              criteria: [],
              matchedConcepts: [],
              missingConcepts: keywords,
              feedback: "OCR text unavailable; manual review required.",
              confidence: 0,
              evaluatedAt: new Date(),
              modelName,
              evaluationConfigVersion: configVersion,
            },
            facultyEvaluation: {
              status: "pending",
              finalMarks: null,
              comment: null,
              reviewedAt: null,
              reviewedBy: null,
            },
          });
          failedQuestionsCount++;
          continue;
        }

        // Handle case where student answer is empty or whitespace-only
        if (!answerData || !answerData.recognizedText || !answerData.recognizedText.trim()) {
          logger.info(`Empty student answer for Q${examQuestion.questionNumber}. Skipping LLM call and assigning 0 marks.`);
          const defaultCriteria = rubricList.map((rub) => ({
            criterion: rub.criterion || rub.criteria || "General Correctness",
            marksAwarded: 0,
            maxMarks: rub.maxMarks || rub.marks || maxMarks,
            status: "missing",
            reason: "Unanswered question.",
          }));

          newQuestionResults.push({
            questionId,
            questionNumber: examQuestion.questionNumber,
            recognizedText: "",
            studentAnswer: "",
            modelAnswer: modelAnswer || "",
            similarityScore: 0,
            aiMarks: 0,
            aiAwardedMarks: 0,
            finalAwardedMarks: 0,
            status: "completed",
            classification: "unanswered",
            evaluationStatus: "completed",
            feedback: "Unanswered question. No student response was detected.",
            confidence: 1.0,
            criteriaScores: defaultCriteria,
            criteria: defaultCriteria,
            matchedConcepts: [],
            missingConcepts: keywords,
            matchedKeywords: [],
            missingKeywords: keywords,
            keywordScore: 0,
            semanticScore: 0,
            wasOverridden: false,
            maximumMarks: maxMarks,
            provider: providerName,
            model: modelName,
            evaluationConfigVersion: configVersion,
            evaluationAttempt: attemptNo,
            startedAt: new Date(),
            completedAt: new Date(),
            aiEvaluation: {
              marksAwarded: 0,
              maxMarks,
              percentage: 0,
              criteria: defaultCriteria,
              matchedConcepts: [],
              missingConcepts: keywords,
              feedback: "Unanswered question. No student response was detected.",
              confidence: 1.0,
              evaluatedAt: new Date(),
              modelName,
              evaluationConfigVersion: configVersion,
            },
            facultyEvaluation: {
              status: "pending",
              finalMarks: null,
              comment: null,
              reviewedAt: null,
              reviewedBy: null,
            },
          });
          continue;
        }

        try {
          // --- STAGE 2.1: BUILDING PROMPT & CALLING LLM ---
          const studentOCRText = answerData.recognizedText;

          const prompt = promptService.buildEvaluationPrompt({
            questionText: examQuestion.questionText,
            studentAnswer: studentOCRText,
            modelAnswer,
            rubric: rubricList,
            maximumMarks: maxMarks,
            keywords,
          });

          totalPromptText += `[Q: ${examQuestion.questionNumber}] [Attempt #${attemptNo}] ${prompt}\n\n`;

          const qEvalStart = Date.now();
          const llmStart = Date.now();
          const llmResult = await llmProvider.evaluate(prompt, maxMarks);
          const llmDuration = Date.now() - llmStart;
          totalLlmMs += llmDuration;

          promptTokensSum += llmResult.tokensUsed?.promptTokens || 0;
          completionTokensSum += llmResult.tokensUsed?.completionTokens || 0;

          // --- STAGE 3: VALIDATING STRUCTURED RESULT ---
          await updateProgress(
            "VALIDATING_RESULT",
            85,
            `Validating scoring for question Q${examQuestion.questionNumber}...`
          );

          const validation = validateAiEvaluationResponse(llmResult, rubricList, maxMarks);
          if (!validation.valid) {
            throw new Error(`AI_RESPONSE_VALIDATION_FAILED: ${validation.errors.join("; ")}`);
          }

          const finalScore = validation.calculatedMarks;
          const percentage = maxMarks > 0 ? Number(((finalScore / maxMarks) * 100).toFixed(2)) : 0;

          // OCR Confidence warnings
          const warningsList = [];
          const ocrConfidence = answerData.confidenceLevel || answerData.confidence || "HIGH";
          if (ocrConfidence === "MEDIUM") {
            warningsList.push({
              code: "MEDIUM_OCR_CONFIDENCE",
              message: "Evaluation is based on medium-confidence OCR transcription.",
            });
          } else if (ocrConfidence === "LOW") {
            warningsList.push({
              code: "LOW_OCR_CONFIDENCE",
              message: "Evaluation is based on low-confidence OCR transcription.",
            });
          }

          // Similarity metrics
          const similarityResult = similarityService.calculateSimilarity(
            studentOCRText,
            modelAnswer
          );

          const structuredCriteria = llmResult.criteria || [];
          const matchedConcepts = llmResult.matchedConcepts || [];
          const missingConcepts = llmResult.missingConcepts || [];
          const feedbackText = llmResult.feedback || "Evaluation complete.";
          const confidenceVal = llmResult.confidence !== undefined ? llmResult.confidence : 0.85;

          const aiEvalObj = {
            marksAwarded: finalScore,
            maxMarks,
            percentage,
            criteria: structuredCriteria,
            matchedConcepts,
            missingConcepts,
            feedback: feedbackText,
            confidence: confidenceVal,
            evaluatedAt: new Date(),
            modelName,
            evaluationConfigVersion: configVersion,
          };

          const facultyEvalObj = {
            status: "pending",
            finalMarks: null,
            comment: null,
            reviewedAt: null,
            reviewedBy: null,
          };

          newQuestionResults.push({
            questionId,
            questionNumber: examQuestion.questionNumber,
            recognizedText: studentOCRText,
            studentAnswer: studentOCRText,
            modelAnswer,
            similarityScore: Math.round(similarityResult.similarityScore * 100),
            aiMarks: finalScore,
            aiAwardedMarks: finalScore,
            finalAwardedMarks: finalScore,
            confidence: confidenceVal,
            feedback: feedbackText,
            criteriaScores: structuredCriteria,
            criteria: structuredCriteria,
            matchedConcepts,
            missingConcepts,
            matchedKeywords: matchedConcepts,
            missingKeywords: missingConcepts,
            keywordScore: matchedConcepts.length,
            semanticScore: Math.round(similarityResult.similarityScore * 100),
            wasOverridden: false,
            maximumMarks: maxMarks,
            provider: providerName,
            model: modelName,
            evaluationConfigVersion: configVersion,
            evaluationAttempt: attemptNo,
            startedAt: new Date(qEvalStart),
            completedAt: new Date(),
            status: "completed",
            evaluationStatus: "completed",
            warnings: warningsList,
            aiEvaluation: aiEvalObj,
            facultyEvaluation: facultyEvalObj,
          });
        } catch (err) {
          logger.error(
            `Failed to evaluate question Q${examQuestion.questionNumber}: ${err.message}`
          );
          failedQuestionsCount++;

          newQuestionResults.push({
            questionId,
            questionNumber: examQuestion.questionNumber,
            recognizedText: answerData ? answerData.recognizedText : "",
            studentAnswer: answerData ? answerData.recognizedText : "",
            modelAnswer: modelAnswer || "",
            similarityScore: 0,
            aiMarks: 0,
            aiAwardedMarks: 0,
            finalAwardedMarks: 0,
            status: "failed",
            evaluationStatus: "failed",
            feedback: `Evaluation Failed: ${err.message}`,
            confidence: 0,
            criteriaScores: [],
            criteria: [],
            matchedConcepts: [],
            missingConcepts: keywords,
            matchedKeywords: [],
            missingKeywords: keywords,
            keywordScore: 0,
            semanticScore: 0,
            wasOverridden: false,
            maximumMarks: maxMarks,
            provider: providerName,
            model: modelName,
            evaluationConfigVersion: configVersion,
            evaluationAttempt: attemptNo,
            startedAt: new Date(),
            completedAt: new Date(),
            errorMessage: err.message,
            aiEvaluation: {
              marksAwarded: 0,
              maxMarks,
              percentage: 0,
              criteria: [],
              matchedConcepts: [],
              missingConcepts: keywords,
              feedback: `Evaluation Failed: ${err.message}`,
              confidence: 0,
              evaluatedAt: new Date(),
              modelName,
              evaluationConfigVersion: configVersion,
            },
            facultyEvaluation: {
              status: "pending",
              finalMarks: null,
              comment: null,
              reviewedAt: null,
              reviewedBy: null,
            },
          });
        }
      }


      // --- STAGE 5 (100%): EVALUATION_COMPLETED & MERGING ---
      await updateProgress("VALIDATING_RESULT", 95, "Merging results and recalculating summary...");

      let finalQuestionsList = [];
      if (scope === "QUESTION") {
        const newResult = newQuestionResults[0];
        const prevResult = previousQuestionsMap.get(newResult.questionId.toString());

        if (newResult.errorMessage && newResult.status !== "failed" && prevResult && !prevResult.errorMessage) {
          logger.info(
            `Single question re-evaluation failed with exception. Preserving previous valid evaluation for Q${questionNumber}.`
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

      // Sync individual question evaluation data onto answerSheet arrays
      for (const fq of finalQuestionsList) {
        // Sync answerSheet.answers array
        if (Array.isArray(answerSheet.answers)) {
          const ansItem = answerSheet.answers.find(
            (a) =>
              (a.questionId && a.questionId.toString() === fq.questionId.toString()) ||
              (a.questionNumber && a.questionNumber === fq.questionNumber)
          );
          if (ansItem) {
            ansItem.aiAwardedMarks = fq.aiMarks;
            ansItem.finalAwardedMarks = fq.finalAwardedMarks;
            ansItem.evaluationConfigVersion = fq.evaluationConfigVersion;
            ansItem.aiEvaluation = fq.aiEvaluation;
            if (fq.wasOverridden) {
              ansItem.wasOverridden = true;
            }
          }
        }

        // Sync answerSheet.digital_answers array
        if (Array.isArray(answerSheet.digital_answers)) {
          const daItem = answerSheet.digital_answers.find(
            (da) =>
              (da.question_id && da.question_id.toString() === fq.questionId.toString()) ||
              (da.question_number && String(da.question_number) === String(fq.questionNumber))
          );
          if (daItem) {
            daItem.evaluation = {
              status: fq.status || fq.evaluationStatus || "completed",
              aiEvaluation: fq.aiEvaluation,
              facultyEvaluation: fq.facultyEvaluation || { status: "pending", finalMarks: null },
            };
          }
        }
      }

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
