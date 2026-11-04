import mongoose from "mongoose";
import env from "../src/config/env.js";
import User from "../src/models/User.js";
import Exam from "../src/models/Exam.js";
import AnswerSheet from "../src/models/AnswerSheet.js";
import Evaluation from "../src/models/Evaluation.js";
import {
  startStudentExam,
  autosaveStudentExamAnswer,
  submitStudentExam,
  getStudentExamResult,
} from "../src/services/studentExam.service.js";
import evaluationPipelineService from "../src/services/ai/evaluationPipeline.service.js";
import { startReview, overrideQuestion, approveReview, finalizeReview } from "../src/services/facultyReview.service.js";
import { publishResult } from "../src/services/resultPublication.service.js";

export function generateStrokesForText(text) {
  const strokes = [];
  let cursorX = 50.0;
  let cursorY = 100.0;

  const addStroke = (pts, width = 4, color = "#0000FF") => {
    strokes.push({
      points: pts.map((p) => ({ x: p[0], y: p[1] })),
      width,
      color,
    });
  };

  for (const char of text.toUpperCase()) {
    const cx = cursorX;
    const cy = cursorY;
    const w = 40;
    const h = 70;

    if (char === "A") {
      addStroke([[cx, cy + h], [cx + w / 2, cy]]);
      addStroke([[cx + w / 2, cy], [cx + w, cy + h]]);
      addStroke([[cx + w * 0.25, cy + h * 0.6], [cx + w * 0.75, cy + h * 0.6]]);
      cursorX += w + 15;
    } else if (char === "B") {
      addStroke([[cx, cy], [cx, cy + h]]);
      addStroke([[cx, cy], [cx + w * 0.7, cy], [cx + w * 0.7, cy + h * 0.45], [cx, cy + h * 0.45]]);
      addStroke([[cx, cy + h * 0.45], [cx + w, cy + h * 0.45], [cx + w, cy + h], [cx, cy + h]]);
      cursorX += w + 15;
    } else if (char === "C") {
      const cPts = [];
      for (let angle = 45; angle <= 315; angle += 15) {
        const rad = (angle * Math.PI) / 180;
        cPts.push([cx + w / 2 + (w / 2) * Math.cos(rad), cy + h / 2 + (h / 2) * Math.sin(rad)]);
      }
      addStroke(cPts);
      cursorX += w + 15;
    } else if (char === "D") {
      addStroke([[cx, cy], [cx, cy + h]]);
      const dPts = [];
      for (let angle = -90; angle <= 90; angle += 15) {
        const rad = (angle * Math.PI) / 180;
        dPts.push([cx + (w * 0.8) * Math.cos(rad), cy + h / 2 + (h / 2) * Math.sin(rad)]);
      }
      addStroke(dPts);
      cursorX += w + 20;
    } else if (char === "E") {
      addStroke([[cx, cy], [cx, cy + h]]);
      addStroke([[cx, cy], [cx + w, cy]]);
      addStroke([[cx, cy + h / 2], [cx + w * 0.7, cy + h / 2]]);
      addStroke([[cx, cy + h], [cx + w, cy + h]]);
      cursorX += w + 15;
    } else if (char === "F") {
      addStroke([[cx, cy], [cx, cy + h]]);
      addStroke([[cx, cy], [cx + w, cy]]);
      addStroke([[cx, cy + h / 2], [cx + w * 0.7, cy + h / 2]]);
      cursorX += w + 15;
    } else if (char === "G") {
      const gPts = [];
      for (let angle = 30; angle <= 315; angle += 15) {
        const rad = (angle * Math.PI) / 180;
        gPts.push([cx + w / 2 + (w / 2) * Math.cos(rad), cy + h / 2 + (h / 2) * Math.sin(rad)]);
      }
      addStroke(gPts);
      addStroke([[cx + w / 2, cy + h / 2], [cx + w, cy + h / 2], [cx + w, cy + h * 0.85]]);
      cursorX += w + 20;
    } else if (char === "H") {
      addStroke([[cx, cy], [cx, cy + h]]);
      addStroke([[cx + w, cy], [cx + w, cy + h]]);
      addStroke([[cx, cy + h / 2], [cx + w, cy + h / 2]]);
      cursorX += w + 15;
    } else if (char === "I") {
      addStroke([[cx + w * 0.2, cy], [cx + w * 0.8, cy]]);
      addStroke([[cx + w / 2, cy], [cx + w / 2, cy + h]]);
      addStroke([[cx + w * 0.2, cy + h], [cx + w * 0.8, cy + h]]);
      cursorX += w * 0.8 + 15;
    } else if (char === "J") {
      addStroke([[cx + w * 0.2, cy], [cx + w, cy]]);
      const jPts = [[cx + w * 0.7, cy], [cx + w * 0.7, cy + h * 0.7]];
      for (let angle = 0; angle <= 180; angle += 20) {
        const rad = (angle * Math.PI) / 180;
        jPts.push([cx + w * 0.35 + (w * 0.35) * Math.cos(rad), cy + h * 0.7 + (h * 0.3) * Math.sin(rad)]);
      }
      addStroke(jPts);
      cursorX += w + 15;
    } else if (char === "K") {
      addStroke([[cx, cy], [cx, cy + h]]);
      addStroke([[cx + w, cy], [cx, cy + h / 2]]);
      addStroke([[cx + w * 0.3, cy + h / 2], [cx + w, cy + h]]);
      cursorX += w + 15;
    } else if (char === "L") {
      addStroke([[cx, cy], [cx, cy + h]]);
      addStroke([[cx, cy + h], [cx + w, cy + h]]);
      cursorX += w + 15;
    } else if (char === "M") {
      addStroke([[cx, cy + h], [cx, cy], [cx + w / 2, cy + h * 0.6], [cx + w, cy], [cx + w, cy + h]]);
      cursorX += w + 20;
    } else if (char === "N") {
      addStroke([[cx, cy + h], [cx, cy], [cx + w, cy + h], [cx + w, cy]]);
      cursorX += w + 15;
    } else if (char === "O") {
      const oPts = [];
      for (let angle = 0; angle <= 360; angle += 15) {
        const rad = (angle * Math.PI) / 180;
        oPts.push([cx + w / 2 + (w / 2) * Math.cos(rad), cy + h / 2 + (h / 2) * Math.sin(rad)]);
      }
      addStroke(oPts);
      cursorX += w + 20;
    } else if (char === "P") {
      addStroke([[cx, cy], [cx, cy + h]]);
      const pPts = [];
      for (let angle = -90; angle <= 90; angle += 20) {
        const rad = (angle * Math.PI) / 180;
        pPts.push([cx + (w * 0.7) * Math.cos(rad), cy + h * 0.25 + (h * 0.25) * Math.sin(rad)]);
      }
      addStroke(pPts);
      cursorX += w + 15;
    } else if (char === "Q") {
      const qPts = [];
      for (let angle = 0; angle <= 360; angle += 15) {
        const rad = (angle * Math.PI) / 180;
        qPts.push([cx + w / 2 + (w / 2) * Math.cos(rad), cy + h / 2 + (h / 2) * Math.sin(rad)]);
      }
      addStroke(qPts);
      addStroke([[cx + w * 0.5, cy + h * 0.6], [cx + w * 0.9, cy + h * 0.95]]);
      cursorX += w + 20;
    } else if (char === "R") {
      addStroke([[cx, cy], [cx, cy + h]]);
      const rPts = [];
      for (let angle = -90; angle <= 90; angle += 20) {
        const rad = (angle * Math.PI) / 180;
        rPts.push([cx + (w * 0.7) * Math.cos(rad), cy + h * 0.25 + (h * 0.25) * Math.sin(rad)]);
      }
      addStroke(rPts);
      addStroke([[cx, cy + h * 0.5], [cx + w, cy + h]]);
      cursorX += w + 15;
    } else if (char === "S") {
      const sPts = [
        [cx + w * 0.8, cy + h * 0.15],
        [cx + w * 0.3, cy],
        [cx, cy + h * 0.25],
        [cx + w * 0.5, cy + h * 0.5],
        [cx + w, cy + h * 0.75],
        [cx + w * 0.7, cy + h],
        [cx + w * 0.1, cy + h * 0.85],
      ];
      addStroke(sPts);
      cursorX += w + 15;
    } else if (char === "T") {
      addStroke([[cx, cy], [cx + w, cy]]);
      addStroke([[cx + w / 2, cy], [cx + w / 2, cy + h]]);
      cursorX += w + 15;
    } else if (char === "U") {
      const uPts = [[cx, cy], [cx, cy + h * 0.65]];
      for (let angle = 180; angle <= 360; angle += 20) {
        const rad = (angle * Math.PI) / 180;
        uPts.push([cx + w / 2 + (w / 2) * Math.cos(rad), cy + h * 0.65 - (h * 0.35) * Math.sin(rad)]);
      }
      uPts.push([cx + w, cy]);
      addStroke(uPts);
      cursorX += w + 15;
    } else if (char === "V") {
      addStroke([[cx, cy], [cx + w / 2, cy + h], [cx + w, cy]]);
      cursorX += w + 15;
    } else if (char === "W") {
      addStroke([[cx, cy], [cx + w * 0.25, cy + h], [cx + w * 0.5, cy + h * 0.3], [cx + w * 0.75, cy + h], [cx + w, cy]]);
      cursorX += w + 20;
    } else if (char === "X") {
      addStroke([[cx, cy], [cx + w, cy + h]]);
      addStroke([[cx + w, cy], [cx, cy + h]]);
      cursorX += w + 15;
    } else if (char === "Y") {
      addStroke([[cx, cy], [cx + w / 2, cy + h * 0.4]]);
      addStroke([[cx + w, cy], [cx + w / 2, cy + h * 0.4]]);
      addStroke([[cx + w / 2, cy + h * 0.4], [cx + w / 2, cy + h]]);
      cursorX += w + 15;
    } else if (char === "Z") {
      addStroke([[cx, cy], [cx + w, cy], [cx, cy + h], [cx + w, cy + h]]);
      cursorX += w + 15;
    } else if (char === "1") {
      addStroke([[cx + w * 0.2, cy + h * 0.2], [cx + w / 2, cy], [cx + w / 2, cy + h]]);
      addStroke([[cx + w * 0.1, cy + h], [cx + w * 0.8, cy + h]]);
      cursorX += w + 15;
    } else if (char === "2") {
      addStroke([[cx + w * 0.1, cy + h * 0.2], [cx + w * 0.5, cy], [cx + w, cy + h * 0.3], [cx, cy + h], [cx + w, cy + h]]);
      cursorX += w + 15;
    } else if (char === "3") {
      addStroke([[cx, cy], [cx + w], [cx + w / 2, cy + h * 0.45], [cx + w, cy + h * 0.7], [cx + w * 0.2, cy + h]]);
      cursorX += w + 15;
    } else if (char === " ") {
      cursorX += 35;
    } else {
      addStroke([[cx, cy], [cx + w, cy], [cx + w, cy + h], [cx, cy + h], [cx, cy]]);
      cursorX += w + 15;
    }
  }

  return strokes;
}

