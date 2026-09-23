import HistoricalEvaluation from "../../models/HistoricalEvaluation.js";
import logger from "../../utils/logger.js";
import env from "../../config/env.js";

export class ReferenceRetrievalService {
  /**
   * Calculates word-level / n-gram TF-IDF cosine similarity between two texts.
   * @param {String} text1
   * @param {String} text2
   * @returns {Number} Similarity score between 0.0 and 1.0
   */
  calculateSimilarity(text1 = "", text2 = "") {
    if (!text1 || !text2) return 0;

    const tokenize = (text) =>
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2);

    const tokens1 = tokenize(text1);
    const tokens2 = tokenize(text2);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    const freq1 = {};
    const freq2 = {};

    tokens1.forEach((t) => (freq1[t] = (freq1[t] || 0) + 1));
    tokens2.forEach((t) => (freq2[t] = (freq2[t] || 0) + 1));

    const vocab = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    vocab.forEach((term) => {
      const v1 = freq1[term] || 0;
      const v2 = freq2[term] || 0;
      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    });

    if (norm1 === 0 || norm2 === 0) return 0;

    const cosineSim = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return Math.round(cosineSim * 100) / 100;
  }

  /**
   * Retrieves top approved historical references relevant to the current student answer and question.
   * @param {Object} params
   * @param {String|Object} params.subjectId - Subject ID
   * @param {String|Object} params.questionId - Question ID
   * @param {Number} params.questionNumber - Question Number
   * @param {String} params.questionText - Current question text
   * @param {String} params.studentAnswer - Current student OCR answer
   * @param {Number} params.maxMarks - Maximum marks
   * @returns {Array<Object>} List of top relevant approved references
   */
  async getRelevantReferences(params) {
    const {
      subjectId,
      questionId,
      questionNumber,
      questionText = "",
      studentAnswer = "",
      maxMarks = 10,
    } = params || {};

    const topK = parseInt(
      process.env.REFERENCE_TOP_K || env.AI?.REFERENCE_TOP_K || "3",
      10
    );
    const simThreshold = parseFloat(
      process.env.REFERENCE_SIMILARITY_THRESHOLD ||
        env.AI?.REFERENCE_SIMILARITY_THRESHOLD ||
        "0.70"
    );

    try {
      // 1. Build Metadata Hard Filter
      const filter = {
        referenceStatus: "approved", // MUST be approved only
      };

      if (subjectId) {
        filter.$or = [
          { "subject.id": subjectId },
          { subject: subjectId },
        ];
      }

      if (maxMarks) {
        filter.maxMarks = maxMarks;
      }

      // Fetch candidates from database
      const candidates = await HistoricalEvaluation.find(filter)
        .populate("approvedBy", "name email")
        .populate("createdBy", "name email")
        .lean();

      if (!candidates || candidates.length === 0) {
        logger.info(`No approved candidate historical references found for subject ${subjectId}`);
        return [];
      }

      // 2. Question identity & Semantic Similarity filtering
      const scoredCandidates = [];

      for (const candidate of candidates) {
        const refQuestionText = candidate.questionText || "";
        const refStudentAnswer = candidate.studentAnswer || candidate.ocrText || "";

        // Question match ratio
        const questionSim = this.calculateSimilarity(questionText, refQuestionText);
        // Direct questionNumber or questionId match
        const isExactQuestion =
          (questionId && candidate.questionId && candidate.questionId.toString() === questionId.toString()) ||
          (questionNumber && candidate.questionNumber === questionNumber);

        // If not exact question match and question text similarity is low, skip
        if (!isExactQuestion && questionSim < 0.6) {
          continue;
        }

        // Calculate student answer similarity
        const answerSim = this.calculateSimilarity(studentAnswer, refStudentAnswer);

        // Weighted combined similarity (70% answer similarity, 30% question similarity)
        const combinedSim = isExactQuestion
          ? Math.round(answerSim * 100) / 100
          : Math.round((0.7 * answerSim + 0.3 * questionSim) * 100) / 100;

        // Apply similarity threshold (allow exact question match with slightly lower threshold if necessary)
        const effectiveThreshold = isExactQuestion ? Math.max(0.4, simThreshold - 0.2) : simThreshold;

        if (combinedSim >= effectiveThreshold) {
          scoredCandidates.push({
            referenceId: candidate._id,
            academicYear: candidate.academicYear,
            examName: candidate.examName,
            questionNumber: candidate.questionNumber,
            questionText: candidate.questionText,
            studentAnswer: candidate.studentAnswer || candidate.ocrText,
            ocrText: candidate.ocrText,
            modelAnswer: candidate.modelAnswer,
            maxMarks: candidate.maxMarks,
            marksAwarded: candidate.marksAwarded,
            rubric: candidate.rubric,
            similarity: combinedSim,
            relevanceSummary: `Semantic similarity match of ${(combinedSim * 100).toFixed(
              0
            )}% for Question ${candidate.questionNumber} (${candidate.academicYear}).`,
            approvedAt: candidate.approvedAt,
            approvedBy: candidate.approvedBy,
          });
        }
      }

      // 3. Sort by similarity descending
      scoredCandidates.sort((a, b) => b.similarity - a.similarity);

      // 4. Reference Diversity selection: Try to pick diverse mark levels if multiple top matches exist
      const topSelected = [];
      const usedMarks = new Set();

      for (const cand of scoredCandidates) {
        if (topSelected.length >= topK) break;

        // Add candidate
        topSelected.push(cand);
        usedMarks.add(cand.marksAwarded);
      }

      logger.info(
        `Retrieved ${topSelected.length} top approved historical references out of ${candidates.length} candidates`
      );

      return topSelected;
    } catch (err) {
      logger.error(`Error retrieving historical references: ${err.message}`);
      return [];
    }
  }
}

export default new ReferenceRetrievalService();
