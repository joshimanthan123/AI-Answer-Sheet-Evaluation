import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import studentExamService from "../services/studentExam.service.js";

async function runTest() {
  console.log("Starting Student My Exams & Eligibility Service Integration Tests...");
  console.log("Connecting database: " + env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let facultyUser = null;
  let studentUser = null;
  let unauthorizedStudent = null;
  let tempDept = null;
  let tempCourse = null;
  let tempSubject = null;
  let unauthorizedSubject = null;

  let upcomingExam = null;
  let activeExam = null;
  let inProgressExam = null;
  let submittedExam = null;
  let publishedExam = null;
  let expiredExam = null;
  let unauthorizedExam = null;

  let inProgressSheet = null;
  let submittedSheet = null;
  let publishedSheet = null;
  let publishedEvaluation = null;

  try {
    // Setup Users
    facultyUser = await User.create({
      name: "Exams Test Faculty Member",
      email: "exams.faculty@example.com",
      password: "password123",
      role: "faculty",
      lecturerId: "LECEXAM" + Date.now(),
    });
    
    // Eligible Student: Semester 4, Computer Engineering (dept code CE)
    studentUser = await User.create({
      name: "Exams Test Student Member",
      email: "exams.student@example.com",
      password: "password123",
      role: "student",
      studentId: "STUDEXAM" + Date.now(),
      semester: 4,
      department: "CE",
    });

    // Ineligible Student (Semester 1)
    unauthorizedStudent = await User.create({
      name: "Exams Test Unauthorized Student",
      email: "exams.unauth@example.com",
      password: "password123",
      role: "student",
      studentId: "STUDUNAUTH" + Date.now(),
      semester: 1,
      department: "EC",
    });
    console.log("✓ Created mock faculty and student users.");

    // Setup Department, Course and Subject
    tempDept = await Department.create({
      name: "Computer Engineering Department",
      code: "CE",
      createdBy: facultyUser._id,
    });

    tempCourse = await Course.create({
      name: "B.Tech Computer Engineering " + Date.now(),
      code: "BTCE",
      durationYears: 4,
      totalSemesters: 8,
      department: tempDept._id,
      createdBy: facultyUser._id,
    });

    tempSubject = await Subject.create({
      name: "Database Management Systems",
      code: "CS401",
      credits: 4,
      semester: 4,
      isActive: true,
      course: tempCourse._id,
      faculty: facultyUser._id,
      createdBy: facultyUser._id,
    });

    // A separate subject that Semester 4 CE is not registered to
    unauthorizedSubject = await Subject.create({
      name: "Introduction to Electronics",
      code: "EC101",
      credits: 3,
      semester: 1,
      isActive: true,
      course: tempCourse._id,
      faculty: facultyUser._id,
      createdBy: facultyUser._id,
    });
    console.log("✓ Created mock Department, Course, Subject, and Unauthorized Subject.");

    const now = new Date();

    // 1. Setup Exams
    // Scenario 2: Upcoming Exam
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day future
    upcomingExam = await Exam.create({
      title: "Upcoming Database Midterm Test",
      examCode: "CS401-UP",
      subject: tempSubject._id,
      examType: "Quiz",
      examDate: futureDate,
      startTime: futureDate,
      endTime: new Date(futureDate.getTime() + 60 * 60 * 1000),
      duration: 60,
      totalMarks: 50,
      passingMarks: 20,
      isPublished: true,
      examStatus: "Published",
      createdBy: facultyUser._id,
      questions: [{ questionNumber: 1, questionText: "Upcoming Q", maximumMarks: 50 }],
    });

    // Scenario 3: Active Exam
    const activeStart = new Date(now.getTime() - 20 * 60 * 1000); // started 20 mins ago
    const activeEnd = new Date(now.getTime() + 40 * 60 * 1000); // ends in 40 mins
    activeExam = await Exam.create({
      title: "Active Database Practical Exam",
      examCode: "CS401-AC",
      subject: tempSubject._id,
      examType: "Practical",
      examDate: activeStart,
      startTime: activeStart,
      endTime: activeEnd,
      duration: 60,
      totalMarks: 100,
      passingMarks: 40,
      isPublished: true,
      examStatus: "Active",
      createdBy: facultyUser._id,
      questions: [{ questionNumber: 1, questionText: "Active Q", maximumMarks: 100 }],
    });

    // Scenario 4: In Progress (draft exists)
    inProgressExam = await Exam.create({
      title: "Ongoing Database Lab Assessment",
      examCode: "CS401-IP",
      subject: tempSubject._id,
      examType: "Practical",
      examDate: activeStart,
      startTime: activeStart,
      endTime: activeEnd,
      duration: 60,
      totalMarks: 50,
      passingMarks: 20,
      isPublished: true,
      examStatus: "Active",
      createdBy: facultyUser._id,
      questions: [{ questionNumber: 1, questionText: "Lab Q", maximumMarks: 50 }],
    });
    // Create draft submission
    inProgressSheet = await AnswerSheet.create({
      student: studentUser._id,
      subject: tempSubject._id,
      exam: inProgressExam._id,
      submittedAt: null,
      submissionStatus: "Started",
      answers: [],
      createdBy: studentUser._id,
    });

    // Scenario 5: Submitted Exam
    submittedExam = await Exam.create({
      title: "Completed Database Homework",
      examCode: "CS401-SU",
      subject: tempSubject._id,
      examType: "Theory",
      examDate: activeStart,
      startTime: activeStart,
      endTime: activeEnd,
      duration: 60,
      totalMarks: 100,
      passingMarks: 35,
      isPublished: true,
      examStatus: "Active",
      createdBy: facultyUser._id,
      questions: [{ questionNumber: 1, questionText: "Homework Q", maximumMarks: 100 }],
    });
    submittedSheet = await AnswerSheet.create({
      student: studentUser._id,
      subject: tempSubject._id,
      exam: submittedExam._id,
      submittedAt: new Date(now.getTime() - 10 * 60 * 1000),
      submissionStatus: "Submitted",
      answers: [],
      createdBy: studentUser._id,
    });

    // Scenario 6: Published Result
    publishedExam = await Exam.create({
      title: "Database Final Examination",
      examCode: "CS401-PR",
      subject: tempSubject._id,
      examType: "Theory",
      examDate: activeStart,
      startTime: activeStart,
      endTime: activeEnd,
      duration: 120,
      totalMarks: 100,
      passingMarks: 40,
      isPublished: true,
      examStatus: "Published",
      createdBy: facultyUser._id,
      questions: [{ questionNumber: 1, questionText: "Final Q", maximumMarks: 100 }],
    });
    publishedSheet = await AnswerSheet.create({
      student: studentUser._id,
      subject: tempSubject._id,
      exam: publishedExam._id,
      submittedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      submissionStatus: "Published",
      answers: [],
      createdBy: studentUser._id,
    });
    publishedEvaluation = await Evaluation.create({
      answerSheet: publishedSheet._id,
      evaluatedBy: facultyUser._id,
      evaluationType: "Faculty",
      obtainedMarks: 90,
      totalMarks: 100,
      percentage: 90,
      grade: "A+",
      evaluationStatus: "PUBLISHED",
      createdBy: facultyUser._id,
    });

    // Scenario 8: Expired Exam
    const pastStart = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    const pastEnd = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // 4 days ago
    expiredExam = await Exam.create({
      title: "Expired Lecture Quiz 1",
      examCode: "CS401-EX",
      subject: tempSubject._id,
      examType: "Quiz",
      examDate: pastStart,
      startTime: pastStart,
      endTime: pastEnd,
      duration: 30,
      totalMarks: 20,
      passingMarks: 10,
      isPublished: true,
      examStatus: "Published",
      createdBy: facultyUser._id,
      questions: [{ questionNumber: 1, questionText: "Quiz Q", maximumMarks: 20 }],
    });

    // Scenario 7: Unauthorized exam (student is CE, exam is EC)
    unauthorizedExam = await Exam.create({
      title: "EC Freshman Fundamentals",
      examCode: "EC101-UN",
      subject: unauthorizedSubject._id,
      examType: "Quiz",
      examDate: activeStart,
      startTime: activeStart,
      endTime: activeEnd,
      duration: 40,
      totalMarks: 30,
      passingMarks: 12,
      isPublished: true,
      examStatus: "Active",
      createdBy: facultyUser._id,
      questions: [{ questionNumber: 1, questionText: "EC Q", maximumMarks: 30 }],
    });
    console.log("✓ Created all mock exams, submissions, and evaluations.");

    // EXECUTING SCENARIO CHECKS
    console.log("\n--- EXECUTING TEST SCENARIOS ---");

    // Scenario 1: Eligible student receives only exams they are eligible for.
    console.log("\nChecking Scenario 1 (Get student exams list)...");
    const examsResult = await studentExamService.getStudentExams(studentUser._id, { limit: 20 });
    const examsList = examsResult.exams;
    console.log(`Eligible Student Exams returned: ${examsList.length}`);
    if (examsList.length < 6) throw new Error("Expected at least 6 eligible exams, got " + examsList.length);
    // Ensure student does not see the EC exam
    const hasUnauthorized = examsList.some(e => e.id.toString() === unauthorizedExam._id.toString());
    if (hasUnauthorized) throw new Error("Security breach: student saw EC exam in list!");
    console.log("✓ Scenario 1 passed!");

    // Scenario 2: Upcoming Exam
    console.log("\nChecking Scenario 2 (Upcoming Exam)...");
    const upcomingObj = examsList.find(e => e.id.toString() === upcomingExam._id.toString());
    if (!upcomingObj) throw new Error("Upcoming exam not found in list");
    if (upcomingObj.status !== "upcoming") throw new Error(`Expected status 'upcoming', got '${upcomingObj.status}'`);
    if (upcomingObj.canEnter !== false) throw new Error("Upcoming exam should not be enterable");
    console.log("✓ Scenario 2 passed!");

    // Scenario 3: Active Exam
    console.log("\nChecking Scenario 3 (Active Exam)...");
    const activeObj = examsList.find(e => e.id.toString() === activeExam._id.toString());
    if (!activeObj) throw new Error("Active exam not found in list");
    if (activeObj.status !== "active") throw new Error(`Expected status 'active', got '${activeObj.status}'`);
    if (activeObj.canEnter !== true) throw new Error("Active exam should be enterable");
    console.log("✓ Scenario 3 passed!");

    // Scenario 4: In Progress
    console.log("\nChecking Scenario 4 (In Progress / Resume Draft)...");
    const ipObj = examsList.find(e => e.id.toString() === inProgressExam._id.toString());
    if (!ipObj) throw new Error("In progress exam not found in list");
    if (ipObj.status !== "in_progress") throw new Error(`Expected status 'in_progress', got '${ipObj.status}'`);
    if (ipObj.canEnter !== true) throw new Error("In progress exam should allow entry/resume");
    console.log("✓ Scenario 4 passed!");

    // Scenario 5: Submitted Exam
    console.log("\nChecking Scenario 5 (Submitted Exam)...");
    const subObj = examsList.find(e => e.id.toString() === submittedExam._id.toString());
    if (!subObj) throw new Error("Submitted exam not found in list");
    if (subObj.status !== "submitted") throw new Error(`Expected status 'submitted', got '${subObj.status}'`);
    if (subObj.canEnter !== false) throw new Error("Submitted exam should NOT allow entry");
    console.log("✓ Scenario 5 passed!");

    // Scenario 6: Published Result
    console.log("\nChecking Scenario 6 (Published Exam Result)...");
    const pubObj = examsList.find(e => e.id.toString() === publishedExam._id.toString());
    if (!pubObj) throw new Error("Published exam not found in list");
    if (pubObj.status !== "published") throw new Error(`Expected status 'published', got '${pubObj.status}'`);
    if (pubObj.canEnter !== false) throw new Error("Published exam should NOT allow entry");
    console.log("✓ Scenario 6 passed!");

    // Scenario 8: Expired Exam
    console.log("\nChecking Scenario 8 (Expired Exam without submission)...");
    const expObj = examsList.find(e => e.id.toString() === expiredExam._id.toString());
    if (!expObj) throw new Error("Expired exam not found in list");
    if (expObj.status !== "expired") throw new Error(`Expected status 'expired', got '${expObj.status}'`);
    if (expObj.canEnter !== false) throw new Error("Expired exam should NOT allow entry");
    console.log("✓ Scenario 8 passed!");

    // Scenario 7: Unauthorized accessing
    console.log("\nChecking Scenario 7 (Security/Unauthorized Access checks)...");
    try {
      await studentExamService.getStudentExamById(studentUser._id, unauthorizedExam._id);
      throw new Error("Student should have been blocked from fetching EC exam detail");
    } catch (err) {
      if (err.statusCode !== 403) {
        throw new Error(`Expected status code 403, got ${err.statusCode}`);
      }
      console.log("✓ Blocked student from detail API of ineligible exam.");
    }

    const eligCheck = await studentExamService.getStudentExamEligibility(studentUser._id, unauthorizedExam._id);
    if (eligCheck.eligible !== false || eligCheck.status !== "not_eligible") {
      throw new Error("Eligibility endpoint returned eligible:true or incorrect status on unauthorized exam!");
    }
    console.log("✓ Verified eligibility endpoint correctly reports false on unauthorized exam.");
    console.log("✓ Scenario 7 passed!");

    // Scenario 9: No Exams
    console.log("\nChecking Scenario 9 (Student with no exams)...");
    const unauthResults = await studentExamService.getStudentExams(unauthorizedStudent._id);
    if (unauthResults.exams.length !== 0) {
      throw new Error(`Expected 0 exams for unauth student, got ${unauthResults.exams.length}`);
    }
    console.log("✓ Scenario 9 passed!");

    // Search query check
    console.log("\nChecking Search filter...");
    const searchRes = await studentExamService.getStudentExams(studentUser._id, { search: "midterm" });
    if (searchRes.exams.length !== 1 || searchRes.exams[0].id.toString() !== upcomingExam._id.toString()) {
      throw new Error("Search filter failed, expected 1 matching exam matching 'midterm'");
    }
    console.log("✓ Search filter passed!");

    // Status filter check
    console.log("\nChecking Status filter...");
    const statusRes = await studentExamService.getStudentExams(studentUser._id, { status: "active" });
    const hasOnlyActive = statusRes.exams.every(e => e.status === "active");
    if (!hasOnlyActive || statusRes.exams.length < 1) {
      throw new Error("Status filter failed to restrict results to active exams");
    }
    console.log("✓ Status filter passed!");

    console.log("\nALL STUDENT EXAMS & ELIGIBILITY INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉");
  } catch (err) {
    console.error("\n❌ TESTS FAILED:", err);
    process.exitCode = 1;
  } finally {
    console.log("\nCleaning up test documents...");
    if (publishedEvaluation) await Evaluation.findByIdAndDelete(publishedEvaluation._id);
    if (publishedSheet) await AnswerSheet.findByIdAndDelete(publishedSheet._id);
    if (submittedSheet) await AnswerSheet.findByIdAndDelete(submittedSheet._id);
    if (inProgressSheet) await AnswerSheet.findByIdAndDelete(inProgressSheet._id);

    if (unauthorizedExam) await Exam.findByIdAndDelete(unauthorizedExam._id);
    if (expiredExam) await Exam.findByIdAndDelete(expiredExam._id);
    if (publishedExam) await Exam.findByIdAndDelete(publishedExam._id);
    if (submittedExam) await Exam.findByIdAndDelete(submittedExam._id);
    if (inProgressExam) await Exam.findByIdAndDelete(inProgressExam._id);
    if (activeExam) await Exam.findByIdAndDelete(activeExam._id);
    if (upcomingExam) await Exam.findByIdAndDelete(upcomingExam._id);

    if (unauthorizedSubject) await Subject.findByIdAndDelete(unauthorizedSubject._id);
    if (tempSubject) await Subject.findByIdAndDelete(tempSubject._id);
    if (tempCourse) await Course.findByIdAndDelete(tempCourse._id);
    if (tempDept) await Department.findByIdAndDelete(tempDept._id);

    if (unauthorizedStudent) await User.findByIdAndDelete(unauthorizedStudent._id);
    if (studentUser) await User.findByIdAndDelete(studentUser._id);
    if (facultyUser) await User.findByIdAndDelete(facultyUser._id);

    await mongoose.disconnect();
    console.log("Disconnected. Cleanup completed.");
  }
}

runTest();
