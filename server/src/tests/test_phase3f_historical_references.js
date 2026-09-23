import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import HistoricalEvaluation from "../models/HistoricalEvaluation.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import Exam from "../models/Exam.js";
import Subject from "../models/Subject.js";
import AnswerKey from "../models/AnswerKey.js";
import User from "../models/User.js";

import historicalService from "../services/historicalEvaluation.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai_evaluation_db";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function logPass(title) {
  console.log(`${colors.green}✔ PASS:${colors.reset} ${title}`);
}

function logFail(title, error) {
  console.error(`${colors.red}✖ FAIL:${colors.reset} ${title}`);
  if (error) console.error(error);
}

async function runPhase3FTests() {
  console.log(`\n${colors.cyan}${colors.bold}=== Starting Phase 3F — Historical Evaluated Answer Reference Test Suite ===${colors.reset}\n`);

  try {
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }

  let testCount = 0;
  let passCount = 0;

  let facultyUser, studentUser, subjectDoc, examDoc, answerKeyDoc, finalizedSheet, unfinalizedSheet, evalDoc;

  try {
    // Pre-test cleanup of previous test runs
    await HistoricalEvaluation.deleteMany({ academicYear: "2025-26", examName: "Mid-Term Examination CS201" });

    // Setup test environment data
    facultyUser = await User.findOne({ role: "faculty" });
    if (!facultyUser) {
      facultyUser = await User.create({
        name: "Test Faculty",
        email: "test.faculty@example.com",
        password: "password123",
        role: "faculty",
      });
    }

    studentUser = await User.findOne({ role: "student" });
    if (!studentUser) {
      studentUser = await User.create({
        name: "Test Student",
        email: "test.student@example.com",
        password: "password123",
        role: "student",
      });
    }

    subjectDoc = await Subject.findOne();
    if (!subjectDoc) {
      subjectDoc = await Subject.create({
        name: "Data Structures & Algorithms",
        code: "CS201",
        academicYear: "2025-26",
      });
    }

    const q1Id = new mongoose.Types.ObjectId();
    const q2Id = new mongoose.Types.ObjectId();

    examDoc = await Exam.create({
      title: "Mid-Term Examination CS201",
      academicYear: "2025-26",
      subject: subjectDoc._id,
      createdBy: facultyUser._id,
      examType: "MidTerm",
      totalMarks: 20,
      duration: 60,
      examDate: new Date(),
      questions: [
        {
          _id: q1Id,
          questionNumber: 1,
          questionText: "Explain Binary Search Tree insertion algorithm with time complexity.",
          maximumMarks: 10,
          modelAnswer: "A binary search tree inserts nodes based on binary property...",
        },
        {
          _id: q2Id,
          questionNumber: 2,
          questionText: "What is the difference between BFS and DFS graph traversals?",
          maximumMarks: 10,
          modelAnswer: "BFS uses a Queue data structure while DFS uses a Stack...",
        },
      ],
    });

    answerKeyDoc = await AnswerKey.create({
      examId: examDoc._id,
      exam: examDoc._id,
      subject: subjectDoc._id,
      createdBy: facultyUser._id,
      uploadedBy: facultyUser._id,
      fileName: "answer_key_cs201.pdf",
      fileUrl: "/uploads/answer_keys/answer_key_cs201.pdf",
      version: 1,
      questions: [
        {
          _id: q1Id,
          questionNumber: 1,
          questionText: "Explain Binary Search Tree insertion algorithm with time complexity.",
          maxMarks: 10,
          modelAnswer: "A binary search tree inserts nodes based on binary property...",
          rubricItems: [
            { criterion: "Definition and concept", maxMarks: 4 },
            { criterion: "Complexity analysis", maxMarks: 6 },
          ],
        },
        {
          _id: q2Id,
          questionNumber: 2,
          questionText: "What is the difference between BFS and DFS graph traversals?",
          maxMarks: 10,
          modelAnswer: "BFS uses a Queue data structure while DFS uses a Stack...",
          rubricItems: [
            { criterion: "Data structures used", maxMarks: 5 },
            { criterion: "Traversal order", maxMarks: 5 },
          ],
        },
      ],
      parsedAnswers: [
        {
          questionId: q1Id,
          questionNumber: 1,
          questionText: "Explain Binary Search Tree insertion algorithm with time complexity.",
          answerText: "A binary search tree inserts nodes based on binary property...",
          maximumMarks: 10,
        },
        {
          questionId: q2Id,
          questionNumber: 2,
          questionText: "What is the difference between BFS and DFS graph traversals?",
          answerText: "BFS uses a Queue data structure while DFS uses a Stack...",
          maximumMarks: 10,
        },
      ],
    });

    // Create Finalized AnswerSheet
    finalizedSheet = await AnswerSheet.create({
      student: studentUser._id,
      exam: examDoc._id,
      subject: subjectDoc._id,
      evaluationStatus: "finalized",
      uploadStatus: "Published",
      original_filename: "test_candidate_ans.pdf",
      totalQuestions: 2,
      digital_answers: [
        {
          _id: q1Id,
          question_id: q1Id,
          question_number: 1,
          question_text: "Explain Binary Search Tree insertion algorithm with time complexity.",
          text: "BST insertion compares value with current node and moves left or right. Time complexity is O(log n).",
          recognizedText: "BST insertion compares value with current node and moves left or right. Time complexity is O(log n).",
          max_marks: 10,
          evaluation: {
            facultyEvaluation: {
              finalMarks: 9,
              status: "approved",
            },
          },
        },
        {
          _id: q2Id,
          question_id: q2Id,
          question_number: 2,
          question_text: "What is the difference between BFS and DFS graph traversals?",
          text: "BFS uses Queue (FIFO) for level order. DFS uses Stack (LIFO) for deep traversal.",
          recognizedText: "BFS uses Queue (FIFO) for level order. DFS uses Stack (LIFO) for deep traversal.",
          max_marks: 10,
          evaluation: {
            facultyEvaluation: {
              finalMarks: 8,
              status: "modified",
            },
          },
        },
      ],
    });

    evalDoc = await Evaluation.create({
      answerSheet: finalizedSheet._id,
      exam: examDoc._id,
      student: studentUser._id,
      evaluationStatus: "finalized",
      evaluationType: "Faculty",
      totalMarks: 20,
      obtainedMarks: 17,
      percentage: 85,
      questions: [
        {
          _id: q1Id,
          questionId: q1Id,
          questionNumber: 1,
          facultyAwardedMarks: 9,
          facultyEvaluation: { finalMarks: 9, status: "approved" },
          studentAnswer: "BST insertion compares value with current node and moves left or right. Time complexity is O(log n).",
          recognizedText: "BST insertion compares value with current node and moves left or right. Time complexity is O(log n).",
          maximumMarks: 10,
        },
        {
          _id: q2Id,
          questionId: q2Id,
          questionNumber: 2,
          facultyAwardedMarks: 8,
          facultyEvaluation: { finalMarks: 8, status: "modified" },
          studentAnswer: "BFS uses Queue (FIFO) for level order. DFS uses Stack (LIFO) for deep traversal.",
          recognizedText: "BFS uses Queue (FIFO) for level order. DFS uses Stack (LIFO) for deep traversal.",
          maximumMarks: 10,
        },
      ],
      finalEvaluation: { status: "finalized", finalizedBy: facultyUser._id, finalizedAt: new Date() },
    });

    // Create Unfinalized AnswerSheet
    unfinalizedSheet = await AnswerSheet.create({
      student: studentUser._id,
      exam: examDoc._id,
      subject: subjectDoc._id,
      evaluationStatus: "READY_FOR_FACULTY_REVIEW",
      uploadStatus: "Published",
      original_filename: "pending_candidate.pdf",
      totalQuestions: 1,
      digital_answers: [
        {
          _id: q1Id,
          question_id: q1Id,
          question_number: 1,
          text: "Pending evaluation answer.",
          max_marks: 10,
        },
      ],
    });

    // ==========================================
    // TEST 1: Create Reference from Finalized Answer Sheet
    // ==========================================
    testCount++;
    try {
      const res = await historicalService.createHistoricalReferences(
        {
          answerSheetId: finalizedSheet._id.toString(),
          answerIds: [q1Id.toString()],
        },
        facultyUser._id
      );

      if (
        res.createdReferences.length === 1 &&
        res.createdReferences[0].referenceStatus === "pending_review" &&
        res.createdReferences[0].marksAwarded === 9
      ) {
        passCount++;
        logPass("Test 1: Create reference from finalized sheet (Status = pending_review, Marks = 9)");
      } else {
        logFail("Test 1: Invalid creation response", res);
      }
    } catch (err) {
      logFail("Test 1 Failed", err);
    }

    // ==========================================
    // TEST 2: Approve Reference (Status = approved)
    // ==========================================
    testCount++;
    try {
      const pendingRef = await HistoricalEvaluation.findOne({
        sourceAnswerSheetId: finalizedSheet._id,
        questionNumber: 1,
      });

      const approvedRef = await historicalService.updateReferenceStatus(
        pendingRef._id.toString(),
        "approved",
        "Excellent high mark reference example.",
        facultyUser._id
      );

      if (
        approvedRef.referenceStatus === "approved" &&
        approvedRef.approvedBy.toString() === facultyUser._id.toString() &&
        approvedRef.approvedAt !== null
      ) {
        passCount++;
        logPass("Test 2: Faculty approves reference (Status = approved, approvedBy & approvedAt set)");
      } else {
        logFail("Test 2: Approval failed", approvedRef);
      }
    } catch (err) {
      logFail("Test 2 Failed", err);
    }

    // ==========================================
    // TEST 3: Create Second Reference & Reject
    // ==========================================
    testCount++;
    try {
      const res2 = await historicalService.createHistoricalReferences(
        {
          answerSheetId: finalizedSheet._id.toString(),
          answerIds: [q2Id.toString()],
        },
        facultyUser._id
      );

      const ref2 = res2.createdReferences[0];
      const rejectedRef = await historicalService.updateReferenceStatus(
        ref2._id.toString(),
        "rejected",
        "Does not meet reference benchmark.",
        facultyUser._id
      );

      if (rejectedRef.referenceStatus === "rejected") {
        passCount++;
        logPass("Test 3: Reject reference (Status = rejected)");
      } else {
        logFail("Test 3: Reject failed", rejectedRef);
      }
    } catch (err) {
      logFail("Test 3 Failed", err);
    }

    // ==========================================
    // TEST 4: Archive Reference
    // ==========================================
    testCount++;
    try {
      const refToArchive = await HistoricalEvaluation.findOne({ questionNumber: 2 });
      const archivedRef = await historicalService.updateReferenceStatus(
        refToArchive._id.toString(),
        "archived",
        "Archiving record.",
        facultyUser._id
      );

      if (archivedRef.referenceStatus === "archived") {
        passCount++;
        logPass("Test 4: Archive reference (Status = archived)");
      } else {
        logFail("Test 4: Archive failed", archivedRef);
      }
    } catch (err) {
      logFail("Test 4 Failed", err);
    }

    // ==========================================
    // TEST 5: Attempt Creation from Unfinalized Sheet (Expect Error)
    // ==========================================
    testCount++;
    try {
      await historicalService.createHistoricalReferences(
        {
          answerSheetId: unfinalizedSheet._id.toString(),
          answerIds: [q1Id.toString()],
        },
        facultyUser._id
      );
      logFail("Test 5: Creation from unfinalized sheet should have failed but succeeded.");
    } catch (err) {
      if (err.statusCode === 400 || err.message.includes("finalized")) {
        passCount++;
        logPass("Test 5: Rejects creation from unfinalized sheet (HTTP 400 Rejection)");
      } else {
        logFail("Test 5 Unexpected error type", err);
      }
    }

    // ==========================================
    // TEST 6: Duplicate Protection Check
    // ==========================================
    testCount++;
    try {
      // Q1 reference was created in Test 1 (evaluationConfigVersion: 1)
      await historicalService.createHistoricalReferences(
        {
          answerSheetId: finalizedSheet._id.toString(),
          answerIds: [q1Id.toString()],
        },
        facultyUser._id
      );
      logFail("Test 6: Duplicate reference creation succeeded when it should be prevented.");
    } catch (err) {
      if (err.statusCode === 409 || err.message.includes("already exists")) {
        passCount++;
        logPass("Test 6: Duplicate reference protection enforced (HTTP 409 Conflict)");
      } else {
        logFail("Test 6 Unexpected error type", err);
      }
    }

    // ==========================================
    // TEST 7: Snapshot Preservation Verification
    // ==========================================
    testCount++;
    try {
      const originalRef = await HistoricalEvaluation.findOne({ questionNumber: 1 });
      const originalModelAns = originalRef.modelAnswer;

      // Update original Exam question model answer
      examDoc.questions[0].modelAnswer = "MODIFIED MODEL ANSWER IN KEY";
      await examDoc.save();

      // Refetch historical evaluation reference
      const refAfterKeyChange = await HistoricalEvaluation.findById(originalRef._id);

      if (
        refAfterKeyChange.modelAnswer === originalModelAns &&
        refAfterKeyChange.modelAnswer !== "MODIFIED MODEL ANSWER IN KEY"
      ) {
        passCount++;
        logPass("Test 7: Snapshot preservation verified (Historical record immune to future model answer updates)");
      } else {
        logFail("Test 7: Snapshot altered by external updates!", refAfterKeyChange);
      }
    } catch (err) {
      logFail("Test 7 Failed", err);
    }

    // ==========================================
    // TEST 8: OCR Text and Faculty Marks Integrity
    // ==========================================
    testCount++;
    try {
      const ref = await HistoricalEvaluation.findOne({ questionNumber: 1 });

      if (
        ref.ocrText.includes("BST insertion compares value") &&
        ref.marksAwarded === 9 &&
        ref.maxMarks === 10
      ) {
        passCount++;
        logPass("Test 8: OCR text & Faculty final marks integrity verified");
      } else {
        logFail("Test 8: Data integrity mismatch", ref);
      }
    } catch (err) {
      logFail("Test 8 Failed", err);
    }

    // ==========================================
    // TEST 9: Metadata Query & Filtering
    // ==========================================
    testCount++;
    try {
      const filterRes = await historicalService.getHistoricalReferences({
        academicYear: "2025-26",
        referenceStatus: "approved",
      });

      if (filterRes.references.length === 1 && filterRes.references[0].questionNumber === 1) {
        passCount++;
        logPass("Test 9: Metadata query & filtering verified (Found 1 approved reference for 2025-26)");
      } else {
        logFail("Test 9: Filtering failed", filterRes);
      }
    } catch (err) {
      logFail("Test 9 Failed", err);
    }

    // ==========================================
    // TEST 10: Find Approved References Helper Interface (Phase 3G Prep)
    // ==========================================
    testCount++;
    try {
      const approvedList = await historicalService.findApprovedReferences({
        subjectId: subjectDoc._id,
        questionNumber: 1,
      });

      if (approvedList.length === 1 && approvedList[0].referenceStatus === "approved") {
        passCount++;
        logPass("Test 10: findApprovedReferences helper interface functional for Phase 3G consumption");
      } else {
        logFail("Test 10 Helper interface failed", approvedList);
      }
    } catch (err) {
      logFail("Test 10 Failed", err);
    }

  } catch (err) {
    console.error("Test execution error:", err);
  } finally {
    // Cleanup created test records
    console.log(`\nCleaning up test artifacts...`);
    if (finalizedSheet) await AnswerSheet.deleteOne({ _id: finalizedSheet._id });
    if (unfinalizedSheet) await AnswerSheet.deleteOne({ _id: unfinalizedSheet._id });
    if (evalDoc) await Evaluation.deleteOne({ _id: evalDoc._id });
    if (examDoc) await Exam.deleteOne({ _id: examDoc._id });
    if (answerKeyDoc) await AnswerKey.deleteOne({ _id: answerKeyDoc._id });
    await HistoricalEvaluation.deleteMany({ academicYear: "2025-26", "subject.name": "Data Structures & Algorithms" });

    await mongoose.disconnect();
    console.log(`Disconnected from MongoDB.`);

    console.log(`\n${colors.cyan}${colors.bold}=== Test Suite Summary ===${colors.reset}`);
    console.log(`Total Tests: ${testCount}`);
    console.log(`Passed: ${colors.green}${passCount}${colors.reset}`);
    console.log(`Failed: ${testCount - passCount > 0 ? colors.red : colors.green}${testCount - passCount}${colors.reset}\n`);

    if (passCount === testCount) {
      console.log(`${colors.green}${colors.bold}ALL 10 PHASE 3F TEST CASES PASSED SUCCESSFULLY!${colors.reset}\n`);
      process.exit(0);
    } else {
      console.error(`${colors.red}${colors.bold}SOME TESTS FAILED!${colors.reset}\n`);
      process.exit(1);
    }
  }
}

runPhase3FTests();
