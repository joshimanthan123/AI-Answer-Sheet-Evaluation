import mongoose from "mongoose";
import AnswerSheet from "../models/AnswerSheet.js";
import User from "../models/User.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import ApiError from "../utils/ApiError.js";
import { STATUS_CODES } from "../constants/statusCodes.js";
import { ROLES } from "../constants/roles.js";
import Notification from "../models/Notification.js";
import logger from "../utils/logger.js";
import fs from "fs";
import path from "path";

import { execFile } from "child_process";
import evaluationPipelineService from "./ai/evaluationPipeline.service.js";

export const extractTextFromFile = (fileUrlOrPath) => {
  return new Promise((resolve) => {
    try {
      if (!fileUrlOrPath) return resolve([]);
      let absolutePath = fileUrlOrPath;
      if (!path.isAbsolute(fileUrlOrPath) || fileUrlOrPath.startsWith("/") || fileUrlOrPath.startsWith("\\")) {
        const cleanRelative = fileUrlOrPath.replace(/^[/\\]+/, "");
        if (fs.existsSync(path.join(process.cwd(), cleanRelative))) {
          absolutePath = path.join(process.cwd(), cleanRelative);
        } else if (fs.existsSync(path.join(process.cwd(), "..", cleanRelative))) {
          absolutePath = path.join(process.cwd(), "..", cleanRelative);
        } else {
          absolutePath = path.join(process.cwd(), cleanRelative);
        }
      }
      if (!fs.existsSync(absolutePath)) {
        logger.warn(`extractTextFromFile file not found at: ${absolutePath}`);
        return resolve([]);
      }
      let scriptPath = path.join(process.cwd(), "..", "ocr-service", "extract_file_text.py");
      if (!fs.existsSync(scriptPath)) {
        scriptPath = path.join(process.cwd(), "ocr-service", "extract_file_text.py");
      }
      const ocrDir = path.dirname(scriptPath);
      execFile("python", [scriptPath, absolutePath], { timeout: 45000, env: { ...process.env, PYTHONPATH: ocrDir } }, (error, stdout) => {
        if (error || !stdout) {
          logger.warn(`extractTextFromFile script error for ${absolutePath}: ${error ? error.message : "no output"}`);
          return resolve([]);
        }
        try {
          const lines = stdout.split("\n");
          for (const l of lines) {
            const trimmed = l.trim();
            if (trimmed.startsWith('{"success":')) {
              const data = JSON.parse(trimmed);
              const linesArr = data.lines || [];
              linesArr.answers = data.answers || [];
              linesArr.pages = data.pages || [];
              return resolve(linesArr);
            }
          }
        } catch (e) {
          logger.warn(`extractTextFromFile parse error: ${e.message}`);
        }
        return resolve([]);
      });
    } catch (err) {
      logger.error(`extractTextFromFile exception: ${err.message}`);
      return resolve([]);
    }
  });
};

export const createAnswerSheet = async (data, userId) => {
  // Validate student exists
  const student = await User.findOne({ _id: data.student, isDeleted: false, role: ROLES.STUDENT });
  if (!student) {
    throw new ApiError(
      STATUS_CODES.NOT_FOUND,
      "Student reference not found, is inactive, or role is invalid"
    );
  }

  // Validate subject exists
  const subject = await Subject.findOne({ _id: data.subject, isDeleted: false });
  if (!subject) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Subject reference not found or is inactive");
  }

  // Validate exam exists
  const exam = await Exam.findOne({ _id: data.exam, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam reference not found or is inactive");
  }

  const answerSheet = await AnswerSheet.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
  return answerSheet;
};

