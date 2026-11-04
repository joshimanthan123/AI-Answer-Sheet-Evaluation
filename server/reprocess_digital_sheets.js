import mongoose from 'mongoose';
import env from './src/config/env.js';
import AnswerSheet from './src/models/AnswerSheet.js';
import Exam from './src/models/Exam.js';

async function reprocess() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(env.MONGODB_URI);
  
  const sheets = await AnswerSheet.find({});
  console.log(`Found ${sheets.length} total answer sheets in database.`);
  
  const uvicornUrl = env.PYTHON_OCR_SERVICE_URL || "http://127.0.0.1:8000/api/v1/ocr/recognize-strokes";

  for (const sheet of sheets) {
    if (!sheet.answers || sheet.answers.length === 0) continue;
    
    let needsUpdate = false;
    const exam = sheet.exam ? await Exam.findById(sheet.exam) : null;
    const examQuestions = exam?.questions || [];
    
    const updatedAnswers = [];
    const rawTextParts = [];

    for (let idx = 0; idx < sheet.answers.length; idx++) {
      const ansItem = sheet.answers[idx];
      const matchedQ = examQuestions.find(q => q._id && ansItem.questionId && q._id.toString() === ansItem.questionId.toString());
      const qNum = ansItem.question_number || (matchedQ ? matchedQ.questionNumber : idx + 1);
      const qText = ansItem.question_text || (matchedQ ? matchedQ.questionText : "");
      const maxMarks = ansItem.max_marks || (matchedQ ? (matchedQ.maximumMarks || matchedQ.marks || 10) : 10);

      let parsedHandwritten = null;
      if (ansItem.handwrittenData) {
        try {
          parsedHandwritten = typeof ansItem.handwrittenData === "string" ? JSON.parse(ansItem.handwrittenData) : ansItem.handwrittenData;
        } catch (e) {}
      }

      let recText = ansItem.recognizedText || ansItem.text || ansItem.answer_text || "";
      if (recText.startsWith("Transcribed canvas response") || recText.startsWith("Digitized canvas answer")) {
        recText = "";
      }

      // If recognized text is empty but handwritten strokes exist, attempt OCR transcription
      if ((!recText || recText.trim().length === 0) && parsedHandwritten && Array.isArray(parsedHandwritten.strokes) && parsedHandwritten.strokes.length > 0) {
        needsUpdate = true;
        console.log(`Sheet ${sheet._id}: Question Q${qNum} has ${parsedHandwritten.strokes.length} strokes but empty recognizedText. Transcribing via PaddleOCR...`);
        
        try {
          const payload = {
            strokes: parsedHandwritten.strokes.map(st => ({
              points: (st.points || []).map(p => ({ x: p.x, y: p.y })),
              color: st.color || "#0000FF",
              width: st.width || 3
            })),
            width: 800,
            height: 600,
            page_num: qNum
          };

          const res = await fetch(uvicornUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            const data = await res.json();
            console.log(`FastAPI OCR response for Q${qNum}:`, data);
            if (data.success && data.data && data.data.text) {
              recText = data.data.text.trim();
              console.log(`✓ Real PaddleOCR recognized text for Q${qNum}: "${recText}"`);
            }
          }
        } catch (ocrErr) {
          console.warn(`FastAPI OCR offline or failed for Q${qNum}: ${ocrErr.message}`);
        }

        if (!recText) {
          recText = "";
          console.log(`-> Empty OCR text set for Q${qNum}`);
        }
      }

      const updatedAnsItem = {
        questionId: ansItem.questionId,
        handwrittenData: ansItem.handwrittenData,
        recognizedText: recText,
        hwrStatus: "Completed",
        confidence: ansItem.confidence !== undefined ? ansItem.confidence : 1.0,
        submissionTime: ansItem.submissionTime || new Date()
      };
      updatedAnswers.push(updatedAnsItem);
      if (recText) rawTextParts.push(`Q${qNum}: ${recText}`);
    }

    if (needsUpdate || !sheet.digital_answers || sheet.digital_answers.length === 0) {
      const digitalAnswers = updatedAnswers.map((ans, idx) => {
        const matchedQ = examQuestions.find(q => q._id && ans.questionId && q._id.toString() === ans.questionId.toString());
        const qNum = ans.question_number || (matchedQ ? matchedQ.questionNumber : idx + 1);
        const qText = ans.question_text || (matchedQ ? matchedQ.questionText : "");
        const maxMarks = ans.max_marks || (matchedQ ? (matchedQ.maximumMarks || matchedQ.marks || 10) : 10);
        let strokes = [];
        if (ans.handwrittenData) {
          try {
            const parsed = typeof ans.handwrittenData === "string" ? JSON.parse(ans.handwrittenData) : ans.handwrittenData;
            if (parsed && Array.isArray(parsed.strokes)) strokes = parsed.strokes;
          } catch (e) {}
        }
        return {
          question_id: ans.questionId,
          question_number: String(qNum),
          question_text: qText,
          max_marks: maxMarks,
          text: ans.recognizedText || "",
          answer_text: ans.recognizedText || "",
          recognizedText: ans.recognizedText || "",
          handwrittenData: ans.handwrittenData || "",
          strokes,
          page_number: 1,
          confidence: ans.confidence !== undefined ? ans.confidence : 1.0
        };
      });

      try {
        sheet.answers = updatedAnswers;
        sheet.digital_answers = digitalAnswers;
        if (rawTextParts.length > 0) sheet.extractedText = rawTextParts.join("\n\n");
        sheet.processingStatus = "completed";
        sheet.ocrStatus = "completed";
        await sheet.save();
        console.log(`✓ Updated AnswerSheet ${sheet._id} with ${digitalAnswers.length} digital answers.`);
      } catch (saveErr) {
        console.error(`❌ Save failed for sheet ${sheet._id}:`, saveErr.message);
      }
    }
  }

  console.log("Reprocessing complete!");
  await mongoose.connection.close();
}

reprocess().catch(console.error);
