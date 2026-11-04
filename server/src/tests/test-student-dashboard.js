import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import AnswerSheet from "../models/AnswerSheet.js";
import Evaluation from "../models/Evaluation.js";
import { getStudentDashboard } from "../services/dashboard.service.js";

async function runTest() {
  console.log("Starting Student Dashboard Service Integration Tests...");
  console.log("Connecting database: " + env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let facultyUser = null;
  let studentUser = null;
  let tempDept = null;
  let tempCourse = null;
  let tempSubject = null;
  let activeExamDoc = null;
  let upcomingExamDoc = null;
  let answerSheetDoc1 = null;
  let answerSheetDoc2 = null;
  let evaluationDoc = null;

  try {
    // 1. Create a mock faculty & student user
    facultyUser = await User.create({
      name: "Dashboard Faculty Member",
      email: "dash.faculty@example.com",
      password: "password123",
      role: "faculty",
      lecturerId: "LEC" + Date.now(),
    });
    
    // Create student matching semester 5 and computer engineering department
    studentUser = await User.create({
      name: "Dashboard Student Member",
      email: "dash.student@example.com",
      password: "password123",
      role: "student",
      studentId: "STUD" + Date.now(),
      semester: 5,
      department: "CEDASH",
    });
    console.log("✓ Created mock faculty and student users.");

    // 2. Create mock department, course, subject
    tempDept = await Department.create({
      name: "DASH computer engineering",
      code: "CEDASH",
      createdBy: facultyUser._id,
    });

    tempCourse = await Course.create({
      name: "B.Tech CE DASH",
      code: "BTDASH",
      durationYears: 4,
      totalSemesters: 8,
      department: tempDept._id,
      createdBy: facultyUser._id,
    });

    tempSubject = await Subject.create({
      name: "CE DASH Subject",
      code: "CEDASH101",
      credits: 4,
      semester: 5,
      isActive: true,
      course: tempCourse._id,
      faculty: facultyUser._id,
      createdBy: facultyUser._id,
    });
    console.log("✓ Created mock Department, Course, and Subject.");

    // Scenario 5 Check: Student with no data
    console.log("Test: Scenario 5 (Student with no data)...");
    let dashboardData = await getStudentDashboard(studentUser._id);
    if (dashboardData.activeExams !== 0) throw new Error("Expected 0 active exams");
    if (dashboardData.upcomingExams !== 0) throw new Error("Expected 0 upcoming exams");
    if (dashboardData.completedExams !== 0) throw new Error("Expected 0 completed exams");
    if (dashboardData.averageMarks !== null) throw new Error("Expected null averageMarks");
    if (dashboardData.activeExam !== null) throw new Error("Expected null activeExam");
    if (dashboardData.latestResult !== null) throw new Error("Expected null latestResult");
    if (dashboardData.pipeline.status !== "idle") throw new Error("Expected idle pipeline");
    console.log("✓ Scenario 5 passed!");

    // Scenario 2 Check: Student with upcoming exam
    console.log("Test: Scenario 2 (Student with upcoming exam)...");
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2); // 2 days in future
    upcomingExamDoc = await Exam.create({
      title: "Upcoming Exam",
      examCode: "UP101",
      subject: tempSubject._id,
      examType: "Quiz",
      examDate: futureDate,
      startTime: futureDate,
      duration: 60,
      totalMarks: 50,
      passingMarks: 20,
      isPublished: true,
      examStatus: "Published",
      createdBy: facultyUser._id,
      questions: [{ questionNumber: 1, questionText: "Is it future?", maximumMarks: 50 }],
    });

    dashboardData = await getStudentDashboard(studentUser._id);
    if (dashboardData.upcomingExams !== 1) throw new Error(`Expected 1 upcoming exam, got ${dashboardData.upcomingExams}`);
    console.log("✓ Scenario 2 passed!");

    // Scenario 1 Check: Student with active exam
    console.log("Test: Scenario 1 (Student with active exam)...");
    const now = new Date();
    const startTimeActive = new Date(now.getTime() - 30 * 60 * 1000); // started 30 mins ago
    const endTimeActive = new Date(now.getTime() + 30 * 60 * 1000); // ends in 30 mins
    activeExamDoc = await Exam.create({
      title: "Active Exam",
      examCode: "AC101",
      subject: tempSubject._id,
      examType: "Quiz",
      examDate: startTimeActive,
      startTime: startTimeActive,
      endTime: endTimeActive,
      duration: 60,
      totalMarks: 50,
      passingMarks: 20,
      isPublished: true,
      examStatus: "Active",
      createdBy: facultyUser._id,
      questions: [{ questionNumber: 1, questionText: "Is it active?", maximumMarks: 50 }],
    });

    dashboardData = await getStudentDashboard(studentUser._id);
    if (dashboardData.activeExams !== 1) throw new Error(`Expected 1 active exam, got ${dashboardData.activeExams}`);
    if (!dashboardData.activeExam) throw new Error("Expected activeExam object");
    if (dashboardData.activeExam.title !== "Active Exam") throw new Error("Active exam title mismatch");
    if (dashboardData.activeExam.submissionStatus !== "not_started") throw new Error("Expected submissionStatus to be 'not_started'");
    console.log("✓ Scenario 1 passed!");

    // Scenario 3 Check: Student with submission under processing / AI evaluation
    console.log("Test: Scenario 3 (Student with submission under processing / AI evaluation)...");
    answerSheetDoc1 = await AnswerSheet.create({
      student: studentUser._id,
      subject: tempSubject._id,
      exam: activeExamDoc._id,
      submittedAt: new Date(),
      submissionStatus: "Submitted",
      uploadStatus: "HWR Processing",
      processingStatus: "processing",
      answers: [],
      createdBy: studentUser._id,
    });

    dashboardData = await getStudentDashboard(studentUser._id);
    // Submit status should mean active exam is not counts (since already submitted)
    if (dashboardData.activeExams !== 0) throw new Error(`Expected 0 active exams (student already submitted), got ${dashboardData.activeExams}`);
    if (dashboardData.completedExams !== 1) throw new Error(`Expected 1 completed exam, got ${dashboardData.completedExams}`);
    if (dashboardData.pipeline.status !== "processing") throw new Error(`Expected pipeline status 'processing', got ${dashboardData.pipeline.status}`);
    if (dashboardData.pipeline.currentStage !== "Handwriting Recognition") throw new Error(`Expected stage 'Handwriting Recognition', got ${dashboardData.pipeline.currentStage}`);
    if (dashboardData.pipeline.progress !== 40) throw new Error(`Expected progress 40, got ${dashboardData.pipeline.progress}`);
    console.log("✓ Scenario 3 passed!");

    // Scenario 4 Check: Student with published results
    console.log("Test: Scenario 4 (Student with published result)...");
    // Update answer sheet status to published
    answerSheetDoc2 = await AnswerSheet.create({
      student: studentUser._id,
      subject: tempSubject._id,
      exam: upcomingExamDoc._id, // let's attach to another exam
      submittedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // submitted in past
      submissionStatus: "Published",
      uploadStatus: "Published",
      processingStatus: "completed",
      answers: [],
      createdBy: studentUser._id,
    });

    evaluationDoc = await Evaluation.create({
      answerSheet: answerSheetDoc2._id,
      evaluatedBy: facultyUser._id,
      evaluationType: "Faculty",
      obtainedMarks: 40,
      totalMarks: 50,
      percentage: 80,
      grade: "B+",
      evaluationStatus: "PUBLISHED",
      createdBy: facultyUser._id,
    });

    dashboardData = await getStudentDashboard(studentUser._id);
    if (dashboardData.averageMarks !== 80) throw new Error(`Expected averageMarks 88, got ${dashboardData.averageMarks}`);
    if (!dashboardData.latestResult) throw new Error("Expected latestResult object");
    if (dashboardData.latestResult.percentage !== 80) throw new Error("Latest result percentage mismatch");
    if (dashboardData.latestResult.grade !== "B+") throw new Error("Latest result grade mismatch");
    console.log("✓ Scenario 4 passed!");

    // Scenario 6 Check: Data isolation / Security check
    console.log("Test: Scenario 6 (Data Isolation / Security check)...");
    const otherStudent = await User.create({
      name: "Other Student",
      email: "other@example.com",
      password: "password123",
      role: "student",
      studentId: "STUD" + (Date.now() + 100),
    });

    const otherData = await getStudentDashboard(otherStudent._id);
    // Student otherStudent should not see dashStudent's results or submissions
    if (otherData.averageMarks !== null) throw new Error("Other student saw target student's avgMarks");
    if (otherData.latestResult !== null) throw new Error("Other student saw target student's latestResult");
    if (otherData.completedExams !== 0) throw new Error("Other student saw target student's completed count");

    // cleanup other student
    await User.findByIdAndDelete(otherStudent._id);
    console.log("✓ Scenario 6 passed!");

    console.log("\nALL STUDENT DASHBOARD INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉");
  } catch (err) {
    console.error("\n❌ TESTS FAILED:", err.stack || err);
    process.exitCode = 1;
  } finally {
    console.log("Cleaning up test documents...");
    if (evaluationDoc) await Evaluation.findByIdAndDelete(evaluationDoc._id);
    if (answerSheetDoc1) await AnswerSheet.findByIdAndDelete(answerSheetDoc1._id);
    if (answerSheetDoc2) await AnswerSheet.findByIdAndDelete(answerSheetDoc2._id);
    if (activeExamDoc) await Exam.findByIdAndDelete(activeExamDoc._id);
    if (upcomingExamDoc) await Exam.findByIdAndDelete(upcomingExamDoc._id);
    if (tempSubject) await Subject.findByIdAndDelete(tempSubject._id);
    if (tempCourse) await Course.findByIdAndDelete(tempCourse._id);
    if (tempDept) await Department.findByIdAndDelete(tempDept._id);
    if (studentUser) await User.findByIdAndDelete(studentUser._id);
    if (facultyUser) await User.findByIdAndDelete(facultyUser._id);
    await mongoose.disconnect();
    console.log("Disconnected. Cleanup completed.");
  }
}

runTest();