export const getAnswerSheetById = async (id, userId, userRole) => {
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id, isDeleted: false }
    : { $or: [{ _id: id }, { fastapiSheetId: id }], isDeleted: false };

  let answerSheet;
  try {
    answerSheet = await AnswerSheet.findOne(query)
      .populate("student", "name email rollNo department semester")
      .populate("subject", "name code semester")
      .populate("exam", "title examType totalMarks duration")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");
  } catch (err) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }

  // Enforce student ownership isolation
  if (userRole === ROLES.STUDENT && userId) {
    const studentOwnerId = answerSheet.student && (answerSheet.student._id ? answerSheet.student._id.toString() : answerSheet.student.toString());
    if (studentOwnerId !== userId.toString()) {
      throw new ApiError(STATUS_CODES.FORBIDDEN, "Access denied. You do not own this answer sheet.");
    }
  }

  const sheetObj = answerSheet.toObject ? answerSheet.toObject() : { ...answerSheet };

  // Ensure digital_answers exists and is populated for frontend UI consumption
  const hasTextInItems = (items) => Array.isArray(items) && items.some(item => (item.text || item.recognizedText || item.answer_text || "").trim().length > 0);

  if (!sheetObj.digital_answers || sheetObj.digital_answers.length === 0 || sheetObj.uploadStatus === "FAILED" || !hasTextInItems(sheetObj.digital_answers)) {
    let populatedFromAnswers = false;
    if (sheetObj.answers && sheetObj.answers.length > 0) {
      const examQuestions = sheetObj.exam?.questions || [];
      const mapped = sheetObj.answers.map((ans, idx) => {
        const matchedQ = examQuestions.find(q => q._id && ans.questionId && q._id.toString() === ans.questionId.toString());
        const qNum = ans.question_number || (matchedQ ? matchedQ.questionNumber : idx + 1);
        const qText = ans.question_text || (matchedQ ? matchedQ.questionText : "");
        const maxMarks = ans.max_marks || (matchedQ ? (matchedQ.maximumMarks || matchedQ.marks || 10) : 10);
        let strokes = ans.strokes || [];
        if ((!strokes || strokes.length === 0) && ans.handwrittenData) {
          try {
            const parsed = typeof ans.handwrittenData === "string" ? JSON.parse(ans.handwrittenData) : ans.handwrittenData;
            if (parsed && Array.isArray(parsed.strokes)) strokes = parsed.strokes;
          } catch (e) {}
        }
        let textVal = (ans.recognizedText || ans.text || ans.answer_text || "").trim();
        if (textVal.startsWith("Transcribed canvas response") || textVal.startsWith("Digitized canvas answer")) {
          textVal = "";
        }
        return {
          question_number: String(qNum),
          question_id: ans.questionId,
          question_text: qText,
          max_marks: maxMarks,
          text: textVal,
          answer_text: textVal,
          recognizedText: textVal,
          handwrittenData: ans.handwrittenData || "",
          strokes,
          page_number: ans.page_number || ans.pageNumber || 1,
          confidence: ans.confidence !== undefined ? ans.confidence : 1.0,
          hwrStatus: ans.hwrStatus || (textVal ? "Completed" : (strokes.length > 0 ? "Pending" : "Completed")),
          provider: ans.provider || "textract",
        };
      });
      if (mapped.length > 0) {
        sheetObj.digital_answers = mapped;
        if (hasTextInItems(mapped) || mapped.some(m => m.strokes?.length > 0 || m.handwrittenData)) {
          populatedFromAnswers = true;
        }
      }
    }
    if ((!populatedFromAnswers || !hasTextInItems(sheetObj.digital_answers)) && sheetObj.extractedText && sheetObj.extractedText.trim().length > 0) {
      const parts = sheetObj.extractedText.split(/\n\n+/).filter((p) => p.trim().length > 0);
      const parsedParts = parts.map((part, idx) => {
        const match = part.match(/^Q(\d+):\s*(.*)/s);
        return {
          question_number: match ? match[1] : String(idx + 1),
          text: match ? match[2].trim() : part.trim(),
          answer_text: match ? match[2].trim() : part.trim(),
          confidence: 0.95,
        };
      });
      if (sheetObj.digital_answers && sheetObj.digital_answers.length > 0) {
        sheetObj.digital_answers = sheetObj.digital_answers.map((da, idx) => {
          const match = parsedParts.find(p => String(p.question_number) === String(da.question_number)) || parsedParts[idx];
          const textVal = da.text || (match ? match.text : "");
          return {
            ...da,
            text: textVal,
            answer_text: textVal,
            recognizedText: textVal,
          };
        });
      } else {
        sheetObj.digital_answers = parsedParts;
      }
      populatedFromAnswers = true;
    }

    // Direct File Extraction Fallback if still unpopulated
    const fallbackPath = sheetObj.uploadedFileUrl || (sheetObj.uploadedFileName && fs.existsSync(`server/uploads/${sheetObj.uploadedFileName}`) ? `server/uploads/${sheetObj.uploadedFileName}` : null);
    if ((!populatedFromAnswers || !hasTextInItems(sheetObj.digital_answers)) && fallbackPath) {
      const extractedLines = await extractTextFromFile(fallbackPath);
      if (extractedLines && (extractedLines.answers?.length > 0 || extractedLines.pages?.length > 0 || extractedLines.length > 0)) {
        if (extractedLines.answers && extractedLines.answers.length > 0) {
          sheetObj.digital_answers = extractedLines.answers.map((a, idx) => ({
            question_number: String(a.question_number || a.normalized_question_number || idx + 1).replace(/^Q/i, ""),
            text: (a.answer_text || a.text || "").trim(),
            answer_text: (a.answer_text || a.text || "").trim(),
            recognizedText: (a.answer_text || a.text || "").trim(),
            confidence: a.confidence ?? 1.0,
            page_number: a.page_number || idx + 1,
            strokes: []
          }));
        } else if (extractedLines.pages && extractedLines.pages.length > 0) {
          sheetObj.digital_answers = extractedLines.pages.map((pText, idx) => ({
            question_number: String(idx + 1),
            text: pText.trim(),
            answer_text: pText.trim(),
            recognizedText: pText.trim(),
            confidence: 1.0,
            page_number: idx + 1,
            strokes: []
          }));
        } else {
          const fullTxt = extractedLines.join("\n").trim();
          sheetObj.digital_answers = [{
            question_number: "1",
            text: fullTxt,
            answer_text: fullTxt,
            recognizedText: fullTxt,
            confidence: 1.0,
            page_number: 1,
            strokes: []
          }];
        }
        sheetObj.extractedText = sheetObj.digital_answers.map(da => `Q${da.question_number}: ${da.text}`).join("\n\n");
        sheetObj.uploadStatus = "COMPLETED";
        sheetObj.processingStatus = "completed";

        AnswerSheet.findByIdAndUpdate(sheetObj._id, {
          digital_answers: sheetObj.digital_answers,
          extractedText: sheetObj.extractedText,
          uploadStatus: "COMPLETED",
          processingStatus: "completed",
          errorMessage: null,
        }).catch((e) => logger.error(`Failed updating AnswerSheet ${sheetObj._id} in fallback: ${e.message}`));
      }
    }
  }

  // Digital Canvas Stroke Recognition Fallback: If digital answers have strokes but missing recognized text
  const hasUnrecognizedStrokes = (items) => Array.isArray(items) && items.some(item => {
    const hasText = (item.text || item.recognizedText || item.answer_text || "").trim().length > 0;
    const hasStrokes = (item.strokes && item.strokes.length > 0) || (item.handwrittenData && typeof item.handwrittenData === "string" && item.handwrittenData.includes("points"));
    return !hasText && hasStrokes;
  });

  if (sheetObj.digital_answers && hasUnrecognizedStrokes(sheetObj.digital_answers)) {
    const ocrBaseUrl = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8000";
    let updatedStrokes = false;
    const recognizedLines = [];

    for (let i = 0; i < sheetObj.digital_answers.length; i++) {
      const da = sheetObj.digital_answers[i];
      let strokes = da.strokes || [];
      if ((!strokes || strokes.length === 0) && da.handwrittenData) {
        try {
          const parsed = typeof da.handwrittenData === "string" ? JSON.parse(da.handwrittenData) : da.handwrittenData;
          if (parsed && Array.isArray(parsed.strokes)) strokes = parsed.strokes;
        } catch (e) {}
      }

      let textVal = (da.text || da.recognizedText || da.answer_text || "").trim();
      if (textVal.startsWith("Transcribed canvas response") || textVal.startsWith("Digitized canvas answer")) {
        textVal = "";
      }

      if (!textVal && strokes && strokes.length > 0) {
        const payload = {
          strokes: strokes.map(st => ({
            points: (st.points || []).map(p => ({ x: p.x, y: p.y })),
            color: st.color || "#0000FF",
            width: st.width || 3,
          })),
          width: 800,
          height: 600,
          page_num: Number(da.question_number) || (i + 1),
        };

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          const resp = await fetch(`${ocrBaseUrl}/api/v1/ocr/recognize-strokes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (resp.ok) {
            const resData = await resp.json();
            if (resData.success && resData.data) {
              const transcribed = (resData.data.text || resData.data.processed_text || resData.data.raw_text || "").trim();
              if (transcribed) {
                textVal = transcribed;
                da.text = textVal;
                da.answer_text = textVal;
                da.recognizedText = textVal;
                da.confidence = resData.data.confidence ?? 1.0;
                da.hwrStatus = "Completed";
                da.provider = resData.data.provider || "textract";
                updatedStrokes = true;

                if (Array.isArray(sheetObj.answers)) {
                  const matchedAns = sheetObj.answers.find(a => 
                    (a.questionId && da.question_id && a.questionId.toString() === da.question_id.toString()) ||
                    (a.question_number && String(a.question_number) === String(da.question_number))
                  ) || sheetObj.answers[i];
                  if (matchedAns) {
                    matchedAns.recognizedText = textVal;
                    matchedAns.hwrStatus = "Completed";
                    matchedAns.confidence = da.confidence;
                    matchedAns.provider = da.provider;
                  }
                }
              }
            }
          } else {
            da.hwrStatus = "Failed";
          }
        } catch (strokeErr) {
          logger.warn(`Strokes recognition fallback failed for Q${da.question_number}: ${strokeErr.message}`);
          da.hwrStatus = "Failed";
        }
      }

      if (textVal) {
        recognizedLines.push(`Q${da.question_number}: ${textVal}`);
      }
    }

    if (updatedStrokes) {
      if (recognizedLines.length > 0) {
        sheetObj.extractedText = recognizedLines.join("\n\n");
      }
      sheetObj.uploadStatus = "COMPLETED";
      sheetObj.processingStatus = "completed";
      sheetObj.ocrStatus = "completed";

      await AnswerSheet.findByIdAndUpdate(sheetObj._id, {
        answers: sheetObj.answers,
        digital_answers: sheetObj.digital_answers,
        extractedText: sheetObj.extractedText,
        uploadStatus: "COMPLETED",
        processingStatus: "completed",
        ocrStatus: "completed",
        errorMessage: null,
      }).catch((e) => logger.error(`Failed updating AnswerSheet ${sheetObj._id} with recognized strokes: ${e.message}`));
    }
  }

  // Populate evaluation marks if present
  try {
    const Evaluation = mongoose.model("Evaluation");
    const matchingEval = await Evaluation.findOne({ answerSheet: answerSheet._id, isDeleted: false }).lean();
    if (matchingEval) {
      sheetObj.evaluation = {
        _id: matchingEval._id,
        obtainedMarks: matchingEval.obtainedMarks,
        totalMarks: matchingEval.totalMarks,
        percentage: matchingEval.percentage,
        evaluationStatus: matchingEval.evaluationStatus,
        grade: matchingEval.grade,
      };
      sheetObj.obtainedMarks = matchingEval.obtainedMarks;
      sheetObj.totalMarks = matchingEval.totalMarks;
      sheetObj.percentage = matchingEval.percentage;
      sheetObj.grade = matchingEval.grade;
    } else if (sheetObj.evaluationSummary && (sheetObj.evaluationSummary.evaluatedQuestions > 0 || sheetObj.evaluationSummary.totalMaximumMarks > 0)) {
      sheetObj.obtainedMarks = sheetObj.evaluationSummary.totalAwardedMarks;
      sheetObj.totalMarks = sheetObj.evaluationSummary.totalMaximumMarks;
      sheetObj.percentage = sheetObj.evaluationSummary.percentage;
      if (sheetObj.percentage !== undefined) {
        sheetObj.grade = sheetObj.percentage >= 90 ? "A+" : sheetObj.percentage >= 80 ? "A" : sheetObj.percentage >= 70 ? "B" : sheetObj.percentage >= 60 ? "C" : sheetObj.percentage >= 50 ? "D" : sheetObj.percentage >= 40 ? "E" : "F";
      }
    }
  } catch (evalLookupErr) {
    logger.warn(`Could not lookup evaluation for sheet ${answerSheet._id}: ${evalLookupErr.message}`);
  }

  return sheetObj;
};

export const getDigitalAnswers = async (id, userId, userRole) => {
  const sheet = await getAnswerSheetById(id, userId, userRole);
  return sheet.digital_answers || [];
};

export const getAllAnswerSheets = async (query = {}, userId, userRole) => {
  const {
    page = 1,
    limit = 10,
    sort = "-createdAt",
    student,
    subject,
    exam,
    submissionStatus,
    ...filters
  } = query;

  const mongoQuery = { isDeleted: false };

  if (userRole === ROLES.STUDENT && userId) {
    // Force ownership filter for student users
    mongoQuery.student = userId;
    // Exclude unsubmitted digital drafts with 0 answers (abandoned started sessions)
    mongoQuery.$nor = [
      { submissionStatus: "Started", submissionType: "DIGITAL", answers: { $size: 0 } }
    ];
  } else if (student) {
    mongoQuery.student = student;
  }

  if (subject) {
    mongoQuery.subject = subject;
  }

  if (exam) {
    mongoQuery.exam = exam;
  }

  if (submissionStatus) {
    mongoQuery.submissionStatus = submissionStatus;
  }

  Object.assign(mongoQuery, filters);

  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Number(limit);

  const total = await AnswerSheet.countDocuments(mongoQuery);
  const data = await AnswerSheet.find(mongoQuery)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate("student", "name email rollNo department semester")
    .populate("subject", "name code semester")
    .populate("exam", "title examType totalMarks duration")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .lean();

  const sheetIds = data.map((s) => s._id);
  const Evaluation = mongoose.model("Evaluation");
  const evaluations = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    isDeleted: false,
  }).lean();

  const formattedData = data.map((sheet) => {
    if (!sheet.uploadedFileName) {
      sheet.uploadedFileName = sheet.submissionType === "UPLOAD" ? "Uploaded Scan" : "Digital Slate Submission";
    }

    const matchingEval = evaluations.find(
      (ev) => ev.answerSheet.toString() === sheet._id.toString()
    );
    if (matchingEval) {
      sheet.evaluation = {
        _id: matchingEval._id,
        obtainedMarks: matchingEval.obtainedMarks,
        totalMarks: matchingEval.totalMarks,
        percentage: matchingEval.percentage,
        evaluationStatus: matchingEval.evaluationStatus,
        grade: matchingEval.grade,
      };
      sheet.obtainedMarks = matchingEval.obtainedMarks;
      sheet.totalMarks = matchingEval.totalMarks;
      sheet.percentage = matchingEval.percentage;
      sheet.grade = matchingEval.grade;
    } else if (sheet.evaluationSummary && (sheet.evaluationSummary.evaluatedQuestions > 0 || sheet.evaluationSummary.totalMaximumMarks > 0)) {
      sheet.obtainedMarks = sheet.evaluationSummary.totalAwardedMarks;
      sheet.totalMarks = sheet.evaluationSummary.totalMaximumMarks;
      sheet.percentage = sheet.evaluationSummary.percentage;
      if (sheet.percentage !== undefined) {
        sheet.grade = sheet.percentage >= 90 ? "A+" : sheet.percentage >= 80 ? "A" : sheet.percentage >= 70 ? "B" : sheet.percentage >= 60 ? "C" : sheet.percentage >= 50 ? "D" : sheet.percentage >= 40 ? "E" : "F";
      }
    }
    return sheet;
  });

  return {
    data: formattedData,
    pagination: {
      total,
      page: Number(page),
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

export const updateAnswerSheet = async (id, data, userId) => {
  const answerSheet = await AnswerSheet.findOne({ _id: id, isDeleted: false });
  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }

  if (data.student) {
    const student = await User.findOne({
      _id: data.student,
      isDeleted: false,
      role: ROLES.STUDENT,
    });
    if (!student) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Student reference not found or is invalid");
    }
  }

  if (data.subject) {
    const subject = await Subject.findOne({ _id: data.subject, isDeleted: false });
    if (!subject) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Subject reference not found or is inactive");
    }
  }

  if (data.exam) {
    const exam = await Exam.findOne({ _id: data.exam, isDeleted: false });
    if (!exam) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam reference not found or is inactive");
    }
  }

  Object.assign(answerSheet, data);
  answerSheet.updatedBy = userId;

  await answerSheet.save();
  return answerSheet;
};

export const deleteAnswerSheet = async (id, userId) => {
  const answerSheet = await AnswerSheet.findOne({ _id: id, isDeleted: false });
  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }

  // Verify ownership
  if (answerSheet.facultyId && answerSheet.facultyId.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this answer sheet");
  }

  // Check if safe to delete
  if (answerSheet.processingStatus === "processing") {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      "Cannot delete answer sheet while it is processing"
    );
  }

  // Delete file from local uploads folder
  const filePath = answerSheet.uploadedFileUrl;
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      logger.error(`Failed to delete local file ${filePath}: ${err.message}`);
    }
  }

  // Try calling Python FastAPI OCR service to delete there if possible
  try {
    const ocrBase = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8000";
    const uvicornUrl = `${ocrBase}/api/v1/faculty/answer-sheets/${id}`;
    await fetch(uvicornUrl, {
      method: "DELETE",
      headers: {
        "X-User-Role": "faculty",
      },
    });
  } catch (err) {
    logger.warn(`Failed to delete answer sheet from Python OCR: ${err.message}`);
  }

  answerSheet.isDeleted = true;
  answerSheet.updatedBy = userId;

  await answerSheet.save();
  return answerSheet;
};

export const getExamAnswerSheets = async (examId, userId, userRole) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  // If role is faculty, ensure ownership
  if (userRole === ROLES.FACULTY && exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this exam");
  }

  // Self-healing: Ensure all answer sheets for this exam have facultyId set to exam.createdBy
  if (exam.createdBy) {
    await AnswerSheet.updateMany(
      { exam: examId, $or: [{ facultyId: { $exists: false } }, { facultyId: null }], isDeleted: false },
      { $set: { facultyId: exam.createdBy } }
    );
  }

  const sheets = await AnswerSheet.find({ exam: examId, isDeleted: false })
    .populate("student", "name email rollNo department semester")
    .sort("-createdAt")
    .lean();

  const sheetIds = sheets.map((s) => s._id);
  // Import Evaluation model dynamically or check if Evaluation model is already loaded
  const Evaluation = mongoose.model("Evaluation");
  const evaluations = await Evaluation.find({
    answerSheet: { $in: sheetIds },
    isDeleted: false,
  }).lean();

  sheets.forEach((sheet) => {
    if (!sheet.uploadedFileName) {
      sheet.uploadedFileName = sheet.submissionType === "UPLOAD" ? "Uploaded Scan" : "Digital Slate Submission";
    }

    const matchingEval = evaluations.find(
      (ev) => ev.answerSheet.toString() === sheet._id.toString()
    );
    if (matchingEval) {
      sheet.evaluation = {
        _id: matchingEval._id,
        obtainedMarks: matchingEval.obtainedMarks,
        totalMarks: matchingEval.totalMarks,
        percentage: matchingEval.percentage,
        evaluationStatus: matchingEval.evaluationStatus,
        grade: matchingEval.grade,
      };
      sheet.obtainedMarks = matchingEval.obtainedMarks;
      sheet.totalMarks = matchingEval.totalMarks;
      sheet.percentage = matchingEval.percentage;
      sheet.grade = matchingEval.grade;
    } else if (sheet.evaluationSummary && (sheet.evaluationSummary.evaluatedQuestions > 0 || sheet.evaluationSummary.totalMaximumMarks > 0)) {
      sheet.obtainedMarks = sheet.evaluationSummary.totalAwardedMarks;
      sheet.totalMarks = sheet.evaluationSummary.totalMaximumMarks;
      sheet.percentage = sheet.evaluationSummary.percentage;
      if (sheet.percentage !== undefined) {
        sheet.grade = sheet.percentage >= 90 ? "A+" : sheet.percentage >= 80 ? "A" : sheet.percentage >= 70 ? "B" : sheet.percentage >= 60 ? "C" : sheet.percentage >= 50 ? "D" : sheet.percentage >= 40 ? "E" : "F";
      }
    }
  });

  return sheets;
};

export const retryAnswerSheet = async (answerSheetId, userId) => {
  const answerSheet = await AnswerSheet.findOne({ _id: answerSheetId, isDeleted: false });
  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found");
  }

  // Verify ownership
  if (answerSheet.facultyId && answerSheet.facultyId.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this answer sheet");
  }

  // Verify it is not already processing
  if (answerSheet.processingStatus === "processing") {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Answer sheet is already processing");
  }

  const filePath = answerSheet.uploadedFileUrl;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new ApiError(
      STATUS_CODES.BAD_REQUEST,
      "Original file is missing from server storage, please re-upload"
    );
  }

  const fileBuffer = fs.readFileSync(filePath);

  answerSheet.processingStatus = "processing";
  answerSheet.ocrStatus = "processing";
  answerSheet.segmentationStatus = "processing";
  answerSheet.errorMessage = undefined;
  answerSheet.updatedBy = userId;
  await answerSheet.save();

  processAnswerSheetBackground(
    answerSheet._id,
    fileBuffer,
    answerSheet.fileType || "application/pdf",
    answerSheet.uploadedFileName,
    answerSheet.exam,
    answerSheet.student,
    userId
  ).catch((err) =>
    logger.error(`Background OCR Retry failed for sheet ${answerSheet._id}: ${err.message}`)
  );

  return answerSheet;
};

export const uploadAnswerSheets = async (examId, files, studentIdentifier, userId) => {
  const exam = await Exam.findOne({ _id: examId, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam not found");
  }

  if (exam.createdBy.toString() !== userId.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "You do not own this exam");
  }

  const results = [];

  for (const file of files) {
    try {
      let identifier = studentIdentifier;
      if (!identifier) {
        const baseName =
          file.originalname.substring(0, file.originalname.lastIndexOf(".")) || file.originalname;
        identifier = baseName.trim();
      }

      let student = await User.findOne({
        $or: [{ email: identifier }, { rollNo: identifier }, { name: identifier }],
        role: ROLES.STUDENT,
        isDeleted: false,
      });

      if (!student) {
        const dummyEmail = `${identifier.replace(/\s+/g, "").toLowerCase()}_${Date.now()}@dummy.student.com`;
        student = await User.create({
          name: identifier,
          email: dummyEmail,
          rollNo: identifier,
          role: ROLES.STUDENT,
          password: "password123",
        });
      }

      let answerSheet = await AnswerSheet.findOne({
        student: student._id,
        exam: examId,
        isDeleted: false,
      });

      const normalizedFilePath = file.path ? file.path.replace(/\\/g, "/") : "";
      if (!answerSheet) {
        answerSheet = await AnswerSheet.create({
          student: student._id,
          subject: exam.subject,
          exam: examId,
          facultyId: userId,
          submissionType: "UPLOAD",
          uploadedFileName: file.originalname,
          uploadedFileUrl: normalizedFilePath, // Store normalized local uploaded path
          fileType: file.mimetype,
          fileSize: file.size,
          uploadStatus: "Uploaded",
          processingStatus: "uploaded",
          ocrStatus: "pending",
          segmentationStatus: "pending",
          isFinalSubmission: true,
          createdBy: userId,
          updatedBy: userId,
          studentIdentifier: identifier,
        });
      } else {
        answerSheet.uploadedFileName = file.originalname;
        answerSheet.uploadedFileUrl = normalizedFilePath;
        answerSheet.fileType = file.mimetype;
        answerSheet.fileSize = file.size;
        answerSheet.uploadStatus = "Uploaded";
        answerSheet.processingStatus = "uploaded";
        answerSheet.ocrStatus = "pending";
        answerSheet.segmentationStatus = "pending";
        answerSheet.studentIdentifier = identifier;
        answerSheet.updatedBy = userId;
        await answerSheet.save();
      }

      processAnswerSheetBackground(
        answerSheet._id,
        file.buffer ? file.buffer : fs.readFileSync(file.path),
        file.mimetype,
        file.originalname,
        examId,
        student._id,
        userId
      ).catch((err) =>
        logger.error(`Background OCR failed for sheet ${answerSheet._id}: ${err.message}`)
      );

      results.push({
        filename: file.originalname,
        answerSheetId: answerSheet._id,
        status: "processing",
      });
    } catch (error) {
      logger.error(`Failed to process upload for file ${file.originalname}: ${error.message}`);
      results.push({
        filename: file.originalname,
        error: error.message,
        status: "failed",
      });
    }
  }

  return results;
};

export const processAnswerSheetBackground = async (
  sheetId,
  fileBuffer,
  mimeType,
  originalName,
  examId,
  studentId,
  userId
) => {
  try {
    const answerSheet = await AnswerSheet.findById(sheetId);
    if (!answerSheet) return;

    answerSheet.processingStatus = "processing";
    answerSheet.ocrStatus = "processing";
    answerSheet.segmentationStatus = "processing";
    await answerSheet.save();

    const ocrBaseUrl = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8000";
    const uvicornUrl = `${ocrBaseUrl}/api/v1/student/answer-sheets`;
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append("file", blob, originalName);
    formData.append("exam_id", examId);
    formData.append("sheet_id", sheetId.toString());

    const response = await fetch(uvicornUrl, {
      method: "POST",
      headers: {
        "X-User-Id": studentId.toString(),
        "X-User-Role": "student",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Uvicorn returned status ${response.status}: ${errorText}`);
    }

    const ocrResult = await response.json();
    if (!ocrResult.success || !ocrResult.data) {
      throw new Error(ocrResult.message || "Failed to process in python service");
    }

    const initialSheet = ocrResult.data;
    const fastapiSheetId = initialSheet.id || sheetId.toString();

    // Poll Python FastAPI service until processing_status becomes COMPLETED or FAILED
    let processedSheet = null;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      try {
        const pollRes = await fetch(`${ocrBaseUrl}/api/v1/student/answer-sheets/${fastapiSheetId}`, {
          headers: {
            "X-User-Id": studentId.toString(),
            "X-User-Role": "student",
          },
        });

        if (pollRes.ok) {
          const pollJson = await pollRes.json();
          if (pollJson.success && pollJson.data) {
            const status = pollJson.data.processing_status;
            if (status === "COMPLETED" || status === "completed") {
              processedSheet = pollJson.data;
              break;
            } else if (status === "FAILED" || status === "failed") {
              throw new Error(pollJson.data.error_message || "Python service processing failed.");
            }
          }
        }
      } catch (pollErr) {
        logger.warn(`Poll attempt ${attempts} for ${fastapiSheetId} encountered error: ${pollErr.message}`);
      }
    }

    if (!processedSheet) {
      // Fallback: Check if initial response contained pages/answers directly
      if (initialSheet.pages && initialSheet.pages.length > 0) {
        processedSheet = initialSheet;
      } else {
        logger.warn(`FastAPI polling timed out for ${fastapiSheetId}, running direct file text extraction.`);
        const fallbackLines = await extractTextFromFile(answerSheet.uploadedFileUrl);
        const mappedDigital = (fallbackLines.answers && fallbackLines.answers.length > 0)
          ? fallbackLines.answers.map((a, idx) => ({
              question_number: String(a.question_number || a.normalized_question_number || idx + 1).replace(/^Q/i, ""),
              text: (a.answer_text || a.text || "").trim(),
              answer_text: (a.answer_text || a.text || "").trim(),
              confidence: a.confidence ?? 1.0,
              page_number: a.page_number || idx + 1
            }))
          : (fallbackLines.pages && fallbackLines.pages.length > 0)
          ? fallbackLines.pages.map((pText, idx) => ({
              question_number: String(idx + 1),
              text: pText.trim(),
              answer_text: pText.trim(),
              confidence: 1.0,
              page_number: idx + 1
            }))
          : [{
              question_number: "1",
              text: (fallbackLines || []).join("\n").trim(),
              answer_text: (fallbackLines || []).join("\n").trim(),
              confidence: 1.0,
              page_number: 1
            }];

        processedSheet = {
          pages: (fallbackLines.pages && fallbackLines.pages.length > 0)
            ? fallbackLines.pages.map((_, pIdx) => ({ page_number: pIdx + 1, original_file_reference: "source", processing_status: "PROCESSED" }))
            : [{ page_number: 1, original_file_reference: "source", processing_status: "PROCESSED" }],
          digital_answers: mappedDigital
        };
      }
    }

    const { pages, digital_answers } = processedSheet;

    const exam = await Exam.findById(examId);
    if (!exam) {
      throw new Error("Exam not found during processing map");
    }

    const answers = [];
    const rawTextParts = [];

    if (digital_answers && Array.isArray(digital_answers)) {
      for (let idx = 0; idx < digital_answers.length; idx++) {
        const ans = digital_answers[idx];
        const qNum = parseInt(String(ans.question_number || "").replace(/\D/g, ""), 10);
        let questionId = null;
        if (!isNaN(qNum) && qNum > 0 && exam.questions && qNum <= exam.questions.length) {
          questionId = exam.questions[qNum - 1]._id;
        } else if (exam.questions && exam.questions[idx]) {
          questionId = exam.questions[idx]._id;
        } else if (exam.questions && exam.questions[0]) {
          questionId = exam.questions[0]._id;
        } else {
          questionId = new mongoose.Types.ObjectId();
        }

        const recognizedText = ans.text ?? ans.answer_text ?? ans.recognizedText ?? "";

        answers.push({
          questionId,
          handwrittenData: ans.handwrittenData || "",
          recognizedText,
          hwrStatus: "Completed",
          submissionTime: new Date(),
        });

        if (recognizedText) {
          rawTextParts.push(`Q${String(ans.question_number || idx + 1).replace(/^Q/i, "")}: ${recognizedText}`);
        }
      }
    }

    const mappedPages = [];
    if (pages && Array.isArray(pages)) {
      for (const p of pages) {
        mappedPages.push({
          pageNumber: p.page_number,
          originalFileReference: p.original_file_reference,
          processedFileReference: p.processed_file_reference,
          width: p.width,
          height: p.height,
          processingStatus: p.processing_status,
        });

        if (rawTextParts.length === 0 && (p.extracted_text || p.extractedText)) {
          rawTextParts.push(p.extracted_text || p.extractedText);
        }
      }
    }

    answerSheet.answers = answers;
    answerSheet.pages = mappedPages;
    answerSheet.extractedText = rawTextParts.join("\n\n");
    answerSheet.processingStatus = "completed";
    answerSheet.ocrStatus = "completed";
    answerSheet.segmentationStatus = "completed";
    answerSheet.uploadStatus = "HWR Processing";
    answerSheet.submissionStatus = "Pending AI Evaluation";
    answerSheet.errorMessage = undefined;
    answerSheet.updatedBy = userId;

    await answerSheet.save();
    logger.info(`Background OCR completed successfully for AnswerSheet ${sheetId}`);

    // Queue AI evaluation pipeline for the recognized answers
    evaluationPipelineService.queueEvaluation(sheetId, userId || studentId).catch((evalErr) => {
      logger.error(`Automatic AI evaluation queueing failed for sheet ${sheetId}: ${evalErr.message}`);
    });
  } catch (error) {
    logger.error(`Background OCR pipeline failed for AnswerSheet ${sheetId}: ${error.message}`);
    try {
      await AnswerSheet.findByIdAndUpdate(sheetId, {
        processingStatus: "failed",
        ocrStatus: "failed",
        segmentationStatus: "failed",
        uploadStatus: "Failed",
        errorMessage: error.message,
      });
    } catch (dbErr) {
      logger.error(`Failed to save error status for AnswerSheet ${sheetId}: ${dbErr.message}`);
    }
  }
};

