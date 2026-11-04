import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import env from "../src/config/env.js";
import User from "../src/models/User.js";
import Department from "../src/models/Department.js";
import Course from "../src/models/Course.js";
import Subject from "../src/models/Subject.js";
import Exam from "../src/models/Exam.js";
import AnswerKey from "../src/models/AnswerKey.js";
import { ROLES } from "../src/constants/roles.js";

async function seedData() {
  console.log("Connecting to MongoDB:", env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  try {
    const defaultPassword = "Password123!";

    // 1. Department
    let dept = await Department.findOne({ $or: [{ code: "CE" }, { name: "Computer Engineering" }] });
    if (!dept) {
      dept = await Department.create({
        name: "Computer Engineering",
        code: "CE",
        isActive: true,
      });
      console.log("Created Department: Computer Engineering (CE)");
    } else {
      console.log("Found existing Department:", dept.name);
    }

    // 2. Course
    let course = await Course.findOne({ $or: [{ code: "BTECH-CE" }, { name: "B.Tech Computer Engineering" }] });
    if (!course) {
      course = await Course.create({
        department: dept._id,
        name: "B.Tech Computer Engineering",
        code: "BTECH-CE",
        durationYears: 4,
        totalSemesters: 8,
      });
      console.log("Created Course: B.Tech Computer Engineering");
    } else {
      console.log("Found existing Course:", course.name);
    }

    // 3. Student User
    let student = await User.findOne({ email: "student@test.com" });
    if (!student) {
      student = await User.create({
        name: "Test Student",
        email: "student@test.com",
        password: defaultPassword,
        role: ROLES.STUDENT,
        studentId: "STUD-BDA-001",
        semester: 5,
        department: "CE",
        isActive: true,
        isDeleted: false,
      });
      console.log("Created Student: student@test.com");
    } else {
      student.password = defaultPassword;
      student.role = ROLES.STUDENT;
      student.semester = 5;
      student.department = "CE";
      student.isDeleted = false;
      await student.save();
      console.log("Updated Student: student@test.com");
    }

    // 4. Faculty User
    let faculty = await User.findOne({ email: "faculty@test.com" });
    if (!faculty) {
      faculty = await User.create({
        name: "Test Faculty",
        email: "faculty@test.com",
        password: defaultPassword,
        role: ROLES.FACULTY,
        lecturerId: "FAC-BDA-001",
        department: "CE",
        isActive: true,
        isDeleted: false,
      });
      console.log("Created Faculty: faculty@test.com");
    } else {
      faculty.password = defaultPassword;
      faculty.role = ROLES.FACULTY;
      faculty.department = "CE";
      faculty.isDeleted = false;
      await faculty.save();
      console.log("Updated Faculty: faculty@test.com");
    }

    // 5. Admin User
    let admin = await User.findOne({ email: "admin@test.com" });
    if (!admin) {
      admin = await User.create({
        name: "Test Admin",
        email: "admin@test.com",
        password: defaultPassword,
        role: ROLES.ADMIN,
        employeeId: "ADM-BDA-001",
        department: "CE",
        isActive: true,
        isDeleted: false,
      });
      console.log("Created Admin: admin@test.com");
    } else {
      admin.password = defaultPassword;
      admin.role = ROLES.ADMIN;
      admin.isDeleted = false;
      await admin.save();
      console.log("Updated Admin: admin@test.com");
    }

    // 6. Subject
    let subject = await Subject.findOne({ $or: [{ code: "BDA-501" }, { name: "Big Data Analytics" }] });
    if (!subject) {
      subject = await Subject.create({
        name: "Big Data Analytics",
        code: "BDA-501",
        semester: 5,
        credits: 4,
        faculty: faculty._id,
        course: course._id,
      });
      console.log("Created Subject: Big Data Analytics (BDA-501)");
    } else {
      console.log("Found existing Subject:", subject.name);
    }

    // 7. Exam: "Big Data Analytics — End-to-End Test"
    const q1Id = new mongoose.Types.ObjectId();
    const q2Id = new mongoose.Types.ObjectId();
    const q3Id = new mongoose.Types.ObjectId();

    let exam = await Exam.findOne({ title: "Big Data Analytics — End-to-End Test" });
    if (exam) {
      console.log("Exam already exists ID:", exam._id);
    } else {
      exam = await Exam.create({
        title: "Big Data Analytics — End-to-End Test",
        examType: "Final",
        subject: subject._id,
        course: course._id,
        department: dept._id,
        academicYear: "2026-2027",
        semester: 5,
        examDate: new Date(),
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 86400000),
        duration: 180,
        totalMarks: 15,
        passingMarks: 6,
        examStatus: "Published",
        isPublished: true,
        createdBy: faculty._id,
        questions: [
          {
            _id: q1Id,
            questionNumber: 1,
            questionText: "What is Hadoop? Explain its major components.",
            maximumMarks: 5,
            required: true,
          },
          {
            _id: q2Id,
            questionNumber: 2,
            questionText: "Explain the architecture of HDFS.",
            maximumMarks: 5,
            required: true,
          },
          {
            _id: q3Id,
            questionNumber: 3,
            questionText: "Differentiate between MapReduce and Spark.",
            maximumMarks: 5,
            required: true,
          },
        ],
      });
      console.log("Created Exam: Big Data Analytics — End-to-End Test (ID:", exam._id, ")");
    }

    // Extract Question IDs from created or existing exam
    const question1Obj = exam.questions.find((q) => q.questionNumber === 1);
    const question2Obj = exam.questions.find((q) => q.questionNumber === 2);
    const question3Obj = exam.questions.find((q) => q.questionNumber === 3);

    // 8. AnswerKey
    let answerKey = await AnswerKey.findOne({ examId: exam._id });
    if (answerKey) {
      console.log("AnswerKey already exists ID:", answerKey._id);
    } else {
      answerKey = await AnswerKey.create({
        examId: exam._id,
        version: 1,
        isActive: true,
        uploadedBy: faculty._id,
        fileName: "bda_end_to_end_answer_key.pdf",
        fileType: "application/pdf",
        fileUrl: "/uploads/keys/bda_end_to_end_answer_key.pdf",
        uploadStatus: "Approved",
        extractedText: "Official Answer Key for Big Data Analytics (Hadoop, HDFS, MapReduce vs Spark).",
        parsedAnswers: [
          {
            questionId: question1Obj._id,
            questionNumber: 1,
            questionText: "What is Hadoop? Explain its major components.",
            answerText: "Hadoop is an open-source framework for distributed storage and processing of large datasets. Its core components are HDFS (storage), MapReduce (processing), YARN (resource management), and Common utilities.",
            maximumMarks: 5,
            keywords: ["hadoop", "hdfs", "mapreduce", "yarn", "distributed", "framework", "storage", "processing"],
            rubric: [
              { criteria: "Definition of Hadoop framework", marks: 2 },
              { criteria: "Explanation of HDFS, MapReduce, and YARN", marks: 3 },
            ],
          },
          {
            questionId: question2Obj._id,
            questionNumber: 2,
            questionText: "Explain the architecture of HDFS.",
            answerText: "HDFS uses a master-slave architecture. NameNode is the master managing metadata and block locations. DataNodes are slaves storing actual data blocks with a default replication factor of 3 for fault tolerance.",
            maximumMarks: 5,
            keywords: ["hdfs", "namenode", "datanode", "master-slave", "blocks", "replication", "fault tolerance"],
            rubric: [
              { criteria: "NameNode role and metadata management", marks: 2 },
              { criteria: "DataNode role and block storage", marks: 2 },
              { criteria: "Replication and fault tolerance", marks: 1 },
            ],
          },
          {
            questionId: question3Obj._id,
            questionNumber: 3,
            questionText: "Differentiate between MapReduce and Spark.",
            answerText: "MapReduce processes data on disk in batches, resulting in high I/O overhead. Spark processes data in-memory using Resilient Distributed Datasets (RDDs), providing up to 100x faster execution and supporting real-time stream processing.",
            maximumMarks: 5,
            keywords: ["mapreduce", "spark", "in-memory", "rdd", "disk-based", "batch", "speed", "latency"],
            rubric: [
              { criteria: "Disk vs In-Memory execution model", marks: 2.5 },
              { criteria: "Performance, RDDs, and stream processing comparison", marks: 2.5 },
            ],
          },
        ],
      });
      console.log("Created AnswerKey ID:", answerKey._id);
    }

    console.log("\n--- SEED DATA VERIFICATION COMPLETE ---");
    console.log("Student User: student@test.com / Password123!");
    console.log("Faculty User: faculty@test.com / Password123!");
    console.log("Admin User  : admin@test.com   / Password123!");
    console.log("Exam ID     :", exam._id.toString());

  } catch (err) {
    console.error("Error seeding data:", err);
  } finally {
    await mongoose.disconnect();
  }
}

seedData();
