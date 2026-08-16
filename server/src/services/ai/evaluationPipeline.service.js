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

export class EvaluationPipelineService {
  async queueEvaluation(answerSheetId, userId) {
    const answerSheet = await AnswerSheet.findOne({
      _id: answerSheetId,
      isDeleted: false,
    }).populate("exam");
    if (!answerSheet) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
    }

    const exam = answerSheet.exam;
    if (!exam) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Associated exam not found");
    }

    // Eligibility check 1: Ownership
    if (exam.createdBy && exam.createdBy.toString() !== userId.toString()) {
      throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this Exam");
    }

    // Eligibility check 2: Completed processing
    if (
      answerSheet.processingStatus !== "completed" &&
      answerSheet.processingStatus !== "ready_for_evaluation"
    ) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, "Answer sheet processing is not complete");
    }

    // Eligibility check 3: Segmented answers exist
    if (!answerSheet.answers || answerSheet.answers.length === 0) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, "No segmented answers are available");
    }

    // Eligibility check 4: Exam answer key is locked
    if (exam.answerKeyStatus !== "locked") {
      throw new ApiError(
        STATUS_CODES.BAD_REQUEST,
        "Answer key must be finalized before evaluation"
      );
    }

    let evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });

    // Eligibility check 5: Finalized checks
    if (
      evaluation &&
      (evaluation.evaluationStatus === "finalized" ||
        evaluation.evaluationStatus === "reviewed" ||
        evaluation.evaluationStatus === "completed")
    ) {
      // Unless re-evaluate is called; default behave returns existing
      return evaluation;
    }

    if (!evaluation) {
      evaluation = await Evaluation.create({
        answerSheet: answerSheetId,
        evaluationType: "AI",
        obtainedMarks: 0,
        totalMarks: exam.totalMarks || answerSheet.totalQuestions || 10,
        percentage: 0,
        evaluationStatus: "pending",
        createdBy: userId,
        updatedBy: userId,
      });
    } else {
      evaluation.evaluationStatus = "pending";
      evaluation.updatedBy = userId;
      await evaluation.save();
    }

    // Start background processing async (do not await)
    this.runPipeline(evaluation._id, answerSheetId, userId).catch((err) => {
      logger.error(
        `Background AI Evaluation failure for answerSheet ${answerSheetId}: ${err.message}`
      );
    });

    return evaluation;
  }

  async runPipeline(evaluationId, answerSheetId, userId) {
    const totalStart = Date.now();
    logger.info(`Starting AI Evaluation Pipeline for answerSheetId = ${answerSheetId}...`);

    const evaluation = await Evaluation.findById(evaluationId);
    if (!evaluation) return;

    try {
      const answerSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false })
        .populate("student")
        .populate("exam");

      if (!answerSheet) {
        throw new Error(`Answer sheet ${answerSheetId} not found`);
      }

      const examId = answerSheet.exam?._id;
      const exam = await Exam.findOne({ _id: examId, isDeleted: false });
      if (!exam) {
        throw new Error(`Associated Exam ${examId} not found`);
      }

      const hwrProvider = HwrProviderFactory.getProvider();
      const llmProvider = LlmProviderFactory.getProvider();

      // Check if an approved AnswerKey exists for this exam
      const answerKey = await AnswerKey.findOne({
        examId: exam._id,
        isActive: true,
        uploadStatus: "Approved",
      });

      // Support student scanned document/images upload preprocessing
      if (answerSheet.submissionType === "UPLOAD") {
        answerSheet.uploadStatus = "HWR Processing";
        await answerSheet.save();

        if (answerSheet.answers.length === 0) {
          for (const eq of exam.questions) {
            const parsedKeyAnswer = answerKey
              ? answerKey.parsedAnswers.find(
                  (pa) =>
                    (pa.questionId && pa.questionId.toString() === eq._id.toString()) ||
                    pa.questionNumber === eq.questionNumber
                )
              : null;

            const targetModelAnswer = parsedKeyAnswer ? parsedKeyAnswer.answerText : eq.modelAnswer;

            const hwrResult = await hwrProvider.transcribe(null, targetModelAnswer);
            answerSheet.answers.push({
              questionId: eq._id,
              handwrittenData: "",
              recognizedText: hwrResult.recognizedText,
              hwrStatus: "Completed",
              submissionTime: new Date(),
            });
          }
          await answerSheet.save();
        }
      }

      evaluation.evaluationStatus = "processing";
      await evaluation.save();

      const questionsEvaluation = [];
      let totalObtainedMarks = 0;
      let totalMaxMarks = 0;
      let totalHwrMs = 0;
      let totalLlmMs = 0;
      let promptTokensSum = 0;
      let completionTokensSum = 0;
      let totalPromptText = "";

      // Loop through exam questions to ensure complete coverage, mapping segmented answers or marking missing
      for (const examQuestion of exam.questions) {
        const questionId = examQuestion._id;
        const maxMarks = examQuestion.maximumMarks;

        // Map answer by questionId or questionNumber
        const answerData = answerSheet.answers.find(
          (ans) =>
            (ans.questionId && ans.questionId.toString() === questionId.toString()) ||
            (ans.questionNumber && ans.questionNumber === examQuestion.questionNumber)
        );

        const parsedKeyAnswer = answerKey
          ? answerKey.parsedAnswers.find(
              (pa) =>
                (pa.questionId && pa.questionId.toString() === questionId.toString()) ||
                pa.questionNumber === examQuestion.questionNumber
            )
          : null;

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

        // Handle case where student answer is missing or completely blank
        if (!answerData || !answerData.recognizedText || !answerData.recognizedText.trim()) {
          const defaultCriteriaScores = rubricList.map((rub) => ({
            criterion: rub.criteria || rub.criterion,
            marksAwarded: 0,
            maxMarks: rub.marks || rub.maxMarks || 0,
          }));

          questionsEvaluation.push({
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
          });
          totalMaxMarks += maxMarks;
          continue;
        }

        let recognizedText = answerData.recognizedText;
        if (!recognizedText) {
          const hwrStart = Date.now();
          const hwrResult = await hwrProvider.transcribe(answerData.handwrittenData, modelAnswer);
          const hwrDuration = Date.now() - hwrStart;
          totalHwrMs += hwrDuration;
          recognizedText = hwrResult.recognizedText || "";
          answerData.recognizedText = recognizedText;
          answerData.hwrStatus = "Completed";
          answerData.submissionTime = new Date();
        }

        evaluation.evaluationStatus = "processing"; // Keep active status lowercase or mapped
        await evaluation.save();

        const prompt = promptService.buildEvaluationPrompt({
          questionText: examQuestion.questionText,
          studentAnswer: recognizedText,
          modelAnswer,
          rubric: rubricList,
          maximumMarks: maxMarks,
          keywords,
        });

        totalPromptText += `[Q: ${examQuestion.questionNumber}] ${prompt}\n\n`;

        evaluation.evaluationStatus = "processing";
        if (answerSheet.submissionType === "UPLOAD") {
          answerSheet.uploadStatus = "AI Evaluation";
          await answerSheet.save();
        }
        await evaluation.save();

        const llmStart = Date.now();
        const llmResult = await llmProvider.evaluate(prompt, maxMarks);
        const llmDuration = Date.now() - llmStart;
        totalLlmMs += llmDuration;

        promptTokensSum += llmResult.tokensUsed?.promptTokens || 0;
        completionTokensSum += llmResult.tokensUsed?.completionTokens || 0;

        // Calculate similarity metrics
        const similarityResult = similarityService.calculateSimilarity(recognizedText, modelAnswer);

        // Sub-elements validation: ensure score is in 0..maxMarks
        const scoredMarks = gradingService.processMarks(llmResult.marks, maxMarks);

        // Enforce criterion-level boundaries
        const validatedCriteria = (llmResult.criteriaScores || []).map((cs) => {
          const matchRub = rubricList.find(
            (rub) =>
              (rub.criteria && rub.criteria.toLowerCase() === cs.criterion.toLowerCase()) ||
              (rub.criterion && rub.criterion.toLowerCase() === cs.criterion.toLowerCase())
          );
          const criterionMax = matchRub ? matchRub.marks || matchRub.maxMarks : cs.maxMarks || 0;
          return {
            criterion: cs.criterion,
            marksAwarded: Math.min(Math.max(Number(cs.marksAwarded) || 0, 0), criterionMax),
            maxMarks: criterionMax,
          };
        });

        totalObtainedMarks += scoredMarks;
        totalMaxMarks += maxMarks;

        const formattedFeedback = feedbackService.formatFeedback(
          llmResult.strengths,
          llmResult.weaknesses,
          llmResult.suggestions
        );

        questionsEvaluation.push({
          questionId,
          recognizedText,
          studentAnswer: recognizedText,
          modelAnswer,
          similarityScore: Math.round(similarityResult.similarityScore * 100),
          aiMarks: scoredMarks,
          aiAwardedMarks: scoredMarks,
          finalAwardedMarks: scoredMarks,
          confidence: llmResult.confidence || 0.85,
          feedback: `${formattedFeedback.strengths} | ${formattedFeedback.weaknesses} | ${formattedFeedback.suggestions}`,
          criteriaScores: validatedCriteria,
          matchedKeywords: llmResult.matchedKeywords || [],
          missingKeywords: llmResult.missingKeywords || [],
          keywordScore: (llmResult.matchedKeywords || []).length,
          semanticScore: Math.round(similarityResult.similarityScore * 100),
          wasOverridden: false,
        });
      }

      answerSheet.submissionStatus = "Pending AI Evaluation";
      if (answerSheet.submissionType === "UPLOAD") {
        answerSheet.uploadStatus = "Faculty Review";
      }
      await answerSheet.save();

      const percent = totalMaxMarks > 0 ? (totalObtainedMarks / totalMaxMarks) * 100 : 0;
      const roundedPercent = Math.round(percent * 100) / 100;
      const finalGrade = gradingService.calculateGrade(roundedPercent);
      const totalDuration = Date.now() - totalStart;

      evaluation.questions = questionsEvaluation;
      evaluation.obtainedMarks = totalObtainedMarks;
      evaluation.totalMarks = totalMaxMarks;
      evaluation.percentage = roundedPercent;
      evaluation.grade = finalGrade;
      evaluation.evaluationStatus = "completed";
      evaluation.aiMetadata = {
        promptText: totalPromptText.substring(0, 5000),
        modelUsed: "gpt-4o",
        promptVersion: "1.0",
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

      evaluation.strengths = "Understanding demonstrated in main concepts.";
      evaluation.weaknesses = "Lacks detailed terms in secondary rubrics.";
      evaluation.suggestions = "Practice key terms and definitions.";

      evaluation.updatedBy = userId;
      await evaluation.save();

      logger.info(`AI Evaluation Pipeline completed for AnswerSheet ${answerSheetId}`);

      const examCreator = exam.createdBy;
      if (examCreator) {
        await Notification.create({
          user: examCreator,
          title: "AI Evaluation Ready",
          message: `AI Evaluation auto-completed for "${exam.title}". Review is pending.`,
          type: "Faculty Review Pending",
          createdBy: userId,
          updatedBy: userId,
        });
      }

      if (answerSheet.student?._id) {
        await Notification.create({
          user: answerSheet.student._id,
          title: "AI Evaluation Completed",
          message: `Evaluation for your exam "${exam.title}" has been completed by system.`,
          type: "AI Evaluation Completed",
          createdBy: userId,
          updatedBy: userId,
        });
      }
    } catch (err) {
      logger.error(`Error executing AI evaluation pipeline: ${err.message}`);
      evaluation.evaluationStatus = "FAILED";
      await evaluation.save();

      if (answerSheet) {
        answerSheet.submissionStatus = "Failed";
        if (answerSheet.submissionType === "UPLOAD") {
          answerSheet.uploadStatus = "Failed";
        }
        await answerSheet.save();
      }

      await Notification.create({
        user: userId,
        title: "AI Pipeline Error",
        message: `Evaluation pipeline failed for AnswerSheet ${answerSheetId}: ${err.message}`,
        type: "System Notification",
        createdBy: userId,
        updatedBy: userId,
      });
    }
  }
}

export default new EvaluationPipelineService();