export const startExam = async (examId, userId) => {
  // Validate student exists
  const student = await User.findOne({ _id: userId, isDeleted: false, role: ROLES.STUDENT });
  if (!student) {
    throw new ApiError(
      STATUS_CODES.NOT_FOUND,
      "Student reference not found, is inactive, or role is invalid"
    );
  }

  // Validate exam exists
  const exam = await Exam.findOne({ _id: examId, isDeleted: false });
  if (!exam) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam reference not found or is inactive");
  }

  // Verify exam is published
  if (!exam.isPublished) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, "Exam is not published yet");
  }

  // Verify exam timing (if startTime/endTime are defined)
  const now = new Date();
  if (exam.startTime && now < exam.startTime) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Exam has not started yet");
  }
  if (exam.endTime && now > exam.endTime && !exam.allowLateSubmission) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Exam submission time has expired");
  }

  // Check if an AnswerSheet for this student and exam already exists
  let answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  });

  if (answerSheet) {
    // If it exists but is already submitted/completed/evaluated/published, student cannot restart/resume/edit
    if (
      ["Submitted", "Pending AI Evaluation", "Faculty Review", "Published", "Completed"].includes(
        answerSheet.submissionStatus
      )
    ) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, "Exam has already been submitted");
    }

    // Student resumes existing session
    answerSheet.submissionStatus = "Started";
    await answerSheet.save();
    logger.info(`Student ${userId} resumed exam ${examId}`);
    return answerSheet;
  }

  // Create empty answers array based on the exam questions
  const answers = exam.questions.map((q) => ({
    questionId: q._id,
    handwrittenData: "",
    recognizedText: "",
    hwrStatus: "Pending",
    submissionTime: new Date(),
  }));

  answerSheet = await AnswerSheet.create({
    student: userId,
    subject: exam.subject,
    exam: examId,
    facultyId: exam.createdBy,
    submissionStatus: "Started",
    answers,
    totalQuestions: exam.questions.length,
    createdBy: userId,
    updatedBy: userId,
  });

  // Deduplicate in case of parallel creation race
  const allDrafts = await AnswerSheet.find({
    student: userId,
    exam: examId,
    submissionStatus: { $in: ["Started", "Draft", "Auto Saving", "Pending"] },
    isDeleted: false,
  }).sort("createdAt");

  if (allDrafts.length > 1) {
    const [primary, ...duplicates] = allDrafts;
    await AnswerSheet.updateMany(
      { _id: { $in: duplicates.map((d) => d._id) } },
      { $set: { isDeleted: true } }
    );
    answerSheet = primary;
  }

  // Track event audit log
  logger.info(`Student ${userId} started exam ${examId}`);

  // Create notification for student
  await Notification.create({
    user: userId,
    title: "Exam Started",
    message: `You have successfully started the exam "${exam.title}". All the best!`,
    type: "Exam Started",
    createdBy: userId,
    updatedBy: userId,
  });

  return answerSheet;
};

