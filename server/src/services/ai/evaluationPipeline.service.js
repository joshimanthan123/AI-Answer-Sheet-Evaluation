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

export class EvaluationPipelineService {
  async queueEvaluation(answerSheetId, userId) {
    const answerSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
    if (!answerSheet) {
      throw new Error("Answer sheet not found");
    }

    let evaluation = await Evaluation.findOne({ answerSheet: answerSheetId, isDeleted: false });
    if (!evaluation) {
      evaluation = await Evaluation.create({
        answerSheet: answerSheetId,
        evaluationType: "AI",
        obtainedMarks: 0,
        totalMarks: answerSheet.totalQuestions || 10,
        percentage: 0,
        evaluationStatus: "AI_PENDING",
        createdBy: userId,
        updatedBy: userId,
      });
    } else {
      evaluation.evaluationStatus = "AI_PENDING";
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

      evaluation.evaluationStatus = "HWR_PROCESSING";
      await evaluation.save();

      const questionsEvaluation = [];
      let totalObtainedMarks = 0;
      let totalMaxMarks = 0;
      let totalHwrMs = 0;
      let totalLlmMs = 0;
      let promptTokensSum = 0;
      let completionTokensSum = 0;
      let totalPromptText = "";

      for (const answerData of answerSheet.answers) {
        const { questionId, handwrittenData } = answerData;
        const examQuestion = exam.questions.find((q) => q._id.toString() === questionId.toString());

        if (!examQuestion) {
          logger.warn(`Question details not found in exam for questionId: ${questionId}`);
          continue;
        }

        const parsedKeyAnswer = answerKey
          ? answerKey.parsedAnswers.find(
            (pa) =>
              (pa.questionId && pa.questionId.toString() === questionId.toString()) ||
                pa.questionNumber === examQuestion.questionNumber
          )
          : null;

        const modelAnswer = parsedKeyAnswer ? parsedKeyAnswer.answerText : examQuestion.modelAnswer;
        const rubric =
          parsedKeyAnswer && parsedKeyAnswer.rubric?.length > 0
            ? parsedKeyAnswer.rubric
            : examQuestion.rubric;
        const keywords =
          parsedKeyAnswer && parsedKeyAnswer.keywords?.length > 0
            ? parsedKeyAnswer.keywords
            : examQuestion.keywords;
        const maxMarks =
          parsedKeyAnswer && parsedKeyAnswer.maximumMarks !== undefined
            ? parsedKeyAnswer.maximumMarks
            : examQuestion.maximumMarks;

        let recognizedText = answerData.recognizedText;
        if (!recognizedText) {
          const hwrStart = Date.now();
          const hwrResult = await hwrProvider.transcribe(handwrittenData, modelAnswer);
          const hwrDuration = Date.now() - hwrStart;
          totalHwrMs += hwrDuration;
          recognizedText = hwrResult.recognizedText;
          answerData.recognizedText = recognizedText;
          answerData.hwrStatus = "Completed";
          answerData.submissionTime = new Date();
        }

        evaluation.evaluationStatus = "PROMPT_GENERATION";
        await evaluation.save();

        const prompt = promptService.buildEvaluationPrompt({
          questionText: examQuestion.questionText,
          studentAnswer: recognizedText,
          modelAnswer,
          rubric,
          maximumMarks: maxMarks,
          keywords,
        });

        totalPromptText += `[Q: ${examQuestion.questionNumber}] ${prompt}\n\n`;

        evaluation.evaluationStatus = "LLM_PROCESSING";
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

        const similarityResult = similarityService.calculateSimilarity(
          recognizedText,
          modelAnswer
        );

        evaluation.evaluationStatus = "GRADING";
        await evaluation.save();

        const scoredMarks = gradingService.processMarks(llmResult.marks, maxMarks);
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
          modelAnswer,
          similarityScore: Math.round(similarityResult.similarityScore * 100),
          aiMarks: scoredMarks,
          feedback: `${formattedFeedback.strengths} | ${formattedFeedback.weaknesses} | ${formattedFeedback.suggestions}`,
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
      evaluation.evaluationStatus = "AI_COMPLETED";
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
