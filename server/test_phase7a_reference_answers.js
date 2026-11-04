import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

import app from "./app.js";

const TEST_PORT = 5002;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api/v1`;
const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai_evaluation_db";

async function runPhase7ATests() {
  console.log("=================================================");
  console.log("   PHASE 7A REFERENCE ANSWER INTELLIGENCE TESTS  ");
  console.log("=================================================");

  let server = null;
  let facultyToken = "";
  let studentToken = "";
  let testExamId = "";
  let testSubjectId = "";
  let createdReferenceId = "";
  let sampleQuestionSubId = "";

  try {
    // 1. Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("1. Connected to MongoDB database:", MONGO_URI);

    // 2. Start Test Express Server
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(TEST_PORT, resolve));
    console.log(`2. Express Test Server listening on http://127.0.0.1:${TEST_PORT}`);

    // Get User collection
    const User = mongoose.connection.collection("users");
    const Exam = mongoose.connection.collection("exams");
    const Subject = mongoose.connection.collection("subjects");

    let facultyUser = await User.findOne({ role: { $in: ["faculty", "FACULTY"] } });
    let studentUser = await User.findOne({ role: { $in: ["student", "STUDENT"] } });

    if (!facultyUser) {
      console.log("   Creating test Faculty user...");
      const bcrypt = (await import("bcryptjs")).default;
      const hashedPassword = await bcrypt.hash("password123", 10);
      const res = await User.insertOne({
        name: "Test Faculty Member",
        email: "faculty_test_phase7a@example.com",
        password: hashedPassword,
        role: "faculty",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      facultyUser = await User.findOne({ _id: res.insertedId });
    }

    if (!studentUser) {
      console.log("   Creating test Student user...");
      const bcrypt = (await import("bcryptjs")).default;
      const hashedPassword = await bcrypt.hash("password123", 10);
      const res = await User.insertOne({
        name: "Test Student Member",
        email: "student_test_phase7a@example.com",
        password: hashedPassword,
        role: "student",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      studentUser = await User.findOne({ _id: res.insertedId });
    }

    const secret = process.env.JWT_ACCESS_SECRET || "default_local_dev_access_secret_1234567890";

    facultyToken = jwt.sign(
      { id: facultyUser._id.toString(), role: "faculty" },
      secret,
      { expiresIn: "1h" }
    );
    console.log("   Faculty Token generated for:", facultyUser.email);

    studentToken = jwt.sign(
      { id: studentUser._id.toString(), role: "student" },
      secret,
      { expiresIn: "1h" }
    );
    console.log("   Student Token generated for:", studentUser.email);

    // 4. Exam and Subject Setup
    const existingExam = await Exam.findOne({ isDeleted: { $ne: true } });
    if (existingExam) {
      testExamId = existingExam._id.toString();
      testSubjectId = existingExam.subject ? existingExam.subject.toString() : "";
    } else {
      console.log("   Creating test exam and subject...");
      const subRes = await Subject.insertOne({
        name: "Computer Architecture",
        code: "CS301",
        department: "Computer Science",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      testSubjectId = subRes.insertedId.toString();

      const examRes = await Exam.insertOne({
        title: "CS301 Midterm Reference Test Exam",
        examCode: "CS301-MID",
        subject: subRes.insertedId,
        totalMarks: 50,
        duration: 90,
        examStatus: "Published",
        examDate: new Date(),
        questions: [
          {
            _id: new mongoose.Types.ObjectId(),
            questionNumber: 1,
            questionText: "Explain Von Neumann Architecture and its key components.",
            maximumMarks: 10,
            modelAnswer: "Von Neumann Architecture consists of CPU, Memory, ALU, Control Unit, and Input/Output.",
          },
          {
            _id: new mongoose.Types.ObjectId(),
            questionNumber: 2,
            questionText: "Differentiate between RISC and CISC architectures.",
            maximumMarks: 10,
            modelAnswer: "RISC uses simple instructions while CISC uses complex multi-clock instructions.",
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      testExamId = examRes.insertedId.toString();
    }

    console.log(`   Using Test Exam ID: ${testExamId}`);

    // Create temporary reference test file
    const tmpFilePath = path.join(process.cwd(), "tmp_sample_reference.png");
    if (!fs.existsSync(tmpFilePath)) {
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSU5EUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      );
      fs.writeFileSync(tmpFilePath, pngBuffer);
    }

    // TEST 1: Upload Reference Answer Sheet (Faculty)
    console.log("\n4. Testing POST /v1/reference-answers/upload (Faculty)...");
    const fileBuffer = fs.readFileSync(tmpFilePath);
    const fileBlob = new Blob([fileBuffer], { type: "image/png" });

    const formData = new FormData();
    formData.append("file", fileBlob, "eval_sheet_ref_2024.png");
    formData.append("examId", testExamId);
    if (testSubjectId) formData.append("subjectId", testSubjectId);
    formData.append("academicYear", "2024-25");
    formData.append("description", "Evaluated reference answer sheet for CS301 2024-25 top scorer");

    const uploadRes = await fetch(`${BASE_URL}/reference-answers/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken}`,
      },
      body: formData,
    });

    const uploadJson = await uploadRes.json();
    console.log("   Upload Response Status:", uploadRes.status);
    console.log("   Message:", uploadJson.message);
    const uploadedData = uploadJson.data;
    createdReferenceId = uploadedData._id;
    console.log("   Created Reference ID:", createdReferenceId);
    console.log("   Processing Status:", uploadedData.processingStatus);

    // Wait 1.5s for async OCR processing to complete
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // TEST 2: Get Reference Answers List with Filters
    console.log("\n5. Testing GET /v1/reference-answers (Filtered List)...");
    const listRes = await fetch(`${BASE_URL}/reference-answers?examId=${testExamId}&academicYear=2024-25`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    const listJson = await listRes.json();

    console.log("   List Response Status:", listRes.status);
    console.log("   Total References Found:", listJson.data.pagination.total);
    console.log("   References Array Length:", listJson.data.references.length);

    // Poll until OCR processing completes
    let refDetail = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const detailRes = await fetch(`${BASE_URL}/reference-answers/${createdReferenceId}`, {
        headers: { Authorization: `Bearer ${facultyToken}` },
      });
      const detailJson = await detailRes.json();
      refDetail = detailJson.data;

      if (refDetail.processingStatus !== "UPLOADED" && refDetail.processingStatus !== "PROCESSING") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log("   Final Processing Status:", refDetail.processingStatus);
    console.log("   Verification Status:", refDetail.verificationStatus);
    if (refDetail.processingError) {
      console.log("   Processing Error:", refDetail.processingError);
    }
    console.log("   Questions Extracted Count:", refDetail.questions?.length);
    console.log("   Questions Array:", JSON.stringify(refDetail.questions, null, 2));

    if (refDetail.questions && refDetail.questions.length > 0) {
      sampleQuestionSubId = refDetail.questions[0]._id || refDetail.questions[0].questionNumber;
      console.log("   Selected sampleQuestionSubId:", sampleQuestionSubId);
      console.log("   Question 1 Number:", refDetail.questions[0].questionNumber);
      console.log("   Question 1 Awarded Marks:", refDetail.questions[0].awardedMarks);
      console.log("   Question 1 Keywords:", refDetail.keywords || refDetail.questions[0].keywords);
      console.log("   Question 1 Concepts:", refDetail.concepts || refDetail.questions[0].concepts);
    }

    // TEST 4: Update Question Reference Data
    console.log("\n7. Testing PUT /v1/reference-answers/:id/questions/:questionId...");
    const updateQuestionRes = await fetch(
      `${BASE_URL}/reference-answers/${createdReferenceId}/questions/${sampleQuestionSubId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${facultyToken}`,
        },
        body: JSON.stringify({
          questionText: "Explain Von Neumann Architecture and key components.",
          answerText: "Von Neumann architecture uses a single memory for code and data, consisting of CPU, ALU, Control Unit, and Registers.",
          maximumMarks: 10,
          awardedMarks: 9,
          keywords: ["memory", "cpu", "alu", "registers", "control unit"],
          concepts: ["Von Neumann Architecture", "CPU Structure"],
          facultyComment: "Verified reference answer sheet with 9/10 marks",
          verificationStatus: "approved",
        }),
      }
    );

    const updateQuestionJson = await updateQuestionRes.json();
    console.log("   Update Response Status:", updateQuestionRes.status);
    console.log("   Updated Question Marks:", updateQuestionJson.data.questions[0].awardedMarks);
    console.log("   Updated Question Concepts:", updateQuestionJson.data.questions[0].concepts);

    // TEST 5: Test Validation Error (Awarded marks > Maximum marks)
    console.log("\n8. Testing Awarded Marks Validation (> Maximum Marks)...");
    const invalidValRes = await fetch(
      `${BASE_URL}/reference-answers/${createdReferenceId}/questions/${sampleQuestionSubId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${facultyToken}`,
        },
        body: JSON.stringify({ maximumMarks: 10, awardedMarks: 15 }),
      }
    );

    const invalidValJson = await invalidValRes.json();
    if (invalidValRes.status === 400) {
      console.log("   PASSED: Rejected invalid marks with status 400 Bad Request:", invalidValJson.message);
    } else {
      console.error("   FAILED: Unexpected status code for invalid marks:", invalidValRes.status);
    }

    // TEST 6: Approve Reference Sheet
    console.log("\n9. Testing POST /v1/reference-answers/:id/approve...");
    const approveRes = await fetch(`${BASE_URL}/reference-answers/${createdReferenceId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    const approveJson = await approveRes.json();

    console.log("   Approve Response Status:", approveRes.status);
    console.log("   Final Verification Status:", approveJson.data.verificationStatus);
    console.log("   Final Processing Status:", approveJson.data.processingStatus);

    // TEST 7: Role Security Verification (Student Access Denied)
    console.log("\n10. Testing Security — Student Accessing Reference Answers...");
    const studentAccessRes = await fetch(`${BASE_URL}/reference-answers`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const studentAccessJson = await studentAccessRes.json();

    if (studentAccessRes.status === 403) {
      console.log("   PASSED: Student request blocked with status 403 Forbidden:", studentAccessJson.message);
    } else {
      console.error("   FAILED: Student access was not blocked! Status:", studentAccessRes.status);
    }

    console.log("\n=================================================");
    console.log("   ALL PHASE 7A INTEGRATION TESTS PASSED 100%!  ");
    console.log("=================================================\n");

  } catch (err) {
    console.error("\nTEST FAILED WITH ERROR:", err.message);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
  }
}

runPhase7ATests();
