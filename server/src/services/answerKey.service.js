import AnswerKey from "../models/AnswerKey.js";
import Exam from "../models/Exam.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import logger from "../utils/logger.js";

export class AnswerKeyService {
  async uploadAnswerKey(examId, file, userId) {
    const exam = await Exam.findOne({ _id: examId, isDeleted: false });
    if (!exam) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
    }

    const latestKey = await AnswerKey.findOne({ examId }).sort({ version: -1 });
    const nextVersion = latestKey ? latestKey.version + 1 : 1;

    const fileUrl = `/uploads/${file.filename}`;
    const answerKey = await AnswerKey.create({
      examId,
      version: nextVersion,
      isActive: false,
      uploadedBy: userId,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileUrl,
      uploadStatus: "Uploading",
    });

    this.processExtractedContent(answerKey._id, exam._id).catch((err) => {
      logger.error(`Error processing answer key ${answerKey._id}: ${err.message}`);
    });

    return answerKey;
  }

  async processExtractedContent(answerKeyId, examId) {
    const answerKey = await AnswerKey.findById(answerKeyId);
    if (!answerKey) return;

    try {
      answerKey.uploadStatus = "Extracting Text";
      await answerKey.save();
      await new Promise((resolve) => setTimeout(resolve, 800));

      answerKey.uploadStatus = "Parsing Questions";
      await answerKey.save();
      await new Promise((resolve) => setTimeout(resolve, 800));

      const exam = await Exam.findById(examId);
      const examQuestions = exam ? exam.questions : [];

      const parsedAnswers = [];
      let extractedTextCumulative = "";

      if (examQuestions.length > 0) {
        for (const q of examQuestions) {
          const mockAnswer = `This is mock extracted perfect text answer for Question ${q.questionNumber} matching key concepts.`;
          extractedTextCumulative += `Question ${q.questionNumber}: ${q.questionText}\nAnswer: ${mockAnswer}\n\n`;

          parsedAnswers.push({
            questionId: q._id,
            questionNumber: q.questionNumber,
            questionText: q.questionText,
            answerText: mockAnswer,
            maximumMarks: q.maximumMarks,
            rubric: q.rubric || [],
            keywords: q.keywords || [],
          });
        }
      } else {
        for (let i = 1; i <= 3; i++) {
          const mockAnswer = `Mock transcribed key text for general question ${i}.`;
          extractedTextCumulative += `Q${i}: General Question Text\nAnswer: ${mockAnswer}\n\n`;

          parsedAnswers.push({
            questionNumber: i,
            questionText: `General Question ${i} Text`,
            answerText: mockAnswer,
            maximumMarks: 10,
            rubric: [],
            keywords: [],
          });
        }
      }

      answerKey.extractedText = extractedTextCumulative;
      answerKey.parsedAnswers = parsedAnswers;
      answerKey.uploadStatus = "Ready for Review";
      await answerKey.save();

      logger.info(`Answer key ${answerKeyId} parsing completed successfully`);
    } catch (err) {
      logger.error(`Failed parsing answer key ${answerKeyId}: ${err.message}`);
      answerKey.uploadStatus = "Failed";
      await answerKey.save();
    }
  }

  async getAnswerKey(examId) {
    let answerKey = await AnswerKey.findOne({
      examId,
      isActive: true,
      uploadStatus: "Approved",
    }).populate("uploadedBy", "name email");

    if (!answerKey) {
      answerKey = await AnswerKey.findOne({ examId })
        .sort({ version: -1 })
        .populate("uploadedBy", "name email");
    }

    return answerKey;
  }

  async updateAnswerKey(answerKeyId, data, userId) {
    const answerKey = await AnswerKey.findById(answerKeyId);
    if (!answerKey) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer key not found");
    }

    if (answerKey.uploadStatus === "Approved") {
      throw new ApiError(
        STATUS_CODES.BAD_REQUEST,
        "Cannot update an already approved answer key. Update the details and upload a new version instead."
      );
    }

    if (data.parsedAnswers) {
      answerKey.parsedAnswers = data.parsedAnswers;
    }

    answerKey.uploadStatus = "Ready for Review";
    answerKey.updatedBy = userId;
    await answerKey.save();

    return answerKey;
  }

  async approveAnswerKey(answerKeyId, userId) {
    const answerKey = await AnswerKey.findById(answerKeyId);
    if (!answerKey) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer key not found");
    }

    await AnswerKey.updateMany(
      { examId: answerKey.examId, _id: { $ne: answerKeyId } },
      { $set: { isActive: false } }
    );

    answerKey.isActive = true;
    answerKey.uploadStatus = "Approved";
    answerKey.updatedBy = userId;
    await answerKey.save();

    return answerKey;
  }

  async deleteAnswerKey(answerKeyId) {
    const answerKey = await AnswerKey.findById(answerKeyId);
    if (!answerKey) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer key not found");
    }

    await AnswerKey.findByIdAndDelete(answerKeyId);
    return { success: true };
  }
}

export default new AnswerKeyService();