export const autoSaveAnswer = async (examId, answerData, userId) => {
  const answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  });

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Exam session not found");
  }

  if (
    ["Submitted", "Pending AI Evaluation", "Faculty Review", "Published", "Completed"].includes(
      answerSheet.submissionStatus
    )
  ) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Cannot modify answers after final submission");
  }

  const { questionId, handwrittenData, recognizedText, deviceInfo } = answerData;

  const answerIndex = answerSheet.answers.findIndex(
    (ans) => ans.questionId.toString() === questionId
  );

  if (answerIndex > -1) {
    if (handwrittenData !== undefined) {
      answerSheet.answers[answerIndex].handwrittenData = handwrittenData;
    }
    if (recognizedText !== undefined) {
      answerSheet.answers[answerIndex].recognizedText = recognizedText;
    }
    answerSheet.answers[answerIndex].submissionTime = new Date();
    answerSheet.answers[answerIndex].hwrStatus = "Pending";
  } else {
    answerSheet.answers.push({
      questionId,
      handwrittenData: handwrittenData || "",
      recognizedText: recognizedText || "",
      hwrStatus: "Pending",
      submissionTime: new Date(),
    });
  }

  answerSheet.submissionStatus = "Auto Saving";
  answerSheet.lastSavedAt = new Date();
  if (deviceInfo) {
    answerSheet.deviceInfo = deviceInfo;
  }
  answerSheet.updatedBy = userId;

  await answerSheet.save();
  return answerSheet;
};

