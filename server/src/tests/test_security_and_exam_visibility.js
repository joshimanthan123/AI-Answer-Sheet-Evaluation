import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import answerSheetService from "../services/answerSheet.service.js";
import studentExamService from "../services/studentExam.service.js";
import evaluationService from "../services/evaluation.service.js";
import { ROLES } from "../constants/roles.js";

async function runSecurityTest() {
  console.log("=================================================");
  console.log("  SECURITY & EXAM VISIBILITY E2E VERIFICATION   ");
  console.log("=================================================");
  console.log("Connecting database: " + env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let faculty = null;
  let studentA = null;
  let studentB = null;
  let dept = null;
  let course = null;
  let subject = null;
  let exam = null;
  let sheetA = null;
  let evaluationA = null;

  try {
    // 1. Setup Faculty user
    faculty = await User.create({
      name: "Prof. Security Tester",
      email: `faculty.sec.${Date.now()}@example.com`,
      password: "password123",
      role: ROLES.FACULTY,
    });

    // 2. Setup Department, Course, Subject
    dept = await Department.create({
      name: "Computer Engineering " + Date.now(),
      code: "CE" + Math.floor(Math.random() * 1000),
      createdBy: faculty._id,
    });

    studentA = await User.create({
      name: "Student A (Owner)",
      email: `studentA.${Date.now()}@example.com`,
      password: "password123",
      role: ROLES.STUDENT,
      semester: 5,
      department: dept.code,
    });

    studentB = await User.create({
      name: "Student B (Attacker / Isolation Test)",
      email: `studentB.${Date.now()}@example.com`,
      password: "password123",
      role: ROLES.STUDENT,
      semester: 5,
      department: dept.code,
    });
    console.log("✓ Created Faculty, Department, Student A, and Student B users.");

    course = await Course.create({
      name: "B.Tech CE " + Date.now(),
      code: "BTCE" + Math.floor(Math.random() * 1000),
      durationYears: 4,
      totalSemesters: 8,
      department: dept._id,
      createdBy: faculty._id,
    });

    subject = await Subject.create({
      name: "Software Security & System Architecture",
      code: "CE501",
      credits: 4,
      semester: 5,
      course: course._id,
      faculty: faculty._id,
      createdBy: faculty._id,
    });
    console.log("✓ Created Subject CE501 (Semester 5).");

    // 3. Setup Faculty-Created Exam
    const now = new Date();
    const startTime = new Date(now.getTime() - 10 * 60 * 1000); // started 10 mins ago
    const endTime = new Date(now.getTime() + 50 * 60 * 1000); // ends in 50 mins
    try {
      exam = await Exam.create({
        title: "Mid-Term Security Audit Examination",
        examCode: `SEC-${Date.now()}`,
        subject: subject._id,
        examType: "Mid-Term",
        examDate: startTime,
        startTime: startTime,
        endTime: endTime,
        duration: 60,
        totalMarks: 100,
        isPublished: true,
        examStatus: "Active",
        createdBy: faculty._id,
        questions: [
          { questionNumber: 1, questionText: "Explain IDOR vulnerabilities and mitigation strategies.", maximumMarks: 50 },
          { questionNumber: 2, questionText: "Describe role-based data isolation in REST APIs.", maximumMarks: 50 },
        ],
      });
      console.log("✓ Created Active Exam: Mid-Term Security Audit Examination.");
    } catch (err) {
      console.error("FAILED Exam.create:", err.errors || err);
      throw err;
    }

    // 4. Student A submits answer sheet
    try {
      sheetA = await AnswerSheet.create({
        student: studentA._id,
        subject: subject._id,
        exam: exam._id,
        submissionStatus: "Submitted",
        uploadStatus: "Published",
        uploadedFileUrl: "/uploads/answer-sheets/studentA_secret_paper.pdf",
        extractedText: "Q1: IDOR stands for Insecure Direct Object References...\nQ2: Role based data isolation enforces req.user.id...",
        digital_answers: [
          { question_number: "1", text: "IDOR stands for Insecure Direct Object References...", confidence: 0.98 },
          { question_number: "2", text: "Role based data isolation enforces req.user.id...", confidence: 0.97 },
        ],
        answers: [
          { questionId: exam.questions[0]._id, handwrittenData: "Q1 answer", recognizedText: "IDOR stands for Insecure Direct Object References..." },
          { questionId: exam.questions[1]._id, handwrittenData: "Q2 answer", recognizedText: "Role based data isolation enforces req.user.id..." },
        ],
        createdBy: studentA._id,
      });
      console.log("✓ Student A created answer sheet.");
    } catch (err) {
      console.error("FAILED AnswerSheet.create:", err.errors || err);
      throw err;
    }

    try {
      evaluationA = await Evaluation.create({
        answerSheet: sheetA._id,
        evaluatedBy: faculty._id,
        evaluationType: "Faculty",
        obtainedMarks: 95,
        totalMarks: 100,
        percentage: 95,
        evaluationStatus: "PUBLISHED",
        createdBy: faculty._id,
      });
      console.log("✓ Student A evaluation was generated.");
    } catch (err) {
      console.error("FAILED Evaluation.create:", err.errors || err);
      throw err;
    }

    console.log("\n=================================================");
    console.log("  PART 1: IDOR & DATA ISOLATION TEST SUITE      ");
    console.log("=================================================");

    // Test 1.1: Student A views own answer sheet -> Success
    const sheetAForStudentA = await answerSheetService.getAnswerSheetById(sheetA._id, studentA._id, ROLES.STUDENT);
    if (!sheetAForStudentA || sheetAForStudentA._id.toString() !== sheetA._id.toString()) {
      throw new Error("Student A could not access their own answer sheet!");
    }
    console.log("✓ Test 1.1 Passed: Student A successfully retrieved their own answer sheet.");

    // Test 1.2: Student B attempts to access Student A's answer sheet -> FORBIDDEN
    let test12Blocked = false;
    try {
      await answerSheetService.getAnswerSheetById(sheetA._id, studentB._id, ROLES.STUDENT);
    } catch (err) {
      if (err.statusCode === 403) {
        test12Blocked = true;
      } else {
        console.error("Test 1.2 unexpected status:", err);
      }
    }
    if (!test12Blocked) {
      throw new Error("SECURITY FAILURE: Student B was able to view Student A's answer sheet!");
    }
    console.log("✓ Test 1.2 Passed: Student B BLOCKED (HTTP 403 Forbidden) from viewing Student A's answer sheet.");

    // Test 1.3: Student B attempts to access Student A's digital OCR text -> FORBIDDEN
    let test13Blocked = false;
    try {
      await answerSheetService.getDigitalAnswers(sheetA._id, studentB._id, ROLES.STUDENT);
    } catch (err) {
      if (err.statusCode === 403 || err.status === 403 || (err.message && err.message.includes("Access denied"))) {
        test13Blocked = true;
      } else {
        console.error("Test 1.3 caught unexpected err:", err);
      }
    }
    if (!test13Blocked) {
      throw new Error("SECURITY FAILURE: Student B was able to view Student A's digital OCR answers!");
    }
    console.log("✓ Test 1.3 Passed: Student B BLOCKED (HTTP 403 Forbidden) from viewing Student A's digital OCR answers.");

    // Test 1.4: Student B queries getAllAnswerSheets with ?student=StudentA_ID -> Forces Student B filter
    const studentBList = await answerSheetService.getAllAnswerSheets({ student: studentA._id }, studentB._id, ROLES.STUDENT);
    if (studentBList.data.length > 0) {
      const containsSheetA = studentBList.data.some(s => s._id.toString() === sheetA._id.toString());
      if (containsSheetA) {
        throw new Error("SECURITY FAILURE: Student B queried Student A's ID and received Student A's answer sheet!");
      }
    }
    console.log("✓ Test 1.4 Passed: getAllAnswerSheets enforced studentB._id parameter query override.");

    console.log("\n=================================================");
    console.log("  PART 2: EXAM VISIBILITY & CATEGORIZATION TEST  ");
    console.log("=================================================");

    // Test 2.1: Student B checks exam portal -> Exam is VISIBLE
    const studentBExams = await studentExamService.getStudentExams(studentB._id, { limit: 100 });
    const visibleExam = studentBExams.exams.find(e => e.id.toString() === exam._id.toString());
    if (!visibleExam) {
      throw new Error("VISIBILITY FAILURE: Faculty created active exam is NOT visible to Student B!");
    }
    console.log("✓ Test 2.1 Passed: Faculty-created exam is visible to eligible Student B.");

    // Test 2.2: Student B submission status is 'not_started' and canEnter is true
    if (visibleExam.submissionStatus !== "not_started") {
      throw new Error(`ISOLATION FAILURE: Student B inherited Student A's submission status '${visibleExam.submissionStatus}'!`);
    }
    if (visibleExam.canEnter !== true) {
      throw new Error("Student B should be able to enter live active exam!");
    }
    console.log("✓ Test 2.2 Passed: Student B has clean 'not_started' submission state, isolated from Student A.");

    // Test 2.3: Student A checks exam portal -> submissionStatus is 'submitted'
    const studentAExams = await studentExamService.getStudentExams(studentA._id, { limit: 100 });
    const studentAExamObj = studentAExams.exams.find(e => e.id.toString() === exam._id.toString());
    if (!studentAExamObj || studentAExamObj.submissionStatus !== "submitted") {
      throw new Error(`Student A exam submission status expected 'submitted', got '${studentAExamObj?.submissionStatus}'`);
    }
    console.log("✓ Test 2.3 Passed: Student A exam portal correctly shows submission status 'submitted'.");

    // Test 2.4: Category Tab Filtering for Student B
    const activeTabResult = await studentExamService.getStudentExams(studentB._id, { status: "active" });
    const hasActiveExam = activeTabResult.exams.some(e => e.id.toString() === exam._id.toString());
    if (!hasActiveExam) {
      throw new Error("Category filter 'active' failed to return live exam for Student B!");
    }
    console.log("✓ Test 2.4 Passed: Category tab 'active' correctly includes the live exam.");

    console.log("\n=================================================");
    console.log(" 🎉 ALL SECURITY & EXAM VISIBILITY TESTS PASSED!");
    console.log("=================================================");
  } catch (err) {
    console.error("\n❌ TEST FAILURE STACK TRACE:\n", err.stack || err);
    process.exitCode = 1;
  } finally {
    console.log("\nCleaning up test artifacts...");
    if (evaluationA) await Evaluation.findByIdAndDelete(evaluationA._id);
    if (sheetA) await AnswerSheet.findByIdAndDelete(sheetA._id);
    if (exam) await Exam.findByIdAndDelete(exam._id);
    if (subject) await Subject.findByIdAndDelete(subject._id);
    if (course) await Course.findByIdAndDelete(course._id);
    if (dept) await Department.findByIdAndDelete(dept._id);
    if (studentB) await User.findByIdAndDelete(studentB._id);
    if (studentA) await User.findByIdAndDelete(studentA._id);
    if (faculty) await User.findByIdAndDelete(faculty._id);

    await mongoose.disconnect();
    console.log("Disconnected from database.");
  }
}

runSecurityTest();
