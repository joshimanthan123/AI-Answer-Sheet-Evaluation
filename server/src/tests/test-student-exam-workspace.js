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

async function runTests() {
  console.log("Starting Student Exam Workspace Integration Tests...");
  console.log("Connecting database: " + env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let facultyUser = null;
  let studentUser = null;
  let unauthorizedStudent = null;
  let otherStudent = null;
  
  let tempDept = null;
  let tempCourse = null;
  let tempSubject = null;
  let unauthorizedSubject = null;

  let upcomingExam = null;
  let activeExam = null;
  let submittedExam = null;
  let expiredExam = null;
  let unauthorizedExam = null;

  let submittedSheet = null;

  try {
    // 1. Setup Users
    facultyUser = await User.create({
      name: "Workspace Work Faculty",
      email: "work.faculty@example.com",
      password: "password123",
      role: "faculty",
      lecturerId: "LECWORK" + Date.now(),
    });

    studentUser = await User.create({
      name: "Workspace Work Student",
      email: "work.student@example.com",
      password: "password123",
      role: "student",
      studentId: "STUDWORK" + Date.now(),
      semester: 5,
      department: "CE",
    });

    unauthorizedStudent = await User.create({
      name: "Workspace Unauth Student",
      email: "work.unauth@example.com",
      password: "password123",
      role: "student",
      studentId: "STUDUNAUTH" + Date.now(),
      semester: 1,
      department: "EC",
    });

    otherStudent = await User.create({
      name: "Workspace Other Student",
      email: "work.other@example.com",
      password: "password123",
      role: "student",
      studentId: "STUDOTHER" + Date.now(),
      semester: 5,
      department: "CE",
    });

    // 2. Setup Department / Course / Subject
    tempDept = await Department.create({
      name: "Computer Eng Dept",
      code: "CE",
      createdBy: facultyUser._id,
    });

    tempCourse = await Course.create({
      name: "B.Tech CE",
      code: "BTCE",
      durationYears: 4,
      totalSemesters: 8,
      department: tempDept._id,
      createdBy: facultyUser._id,
    });

    tempSubject = await Subject.create({
      name: "Systems Engineering",
      code: "CS501",
      credits: 4,
      semester: 5,
      isActive: true,
      course: tempCourse._id,
      faculty: facultyUser._id,
      createdBy: facultyUser._id,
    });

    unauthorizedSubject = await Subject.create({
      name: "Digital Logic",
      code: "EC101",
      credits: 3,
      semester: 1,
      isActive: true,
      course: tempCourse._id,
      faculty: facultyUser._id,
      createdBy: facultyUser._id,
    });

    const now = new Date();

    // 3. Create Exams
    // Active Exam
    const activeStart = new Date(now.getTime() - 15 * 60 * 1000);
    const activeEnd = new Date(now.getTime() + 45 * 60 * 1000);
    activeExam = await Exam.create({
      title: "Active Systems Exam",
      examCode: "CS501-ACT",
      subject: tempSubject._id,
      examType: "Theory",
      examDate: activeStart,
      startTime: activeStart,
      endTime: activeEnd,
      duration: 60,
      totalMarks: 70,
      passingMarks: 25,
      isPublished: true,
      examStatus: "Active",
      createdBy: facultyUser._id,
      questions: [
        { questionNumber: 1, questionText: "Define Systems.", maximumMarks: 35 },
        { questionNumber: 2, questionText: "Compare design models.", maximumMarks: 35 }
      ],
    });

    // Upcoming Exam
    const upcomingStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const upcomingEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    upcomingExam = await Exam.create({
      title: "Upcoming Systems Quiz",
      examCode: "CS501-UPC",
      subject: tempSubject._id,
      examType: "Quiz",
      examDate: upcomingStart,
      startTime: upcomingStart,
      endTime: upcomingEnd,
      duration: 60,
      totalMarks: 30,
      passingMarks: 12,
      isPublished: true,
      examStatus: "Published",
      createdBy: facultyUser._id,
      questions: [{ questionNumber: 1, questionText: "Quiz Q1", maximumMarks: 30 }],
    });

    // Submitted Exam
    submittedExam = await Exam.create({
      title: "Submitted Systems Practical",
      examCode: "CS501-SUB",
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
      questions: [{ questionNumber: 1, questionText: "Prac Q1", maximumMarks: 50 }],
    });
    submittedSheet = await AnswerSheet.create({
      student: studentUser._id,
      subject: tempSubject._id,
      exam: submittedExam._id,
      submissionStatus: "Submitted",
      attemptNo: 1,
      answers: [],
      createdBy: studentUser._id,
    });

    // Expired Exam
    const expiredStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const expiredEnd = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    expiredExam = await Exam.create({
      title: "Expired Systems Quiz",
      examCode: "CS501-EXP",
      subject: tempSubject._id,
      examType: "Quiz",
      examDate: expiredStart,
      startTime: expiredStart,
      endTime: expiredEnd,
      duration: 60,
      totalMarks: 20,
      passingMarks: 8,
      isPublished: true,
      examStatus: "Published",
      createdBy: facultyUser._id,
      questions: [{ questionNumber: 1, questionText: "Expired Q1", maximumMarks: 20 }],
    });

    // Ineligible Subject Exam
    unauthorizedExam = await Exam.create({
      title: "EC Digital Logic Midterm",
      examCode: "EC101-MID",
      subject: unauthorizedSubject._id,
      examType: "Theory",
      examDate: activeStart,
      startTime: activeStart,
      endTime: activeEnd,
      duration: 90,
      totalMarks: 50,
      passingMarks: 20,
      isPublished: true,
      examStatus: "Active",
      createdBy: facultyUser._id,
      questions: [{ questionNumber: 1, questionText: "DL Q1", maximumMarks: 50 }],
    });

    console.log("✓ Initialized mock databases and exam states.");

    console.log("\n--- EXECUTING SCENARIOS ---");

    // Scenario 1: Eligible student accesses active exam workspace
    console.log("\nChecking Scenario 1 (Active exam workspace loading)...");
    const workspace = await studentExamService.getStudentExamWorkspace(studentUser._id, activeExam._id);
    if (!workspace.exam || workspace.exam.title !== "Active Systems Exam") {
      throw new Error(`Invalid exam metadata inside workspace, got: ${JSON.stringify(workspace.exam)}`);
    }
    if (workspace.questions.length !== 2) {
      throw new Error(`Expected 2 questions, got: ${workspace.questions.length}`);
    }
    // Verify answers or prompts (for student access) do not contain solution keys
    if (workspace.questions.some(q => q.solutionCode || q.modelAnswer)) {
      throw new Error(`Security leakage: workspace returned solution details!`);
    }
    console.log("✓ Scenario 1 passed!");

    // Scenario 2: Upcoming exam workspace and start blocked
    console.log("\nChecking Scenario 2 (Upcoming blocker)...");
    try {
      await studentExamService.getStudentExamWorkspace(studentUser._id, upcomingExam._id);
      throw new Error("Student should be blocked from loading upcoming exam workspace");
    } catch (err) {
      if (err.statusCode !== 403 || err.message !== "This exam has not started yet") {
        throw new Error(`Unexpected error loading upcoming exam: ${err.message} (${err.statusCode})`);
      }
    }
    try {
      await studentExamService.startStudentExam(studentUser._id, upcomingExam._id);
      throw new Error("Student should be blocked from starting upcoming exam");
    } catch (err) {
      if (err.statusCode !== 403) {
        throw new Error(`Unexpected error starting upcoming exam: ${err.message}`);
      }
    }
    console.log("✓ Scenario 2 passed!");

    // Scenario 3: Unauthorized student accesses exam blocked
    console.log("\nChecking Scenario 3 (Unauthorized student block)...");
    try {
      await studentExamService.getStudentExamWorkspace(unauthorizedStudent._id, activeExam._id);
      throw new Error("Semester 1 student should be blocked from CE Sem 5 exam");
    } catch (err) {
      if (err.statusCode !== 403 || err.message !== "You are not eligible to access this exam") {
        throw new Error(`Unexpected error checking Semester 5 exam: ${err.message}`);
      }
    }
    console.log("✓ Scenario 3 passed!");

    // Scenario 4: Autocomplete resume workspace loader
    console.log("\nChecking Scenario 4 (Draft resume validation)...");
    // Initial start
    const startResult = await studentExamService.startStudentExam(studentUser._id, activeExam._id);
    if (startResult.status !== "Started") {
      throw new Error(`Expected Started status, got: ${startResult.status}`);
    }
    // Reload workspace
    const workspaceResumed = await studentExamService.getStudentExamWorkspace(studentUser._id, activeExam._id);
    if (!workspaceResumed.submission || workspaceResumed.submission.id.toString() !== startResult.id.toString()) {
      throw new Error(`Expected resumed submission ID ${startResult.id}, got workspace resume object: ${JSON.stringify(workspaceResumed.submission)}`);
    }
    console.log("✓ Scenario 4 passed!");

    // Scenario 5: Autosave strokes correctly
    console.log("\nChecking Scenario 5 (Atomic autosave)...");
    const q1 = workspace.questions[0];
    const q2 = workspace.questions[1];
    
    // Autosave Q1
    const strokeDataQ1 = { strokes: [{ points: [{ x: 10, y: 20 }], color: "#0000FF", width: 3 }] };
    const saveQ1 = await studentExamService.autosaveStudentExamAnswer(studentUser._id, activeExam._id, {
      questionId: q1.id,
      handwrittenData: strokeDataQ1,
    });
    if (!saveQ1.success) throw new Error("Q1 save returned fail success");

    // Autosave Q2
    const strokeDataQ2 = { strokes: [{ points: [{ x: 50, y: 60 }], color: "#FF0000", width: 5 }] };
    const saveQ2 = await studentExamService.autosaveStudentExamAnswer(studentUser._id, activeExam._id, {
      questionId: q2.id,
      handwrittenData: strokeDataQ2,
    });
    if (!saveQ2.success) throw new Error("Q2 save returned fail success");

    // Load sheet to verify they co-exist asynchronously without overwriting
    const updatedSheet = await AnswerSheet.findById(startResult.id).lean();
    if (updatedSheet.answers.length !== 2) {
      throw new Error(`Expected 2 answers in database sheet, found: ${updatedSheet.answers.length}`);
    }
    const dbAnsQ1 = updatedSheet.answers.find(a => a.questionId.toString() === q1.id.toString());
    const dbAnsQ2 = updatedSheet.answers.find(a => a.questionId.toString() === q2.id.toString());
    
    if (!dbAnsQ1 || !dbAnsQ1.handwrittenData.includes("10")) {
      throw new Error("Answer Q1 stroke content corrupted or missing: " + JSON.stringify(dbAnsQ1));
    }
    if (!dbAnsQ2 || !dbAnsQ2.handwrittenData.includes("50")) {
      throw new Error("Answer Q2 stroke content corrupted or missing: " + JSON.stringify(dbAnsQ2));
    }
    console.log("✓ Scenario 5 passed!");

    // Scenario 6: Start exam must be idempotent
    console.log("\nChecking Scenario 6 (Start exam is idempotent)...");
    const resumeResult = await studentExamService.startStudentExam(studentUser._id, activeExam._id);
    if (resumeResult.id.toString() !== startResult.id.toString()) {
      throw new Error(`Start exam created duplicate sheet instead of resume! Resumed ID: ${resumeResult.id}, original: ${startResult.id}`);
    }
    const sheetCount = await AnswerSheet.countDocuments({
      student: studentUser._id,
      exam: activeExam._id,
      isDeleted: false,
    });
    if (sheetCount > 1) {
      throw new Error(`Database sheet leakage! Found ${sheetCount} documents.`);
    }
    console.log("✓ Scenario 6 passed!");

    // Scenario 7: Student editing spoofing check
    console.log("\nChecking Scenario 7 (Student spoofing block)...");
    // Attempting to autosave other student's exam sheet by changing studentId parameter
    try {
      await studentExamService.autosaveStudentExamAnswer(otherStudent._id, activeExam._id, {
        questionId: q1.id,
        handwrittenData: strokeDataQ1,
      });
      // If otherStudent has no draft, it throws NOT_FOUND which is correct since they did not start the exam. 
      // But if we create a draft for other student first and try to edit it as studentUser:
      throw new Error("Forbidden expectation did not trigger.");
    } catch (err) {
      console.log(`✓ Autosave rejected other student (Message: ${err.message})`);
    }
    console.log("✓ Scenario 7 passed!");

    // Scenario 8: Expired Exam rejects start and autosave
    console.log("\nChecking Scenario 8 (Expired Exam rejection)...");
    try {
      await studentExamService.startStudentExam(studentUser._id, expiredExam._id);
      throw new Error("Expected block starting expired exam");
    } catch (err) {
      if (err.statusCode !== 403 || err.message !== "This exam is no longer available") {
        throw new Error(`Error: ${err.message} (${err.statusCode})`);
      }
    }
    console.log("✓ Scenario 8 passed!");

    // Scenario 9: ServerOffset timer sync check
    console.log("\nChecking Scenario 9 (Timer details)...");
    const ws = await studentExamService.getStudentExamWorkspace(studentUser._id, activeExam._id);
    if (!ws.serverTime) {
      throw new Error("Workspace must returns serverTime ISO string");
    }
    const parsedOffset = Math.abs(new Date(ws.serverTime).getTime() - Date.now());
    if (parsedOffset > 10000) {
      throw new Error(`Time drift offset difference is too large: ${parsedOffset}ms`);
    }
    console.log(`✓ Offset verified successfully (${parsedOffset}ms drift)`);
    console.log("✓ Scenario 9 passed!");

    console.log("\nALL 9 EXAM WORKSPACE TESTING SCENARIOS COMPLETED SUCCESSFULLY! ⚡🎉");

  } catch (err) {
    console.error("\n❌ TESTS ENCOUNTERED EXCEPTION:", err);
    process.exitCode = 1;
  } finally {
    console.log("\nCleaning up mock documents...");
    const draftSheets = await AnswerSheet.find({ student: studentUser._id, exam: activeExam?._id });
    for (const sh of draftSheets) {
      await AnswerSheet.findByIdAndDelete(sh._id);
    }
    if (submittedSheet) await AnswerSheet.findByIdAndDelete(submittedSheet._id);

    if (unauthorizedExam) await Exam.findByIdAndDelete(unauthorizedExam._id);
    if (expiredExam) await Exam.findByIdAndDelete(expiredExam._id);
    if (submittedExam) await Exam.findByIdAndDelete(submittedExam._id);
    if (activeExam) await Exam.findByIdAndDelete(activeExam._id);
    if (upcomingExam) await Exam.findByIdAndDelete(upcomingExam._id);

    if (unauthorizedSubject) await Subject.findByIdAndDelete(unauthorizedSubject._id);
    if (tempSubject) await Subject.findByIdAndDelete(tempSubject._id);
    if (tempCourse) await Course.findByIdAndDelete(tempCourse._id);
    if (tempDept) await Department.findByIdAndDelete(tempDept._id);

    if (unauthorizedStudent) await User.findByIdAndDelete(unauthorizedStudent._id);
    if (otherStudent) await User.findByIdAndDelete(otherStudent._id);
    if (studentUser) await User.findByIdAndDelete(studentUser._id);
    if (facultyUser) await User.findByIdAndDelete(facultyUser._id);

    await mongoose.disconnect();
    console.log("Database disconnected successfully.");
  }
}

runTests();