export const submitExam = async (examId, userId) => {
  const answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  }).populate("exam", "title createdBy");

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer session not found");
  }

  if (
    ["Submitted", "Pending AI Evaluation", "Faculty Review", "Published", "Completed"].includes(
      answerSheet.submissionStatus
    )
  ) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, "Exam has already been submitted");
  }

  answerSheet.submissionStatus = "Submitted";
  answerSheet.submittedAt = new Date();
  if (!answerSheet.facultyId && answerSheet.exam && answerSheet.exam.createdBy) {
    answerSheet.facultyId = answerSheet.exam.createdBy;
  }
  answerSheet.updatedBy = userId;

  await answerSheet.save();

  logger.info(`Student ${userId} submitted exam ${examId}`);

  // Create notifications
  // 1. Notify Student
  await Notification.create({
    user: userId,
    title: "Exam Submitted",
    message: `Your exam "${answerSheet.exam.title}" was submitted successfully.`,
    type: "Exam Submitted",
    createdBy: userId,
    updatedBy: userId,
  });

  // 2. Notify Faculty Creator
  if (answerSheet.exam.createdBy) {
    await Notification.create({
      user: answerSheet.exam.createdBy,
      title: "New Exam Submission",
      message: `A student has submitted answers for "${answerSheet.exam.title}". Review is pending.`,
      type: "Faculty Review Pending",
      createdBy: userId,
      updatedBy: userId,
    });
  }

  return answerSheet;
};

