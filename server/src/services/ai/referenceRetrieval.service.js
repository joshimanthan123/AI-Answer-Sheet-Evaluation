import ReferenceAnswer from "../../models/ReferenceAnswer.js";
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
   * Helper to calculate concept/keyword overlap ratio
   */
  calculateConceptOverlap(candConcepts = [], candKeywords = [], studentAnswer = "", questionKeywords = []) {
    const studentTokens = new Set(
      studentAnswer
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

    const candTerms = new Set([
      ...candConcepts.map((c) => c.toLowerCase()),
      ...candKeywords.map((k) => k.toLowerCase()),
    ]);

    if (candTerms.size === 0) return 0.5; // Default neutral score if no explicit keywords stored

    let matches = 0;
    candTerms.forEach((term) => {
      if (studentTokens.has(term) || studentAnswer.toLowerCase().includes(term)) {
        matches++;
      }
    });

    return Math.round((matches / candTerms.size) * 100) / 100;
  }

  /**
   * Masks any private personal identification information (PII) like emails or phone numbers
   */
  maskPII(text = "") {
    if (!text) return "";
    return text
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[STUDENT_EMAIL]")
      .replace(/\b\d{10}\b/g, "[PHONE_NUMBER]")
      .replace(/\b\d{12}\b/g, "[REGISTRATION_NUMBER]");
  }

  /**
   * Retrieves top approved historical references relevant to the current student answer and question.
   * Querying BOTH Phase 7A ReferenceAnswer collection and HistoricalEvaluation records.
   * @param {Object} params
   * @param {String|Object} params.examId - Exam ID
   * @param {String|Object} params.subjectId - Subject ID
   * @param {String|Object} params.questionId - Question ID
   * @param {Number|String} params.questionNumber - Question Number
   * @param {String} params.questionText - Current question text
   * @param {String} params.studentAnswer - Current student OCR answer
   * @param {Number} params.maxMarks - Maximum marks
   * @param {Array<String>} params.keywords - Expected question keywords
   * @returns {Array<Object>} List of top relevant approved references
   */
  async getRelevantReferences(params) {
    const {
      examId,
      subjectId,
      questionId,
      questionNumber,
      questionText = "",
      studentAnswer = "",
      maxMarks = 10,
      keywords = [],
    } = params || {};

    const topK = parseInt(
      process.env.REFERENCE_TOP_K || env.AI?.REFERENCE_TOP_K || "3",
      10
    );
    const simThreshold = parseFloat(
      process.env.REFERENCE_SIMILARITY_THRESHOLD ||
        env.AI?.REFERENCE_SIMILARITY_THRESHOLD ||
        "0.60"
    );

    try {
      const candidates = [];

      // 1. QUERY Phase 7A ReferenceAnswer Documents (verificationStatus = "APPROVED" or processingStatus = "APPROVED")
      try {
        const refFilter = {
          isDeleted: false,
          $or: [
            { verificationStatus: "APPROVED" },
            { processingStatus: "APPROVED" },
          ],
        };

        if (examId) {
          refFilter.examId = examId;
        } else if (subjectId) {
          refFilter.subjectId = subjectId;
        }

        const refDocs = await ReferenceAnswer.find(refFilter).lean();

        if (refDocs && refDocs.length > 0) {
          for (const doc of refDocs) {
            const qList = doc.questions || [];
            for (const q of qList) {
              // Ignore unverified or rejected questions if question-level verification status is explicit
              if (q.verificationStatus && q.verificationStatus === "rejected") {
                continue;
              }

              // Match question by ID or number or text
              const matchesQNum =
                questionNumber && String(q.questionNumber) === String(questionNumber);
              const matchesQId =
                questionId && q.questionId && q.questionId.toString() === questionId.toString();

              if (matchesQNum || matchesQId || !questionId) {
                candidates.push({
                  referenceId: doc._id,
                  questionSubId: q._id,
                  academicYear: doc.academicYear || "2024-25",
                  examName: doc.description || "Reference Exam",
                  questionNumber: q.questionNumber,
                  questionId: q.questionId || null,
                  questionText: q.questionText || questionText,
                  studentAnswer: this.maskPII(q.answerText || ""),
                  ocrText: this.maskPII(q.answerText || ""),
                  modelAnswer: "",
                  maxMarks: q.maximumMarks || maxMarks,
                  marksAwarded: q.awardedMarks || 0,
                  keywords: q.keywords || [],
                  concepts: q.concepts || [],
                  partialCreditPoints: q.partialCreditPoints || [],
                  sourceType: "reference_answer",
                });
              }
            }
          }
        }
      } catch (refErr) {
        logger.warn(`Error fetching Phase 7A ReferenceAnswer docs: ${refErr.message}`);
      }

      // 2. QUERY HistoricalEvaluation Documents (referenceStatus = "approved")
      try {
        const histFilter = {
          referenceStatus: "approved",
        };

        if (subjectId) {
          histFilter.$or = [
            { "subject.id": subjectId },
            { subject: subjectId },
          ];
        }

        if (maxMarks) {
          histFilter.maxMarks = maxMarks;
        }

        const histDocs = await HistoricalEvaluation.find(histFilter).lean();

        if (histDocs && histDocs.length > 0) {
          for (const cand of histDocs) {
            candidates.push({
              referenceId: cand._id,
              academicYear: cand.academicYear || "Previous Year",
              examName: cand.examName || "Historical Exam",
              questionNumber: cand.questionNumber,
              questionId: cand.questionId || null,
              questionText: cand.questionText,
              studentAnswer: this.maskPII(cand.studentAnswer || cand.ocrText || ""),
              ocrText: this.maskPII(cand.ocrText || cand.studentAnswer || ""),
              modelAnswer: cand.modelAnswer || "",
              maxMarks: cand.maxMarks || maxMarks,
              marksAwarded: cand.marksAwarded || 0,
              keywords: cand.keywords || [],
              concepts: cand.concepts || [],
              rubric: cand.rubric || [],
              sourceType: "historical_evaluation",
            });
          }
        }
      } catch (histErr) {
        logger.warn(`Error fetching HistoricalEvaluation docs: ${histErr.message}`);
      }

      if (candidates.length === 0) {
        logger.info(`No approved candidate historical or reference answers found for question Q${questionNumber}`);
        return [];
      }

      // 3. RELEVANCE FILTERING & SCORING
      const scoredCandidates = [];

      for (const candidate of candidates) {
        const refQuestionText = candidate.questionText || "";
        const refStudentAnswer = candidate.studentAnswer || candidate.ocrText || "";

        // Question text match ratio
        const questionSim = this.calculateSimilarity(questionText, refQuestionText);

        // Direct question number / ID match check
        const isExactQuestion =
          (questionId && candidate.questionId && candidate.questionId.toString() === questionId.toString()) ||
          (questionNumber && String(candidate.questionNumber) === String(questionNumber));

        // Skip candidate if not exact question match AND question similarity is below 0.5
        if (!isExactQuestion && questionSim < 0.5) {
          continue;
        }

        // Student answer similarity
        const answerSim = this.calculateSimilarity(studentAnswer, refStudentAnswer);

        // Concept overlap score
        const conceptSim = this.calculateConceptOverlap(
          candidate.concepts,
          candidate.keywords,
          studentAnswer,
          keywords
        );

        // Combined relevance score (Weighted: 50% answer text sim, 30% concept overlap, 20% question sim)
        const combinedSim = isExactQuestion
          ? Math.round((0.7 * answerSim + 0.3 * conceptSim) * 100) / 100
          : Math.round((0.5 * answerSim + 0.3 * conceptSim + 0.2 * questionSim) * 100) / 100;

        // Effective threshold (Allow exact question matches with lower similarity to still provide partial credit context)
        const effectiveThreshold = isExactQuestion ? Math.max(0.2, simThreshold - 0.3) : simThreshold;

        if (combinedSim >= effectiveThreshold || isExactQuestion) {
          scoredCandidates.push({
            referenceId: candidate.referenceId,
            questionSubId: candidate.questionSubId,
            academicYear: candidate.academicYear,
            examName: candidate.examName,
            questionNumber: candidate.questionNumber,
            questionText: candidate.questionText,
            studentAnswer: candidate.studentAnswer,
            ocrText: candidate.ocrText,
            modelAnswer: candidate.modelAnswer,
            maxMarks: candidate.maxMarks,
            marksAwarded: candidate.marksAwarded,
            keywords: candidate.keywords,
            concepts: candidate.concepts,
            partialCreditPoints: candidate.partialCreditPoints || [],
            sourceType: candidate.sourceType,
            similarity: combinedSim,
            relevanceSummary: `Reference Evidence (${candidate.academicYear}) matched Q${
              candidate.questionNumber
            } with ${(combinedSim * 100).toFixed(0)}% relevance (Awarded ${candidate.marksAwarded}/${
              candidate.maxMarks
            } marks).`,
          });
        }
      }

      // 4. SORT BY SIMILARITY DESCENDING
      scoredCandidates.sort((a, b) => b.similarity - a.similarity);

      // 5. TAKE TOP K DISTINCT MARKS / DIVERSE REFERENCES
      const topSelected = [];
      const seenRefs = new Set();

      for (const cand of scoredCandidates) {
        if (topSelected.length >= topK) break;
        const key = `${cand.referenceId}_${cand.questionNumber}`;
        if (!seenRefs.has(key)) {
          seenRefs.add(key);
          topSelected.push(cand);
        }
      }

      logger.info(
        `ReferenceRetrievalService: Selected ${topSelected.length} approved reference(s) out of ${candidates.length} total candidates for Q${questionNumber}`
      );

      return topSelected;
    } catch (err) {
      logger.error(`Error retrieving approved reference answers: ${err.message}`);
      return [];
    }
  }
}

export default new ReferenceRetrievalService();

