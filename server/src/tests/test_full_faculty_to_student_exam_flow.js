import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Subject from "../models/Subject.js";
import Exam from "../models/Exam.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import examService from "../services/exam.service.js";
import { getStudentExams } from "../services/studentExam.service.js";

async function runFullFlowTest() {
  console.log("=================================================");
  console.log("FACULTY → STUDENT EXAM FLOW E2E VERIFICATION TEST");
  console.log("=================================================");

  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  let testSubject, testExam, studentB;

  try {
    // 1. Get Faculty User
    const faculty = await User.findOne({ email: "cefaculty@gmail.com" });
    if (!faculty) throw new Error("Faculty user cefaculty@gmail.com not found!");
    console.log(`✓ Step 1: Faculty User found (${faculty.name}, ID: ${faculty._id})`);

    // 2. Get Eligible Student A (CE Department)
    const studentA = await User.findOne({ email: "studentce@gmail.com" });
    if (!studentA) throw new Error("Student A studentce@gmail.com not found!");
    console.log(`✓ Step 2: Student A found (${studentA.name}, Dept: ${studentA.department})`);

    // 3. Create or find Ineligible Student B (IT Department)
    studentB = await User.findOne({ email: "studentIT_test@gmail.com" });
    if (!studentB) {
      studentB = await User.create({
        name: "StudentIT Test",
        email: "studentIT_test@gmail.com",
        password: "password123",
        role: "student",
        department: "Information Technology",
        semester: 3,
        enrollmentNo: "IT999999",
      });
    }
    console.log(`✓ Step 3: Student B found (${studentB.name}, Dept: ${studentB.department})`);

    // 4. Create Test Subject for CE Department
    const timestamp = Date.now();
    let ceDept = await Department.findOne({ code: "CE" });
    if (!ceDept) ceDept = await Department.findOne({ name: /computer/i });

    let ceCourse = await Course.findOne({ department: ceDept?._id });
    if (!ceCourse) {
      ceCourse = await Course.create({
        name: "B.Tech Computer Engineering Test",
        code: `BTECH_CE_${timestamp}`,
        department: ceDept?._id || new mongoose.Types.ObjectId(),
        durationYears: 4,
      });
    }

    testSubject = await Subject.create({
      name: `E2E Flow Subject ${timestamp}`,
      code: `SUB_${timestamp.toString().slice(-4)}`,
      department: ceDept ? ceDept._id : new mongoose.Types.ObjectId(),
      course: ceCourse._id,
      semester: 5,
      credits: 4,
      faculty: faculty._id,
    });
    console.log(`✓ Step 4: Test Subject created ("${testSubject.name}", Code: ${testSubject.code})`);

    // 5. Faculty Creates Unique Test Exam: STUDENT_VISIBILITY_TEST_<timestamp>
    const examTitle = `STUDENT_VISIBILITY_TEST_${timestamp}`;
    const now = new Date();
    const startTime = new Date(now.getTime() - 5 * 60 * 1000); // 5 mins ago
    const endTime = new Date(now.getTime() + 120 * 60 * 1000); // 2 hours from now

    testExam = await examService.createExam({
      title: examTitle,
      subject: testSubject._id,
      examType: "Mid-Term",
      examDate: startTime,
      startTime: startTime,
      endTime: endTime,
      duration: 60,
      totalMarks: 50,
      instructions: "E2E Test Instructions",
      questions: [
        {
          questionText: "What is an Operating System process?",
          maximumMarks: 50,
          modelAnswer: "A process is an instance of a computer program that is being executed.",
          rubric: "Key concepts: program in execution, memory layout, PCB.",
        }
      ],
    }, faculty._id);
    console.log(`✓ Step 5: Faculty created exam ("${testExam.title}", ID: ${testExam._id}, Status: ${testExam.examStatus})`);

    // 6. Verify MongoDB persistence
    const savedExam = await Exam.findById(testExam._id).lean();
    if (!savedExam) throw new Error("Exam not found in MongoDB!");
    console.log(`✓ Step 6: Verified Exam document in MongoDB (isPublished: ${savedExam.isPublished})`);

    // 7. Faculty Publishes Exam
    const publishedExam = await Exam.findByIdAndUpdate(
      testExam._id,
      { $set: { isPublished: true, examStatus: "Published" } },
      { new: true }
    );
    console.log(`✓ Step 7: Faculty published exam (isPublished: ${publishedExam.isPublished}, examStatus: "${publishedExam.examStatus}")`);

    // 8. Call Student Exam API for Eligible Student A
    const resA = await getStudentExams(studentA._id, { page: 1, limit: 20 });
    const foundExamA = resA.exams.find(e => e.id.toString() === testExam._id.toString());

    if (!foundExamA) {
      throw new Error(`CRITICAL FAIL: Published exam "${examTitle}" NOT visible in Student A's portal!`);
    }
    console.log(`✓ Step 8: Student A portal API returned exam ("${foundExamA.title}", Status: "${foundExamA.status}", CanEnter: ${foundExamA.canEnter})`);

    // 9. Call Student Exam API for Ineligible Student B (IT Dept / Sem 3 vs CE Dept / Sem 5)
    const resB = await getStudentExams(studentB._id, { page: 1, limit: 100 });
    const foundExamB = resB.exams.find(e => e.id.toString() === testExam._id.toString());

    if (foundExamB) {
      throw new Error(`CRITICAL SECURITY FAIL: Ineligible Student B received CE exam "${examTitle}"!`);
    }
    console.log(`✓ Step 9: Ineligible Student B correctly blocked from seeing CE exam (Data Isolation & Security Verified!)`);

    console.log("\n=================================================");
    console.log("🎉 FACULTY → STUDENT EXAM FLOW VERIFIED 100% SUCCESS!");
    console.log("=================================================\n");

  } catch (err) {
    console.error("\n❌ FULL FLOW TEST FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    if (testExam) await Exam.findByIdAndDelete(testExam._id);
    if (testSubject) await Subject.findByIdAndDelete(testSubject._id);
    if (studentB && studentB.email === "studentIT_test@gmail.com") await User.findByIdAndDelete(studentB._id);
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

runFullFlowTest();