export const getSubmissionStatus = async (examId, userId) => {
  const answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  })
    .populate("student", "name email rollNo department semester")
    .populate("subject", "name code semester")
    .populate("exam", "title examType totalMarks duration startTime endTime isPublished");

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "Answer sheet not found for this student and exam");
  }

  return {
    submissionStatus: answerSheet.submissionStatus,
    submittedAt: answerSheet.submittedAt,
    totalQuestions: answerSheet.totalQuestions,
    answersCount: answerSheet.answers.length,
  };
};

export const getReviewStatus = async (examId, userId) => {
  const answerSheet = await AnswerSheet.findOne({
    student: userId,
    exam: examId,
    isDeleted: false,
  });

  if (!answerSheet) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, "No exam session found");
  }

  const reviewQuestions = answerSheet.answers.map((ans) => {
    const hasData = !!(ans.handwrittenData || ans.recognizedText);
    return {
      questionId: ans.questionId,
      status: hasData ? "Answered" : "Not Answered",
      lastSavedAt: ans.submissionTime,
    };
  });

  return {
    submissionStatus: answerSheet.submissionStatus,
    lastSavedAt: answerSheet.lastSavedAt,
    reviewQuestions,
  };
};

export default {
  createAnswerSheet,
  getAnswerSheetById,
  getDigitalAnswers,
  getAllAnswerSheets,
  updateAnswerSheet,
  deleteAnswerSheet,
  startExam,
  autoSaveAnswer,
  submitExam,
  getSubmissionStatus,
  getReviewStatus,
  getExamAnswerSheets,
  uploadAnswerSheets,
  retryAnswerSheet,
};
