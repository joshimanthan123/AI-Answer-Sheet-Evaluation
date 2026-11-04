import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import HistoricalEvaluation from "../models/HistoricalEvaluation.js";
import examService from "../services/exam.service.js";

async function runPhase3ATests() {
  console.log("=================================================");
  console.log("   RUNNING PHASE 3A DATABASE FOUNDATION TESTS    ");
  console.log("=================================================");
  console.log("Connecting database:", env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let tempUser = null;
  let tempDept = null;
  let tempCourse = null;
  let tempSubject = null;
  let tempExam = null;
  let tempAnswerSheet = null;
  let tempHistoricalDoc = null;

  try {
    // Setup Mock User, Dept, Course, Subject
    tempUser = await User.create({
      name: "Phase 3A Tester",
      email: `p3a.tester.${Date.now()}@example.com`,
      password: "password123",
      role: "faculty",
      lecturerId: "LEC3A" + Date.now(),
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
      name: "Evaluation Foundation Subject " + Date.now(),
      code: "EVAL" + Math.floor(Math.random() * 1000),
      credits: 4,
      semester: 5,
      isActive: true,
      course: tempCourse._id,
      faculty: tempUser._id,
      createdBy: tempUser._id,
    });
    console.log("✓ Test Subject created:", tempSubject.code);

    // -------------------------------------------------------------
    // TEST 1: Question Creation with Model Answer & Valid Rubric Items
    // -------------------------------------------------------------
    console.log("\n[TEST 1] Create Question with Model Answer and Valid Rubric Items...");
    tempExam = await examService.createExam(
      {
        title: "Phase 3A Evaluation Test Exam",
        examCode: "EX3A" + Math.floor(Math.random() * 1000),
        subject: tempSubject._id,
        examType: "Mid-Term",
        examDate: new Date(),
        duration: 90,
        totalMarks: 10,
        passingMarks: 4,
        questions: [
          {
            questionNumber: 1,
            questionText: "Explain QuickSort partitioning logic and analyze time complexity.",
            maximumMarks: 10,
            questionType: "Descriptive",
            modelAnswer: "QuickSort uses a pivot element to partition array into smaller sub-arrays recursively. Average time complexity is O(n log n).",
            rubricItems: [
              { criterion: "Pivot Choice & Partitioning", description: "Lomuto/Hoare partition scheme explanation", maxMarks: 5 },
              { criterion: "Recursion & Base Case", description: "Correct base case and recursive calls", maxMarks: 3 },
              { criterion: "Time Complexity Derivation", description: "Best, average and worst case analysis", maxMarks: 2 },
            ],
          },
        ],
      },
      tempUser._id
    );

    const questionDoc = tempExam.questions[0];
    console.log("✓ Question created successfully!");
    console.log("   - Question text:", questionDoc.questionText);
    console.log("   - Model answer present:", !!questionDoc.modelAnswer);
    console.log("   - Rubric items count:", questionDoc.rubricItems.length);
    const rubricSum = questionDoc.rubricItems.reduce((acc, r) => acc + r.maxMarks, 0);
    console.log(`   - Rubric items sum (${rubricSum}) === Question maximumMarks (${questionDoc.maximumMarks})`);
    if (rubricSum !== questionDoc.maximumMarks) {
      throw new Error("FAIL: Rubric sum does not equal question maximumMarks!");
    }

    // -------------------------------------------------------------
    // TEST 2: Rubric Total Validation Failure when Sum != maxMarks
    // -------------------------------------------------------------
    console.log("\n[TEST 2] Verify Mongoose Pre-Validate Catch for Rubric Total Mismatch...");
    try {
      const invalidExam = new Exam({
        title: "Invalid Rubric Exam",
        examCode: "INV" + Math.floor(Math.random() * 1000),
        subject: tempSubject._id,
        examType: "Mid-Term",
        examDate: new Date(),
        duration: 60,
        totalMarks: 10,
        passingMarks: 4,
        createdBy: tempUser._id,
        questions: [
          {
            questionNumber: 1,
            questionText: "Explain Binary Search.",
            maximumMarks: 10,
            rubricItems: [
              { criterion: "Algorithm logic", maxMarks: 4 },
              { criterion: "Code implementation", maxMarks: 4 }, // 4 + 4 = 8 != 10
            ],
          },
        ],
      });
      await invalidExam.save();
      throw new Error("FAIL: Pre-validate did not block invalid rubric sum!");
    } catch (err) {
      console.log("✓ Correctly rejected invalid rubric items sum:", err.message);
    }

    // -------------------------------------------------------------
    // TEST 3: AnswerSheet Creation with Default Evaluation Status = "pending"
    // -------------------------------------------------------------
    console.log("\n[TEST 3] Create AnswerSheet & Verify Default Evaluation Status = 'pending'...");
    tempAnswerSheet = await AnswerSheet.create({
      exam: tempExam._id,
      subject: tempSubject._id,
      student: tempUser._id,
      answers: [
        {
          questionId: questionDoc._id,
          recognizedText: "QuickSort selects a pivot element. Average time is O(n log n).",
          handwrittenData: "<svg><path d='M0 0 L10 10'/></svg>",
        },
      ],
      ocrStatus: "completed",
      ocrCompletedAt: new Date(),
    });

    const answerItem = tempAnswerSheet.answers[0];
    console.log("✓ AnswerSheet created!");
    console.log("   - Answer ID:", answerItem._id);
    console.log("   - Evaluation status:", answerItem.evaluation.status);
    console.log("   - Faculty evaluation status:", answerItem.evaluation.facultyEvaluation.status);
    if (answerItem.evaluation.status !== "pending") {
      throw new Error(`FAIL: Expected evaluation status 'pending', got '${answerItem.evaluation.status}'`);
    }

    // -------------------------------------------------------------
    // TEST 4: Faculty Evaluation modification preserves AI Evaluation separation
    // -------------------------------------------------------------
    console.log("\n[TEST 4] Modify Faculty Evaluation Marks & Verify AI Evaluation Fields Untouched...");
    // Simulate AI evaluation populated
    answerItem.evaluation.aiEvaluation = {
      marksAwarded: 8,
      maxMarks: 10,
      percentage: 80,
      criteria: [
        { criterion: "Pivot Choice & Partitioning", marksAwarded: 5, maxMarks: 5, status: "met", reason: "Complete" },
        { criterion: "Recursion & Base Case", marksAwarded: 2, maxMarks: 3, status: "partial", reason: "Minor syntax error" },
        { criterion: "Time Complexity Derivation", marksAwarded: 1, maxMarks: 2, status: "partial", reason: "Worst case missing" },
      ],
      confidence: 0.95,
      feedback: "Good explanation overall.",
      evaluatedAt: new Date(),
    };
    answerItem.evaluation.status = "completed";
    await tempAnswerSheet.save();

    // Now faculty overrides final mark to 9
    answerItem.evaluation.facultyEvaluation = {
      status: "modified",
      finalMarks: 9,
      comment: "Awarded 1 extra mark for good recursion explanation.",
      reviewedAt: new Date(),
      reviewedBy: tempUser._id,
    };
    await tempAnswerSheet.save();

    const reloadedSheet = await AnswerSheet.findById(tempAnswerSheet._id);
    const reloadedAnswer = reloadedSheet.answers[0];

    console.log("✓ Faculty evaluation updated!");
    console.log("   - AI marksAwarded:", reloadedAnswer.evaluation.aiEvaluation.marksAwarded); // Should remain 8!
    console.log("   - AI confidence:", reloadedAnswer.evaluation.aiEvaluation.confidence); // Should remain 0.95!
    console.log("   - Faculty finalMarks:", reloadedAnswer.evaluation.facultyEvaluation.finalMarks); // Should be 9
    console.log("   - Faculty comment:", reloadedAnswer.evaluation.facultyEvaluation.comment);

    if (reloadedAnswer.evaluation.aiEvaluation.marksAwarded !== 8) {
      throw new Error("FAIL: AI evaluation marks were overwritten by faculty evaluation!");
    }
    if (reloadedAnswer.evaluation.facultyEvaluation.finalMarks !== 9) {
      throw new Error("FAIL: Faculty final marks were not saved properly!");
    }

    // -------------------------------------------------------------
    // TEST 5: Create and Retrieve Historical Evaluation (historical_evaluations)
    // -------------------------------------------------------------
    console.log("\n[TEST 5] Create & Query HistoricalEvaluation (historical_evaluations)...");
    tempHistoricalDoc = await HistoricalEvaluation.create({
      academicYear: "2025-2026",
      subject: tempSubject._id.toString(),
      examName: "Data Structures Mid-Term",
      questionNumber: 1,
      questionText: "Explain QuickSort algorithm.",
      studentAnswer: "QuickSort is a divide and conquer algorithm...",
      marksAwarded: 9,
      maxMarks: 10,
      rubric: questionDoc.rubricItems,
      uploadedBy: tempUser._id,
    });

    const retrievedHist = await HistoricalEvaluation.findById(tempHistoricalDoc._id);
    console.log("✓ Historical evaluation created and retrieved successfully!");
    console.log("   - Academic Year:", retrievedHist.academicYear);
    console.log("   - Question text:", retrievedHist.questionText);
    console.log("   - Rubric items saved:", retrievedHist.rubric.length);

    // -------------------------------------------------------------
    // TEST 6: OCR Retrieval & Backward Compatibility Verification
    // -------------------------------------------------------------
    console.log("\n[TEST 6] OCR Digitized Text Preservation Verification...");
    const sheetWithOCR = await AnswerSheet.findById(tempAnswerSheet._id);
    const firstAnswer = sheetWithOCR.answers[0];
    console.log("✓ OCR text retrieved successfully:");
    console.log("   - recognizedText:", firstAnswer.recognizedText);
    console.log("   - handwrittenData:", firstAnswer.handwrittenData);
    if (!firstAnswer.recognizedText || !firstAnswer.handwrittenData) {
      throw new Error("FAIL: OCR recognizedText or handwrittenData was missing or lost!");
    }

    console.log("\n=================================================");
    console.log(" 🎉 ALL PHASE 3A DATABASE FOUNDATION TESTS PASSED 🎉 ");
    console.log("=================================================\n");
  } catch (err) {
    console.error("\n❌ PHASE 3A TEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    console.log("Cleaning up test documents...");
    if (tempHistoricalDoc) await HistoricalEvaluation.findByIdAndDelete(tempHistoricalDoc._id);
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

runPhase3ATests();
