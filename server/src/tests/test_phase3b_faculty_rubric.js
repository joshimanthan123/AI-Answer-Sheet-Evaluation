import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import examService from "../services/exam.service.js";

async function runPhase3BTests() {
  console.log("=================================================");
  console.log("  RUNNING PHASE 3B FACULTY RUBRIC ENGINE TESTS   ");
  console.log("=================================================");
  console.log("Connecting database:", env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let tempUser = null;
  let tempDept = null;
  let tempCourse = null;
  let tempSubject = null;
  let tempExam = null;
  let tempAnswerSheet = null;

  try {
    // Setup Mock User, Dept, Course, Subject
    tempUser = await User.create({
      name: "Phase 3B Faculty Tester",
      email: `p3b.tester.${Date.now()}@example.com`,
      password: "password123",
      role: "faculty",
      lecturerId: "LEC3B" + Date.now(),
      status: "online",
    });
    console.log("✓ Test Faculty created:", tempUser.email);

    tempDept = await Department.create({
      name: "CS Dept " + Date.now(),
      code: "CSD" + Math.floor(Math.random() * 1000),
      createdBy: tempUser._id,
    });

    tempCourse = await Course.create({
      name: "B.Tech CS " + Date.now(),
      code: "BTC" + Math.floor(Math.random() * 1000),
      durationYears: 4,
      totalSemesters: 8,
      department: tempDept._id,
      createdBy: tempUser._id,
    });

    tempSubject = await Subject.create({
      name: "Cloud Computing & Systems " + Date.now(),
      code: "CCS" + Math.floor(Math.random() * 1000),
      credits: 4,
      semester: 5,
      isActive: true,
      course: tempCourse._id,
      faculty: tempUser._id,
      createdBy: tempUser._id,
    });
    console.log("✓ Test Subject created:", tempSubject.code);

    // Create Initial Exam
    tempExam = await examService.createExam(
      {
        title: "Cloud Computing Mid-Term Exam",
        examCode: "EX3B" + Math.floor(Math.random() * 1000),
        subject: tempSubject._id,
        examType: "Mid-Term",
        examDate: new Date(),
        duration: 90,
        totalMarks: 10.5,
        passingMarks: 4,
        questions: [
          {
            questionNumber: 1,
            questionText: "Discuss cloud architecture design trade-offs regarding scalability, cost, and access control.",
            maximumMarks: 5,
            questionType: "descriptive",
            modelAnswer: "Initial model answer outline.",
          },
          {
            questionNumber: 2,
            questionText: "Calculate effective throughput given bandwidth and latency metrics.",
            maximumMarks: 5.5,
            questionType: "numerical",
            modelAnswer: "Throughput = (Bandwidth * Efficiency) / Latency Factor.",
          },
        ],
      },
      tempUser._id
    );

    const question1 = tempExam.questions[0];
    const question2 = tempExam.questions[1];
    console.log("✓ Exam and questions created successfully!");

    // -------------------------------------------------------------
    // TEST 1: Save Initial Evaluation Configuration (Version 1)
    // -------------------------------------------------------------
    console.log("\n[TEST 1] Save Evaluation Configuration for Question 1 (Version 1)...");
    const configDataQ1 = {
      questionText: "Discuss cloud architecture design trade-offs regarding scalability, cost, and access control.",
      maximumMarks: 5,
      questionType: "descriptive",
      modelAnswer: "Scalability requires horizontal elasticity, cost requires resource auto-scaling, and access control requires role-based policies.",
      rubric: [
        { criterion: "Scalability", description: "Explains horizontal and vertical scaling", maxMarks: 2 },
        { criterion: "Cost Optimization", description: "Describes auto-scaling and spot instances", maxMarks: 2 },
        { criterion: "Access Control", description: "Details RBAC and IAM policies", maxMarks: 1 },
      ],
    };

    const resQ1 = await examService.saveEvaluationConfig(tempExam._id, question1._id, configDataQ1, tempUser._id);
    console.log("✓ Evaluation Configuration saved for Q1!");
    console.log("   - Version:", resQ1.evaluationConfig.version);
    console.log("   - Model Answer:", resQ1.evaluationConfig.modelAnswer);
    console.log("   - Rubric Criteria Count:", resQ1.evaluationConfig.rubric.length);

    if (resQ1.evaluationConfig.version !== 1) {
      throw new Error(`FAIL: Expected version 1, got ${resQ1.evaluationConfig.version}`);
    }

    // -------------------------------------------------------------
    // TEST 2: Decimal Marks Support
    // -------------------------------------------------------------
    console.log("\n[TEST 2] Save Evaluation Configuration with Decimal Marks (Q2 maxMarks = 5.5)...");
    const configDataQ2 = {
      questionText: "Calculate effective throughput given bandwidth and latency metrics.",
      maximumMarks: 5.5,
      questionType: "numerical",
      modelAnswer: "Effective throughput = 5.5 Gbps under 10ms latency.",
      rubric: [
        { criterion: "Formula derivation", description: "Correct bandwidth formula", maxMarks: 2.5 },
        { criterion: "Substitution", description: "Correct value substitution", maxMarks: 1.5 },
        { criterion: "Final result", description: "Correct unit and magnitude", maxMarks: 1.5 },
      ],
    };

    const resQ2 = await examService.saveEvaluationConfig(tempExam._id, question2._id, configDataQ2, tempUser._id);
    const decimalSum = resQ2.evaluationConfig.rubric.reduce((acc, r) => acc + r.maxMarks, 0);
    console.log(`✓ Decimal marks saved! Rubric Sum (${decimalSum}) === maxMarks (${resQ2.maximumMarks})`);

    if (decimalSum !== 5.5) {
      throw new Error("FAIL: Decimal marks sum did not match maximumMarks 5.5!");
    }

    // -------------------------------------------------------------
    // TEST 3: Reject Configuration when Rubric Sum != maximumMarks
    // -------------------------------------------------------------
    console.log("\n[TEST 3] Verify Rejection when Rubric Sum Mismatches maxMarks...");
    try {
      await examService.saveEvaluationConfig(tempExam._id, question1._id, {
        ...configDataQ1,
        rubric: [
          { criterion: "Scalability", description: "Explains scaling", maxMarks: 2 },
          { criterion: "Cost", description: "Explains cost", maxMarks: 1 }, // 2 + 1 = 3 != 5
        ],
      }, tempUser._id);
      throw new Error("FAIL: System accepted rubric total mismatch!");
    } catch (err) {
      console.log("✓ Correctly rejected rubric sum mismatch:", err.message);
    }

    // -------------------------------------------------------------
    // TEST 4: Reject Configuration when Model Answer is Missing
    // -------------------------------------------------------------
    console.log("\n[TEST 4] Verify Rejection when Model Answer is Missing...");
    try {
      await examService.saveEvaluationConfig(tempExam._id, question1._id, {
        ...configDataQ1,
        modelAnswer: "",
      }, tempUser._id);
      throw new Error("FAIL: System accepted empty model answer!");
    } catch (err) {
      console.log("✓ Correctly rejected missing model answer:", err.message);
    }

    // -------------------------------------------------------------
    // TEST 5: Reject Configuration when Criterion Description is Missing
    // -------------------------------------------------------------
    console.log("\n[TEST 5] Verify Rejection when Criterion Description is Missing...");
    try {
      await examService.saveEvaluationConfig(tempExam._id, question1._id, {
        ...configDataQ1,
        rubric: [
          { criterion: "Scalability", description: "", maxMarks: 5 },
        ],
      }, tempUser._id);
      throw new Error("FAIL: System accepted empty criterion description!");
    } catch (err) {
      console.log("✓ Correctly rejected missing criterion description:", err.message);
    }

    // -------------------------------------------------------------
    // TEST 6: Versioning Increment on Update (Version 2)
    // -------------------------------------------------------------
    console.log("\n[TEST 6] Update Evaluation Configuration and Verify Version Increment (Version 2)...");
    const updatedConfigQ1 = {
      ...configDataQ1,
      modelAnswer: "Updated model answer with additional security considerations.",
      rubric: [
        { criterion: "Scalability", description: "Explains scaling", maxMarks: 2.5 },
        { criterion: "Cost Optimization", description: "Describes auto-scaling", maxMarks: 1.5 },
        { criterion: "Access Control", description: "Details RBAC and IAM policies", maxMarks: 1 },
      ],
    };

    const resQ1v2 = await examService.saveEvaluationConfig(tempExam._id, question1._id, updatedConfigQ1, tempUser._id);
    console.log("✓ Updated evaluation configuration saved!");
    console.log("   - New Version:", resQ1v2.evaluationConfig.version);
    console.log("   - Updated Model Answer:", resQ1v2.evaluationConfig.modelAnswer);

    if (resQ1v2.evaluationConfig.version !== 2) {
      throw new Error(`FAIL: Expected version increment to 2, got ${resQ1v2.evaluationConfig.version}`);
    }

    // -------------------------------------------------------------
    // TEST 7: Backward Compatibility & OCR Integrity
    // -------------------------------------------------------------
    console.log("\n[TEST 7] Verify OCR & AnswerSheet Backward Compatibility...");
    tempAnswerSheet = await AnswerSheet.create({
      exam: tempExam._id,
      subject: tempSubject._id,
      student: tempUser._id,
      answers: [
        {
          questionId: question1._id,
          recognizedText: "Cloud scalability allows dynamically allocating virtual machines.",
          handwrittenData: "<svg><path d='M10 10 L50 50'/></svg>",
        },
      ],
      ocrStatus: "completed",
    });

    const answerSheetDoc = await AnswerSheet.findById(tempAnswerSheet._id);
    const ansItem = answerSheetDoc.answers[0];

    console.log("✓ OCR data verified successfully!");
    console.log("   - Digitized Text:", ansItem.recognizedText);
    console.log("   - Handwritten SVG Data:", ansItem.handwrittenData);

    if (!ansItem.recognizedText || ansItem.recognizedText !== "Cloud scalability allows dynamically allocating virtual machines.") {
      throw new Error("FAIL: OCR digitized text was corrupted or lost!");
    }

    console.log("\n=================================================");
    console.log(" 🎉 ALL PHASE 3B FACULTY RUBRIC ENGINE TESTS PASSED 🎉 ");
    console.log("=================================================\n");
  } catch (err) {
    console.error("\n❌ PHASE 3B TEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    console.log("Cleaning up test documents...");
    if (tempAnswerSheet) await AnswerSheet.findByIdAndDelete(tempAnswerSheet._id);
    if (tempExam) await Exam.findByIdAndDelete(tempExam._id);
    if (tempSubject) await Subject.findByIdAndDelete(tempSubject._id);
    if (tempCourse) await Course.findByIdAndDelete(tempCourse._id);
    if (tempDept) await Department.findByIdAndDelete(tempDept._id);
    if (tempUser) await User.findByIdAndDelete(tempUser._id);
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

runPhase3BTests();
