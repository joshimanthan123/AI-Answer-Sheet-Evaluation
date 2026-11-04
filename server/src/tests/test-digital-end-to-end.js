import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import AnswerKey from "../models/AnswerKey.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import { submitStudentExam } from "../services/studentExam.service.js";

async function runTest() {
  console.log("Starting Digital End-to-End System Integration Test...");
  await mongoose.connect(env.MONGODB_URI);

  let faculty = null;
  let student = null;
  let testDept = null;
  let testCourse = null;
  let testSubject = null;
  let testExam = null;
  let testAnswerKey = null;
  let testAnswerSheet = null;

  try {
    // 1. Create Faculty
    faculty = await User.create({
      name: "Faculty Owner " + Date.now(),
      email: "fac.digital." + Date.now() + "@example.com",
      password: "password123",
      role: "faculty",
      lecturerId: "LEC-DIGITAL-" + Date.now(),
      status: "online"
    });
    console.log("✓ Faculty created");

    // 2. Create Department
    testDept = await Department.create({
      name: "Digital Dept " + Date.now(),
      code: "DIG" + Math.floor(Math.random() * 1000),
      createdBy: faculty._id
    });

    // 3. Create Student
    student = await User.create({
      name: "Student Candidate " + Date.now(),
      email: "stu.digital." + Date.now() + "@example.com",
      password: "password123",
      role: "student",
      rollNo: "ROLL-DIGITAL-" + Date.now(),
      status: "online",
      semester: 3,
      department: testDept._id.toString()
    });
    console.log("✓ Student created and authorized");

    // 4. Create Course
    testCourse = await Course.create({
      name: "B.Tech Digital Course " + Date.now(),
      code: "BTC" + Math.floor(Math.random() * 1000),
      durationYears: 4,
      totalSemesters: 8,
      department: testDept._id,
      createdBy: faculty._id
    });

    testSubject = await Subject.create({
      name: "Web Systems " + Date.now(),
      code: "WBS" + Math.floor(Math.random() * 1000),
      credits: 4,
      semester: 3,
      isActive: true,
      course: testCourse._id,
      faculty: faculty._id,
      createdBy: faculty._id
    });

    // 4. Create Exam
    testExam = await Exam.create({
      subject: testSubject._id,
      title: "Mid-Term Web Systems " + Date.now(),
      examType: "Mid-Sem",
      totalMarks: 20,
      passingMarks: 8,
      duration: 120,
      examDate: new Date(),
      examStatus: "Published",
      isPublished: true,
      questions: [
        {
          questionNumber: 1,
          questionText: "What is AI?",
          maximumMarks: 10,
          expectedAnswerLength: "medium"
        },
        {
          questionNumber: 2,
          questionText: "Define Machine Learning.",
          maximumMarks: 10,
          expectedAnswerLength: "medium"
        }
      ],
      createdBy: faculty._id
    });
    console.log("✓ Exam configured");

    // Create approved AnswerKey to match Mock HWR Provider output
    testAnswerKey = await AnswerKey.create({
      examId: testExam._id,
      isActive: true,
      uploadStatus: "Approved",
      parsedAnswers: [
        {
          questionNumber: 1,
          questionId: testExam.questions[0]._id,
          answerText: "Artificial Intelligence is the simulation of human intelligence.",
          keywords: ["intelligence", "simulation"]
        },
        {
          questionNumber: 2,
          questionId: testExam.questions[1]._id,
          answerText: "Machine Learning is a subset of AI.",
          keywords: ["subset", "learning"]
        }
      ],
      uploadedBy: faculty._id,
      fileName: "web-key.pdf",
      fileUrl: "http://localhost:5000/uploads/web-key.pdf",
      createdBy: faculty._id,
      updatedBy: faculty._id
    });
    console.log("✓ AnswerKey approved");

    // 5. Create Student Answer Sheet in Started mode
    // Simulate digital stroke data
    const mockStrokesQ1 = {
      strokes: [
        {
          points: [{ x: 10, y: 15 }, { x: 50, y: 55 }],
          color: "#0000FF",
          width: 3
        }
      ]
    };
    const mockStrokesQ2 = {
      strokes: [
        {
          points: [{ x: 100, y: 110 }, { x: 150, y: 180 }],
          color: "#0000FF",
          width: 3
        }
      ]
    };

    testAnswerSheet = await AnswerSheet.create({
      student: student._id,
      exam: testExam._id,
      subject: testSubject._id,
      submissionStatus: "Started",
      submissionType: "DIGITAL",
      evaluationStatus: "READY_FOR_EVALUATION",
      reviewStatus: "NOT_READY",
      answers: [
        {
          questionId: testExam.questions[0]._id,
          handwrittenData: JSON.stringify(mockStrokesQ1),
          submissionTime: new Date()
        },
        {
          questionId: testExam.questions[1]._id,
          handwrittenData: JSON.stringify(mockStrokesQ2),
          submissionTime: new Date()
        }
      ],
      resultPublication: {
        status: "NOT_READY"
      }
    });
    console.log("✓ Started AnswerSheet created with digital canvas strokes");

    // 6. Submit student exam using real submitStudentExam method
    console.log("Submitting student exam...");
    const submitResult = await submitStudentExam(student._id, testExam._id);
    console.log("✓ Exam submission API call finished. Submission ID:", submitResult.submissionId);

    // 7. Poll and verify HWR execution and then AI Evaluation
    console.log("Polling database to verify background digital HWR and AI Evaluation...");
    let sheet = null;
    let attempts = 0;
    while (attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 500));
      sheet = await AnswerSheet.findById(testAnswerSheet._id);
      if (!sheet) continue;
      
      console.log(`- Attempt ${attempts}: processingStatus = ${sheet.processingStatus}, ocrStatus = ${sheet.ocrStatus}, evaluationStatus = ${sheet.evaluationStatus}`);
      
      if (sheet.evaluationStatus === "READY_FOR_FACULTY_REVIEW") {
        break;
      }
      if (sheet.processingStatus === "failed" || sheet.evaluationStatus === "EVALUATION_FAILED") {
        throw new Error(`Pipeline failed! processingStatus: ${sheet.processingStatus}, errorMessage: ${sheet.errorMessage}, evaluationStatus: ${sheet.evaluationStatus}, evaluationError: ${sheet.evaluationError}`);
      }
      attempts++;
    }

    if (sheet.evaluationStatus !== "READY_FOR_FACULTY_REVIEW") {
      throw new Error(`Pipeline timed out! Final status was: ${sheet.evaluationStatus}`);
    }

    console.log("✓ Live HWR/OCR pipeline complete!");
    console.log("✓ Live AI Evaluation automatically triggered and complete!");

    // Verify recognizedText matches corresponding page mock output
    const ans1 = sheet.answers.find(a => a.questionId.toString() === testExam.questions[0]._id.toString());
    const ans2 = sheet.answers.find(a => a.questionId.toString() === testExam.questions[1]._id.toString());

    console.log("Transcribed Text Q1:", JSON.stringify(ans1.recognizedText));
    console.log("Transcribed Text Q2:", JSON.stringify(ans2.recognizedText));

    if (!ans1.recognizedText || !ans1.recognizedText.includes("Artificial Intelligence")) {
      throw new Error("Recognized text for Q1 is missing or incorrect!");
    }
    if (!ans2.recognizedText || !ans2.recognizedText.includes("Machine Learning")) {
      throw new Error("Recognized text for Q2 is missing or incorrect!");
    }
    console.log("✓ Transcribed handwriting outputs verified successfully!");

    // Verify Evaluation marks and details
    const finalEvaluation = await Evaluation.findOne({ answerSheet: testAnswerSheet._id, isDeleted: false });
    if (!finalEvaluation) {
      throw new Error("Evaluation record not found!");
    }
    console.log("AI Awarded Marks:", finalEvaluation.obtainedMarks, "/", finalEvaluation.totalMarks);
    console.log("AI Evaluation Status:", finalEvaluation.evaluationStatus);

    console.log("\n🎉 AUTOMATED DIGITAL HWR & EVALUATION END-TO-END TEST PASSED!");

  } catch (err) {
    console.error("❌ Test failed with error: " + err.stack);
    process.exit(1);
  } finally {
    // Cleanup temporary documents
    if (testAnswerSheet) await AnswerSheet.deleteOne({ _id: testAnswerSheet._id });
    if (testAnswerKey) await AnswerKey.deleteOne({ _id: testAnswerKey._id });
    if (testExam) await Exam.deleteOne({ _id: testExam._id });
    if (testSubject) await Subject.deleteOne({ _id: testSubject._id });
    if (testCourse) await Course.deleteOne({ _id: testCourse._id });
    if (testDept) await Department.deleteOne({ _id: testDept._id });
    if (student) await User.deleteOne({ _id: student._id });
    if (faculty) await User.deleteOne({ _id: faculty._id });
    await mongoose.connection.close();
  }
}

runTest();