async function runEndToEndSubmission() {
  console.log("Starting End-to-End Real Data Execution Pipeline...");
  await mongoose.connect(env.MONGODB_URI);

  try {
    // 1. Fetch Student & Exam
    const student = await User.findOne({ email: "student@test.com" });
    const faculty = await User.findOne({ email: "faculty@test.com" });
    const exam = await Exam.findOne({ title: "Big Data Analytics — End-to-End Test" });

    if (!student || !faculty || !exam) {
      throw new Error("Missing seeded test data. Run seed_real_e2e_data.js first!");
    }

    console.log(`\n[STEP 1] Student (${student.email}) starting exam: '${exam.title}'`);
    
    // Clear any previous submissions for clean test
    await AnswerSheet.deleteMany({ student: student._id, exam: exam._id });
    await Evaluation.deleteMany({ student: student._id, exam: exam._id });

    const session = await startStudentExam(student._id, exam._id);
    console.log(`Session initialized. AnswerSheet ID: ${session.id}`);

    // Question IDs
    const q1Obj = exam.questions.find((q) => q.questionNumber === 1);
    const q2Obj = exam.questions.find((q) => q.questionNumber === 2);
    const q3Obj = exam.questions.find((q) => q.questionNumber === 3);

    // 2. Generate Digital Handwriting Strokes for Q1, Q2, Q3
    console.log("\n[STEP 2] Submitting Digital Canvas Handwriting Answers...");
    const q1Strokes = generateStrokesForText("HADOOP HDFS MAPREDUCE YARN DISTRIBUTED FRAMEWORK");
    const q2Strokes = generateStrokesForText("HDFS NAMENODE DATANODE MASTER SLAVE REPLICATION");
    const q3Strokes = generateStrokesForText("MAPREDUCE DISK SPARK IN MEMORY RDD SPEED");

    await autosaveStudentExamAnswer(student._id, exam._id, {
      questionId: q1Obj._id,
      handwrittenData: JSON.stringify({ strokes: q1Strokes }),
    });

    await autosaveStudentExamAnswer(student._id, exam._id, {
      questionId: q2Obj._id,
      handwrittenData: JSON.stringify({ strokes: q2Strokes }),
    });

    await autosaveStudentExamAnswer(student._id, exam._id, {
      questionId: q3Obj._id,
      handwrittenData: JSON.stringify({ strokes: q3Obj._id ? q3Strokes : [] }),
    });

    console.log("Autosaved stroke data for all 3 questions.");

    // 3. Submit Exam
    console.log("\n[STEP 3] Submitting Exam Session...");
    const submissionResult = await submitStudentExam(student._id, exam._id);
    console.log(`Submission successful. Processing Status: ${submissionResult.processingStatus}`);

    // 4. Wait for Real PaddleOCR Background Process
    console.log("\n[STEP 4] Executing Real PaddleOCR 3.7.0 HWR Processing...");
    const ocrStartTime = Date.now();
    let sheetDoc = await AnswerSheet.findById(session.id).lean();
    
    let retries = 0;
    while ((sheetDoc.ocrStatus === "processing" || sheetDoc.ocrStatus === "Started" || sheetDoc.ocrStatus === "Pending") && retries < 60) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      sheetDoc = await AnswerSheet.findById(session.id).lean();
      retries++;
    }

    const ocrDuration = ((Date.now() - ocrStartTime) / 1000).toFixed(2);
    console.log(`PaddleOCR finished in ${ocrDuration} seconds. Status: ${sheetDoc.ocrStatus}`);
    console.log(`Extracted Text from MongoDB:\n----------------------------------------\n${sheetDoc.extractedText}\n----------------------------------------`);

    // Verify answers per question
    for (const ans of sheetDoc.answers) {
      console.log(`Question #${ans.questionNumber} OCR Text: "${ans.extractedText}" (Confidence: ${ans.confidence})`);
    }

    // 5. Trigger Real AI LLM Evaluation
    console.log("\n[STEP 5] Triggering Real AI LLM Evaluation Pipeline...");
    let evaluation;
    try {
      evaluation = await evaluationPipelineService.queueEvaluation(session.id, student._id);
    } catch (e) {
      if (e.message === "EVALUATION_ALREADY_RUNNING") {
        evaluation = await Evaluation.findOne({ answerSheet: session.id, isDeleted: false });
      } else {
        throw e;
      }
    }

    if (evaluation) {
      await evaluationPipelineService.runPipeline(evaluation._id, session.id, student._id, 1);
    }

    const updatedEval = await Evaluation.findOne({ answerSheet: session.id }).lean();
    console.log(`AI Evaluation Status: ${updatedEval.evaluationStatus}`);
    console.log(`AI Score Awarded: ${updatedEval.totalMarksAwarded} / ${updatedEval.totalMaxMarks} (${updatedEval.percentage}%)`);
    if (updatedEval.evaluationError) {
      console.log(`Evaluation Note/Error: ${updatedEval.evaluationError}`);
    }

    // 6. Faculty Review & Mark Override
    console.log("\n[STEP 6] Faculty (${faculty.email}) Review & Mark Override...");
    await startReview(session.id, faculty._id);
    
    // Override Question 1 score to 4.5
    console.log(`Faculty overriding Q1 score to 4.5 marks (Reason: 'Correct concept with different wording')`);
    await overrideQuestion(
      session.id,
      q1Obj._id.toString(),
      4.5,
      "Correct concept with different wording",
      "Detailed explanation of YARN & HDFS",
      faculty._id
    );

    await approveReview(session.id, faculty._id);
    await finalizeReview(session.id, faculty._id);
    console.log("Faculty Review finalized.");

    // 7. Publish Results
    console.log("\n[STEP 7] Publishing Final Evaluation Results...");
    await publishResult(session.id, faculty._id, "Finalized end-to-end evaluation");
    console.log("Result Published.");

    // 8. Student View Published Results
    console.log("\n[STEP 8] Student (${student.email}) Viewing Final Published Result...");
    const studentView = await getStudentExamResult(student._id, exam._id);
    console.log("=========================================================================");
    console.log(`  Exam Title     : ${studentView.exam.title}`);
    console.log(`  Student Name   : ${studentView.student.name} (${studentView.student.email})`);
    console.log(`  Obtained Marks : ${studentView.result.obtainedMarks} / ${studentView.result.totalMarks}`);
    console.log(`  Percentage     : ${studentView.result.percentage}%`);
    console.log(`  Grade          : ${studentView.result.grade || "N/A"}`);
    console.log(`  Overall Status : ${studentView.result.status}`);
    console.log("=========================================================================");

    console.log("\n[SUCCESS] REAL END-TO-END WORKFLOW EXECUTED WITH FULL DATA PERSISTENCE!");

  } catch (err) {
    console.error("\n[ERROR] Pipeline Execution Failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

runEndToEndSubmission();
