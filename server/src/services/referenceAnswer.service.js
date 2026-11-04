import fs from "fs";
import path from "path";
import ReferenceAnswer from "../models/ReferenceAnswer.js";
import Exam from "../models/Exam.js";
import Subject from "../models/Subject.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import logger from "../utils/logger.js";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8000";

// Common English Stopwords for keyword & concept extraction
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing",
  "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
  "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself",
  "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is",
  "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
  "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
  "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should",
  "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them",
  "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
  "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we",
  "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where",
  "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
  "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
  "is", "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "with", "by", "of"
]);

export class ReferenceAnswerService {
  /**
   * Helper to extract awarded and maximum marks from transcribed answer text
   */
  extractMarks(text = "") {
    let awarded = null;
    let max = null;

    if (!text) return { awardedMarks: 0, maximumMarks: 0 };

    // Pattern 1: 4/5, 4 / 5, 4.5/5, 4 out of 5
    const matchSlash = text.match(/(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*(\d+(?:\.\d+)?)/i);
    if (matchSlash) {
      awarded = parseFloat(matchSlash[1]);
      max = parseFloat(matchSlash[2]);
    } else {
      // Pattern 2: Marks: 4, Score: 4, Awarded: 4
      const matchMarks = text.match(/(?:marks|score|awarded|got|scored)\s*[:=\-]?\s*(\d+(?:\.\d+)?)/i);
      if (matchMarks) {
        awarded = parseFloat(matchMarks[1]);
      }
      // Pattern 3: 4 marks
      const matchWord = text.match(/(\d+(?:\.\d+)?)\s*marks?/i);
      if (matchWord && awarded === null) {
        awarded = parseFloat(matchWord[1]);
      }
    }

    if (awarded !== null && max !== null) {
      if (awarded > max) {
        // Swap if read backwards
        const temp = awarded;
        awarded = max;
        max = temp;
      }
    }

    return {
      awardedMarks: awarded !== null ? Math.max(0, awarded) : 0,
      maximumMarks: max !== null ? Math.max(1, max) : 0,
      marksDetected: awarded !== null,
    };
  }

  /**
   * Helper to extract keywords, concepts, and partial credit points from answer text
   */
  extractKnowledge(answerText = "", questionText = "") {
    if (!answerText) {
      return { keywords: [], concepts: [], partialCreditPoints: [] };
    }

    const cleaned = answerText
      .replace(/[^\w\s\-]/g, " ")
      .toLowerCase();

    const words = cleaned
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    // Calculate word frequencies
    const freq = {};
    words.forEach((w) => {
      freq[w] = (freq[w] || 0) + 1;
    });

    // Sort by frequency
    const keywords = Object.keys(freq)
      .sort((a, b) => freq[b] - freq[a])
      .slice(0, 10);

    // Extract multi-word concepts (N-grams)
    const conceptsSet = new Set();

    // Pull capital phrase nouns or multi-word sequences from original text
    const sentences = answerText.split(/[.\n;!?]/).filter((s) => s.trim().length > 5);

    sentences.forEach((sent) => {
      const sWords = sent.trim().split(/\s+/);
      for (let i = 0; i < sWords.length - 1; i++) {
        const w1 = sWords[i].replace(/[^\w]/g, "");
        const w2 = sWords[i + 1].replace(/[^\w]/g, "");
        if (
          w1.length > 2 &&
          w2.length > 2 &&
          !STOP_WORDS.has(w1.toLowerCase()) &&
          !STOP_WORDS.has(w2.toLowerCase())
        ) {
          const concept = `${w1} ${w2}`;
          if (concept.length > 5 && conceptsSet.size < 8) {
            conceptsSet.add(concept);
          }
        }
      }
    });

    // If questionText has key technical terms, include them as concepts
    if (questionText) {
      const qWords = questionText
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()));

      qWords.slice(0, 3).forEach((qw) => {
        if (!conceptsSet.has(qw)) conceptsSet.add(qw);
      });
    }

    // Partial credit key points: break answer into key structural points / sentences
    const partialCreditPoints = sentences
      .map((s) => s.trim())
      .filter((s) => s.length >= 10 && s.length <= 150)
      .slice(0, 5);

