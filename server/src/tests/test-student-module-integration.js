import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import studentController from "../controllers/student.controller.js";

const makeMockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

// Helper to await asyncHandler controller methods
async function callController(controllerMethod, req, res) {
  return new Promise((resolve) => {
    const next = (err) => {
      if (err) {
        res.status(err.statusCode || 500).json({ success: false, message: err.message });
        resolve();
      } else {
        resolve();
      }
    };

    const originalJson = res.json;
    res.json = (data) => {
      const ret = originalJson ? originalJson(data) : res;
      resolve();
      return ret;
    };

    Promise.resolve(controllerMethod(req, res, next)).catch((err) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message });
      resolve();
    });
  });
}

async function runTests() {
  console.log("==================================================================");
  console.log("RUNNING STUDENT MODULE 12-SCENARIO E2E INTEGRATION & SECURITY TESTS");
  console.log("==================================================================");

  console.log("Connecting database: " + env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let studentA = null;
  let studentB = null;
  let facultyA = null;
  let deptA = null;
  let deptB = null;
  let courseA = null;
  let courseB = null;
  let subject1 = null;
  let subject2 = null;
  let exam1 = null;
  let exam2 = null;
  let attemptId = null;

  try {
    // 0. Cleanup any stale test data (idempotency)
    await User.deleteMany({ email: { $in: ["studenta.test@example.com", "studentb.test@example.com", "faculty.p7@example.com"] } });
    await Subject.deleteMany({ code: { $in: ["CS-101-TEST", "IT-201-TEST"] } });
    await Course.deleteMany({ code: { $in: ["BT-CE-TEST", "BT-IT-TEST"] } });
    await Department.deleteMany({ code: { $in: ["CE-TEST", "IT-TEST"] } });

    // Seed Faculty
    facultyA = await User.create({
      name: "Test Faculty P7",
      email: "faculty.p7@example.com",
      password: "password123",
      role: "faculty",
    });

    // 1. Seed Students
    studentA = await User.create({
      name: "Student A (Semester 5)",
      email: "studenta.test@example.com",
      password: "password123",
      role: "student",
      studentId: "STUDA" + Date.now(),
      rollNo: "ROLLA" + Date.now(),
      department: "Computer Engineering",
      semester: 5,
    });

    studentB = await User.create({
      name: "Student B (Semester 3)",
      email: "studentb.test@example.com",
      password: "password123",
      role: "student",
      studentId: "STUDB" + Date.now(),
      rollNo: "ROLLB" + Date.now(),
      department: "Information Technology",
      semester: 3,
    });

    // Seed Departments
    deptA = await Department.create({
      name: "Computer Engineering",
      code: "CE-TEST",
    });

    deptB = await Department.create({
      name: "Information Technology",
      code: "IT-TEST",
    });

    // Seed Courses
    courseA = await Course.create({
      name: "B.Tech Computer Engineering",
      code: "BT-CE-TEST",
      durationYears: 4,
      totalSemesters: 8,
      department: deptA._id,
    });

    courseB = await Course.create({
      name: "B.Tech Information Technology",
      code: "BT-IT-TEST",
      durationYears: 4,
      totalSemesters: 8,
      department: deptB._id,
    });

    // 2. Seed Subjects
    subject1 = await Subject.create({
      name: "Data Structures Test",
      code: "CS-101-TEST",
      semester: 5,
      department: "Computer Engineering",
      course: courseA._id,
      credits: 4,
      isActive: true,
      faculty: facultyA._id,
    });

    subject2 = await Subject.create({
      name: "Web Systems Test",
      code: "IT-201-TEST",
      semester: 3,
      department: "Information Technology",
      course: courseB._id,
      credits: 4,
      isActive: true,
      faculty: facultyA._id,
    });

    // 3. Seed Exams
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    exam1 = await Exam.create({
      title: "CS101 Mid-term Exam",
      subject: subject1._id,
      examDate: now,
      examType: "Theory",
      totalMarks: 50,
      duration: 60,
      startTime: oneHourAgo,
      endTime: oneHourLater,
      examStatus: "Active",
      isPublished: true,
      questions: [
        {
          questionNumber: 1,
          questionText: "What is a Binary Search Tree?",
          maximumMarks: 10,
          expectedConcept: "Binary search tree search property and Node structure",
        }
      ]
    });

    exam2 = await Exam.create({
      title: "IT201 Final Exam",
      subject: subject2._id,
      examDate: now,
      examType: "Theory",
      totalMarks: 100,
      duration: 120,
      startTime: oneHourAgo,
      endTime: oneHourLater,
      examStatus: "Active",
      isPublished: true,
      questions: [
        {
          questionNumber: 1,
          questionText: "Explain client-server network architecture.",
          maximumMarks: 15,
          expectedConcept: "Client node and Server node requests",
        }
      ]
    });

    console.log("Seed data ready.\n");

    // --- Scenario 1: Retrieve Eligible Exams for Student A ---
    console.log("Scenario 1: Retrieve Eligible Exams for Student A (Semester 5)");
    const req1 = { user: studentA, query: {} };
    const res1 = makeMockResponse();
    await callController(studentController.getStudentExams, req1, res1);

    if (res1.statusCode !== 200 || !res1.body.success) {
      throw new Error(`Scenario 1 Failed! Status: ${res1.statusCode}`);
    }
    const eligibleExams = res1.body.data || [];
    console.log("Eligible Exams returned in response:", JSON.stringify(eligibleExams, null, 2));
    const hasExam1 = eligibleExams.some(e => e.id.toString() === exam1._id.toString());
    const hasExam2 = eligibleExams.some(e => e.id.toString() === exam2._id.toString());

    if (!hasExam1 || hasExam2) {
      throw new Error("Scenario 1 Failed: Semester 5 Student should see CS-101 but NOT IT-201.");
    }
    console.log("✔ Scenario 1 Passed!\n");


    // --- Scenario 2: Check Exam 1 Eligibility for Student A (Eligible) ---
    console.log("Scenario 2: Check Exam 1 Eligibility for Student A (Expects True)");
    const req2 = { user: studentA, params: { examId: exam1._id } };
    const res2 = makeMockResponse();
    await callController(studentController.getStudentExamEligibility, req2, res2);

    if (res2.statusCode !== 200 || !res2.body.data.eligible) {
      throw new Error("Scenario 2 Failed! Eligible flag is false.");
    }
    console.log("✔ Scenario 2 Passed!\n");


    // --- Scenario 3: Check Exam 2 Eligibility for Student A (Ineligible) ---
    console.log("Scenario 3: Check Exam 2 Eligibility for Student A (Expects eligible = false)");
    const req3 = { user: studentA, params: { examId: exam2._id } };
    const res3 = makeMockResponse();
    await callController(studentController.getStudentExamEligibility, req3, res3);

    if (res3.statusCode !== 200 || res3.body.data.eligible !== false) {
      throw new Error(`Scenario 3 Failed! Expected eligible false but got status ${res3.statusCode} / eligible ${res3.body.data.eligible}`);
    }
    console.log("✔ Scenario 3 Passed!\n");


    // --- Scenario 4: Get Exam 1 Workspace for Student A (Allowed) ---
    console.log("Scenario 4: Get Workspace for Exam 1 for Student A");
    const req4 = { user: studentA, params: { examId: exam1._id } };
    const res4 = makeMockResponse();
    await callController(studentController.getStudentExamWorkspace, req4, res4);

    if (res4.statusCode !== 200 || !res4.body.data.exam) {
      throw new Error("Scenario 4 Failed! Workspace payload load error.");
    }
    console.log("✔ Scenario 4 Passed!\n");


    // --- Scenario 5: Access Exam 2 Workspace for Student A (IDOR Blocked) ---
    console.log("Scenario 5: Access Workspace for Exam 2 for Student A (Expects 403)");
    const req5 = { user: studentA, params: { examId: exam2._id } };
    const res5 = makeMockResponse();
    await callController(studentController.getStudentExamWorkspace, req5, res5);

    if (res5.statusCode !== 403) {
      throw new Error(`Scenario 5 Failed! Expected forbidden 403 but got ${res5.statusCode}`);
    }
    console.log("✔ Scenario 5 Passed!\n");


    // --- Scenario 6: Start Student exam attempt ---
    console.log("Scenario 6: Start/Resume Exam 1 for Student A");
    const req6 = { user: studentA, params: { examId: exam1._id } };
    const res6 = makeMockResponse();
    await callController(studentController.startStudentExam, req6, res6);

    if (res6.statusCode !== 200 || !res6.body.data.id) {
      throw new Error(`Scenario 6 Failed! Status: ${res6.statusCode}`);
    }
    attemptId = res6.body.data.id;
    console.log(`✔ Scenario 6 Passed! Attempt ID: ${attemptId}\n`);


    // --- Scenario 7: Autosave answers for Question 1 ---
    console.log("Scenario 7: Autosave writing strokes for Student A");
    const questionId = exam1.questions[0]._id;
    const req7 = {
      user: studentA,
      params: { examId: exam1._id },
      body: {
        questionId: questionId.toString(),
        handwrittenData: JSON.stringify({ strokes: [{ points: [{ x: 10, y: 15 }] }] })
      }
    };
    const res7 = makeMockResponse();
    await callController(studentController.autosaveStudentExamAnswer, req7, res7);

    if (res7.statusCode !== 200 || !res7.body.success) {
      throw new Error(`Scenario 7 Failed! Status: ${res7.statusCode}`);
    }
    
    // Check in database
    const checkSheet = await AnswerSheet.findById(attemptId);
    if (!checkSheet || checkSheet.answers.length === 0 || !checkSheet.answers[0].handwrittenData) {
      throw new Error("Scenario 7 Failed: Answers did not save to database.");
    }
    console.log("✔ Scenario 7 Passed!\n");


    // --- Scenario 8: IDOR Check - Student B tries to write to Student A's Exam Workspace ---
    console.log("Scenario 8: Student B attempts to write to Student A's Exam 1 Workspace (Expects 403)");
    const req8 = {
      user: studentB,
      params: { examId: exam1._id },
      body: {
        questionId: questionId.toString(),
        handwrittenData: JSON.stringify({ strokes: [{ points: [{ x: 200, y: 250 }] }] })
      }
    };
    const res8 = makeMockResponse();
    await callController(studentController.autosaveStudentExamAnswer, req8, res8);

    if (res8.statusCode !== 403) {
      throw new Error(`Scenario 8 Failed! Expected 403 but got ${res8.statusCode}`);
    }
    console.log("✔ Scenario 8 Passed!\n");


    // --- Scenario 9: Final Exam Submit by Student A ---
    console.log("Scenario 9: Final Submission of Exam 1 for Student A");
    const req9 = { user: studentA, params: { examId: exam1._id } };
    const res9 = makeMockResponse();
    await callController(studentController.submitStudentExam, req9, res9);

    if (res9.statusCode !== 200 || !res9.body.success) {
      throw new Error(`Scenario 9 Failed! Status: ${res9.statusCode}`);
    }
    
    const dbSub = await AnswerSheet.findById(attemptId);
    if (dbSub.submissionStatus !== "Submitted") {
      throw new Error(`Scenario 9 Failed: Answer sheet submissionStatus is '${dbSub.submissionStatus}', expected 'Submitted'`);
    }
    console.log("✔ Scenario 9 Passed!\n");


    // --- Scenario 10: Verify Lock - Reject Autosave post Submit ---
    console.log("Scenario 10: Attempt to Autosave after Final Submission (Expects 403)");
    const req10 = {
      user: studentA,
      params: { examId: exam1._id },
      body: {
        questionId: questionId.toString(),
        handwrittenData: JSON.stringify({ strokes: [] })
      }
    };
    const res10 = makeMockResponse();
    await callController(studentController.autosaveStudentExamAnswer, req10, res10);

    if (res10.statusCode !== 403) {
      throw new Error(`Scenario 10 Failed! Post-submission autosave should return 403 but got ${res10.statusCode}`);
    }
    console.log("✔ Scenario 10 Passed!\n");


    // --- Scenario 11: Fetch Published Results ---
    console.log("Scenario 11: Seed and retrieve published evaluation result for Student A");
    // Seed evaluation in DB
    let seededEval = await Evaluation.create({
      answerSheet: attemptId,
      evaluationType: "AI",
      obtainedMarks: 8,
      totalMarks: 10,
      percentage: 80,
      grade: "A",
      evaluationStatus: "PUBLISHED",
      questions: [
        {
          questionId: questionId,
          recognizedText: "Binary Search Tree properties",
          maxMarks: 10,
          aiAwardedMarks: 8,
          finalAwardedMarks: 8,
        }
      ]
    });

    const req11 = { user: studentA };
    const res11 = makeMockResponse();
    await callController(studentController.getStudentResults, req11, res11);

    if (res11.statusCode !== 200) {
      throw new Error(`Scenario 11 Failed to retrieve results list. Status: ${res11.statusCode}`);
    }
    const studentResults = res11.body.data || [];
    if (studentResults.length === 0 || studentResults[0].finalScore !== 8) {
      throw new Error("Scenario 11 Failed: Score or result not matching seeded evaluation.");
    }
    console.log("✔ Scenario 11 Passed!\n");


    // --- Scenario 12: IDOR Check - Student B tries to fetch Student A's Exam Result ---
    console.log("Scenario 12: Student B attempts to query Student A's Exam Result Details (Expects 403)");
    const req12 = { user: studentB, params: { examId: exam1._id } };
    const res12 = makeMockResponse();
    await callController(studentController.getStudentExamResult, req12, res12);

    if (res12.statusCode !== 403 && res12.statusCode !== 404) {
      throw new Error(`Scenario 12 Failed! Expected 403/404 for IDOR scan check, but got ${res12.statusCode}`);
    }
    console.log("✔ Scenario 12 Passed!\n");


    // --- Scenario 13: Student Re-evaluation Request ---
    console.log("Scenario 13: Student A requests manual review/re-evaluation on their published evaluation");
    const req13 = { user: studentA, params: { evaluationId: seededEval._id } };
    const res13 = makeMockResponse();
    await callController(studentController.requestStudentReevaluation, req13, res13);

    if (res13.statusCode !== 200 || !res13.body.success) {
      throw new Error(`Scenario 13 Failed! Status: ${res13.statusCode}, message: ${res13.body.message}`);
    }
    // Verify status was updated to FACULTY_REVIEW
    const updatedEval = await Evaluation.findById(seededEval._id);
    if (!updatedEval || updatedEval.evaluationStatus !== "FACULTY_REVIEW") {
      throw new Error(`Scenario 13 Failed: evaluationStatus is '${updatedEval?.evaluationStatus}', expected 'FACULTY_REVIEW'`);
    }
    console.log("✔ Scenario 13 Passed!\n");


    // --- Scenario 14: IDOR Check - Student B attempts to request Re-evaluation of Student A's result ---
    console.log("Scenario 14: Student B attempts to request manual review on Student A's evaluation (Expects 403)");
    const req14 = { user: studentB, params: { evaluationId: seededEval._id } };
    const res14 = makeMockResponse();
    await callController(studentController.requestStudentReevaluation, req14, res14);

    if (res14.statusCode !== 403) {
      throw new Error(`Scenario 14 Failed! Expected status 403 but got ${res14.statusCode}`);
    }
    console.log("✔ Scenario 14 Passed!\n");


    console.log("==================================================================");
    console.log("ALL 14 SCENARIOS IN INTEGRATION TEST PASSED SUCCESSFULLY!");
    console.log("==================================================================");

  } catch (err) {
    console.error("\nTEST RUN ERROR: Something failed!", err);
    process.exit(1);
  } finally {
    // Cleanup seeded records
    if (studentA) await User.deleteOne({ _id: studentA._id });
    if (studentB) await User.deleteOne({ _id: studentB._id });
    if (facultyA) await User.deleteOne({ _id: facultyA._id });
    if (subject1) await Subject.deleteOne({ _id: subject1._id });
    if (subject2) await Subject.deleteOne({ _id: subject2._id });
    if (courseA) await Course.deleteOne({ _id: courseA._id });
    if (courseB) await Course.deleteOne({ _id: courseB._id });
    if (deptA) await Department.deleteOne({ _id: deptA._id });
    if (deptB) await Department.deleteOne({ _id: deptB._id });
    if (exam1) {
      await AnswerSheet.deleteMany({ exam: exam1._id });
      await Exam.deleteOne({ _id: exam1._id });
    }
    if (exam2) {
      await AnswerSheet.deleteMany({ exam: exam2._id });
      await Exam.deleteOne({ _id: exam2._id });
    }
    if (attemptId) {
      await Evaluation.deleteMany({ answerSheet: attemptId });
    }
    await mongoose.connection.close();
    console.log("Database connection closed cleanly.");
  }
}

runTests();
