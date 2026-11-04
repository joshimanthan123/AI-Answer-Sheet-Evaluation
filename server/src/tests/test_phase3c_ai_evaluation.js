import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import examService from "../services/exam.service.js";
import evaluationPipelineService from "../services/ai/evaluationPipeline.service.js";
import { validateAiEvaluationResponse } from "../utils/evaluationValidator.js";

async function runPhase3CTests() {
  console.log("=================================================");
  console.log("  RUNNING PHASE 3C REAL AI EVALUATION TEST SUITE ");
  console.log("=================================================");
  console.log("Connecting database:", env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let testUser = null;
  let testDept = null;
  let testCourse = null;
  let testSubject = null;
  let testExam = null;
  let testAnswerSheet = null;

  try {
    // SETUP DB DOCUMENTS
    testUser = await User.create({
      name: "Phase 3C Evaluator Tester",
      email: `p3c.tester.${Date.now()}@example.com`,
      password: "password123",
      role: "faculty",
      lecturerId: "LEC3C" + Date.now(),
      status: "online",
    });

    const ts = Date.now();
    testDept = await Department.create({
      name: "CS Dept " + ts,
      code: "CSD" + ts + Math.floor(Math.random() * 100),
      createdBy: testUser._id,
    });

    testCourse = await Course.create({
      name: "B.Tech CS " + ts,
      code: "BTC" + ts + Math.floor(Math.random() * 100),
      durationYears: 4,
      totalSemesters: 8,
      department: testDept._id,
      createdBy: testUser._id,
    });

    testSubject = await Subject.create({
      name: "Distributed Systems " + ts,
      code: "DS" + ts + Math.floor(Math.random() * 100),
      credits: 4,
      semester: 5,
      isActive: true,
      course: testCourse._id,
      faculty: testUser._id,
      createdBy: testUser._id,
    });


    testExam = await examService.createExam(
      {
        title: "Distributed Systems Final Exam",
        examCode: "EX3C" + Math.floor(Math.random() * 1000),
        subject: testSubject._id,
        examType: "Final",
        examDate: new Date(),
        duration: 120,
        totalMarks: 10,
        passingMarks: 4,
        questions: [
          {
            questionNumber: 1,
            questionText: "Explain the CAP theorem in distributed systems, detailing Consistency, Availability, and Partition Tolerance.",
            maximumMarks: 10,
            questionType: "descriptive",
            modelAnswer: "The CAP theorem states that a distributed data store can simultaneously provide at most two out of three guarantees: Consistency (all nodes see the same data at the same time), Availability (every request receives a response), and Partition Tolerance (system continues despite network partitions).",
          },
        ],
      },
      testUser._id
    );

    const question1 = testExam.questions[0];

    const configData = {
      questionText: question1.questionText,
      maximumMarks: 10,
      questionType: "descriptive",
      modelAnswer: question1.modelAnswer,
      rubric: [
        { criterion: "Consistency Definition", description: "Defines all nodes seeing same data", maxMarks: 3.5 },
        { criterion: "Availability Definition", description: "Defines every request receiving a response", maxMarks: 3.5 },
        { criterion: "Partition Tolerance & Tradeoff", description: "Defines network partition handling and 2-of-3 tradeoff", maxMarks: 3 },
      ],
    };

    const configRes = await examService.saveEvaluationConfig(testExam._id, question1._id, configData, testUser._id);
    console.log("✓ Evaluation Configuration saved with version:", configRes.evaluationConfig.version);

    testAnswerSheet = await AnswerSheet.create({
      exam: testExam._id,
      subject: testSubject._id,
      student: testUser._id,
      submissionStatus: "Submitted",
      ocrStatus: "completed",
      answers: [
        {
          questionId: question1._id,
          questionNumber: 1,
          recognizedText: "Initial dummy text",
          handwrittenData: "<svg><path d='M10 10'/></svg>",
        },
      ],
    });

    const runTestEvaluation = async (answerSheetId, qNum = 1) => {
      await AnswerSheet.updateOne(
        { _id: answerSheetId },
        { $set: { evaluationStatus: "pending" } }
      );

      let evalDoc = await Evaluation.findOne({ answerSheet: answerSheetId });
      if (!evalDoc) {
        evalDoc = await Evaluation.create({
          answerSheet: answerSheetId,
          evaluationType: "AI",
          obtainedMarks: 0,
          totalMarks: 10,
          percentage: 0,
          evaluationStatus: "QUEUED_FOR_EVALUATION",
          createdBy: testUser._id,
          updatedBy: testUser._id,
        });
      }

      await evaluationPipelineService.runPipeline(evalDoc._id, answerSheetId, testUser._id, 1, {
        scope: "QUESTION",
        questionNumber: qNum,
        reEvaluate: true,
      });

      return await Evaluation.findById(evalDoc._id);
    };


    // -------------------------------------------------------------
    // TEST 1: Exact Correct Answer Evaluation
    // -------------------------------------------------------------
    console.log("\n[TEST 1] Scenario 1: Exact Correct Answer Evaluation...");
    await AnswerSheet.updateOne(
      { _id: testAnswerSheet._id, "answers.questionId": question1._id },

      { $set: { "answers.$.recognizedText": "The CAP theorem states that a distributed data store can simultaneously provide at most two out of three guarantees: Consistency, Availability, and Partition Tolerance. Consistency means all nodes see the same data at the same time. Availability means every request receives a response. Partition tolerance means the system operates despite network failures." } }
    );

    const evalResult1 = await runTestEvaluation(testAnswerSheet._id, 1);
    console.log("✓ Test 1 complete. Status:", evalResult1.evaluationStatus, "| Obtained Marks:", evalResult1.obtainedMarks);
    const qRes1 = evalResult1.questions[0];
    if (qRes1.aiMarks < 8) {
      throw new Error(`FAIL Test 1: Expected high marks for exact answer, got ${qRes1.aiMarks}`);
    }

    // -------------------------------------------------------------
    // TEST 2: Correct Answer with Different Wording
    // -------------------------------------------------------------
    console.log("\n[TEST 2] Scenario 2: Correct Answer with Different Wording...");
    await AnswerSheet.updateOne(
      { _id: testAnswerSheet._id, "answers.questionId": question1._id },

      { $set: { "answers.$.recognizedText": "In distributed databases, CAP principle asserts you can only pick two of three properties. Consistency means every read returns the most recent write. Availability ensures a non-error response to all requests. Partition tolerance means the cluster survives communication network splits between nodes." } }
    );

    const evalResult2 = await runTestEvaluation(testAnswerSheet._id, 1);
    const qRes2 = evalResult2.questions[0];
    console.log("✓ Test 2 complete. Marks awarded for reworded concept:", qRes2.aiMarks);
    if (qRes2.aiMarks < 7) {
      throw new Error(`FAIL Test 2: Reworded correct answer received low score ${qRes2.aiMarks}`);
    }

    // -------------------------------------------------------------
    // TEST 3: Partially Correct Answer
    // -------------------------------------------------------------
    console.log("\n[TEST 3] Scenario 3: Partially Correct Answer...");
    await AnswerSheet.updateOne(
      { _id: testAnswerSheet._id, "answers.questionId": question1._id },

      { $set: { "answers.$.recognizedText": "CAP theorem covers Consistency and Availability. Consistency means nodes have matching data, and Availability means server answers requests." } }
    );

    const evalResult3 = await runTestEvaluation(testAnswerSheet._id, 1);
    const qRes3 = evalResult3.questions[0];
    console.log("✓ Test 3 complete. Partial Marks awarded:", qRes3.aiMarks, "/", qRes3.maximumMarks);
    if (qRes3.aiMarks <= 0 || qRes3.aiMarks >= 10) {
      throw new Error(`FAIL Test 3: Expected partial score between 0 and 10, got ${qRes3.aiMarks}`);
    }

    // -------------------------------------------------------------
    // TEST 4: Completely Incorrect Answer
    // -------------------------------------------------------------
    console.log("\n[TEST 4] Scenario 4: Completely Incorrect Answer...");
    await AnswerSheet.updateOne(
      { _id: testAnswerSheet._id, "answers.questionId": question1._id },

      { $set: { "answers.$.recognizedText": "CAP theorem stands for Computer Architecture Performance which calculates CPU clock cycle speed and GPU RAM frequency." } }
    );

    const evalResult4 = await runTestEvaluation(testAnswerSheet._id, 1);
    const qRes4 = evalResult4.questions[0];
    console.log("✓ Test 4 complete. Marks awarded for incorrect answer:", qRes4.aiMarks);
    if (qRes4.aiMarks > 2.5) {
      throw new Error(`FAIL Test 4: Expected near-zero marks for incorrect answer, got ${qRes4.aiMarks}`);
    }

    // -------------------------------------------------------------
    // TEST 5: Empty Student Answer (No LLM Call, Marks = 0, Status = completed)
    // -------------------------------------------------------------
    console.log("\n[TEST 5] Scenario 5: Empty Student Answer...");
    await AnswerSheet.updateOne(
      { _id: testAnswerSheet._id, "answers.questionId": question1._id },

      { $set: { "answers.$.recognizedText": "    " } }
    );

    const evalResult5 = await runTestEvaluation(testAnswerSheet._id, 1);
    const qRes5 = evalResult5.questions[0];
    const updatedSheet5 = await AnswerSheet.findById(testAnswerSheet._id);
    const digitalAns5 = updatedSheet5.digital_answers?.find((da) => String(da.question_number) === "1" || String(da.question_id) === String(question1._id));

    console.log("✓ Test 5 complete.");
    console.log("   - Marks:", qRes5.aiMarks);
    console.log("   - Digital Answer Status:", digitalAns5?.status);
    console.log("   - Feedback:", qRes5.feedback);

    if (qRes5.aiMarks !== 0) {
      throw new Error(`FAIL Test 5: Expected 0 marks for empty answer, got ${qRes5.aiMarks}`);
    }
    if (digitalAns5?.status !== "completed" && evalResult5.evaluationStatus !== "READY_FOR_FACULTY_REVIEW") {
      throw new Error(`FAIL Test 5: Expected completed digital answer status, got ${digitalAns5?.status}`);
    }


    // -------------------------------------------------------------
    // TEST 6: Answer Missing One Rubric Criterion
    // -------------------------------------------------------------
    console.log("\n[TEST 6] Scenario 6: Answer Missing One Rubric Criterion...");
    await AnswerSheet.updateOne(
      { _id: testAnswerSheet._id, "answers.questionId": question1._id },

      { $set: { "answers.$.recognizedText": "CAP theorem explains Consistency and Partition Tolerance. Consistency ensures all clients read equal data. Partition Tolerance allows handling network link breaks." } }
    );

    const evalResult6 = await runTestEvaluation(testAnswerSheet._id, 1);
    const qRes6 = evalResult6.questions[0];
    console.log("✓ Test 6 complete. Marks awarded:", qRes6.aiMarks);

    // -------------------------------------------------------------
    // TEST 7: Correct Concept but Incomplete Explanation
    // -------------------------------------------------------------
    console.log("\n[TEST 7] Scenario 7: Correct Concept but Incomplete Explanation...");
    await AnswerSheet.updateOne(
      { _id: testAnswerSheet._id, "answers.questionId": question1._id },

      { $set: { "answers.$.recognizedText": "CAP stands for Consistency, Availability, Partition Tolerance. System can only have 2." } }
    );

    const evalResult7 = await runTestEvaluation(testAnswerSheet._id, 1);
    const qRes7 = evalResult7.questions[0];
    console.log("✓ Test 7 complete. Marks awarded for brief outline:", qRes7.aiMarks);

    // -------------------------------------------------------------
    // TEST 8: Long Answer Containing Irrelevant Text
    // -------------------------------------------------------------
    console.log("\n[TEST 8] Scenario 8: Long Answer with Irrelevant Content...");
    await AnswerSheet.updateOne(
      { _id: testAnswerSheet._id, "answers.questionId": question1._id },

      { $set: { "answers.$.recognizedText": "Distributed systems are hard. I studied this yesterday in the library. The CAP theorem states that a distributed data store can simultaneously provide at most two out of three guarantees: Consistency (all nodes see the same data at the same time), Availability (every request receives a response), and Partition Tolerance (system continues despite network partitions). Also, Python is a great programming language for data analysis." } }
    );

    const evalResult8 = await runTestEvaluation(testAnswerSheet._id, 1);
    const qRes8 = evalResult8.questions[0];
    console.log("✓ Test 8 complete. Marks awarded despite irrelevant filler:", qRes8.aiMarks);
    if (qRes8.aiMarks < 7) {
      throw new Error(`FAIL Test 8: Irrelevant text penalized valid content! Marks: ${qRes8.aiMarks}`);
    }

    // -------------------------------------------------------------
    // TEST 9: OCR Text Unavailable (OCR Failure)
    // -------------------------------------------------------------
    console.log("\n[TEST 9] Scenario 9: OCR Processing Failure Handling...");
    await AnswerSheet.updateOne(
      { _id: testAnswerSheet._id },
      { $set: { ocrStatus: "failed" } }
    );

    const evalResult9 = await runTestEvaluation(testAnswerSheet._id, 1);
    const qRes9 = evalResult9.questions[0];
    console.log("✓ Test 9 complete.");
    console.log("   - Status:", qRes9.status || qRes9.evaluationStatus);
    console.log("   - Reason:", qRes9.reason || qRes9.errorMessage);

    if (qRes9.status !== "failed" && qRes9.evaluationStatus !== "failed") {
      throw new Error(`FAIL Test 9: Expected failed status on OCR failure, got ${qRes9.status}`);
    }
    if (qRes9.reason !== "OCR text unavailable; manual review required." && qRes9.errorMessage !== "OCR text unavailable; manual review required.") {
      throw new Error(`FAIL Test 9: Incorrect failure reason: ${qRes9.reason || qRes9.errorMessage}`);
    }

    // Reset OCR status for remaining tests
    await AnswerSheet.updateOne(
      { _id: testAnswerSheet._id },
      { $set: { ocrStatus: "completed" } }
    );

    // -------------------------------------------------------------
    // TEST 10: Response Validator — Invalid LLM JSON
    // -------------------------------------------------------------
    console.log("\n[TEST 10] Scenario 10: Validator Rejection of Non-Object Output...");
    const valRes10 = validateAiEvaluationResponse("invalid string response", configData.rubric, 10);
    console.log("✓ Test 10 complete. Rejected non-JSON:", !valRes10.valid, "| Error:", valRes10.errors[0]);
    if (valRes10.valid) throw new Error("FAIL Test 10: Validator accepted non-object input!");

    // -------------------------------------------------------------
    // TEST 11: Response Validator — Missing Required Fields
    // -------------------------------------------------------------
    console.log("\n[TEST 11] Scenario 11: Validator Rejection of Missing Feedback & Confidence...");
    const valRes11 = validateAiEvaluationResponse({ marksAwarded: 5 }, configData.rubric, 10);
    console.log("✓ Test 11 complete. Rejected missing fields:", !valRes11.valid, "| Errors count:", valRes11.errors.length);
    if (valRes11.valid) throw new Error("FAIL Test 11: Validator accepted missing feedback/confidence!");

    // -------------------------------------------------------------
    // TEST 12: Response Validator — Marks Exceeding Maximum
    // -------------------------------------------------------------
    console.log("\n[TEST 12] Scenario 12: Validator Rejection of Marks Exceeding Question Maximum...");
    const valRes12 = validateAiEvaluationResponse({
      marksAwarded: 15,
      maxMarks: 10,
      confidence: 0.9,
      feedback: "Exceeded max marks test",
      criteria: [
        { criterion: "Consistency Definition", marksAwarded: 15, maxMarks: 3.5, status: "matched", reason: "Excessive" },
      ],
    }, configData.rubric, 10);

    console.log("✓ Test 12 complete. Rejected marks exceeding max:", !valRes12.valid, "| Error:", valRes12.errors[0]);
    if (valRes12.valid) throw new Error("FAIL Test 12: Validator accepted marks > 10!");

    // -------------------------------------------------------------
    // TEST 13: Response Validator — Criterion Marks Exceeding Criterion Maximum
    // -------------------------------------------------------------
    console.log("\n[TEST 13] Scenario 13: Validator Rejection of Criterion Exceeding Criterion Max...");
    const valRes13 = validateAiEvaluationResponse({
      marksAwarded: 5,
      maxMarks: 10,
      confidence: 0.9,
      feedback: "Criterion overflow test",
      criteria: [
        { criterion: "Consistency Definition", marksAwarded: 5, maxMarks: 3.5, status: "matched", reason: "Criterion overflow" },
      ],
    }, configData.rubric, 10);

    console.log("✓ Test 13 complete. Rejected criterion overflow:", !valRes13.valid, "| Error:", valRes13.errors[0]);
    if (valRes13.valid) throw new Error("FAIL Test 13: Validator accepted criterion marks > criterion max!");

    // -------------------------------------------------------------
    // TEST 14: Response Validator — Total Criterion Marks Mismatch
    // -------------------------------------------------------------
    console.log("\n[TEST 14] Scenario 14: Validator Rejection of Criterion Total Mismatch...");
    const valRes14 = validateAiEvaluationResponse({
      marksAwarded: 8,
      maxMarks: 10,
      confidence: 0.9,
      feedback: "Mismatch test",
      criteria: [
        { criterion: "Consistency Definition", marksAwarded: 3, maxMarks: 3.5, status: "matched", reason: "3 marks" },
        { criterion: "Availability Definition", marksAwarded: 2, maxMarks: 3.5, status: "partial", reason: "2 marks" },
      ],
    }, configData.rubric, 10);

    console.log("✓ Test 14 complete. Rejected sum mismatch:", !valRes14.valid, "| Error:", valRes14.errors[0]);
    if (valRes14.valid) throw new Error("FAIL Test 14: Validator accepted criterion sum mismatch!");

    // -------------------------------------------------------------
    // TEST 15: Persistence of evaluationConfigVersion
    // -------------------------------------------------------------
    console.log("\n[TEST 15] Scenario 15: Evaluation Config Version Persistence...");
    await AnswerSheet.updateOne(
      { _id: testAnswerSheet._id, "answers.questionId": question1._id },

      { $set: { "answers.$.recognizedText": "The CAP theorem states that a system can only guarantee 2 of 3: Consistency, Availability, Partition Tolerance." } }
    );

    const evalResult15 = await runTestEvaluation(testAnswerSheet._id, 1);
    const qRes15 = evalResult15.questions[0];
    console.log("✓ Test 15 complete. Captured evaluationConfigVersion:", qRes15.evaluationConfigVersion || qRes15.aiEvaluation?.evaluationConfigVersion);
    if (!qRes15.evaluationConfigVersion && !qRes15.aiEvaluation?.evaluationConfigVersion) {
      throw new Error("FAIL Test 15: evaluationConfigVersion was not persisted!");
    }

    console.log("\n=================================================");
    console.log(" 🎉 ALL 15 PHASE 3C EVALUATION SCENARIOS PASSED 🎉 ");
    console.log("=================================================\n");
  } catch (err) {
    console.error("\n❌ PHASE 3C TEST SUITE FAILED:", err);
    process.exitCode = 1;
  } finally {
    console.log("Cleaning up test documents...");
    if (testAnswerSheet) {
      await AnswerSheet.findByIdAndDelete(testAnswerSheet._id);
      await Evaluation.deleteOne({ answerSheet: testAnswerSheet._id });
    }
    if (testExam) await Exam.findByIdAndDelete(testExam._id);
    if (testSubject) await Subject.findByIdAndDelete(testSubject._id);
    if (testCourse) await Course.findByIdAndDelete(testCourse._id);
    if (testDept) await Department.findByIdAndDelete(testDept._id);
    if (testUser) await User.findByIdAndDelete(testUser._id);
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

runPhase3CTests();