    return {
      keywords,
      concepts: Array.from(conceptsSet),
      partialCreditPoints,
    };
  }

  /**
   * Upload a new reference answer sheet
   */
  async uploadReferenceAnswer({ examId, subjectId, academicYear, description, file, userId }) {
    if (!file) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, "File upload is required for reference answer sheet");
    }

    // Validate exam exists
    const exam = await Exam.findOne({ _id: examId, isDeleted: false });
    if (!exam) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
    }

    const finalSubjectId = subjectId || exam.subject;

    // Build sourceFile object
    const sourceFile = {
      filename: file.filename || file.originalname,
      path: file.path ? file.path.replace(/\\/g, "/") : `uploads/reference-answers/${file.filename}`,
      storageReference: file.destination || "uploads",
      pages: 1,
      mimeType: file.mimetype || "application/pdf",
      size: file.size || 0,
    };

    // Create reference answer record
    const reference = await ReferenceAnswer.create({
      examId,
      subjectId: finalSubjectId,
      uploadedBy: userId,
      referenceType: "previous_year_evaluated",
      academicYear: academicYear || new Date().getFullYear().toString(),
      description: description || "",
      sourceFile,
      processingStatus: "UPLOADED",
      verificationStatus: "PENDING",
      questions: [],
    });

    logger.info(`Reference answer uploaded ID=${reference._id} by User=${userId}`);

    // Trigger OCR processing asynchronously (or synchronously for small files)
    setImmediate(() => {
      this.processReferenceAnswer(reference._id).catch((err) => {
        logger.error(`Async reference OCR processing failed for ID=${reference._id}: ${err.message}`);
      });
    });

    return reference;
  }

  /**
   * Process/Reprocess reference answer sheet using OCR pipeline
   */
  async processReferenceAnswer(referenceId) {
    const reference = await ReferenceAnswer.findById(referenceId);
    if (!reference || reference.isDeleted) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Reference answer not found");
    }

    // Update status to PROCESSING
    reference.processingStatus = "PROCESSING";
    reference.processingError = "";
    await reference.save();

    logger.info(`Reference answer OCR processing started for ID=${reference._id}`);

    try {
      const exam = await Exam.findById(reference.examId);
      const examQuestions = exam ? exam.questions : [];

      let ocrResultData = null;
      let ocrErrorDetail = null;

      // Locate uploaded file with fallbacks for Windows and relative paths
      let absoluteFilePath = null;
      const possiblePaths = [
        reference.sourceFile?.path,
        path.isAbsolute(reference.sourceFile?.path || "")
          ? reference.sourceFile?.path
          : path.join(process.cwd(), reference.sourceFile?.path || ""),
        path.join(process.cwd(), "uploads", reference.sourceFile?.filename || ""),
        path.join(process.cwd(), "server", reference.sourceFile?.path || ""),
        path.join(process.cwd(), "server", "uploads", reference.sourceFile?.filename || ""),
      ];

      for (const p of possiblePaths) {
        if (p && fs.existsSync(p)) {
          absoluteFilePath = p;
          break;
        }
      }

      if (absoluteFilePath) {
        try {
          const fileBuffer = fs.readFileSync(absoluteFilePath);
          let mimeType = reference.sourceFile?.mimeType;
          if (!mimeType || mimeType === "application/octet-stream") {
            const ext = path.extname(absoluteFilePath).toLowerCase();
            if (ext === ".pdf") mimeType = "application/pdf";
            else if (ext === ".png") mimeType = "image/png";
            else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
            else mimeType = "application/pdf";
          }

          const fileBlob = new Blob([fileBuffer], { type: mimeType });
          const formData = new FormData();
          formData.append("file", fileBlob, reference.sourceFile?.filename || path.basename(absoluteFilePath));

          const ocrUrl = `${OCR_SERVICE_URL}/api/v1/ocr/pipeline`;
          logger.info(`Sending OCR pipeline request for reference ${reference._id} to ${ocrUrl}`);

          const response = await fetch(ocrUrl, {
            method: "POST",
            body: formData,
            signal: AbortSignal.timeout(30000),
          });

          if (response.ok) {
            const data = await response.json();
            if (data && data.success && data.data) {
              ocrResultData = data.data;
              logger.info(`OCR processing succeeded for reference ${reference._id}`);
            } else {
              ocrErrorDetail = data?.message || "OCR service returned unsuccessful response payload";
            }
          } else {
            const errText = await response.text();
            ocrErrorDetail = `OCR service HTTP ${response.status}: ${errText}`;
            logger.warn(`Call to OCR service failed: ${ocrErrorDetail}`);
          }
        } catch (ocrErr) {
          ocrErrorDetail = `Call to OCR service (${OCR_SERVICE_URL}) failed: ${ocrErr.message}`;
          logger.warn(`${ocrErrorDetail}. Attempting direct Python OCR fallback execution...`);

          try {
            const possiblePyExes = [
              path.join(process.cwd(), "..", "ocr-service", ".venv", "Scripts", "python.exe"),
              path.join(process.cwd(), "ocr-service", ".venv", "Scripts", "python.exe"),
              "python",
            ];
            const possiblePyScripts = [
              path.join(process.cwd(), "..", "ocr-service", "extract_file_text.py"),
              path.join(process.cwd(), "ocr-service", "extract_file_text.py"),
            ];

            let pyExeToUse = "python";
            for (const pe of possiblePyExes) {
              if (pe !== "python" && fs.existsSync(pe)) {
                pyExeToUse = pe;
                break;
              }
            }

            let pyScriptToUse = null;
            for (const ps of possiblePyScripts) {
              if (fs.existsSync(ps)) {
                pyScriptToUse = ps;
                break;
              }
            }

            if (pyScriptToUse) {
              logger.info(`Running direct Python script fallback: ${pyExeToUse} "${pyScriptToUse}" "${absoluteFilePath}"`);
              const { stdout } = await execFileAsync(pyExeToUse, [pyScriptToUse, absoluteFilePath], { timeout: 90000 });
              const parsedPy = JSON.parse(stdout);
              if (parsedPy && parsedPy.success) {
                const textLines = parsedPy.lines || [];
                const segAnswers = parsedPy.answers || [];

                ocrResultData = {
                  metrics: { average_confidence: 0.85 },
                  recognition: {
                    text: textLines.join("\n"),
                    lines: textLines.map((t) => ({ text: t })),
                    confidence: 0.85,
                  },
                  segmentation: {
                    answers: segAnswers,
                  },
                };
                ocrErrorDetail = null; // Cleared error because direct Python fallback succeeded!
                logger.info(`Direct Python OCR execution fallback succeeded for reference ${reference._id} (${textLines.length} lines, ${segAnswers.length} segments)`);
              }
            }
          } catch (pyErr) {
            ocrErrorDetail = `Direct Python OCR execution failed: ${pyErr.message}`;
            logger.warn(ocrErrorDetail);
          }
        }
      } else {
        ocrErrorDetail = `Source file not found on disk for reference ${reference._id}`;
        logger.warn(ocrErrorDetail);
      }

      // Parse OCR segmented answers or build from exam question structure
      const extractedQuestions = [];

      if (
        ocrResultData &&
        ocrResultData.segmentation &&
        Array.isArray(ocrResultData.segmentation.answers) &&
        ocrResultData.segmentation.answers.length > 0
      ) {
        const segAnswers = ocrResultData.segmentation.answers;

        for (let i = 0; i < segAnswers.length; i++) {
          const seg = segAnswers[i];
          const qNumStr = seg.normalized_question_number || seg.question_number || `Q${i + 1}`;
          const qNumNumeric = parseInt(qNumStr.replace(/\D/g, ""), 10) || (i + 1);

          // Find corresponding question in Exam if matching
          const matchedExamQ = examQuestions.find(
            (eq) => eq.questionNumber === qNumNumeric || eq.questionNumber === i + 1
          );

          const answerText = seg.answer_text || "";
          const marksInfo = this.extractMarks(answerText);
          const maxMarks = matchedExamQ ? matchedExamQ.maximumMarks : (marksInfo.maximumMarks || 5);
          const awardedMarks = Math.min(marksInfo.awardedMarks, maxMarks);

          const knowledge = this.extractKnowledge(answerText, matchedExamQ ? matchedExamQ.questionText : "");

          extractedQuestions.push({
            questionNumber: qNumNumeric,
            questionId: matchedExamQ ? matchedExamQ._id : null,
            questionText: matchedExamQ ? matchedExamQ.questionText : `Question ${qNumNumeric}`,
            answerText: answerText,
            maximumMarks: maxMarks,
            awardedMarks: awardedMarks,
            keywords: knowledge.keywords,
            concepts: knowledge.concepts,
            partialCreditPoints: knowledge.partialCreditPoints,
            facultyComment: "",
            verificationStatus: "pending",
            ocrConfidence: seg.confidence || ocrResultData.metrics?.average_confidence || 0.85,
          });
        }
      } else if (ocrResultData && ocrResultData.recognition && ocrResultData.recognition.text) {
        const fullText = ocrResultData.recognition.text;
        if (examQuestions && examQuestions.length > 0) {
          for (let i = 0; i < examQuestions.length; i++) {
            const eq = examQuestions[i];
            const qNum = Number(eq.questionNumber) || (i + 1);
            const knowledge = this.extractKnowledge(fullText, eq.questionText);

            extractedQuestions.push({
              questionNumber: qNum,
              questionId: eq._id,
              questionText: eq.questionText || `Question ${qNum}`,
              answerText: fullText,
              maximumMarks: Number(eq.maximumMarks) || 5,
              awardedMarks: 0,
              keywords: eq.keywords || knowledge.keywords,
              concepts: knowledge.concepts,
              partialCreditPoints: knowledge.partialCreditPoints,
              facultyComment: "",
              verificationStatus: "pending",
              ocrConfidence: ocrResultData.recognition.confidence || 0.85,
            });
          }
        } else {
          const knowledge = this.extractKnowledge(fullText, "Question 1");
          extractedQuestions.push({
            questionNumber: 1,
            questionId: null,
            questionText: "Question 1",
            answerText: fullText,
            maximumMarks: 10,
            awardedMarks: 0,
            keywords: knowledge.keywords,
            concepts: knowledge.concepts,
            partialCreditPoints: knowledge.partialCreditPoints,
            facultyComment: "",
            verificationStatus: "pending",
            ocrConfidence: ocrResultData.recognition.confidence || 0.85,
          });
        }
      } else if (examQuestions && examQuestions.length > 0) {
        // Fallback: If OCR service is offline, map exam questions
        for (let i = 0; i < examQuestions.length; i++) {
          const eq = examQuestions[i];
          const qNum = Number(eq.questionNumber) || (i + 1);
          const defaultText = `Answer text for question ${qNum}.`;
          const knowledge = this.extractKnowledge(defaultText, eq.questionText);

          extractedQuestions.push({
            questionNumber: qNum,
            questionId: eq._id,
            questionText: eq.questionText || `Question ${qNum}`,
            answerText: "",
            maximumMarks: Number(eq.maximumMarks) || 5,
            awardedMarks: 0,
            keywords: eq.keywords || knowledge.keywords,
            concepts: knowledge.concepts,
            partialCreditPoints: knowledge.partialCreditPoints,
            facultyComment: "",
            verificationStatus: "pending",
            ocrConfidence: 0.75,
          });
        }
      }

      if (extractedQuestions.length > 0) {
        reference.questions = extractedQuestions;
        reference.processingStatus = "VERIFICATION_PENDING";
        reference.verificationStatus = "PENDING";
        reference.processingError = ocrErrorDetail ? `Warning: ${ocrErrorDetail}` : "";
      } else {
        reference.processingStatus = "FAILED";
        reference.processingError = ocrErrorDetail || "Failed to extract text or questions from sheet";
      }

      await reference.save();

      logger.info(
        `Reference answer OCR processing completed for ID=${reference._id} (Status=${reference.processingStatus}, ${extractedQuestions.length} questions)`
      );
      return reference;
    } catch (err) {
      logger.error(`Error during reference answer processing ID=${reference._id}: ${err.message}`);
      reference.processingStatus = "FAILED";
      reference.processingError = err.message;
      await reference.save();
      throw err;
    }
  }

  /**
   * List reference answers with search and pagination
   */
  async getReferences(query = {}, user) {
    const {
      page = 1,
      limit = 10,
      examId,
      subjectId,
      academicYear,
      processingStatus,
      verificationStatus,
      search,
    } = query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const filter = { isDeleted: false };

    if (examId) filter.examId = examId;
    if (subjectId) filter.subjectId = subjectId;
    if (academicYear) filter.academicYear = academicYear;
    if (processingStatus) filter.processingStatus = processingStatus;
    if (verificationStatus) filter.verificationStatus = verificationStatus;

    if (search) {
      filter.$or = [
        { academicYear: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { "sourceFile.filename": { $regex: search, $options: "i" } },
        { "questions.questionText": { $regex: search, $options: "i" } },
        { "questions.answerText": { $regex: search, $options: "i" } },
      ];
    }

    const [references, total] = await Promise.all([
      ReferenceAnswer.find(filter)
        .populate("examId", "title totalMarks duration examType")
        .populate("subjectId", "name code department")
        .populate("uploadedBy", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      ReferenceAnswer.countDocuments(filter),
    ]);

    return {
      references,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
    };
  }

  /**
   * Get single reference answer by ID
   */
  async getReferenceById(id) {
    const reference = await ReferenceAnswer.findOne({ _id: id, isDeleted: false })
      .populate("examId", "title totalMarks duration examType questions")
      .populate("subjectId", "name code department")
      .populate("uploadedBy", "name email role")
      .lean();

    if (!reference) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Reference answer not found");
    }

    return reference;
  }

  /**
   * Update specific question extracted data in reference answer
   */
  async updateQuestionData(referenceId, questionSubIdOrNum, updateData) {
    const reference = await ReferenceAnswer.findOne({ _id: referenceId, isDeleted: false });
    if (!reference) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Reference answer not found");
    }

    const targetStr = questionSubIdOrNum.toString();
    const questionIndex = reference.questions.findIndex(
      (q) =>
        (q._id && q._id.toString() === targetStr) ||
        (q.questionId && q.questionId.toString() === targetStr) ||
        (q.questionNumber && q.questionNumber.toString() === targetStr)
    );

    if (questionIndex === -1) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Question not found in reference answer sheet");
    }

    const q = reference.questions[questionIndex];

    if (updateData.questionText !== undefined) q.questionText = updateData.questionText;
    if (updateData.answerText !== undefined) q.answerText = updateData.answerText;
    if (updateData.maximumMarks !== undefined) {
      q.maximumMarks = Math.max(0, Number(updateData.maximumMarks));
    }
    if (updateData.awardedMarks !== undefined) {
      const awarded = Math.max(0, Number(updateData.awardedMarks));
      if (awarded > q.maximumMarks) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, `Awarded marks (${awarded}) cannot exceed maximum marks (${q.maximumMarks})`);
      }
      q.awardedMarks = awarded;
    }
    if (updateData.keywords !== undefined && Array.isArray(updateData.keywords)) {
      q.keywords = updateData.keywords;
    }
    if (updateData.concepts !== undefined && Array.isArray(updateData.concepts)) {
      q.concepts = updateData.concepts;
    }
    if (updateData.partialCreditPoints !== undefined && Array.isArray(updateData.partialCreditPoints)) {
      q.partialCreditPoints = updateData.partialCreditPoints;
    }
    if (updateData.facultyComment !== undefined) q.facultyComment = updateData.facultyComment;
    if (updateData.verificationStatus !== undefined) q.verificationStatus = updateData.verificationStatus;

    // Recalculate knowledge if answerText changed and keywords/concepts were not manually passed
    if (updateData.answerText !== undefined && !updateData.keywords && !updateData.concepts) {
      const reExtracted = this.extractKnowledge(q.answerText, q.questionText);
      q.keywords = reExtracted.keywords;
      q.concepts = reExtracted.concepts;
      if (!updateData.partialCreditPoints) q.partialCreditPoints = reExtracted.partialCreditPoints;
    }

    reference.questions[questionIndex] = q;

    // Check overall verification status
    const allApproved = reference.questions.every((item) => item.verificationStatus === "approved");
    const anyRejected = reference.questions.some((item) => item.verificationStatus === "rejected");

    if (allApproved) {
      reference.verificationStatus = "APPROVED";
      reference.processingStatus = "APPROVED";
    } else if (anyRejected) {
      reference.verificationStatus = "REJECTED";
    }

    await reference.save();
    logger.info(`Updated reference question ID=${reference._id}, QNum=${q.questionNumber}`);

    return reference;
  }

  /**
   * Approve reference answer
   */
  async approveReference(id) {
    const reference = await ReferenceAnswer.findOne({ _id: id, isDeleted: false });
    if (!reference) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Reference answer not found");
    }

    reference.verificationStatus = "APPROVED";
    reference.processingStatus = "APPROVED";
    reference.questions.forEach((q) => {
      q.verificationStatus = "approved";
    });

    await reference.save();
    logger.info(`Reference answer APPROVED ID=${reference._id}`);
    return reference;
  }

  /**
   * Reject reference answer
   */
  async rejectReference(id, reason = "") {
    const reference = await ReferenceAnswer.findOne({ _id: id, isDeleted: false });
    if (!reference) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Reference answer not found");
    }

    reference.verificationStatus = "REJECTED";
    if (reason) {
      reference.description = reference.description
        ? `${reference.description} | Rejection Reason: ${reason}`
        : `Rejection Reason: ${reason}`;
    }

    reference.questions.forEach((q) => {
      q.verificationStatus = "rejected";
    });

    await reference.save();
    logger.info(`Reference answer REJECTED ID=${reference._id}`);
    return reference;
  }

  /**
   * Delete reference answer (soft delete)
   */
  async deleteReference(id) {
    const reference = await ReferenceAnswer.findOne({ _id: id, isDeleted: false });
    if (!reference) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Reference answer not found");
    }

    reference.isDeleted = true;
    await reference.save();
    logger.info(`Reference answer deleted ID=${reference._id}`);
    return { success: true, message: "Reference answer deleted successfully" };
  }
}

export default new ReferenceAnswerService();
