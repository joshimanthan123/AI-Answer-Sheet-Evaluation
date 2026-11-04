import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function runRealHandwritingE2ETest() {
  console.log("=========================================================================");
  console.log("       REAL HANDWRITING RECOGNITION BACKEND E2E VALIDATION TEST          ");
  console.log("=========================================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai_evaluation_db";
  console.log(`Connecting to MongoDB at: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log("MongoDB connection established.");

  // Dynamic import models after connection
  const { User } = await import("../models/User.js");
  const { Exam } = await import("../models/Exam.js");
  const { AnswerSheet } = await import("../models/AnswerSheet.js");
  const { generateStrokesForText } = await import("./test_final_complete_live_e2e.js");
  const { processDigitalExamHWRBackground } = await import("../services/studentExam.service.js");

  try {
    // 1. Fetch or verify existing student user
    let student = await User.findOne({ role: "student" });
    if (!student) {
      console.log("No student user found. Creating test student user...");
      student = await User.create({
        name: "Test Student HWR",
        email: `student_hwr_${Date.now()}@example.com`,
        password: "hashedPassword123",
        role: "student",
        department: "Computer Engineering",
        academicYear: "3rd Year",
      });
    }
    console.log(`Using Student User: ${student.name} (${student.email})`);

    // 2. Fetch or create test Exam
    let exam = await Exam.findOne({ isPublished: true });
    if (!exam) {
      exam = await Exam.findOne();
    }
    if (!exam) {
      throw new Error("No active exam found in database.");
    }
    console.log(`Using Test Exam: ${exam.title} (${exam._id})`);

    const questions = exam.questions || [];
    if (questions.length === 0) {
      throw new Error(`No questions found in exam ${exam._id}`);
    }
    console.log(`Found ${questions.length} embedded questions for exam.`);

    // 3. Construct digital canvas answer payload
    const testAnswers = [
      {
        questionId: questions[0]._id,
        handwrittenData: JSON.stringify({
          strokes: generateStrokesForText("PROCESS MANAGEMENT PCB"),
          canvasWidth: 800,
          canvasHeight: 600,
        }),
      },
    ];

    if (questions.length > 1) {
      testAnswers.push({
        questionId: questions[1]._id,
        handwrittenData: JSON.stringify({
          strokes: generateStrokesForText("TCP CONNECTION RELIABLE"),
          canvasWidth: 800,
          canvasHeight: 600,
        }),
      });
    }

    // 4. Create AnswerSheet directly and trigger background processing
    const answerSheet = await AnswerSheet.create({
      student: student._id,
      subject: exam.subject,
      exam: exam._id,
      submissionType: "DIGITAL",
      submissionStatus: "Submitted",
      processingStatus: "processing",
      answers: testAnswers.map((ans) => ({
        questionId: ans.questionId,
        handwrittenData: ans.handwrittenData,
        hwrStatus: "Pending",
      })),
      submittedAt: new Date(),
    });

    console.log(`Created AnswerSheet ${answerSheet._id}. Triggering background HWR processing...`);
    await processDigitalExamHWRBackground(answerSheet._id);

    // 5. Fetch updated AnswerSheet and assert fields
    const updatedSheet = await AnswerSheet.findById(answerSheet._id);
    console.log(`\nHWR Processing Status: ${updatedSheet.processingStatus}`);

    let allOk = true;
    updatedSheet.answers.forEach((ans, idx) => {
      console.log(`--- Question ${idx + 1} ---`);
      console.log(`  Recognized Text:    '${ans.recognizedText}'`);
      console.log(`  Confidence:         ${ans.confidence}`);
      console.log(`  OCR Quality Status: ${ans.ocrQualityStatus}`);
      console.log(`  Needs Review:       ${ans.needsReview}`);
      console.log(`  Provider:           ${ans.provider}`);

      if (!ans.recognizedText || ans.hwrStatus !== "Completed") {
        allOk = false;
      }
    });

    console.log("\n=========================================================================");
    console.log(`VERDICT: ${allOk ? "PASS" : "FAIL"}`);
    console.log("=========================================================================");

    // Clean up test answer sheet
    await AnswerSheet.findByIdAndDelete(answerSheet._id);
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await mongoose.disconnect();
  }
}

runRealHandwritingE2ETest().catch((err) => {
  console.error("Test failed with error:", err.stack || err);
  process.exit(1);
});
