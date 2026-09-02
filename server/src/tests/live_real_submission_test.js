import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-evaluation';
const SAMPLE_IMAGE_PATH = fs.existsSync(path.join(process.cwd(), 'ocr-service', 'tests', 'sample_images', 'Handwritten page2.jpg'))
  ? path.join(process.cwd(), 'ocr-service', 'tests', 'sample_images', 'Handwritten page2.jpg')
  : path.join(process.cwd(), '..', 'ocr-service', 'tests', 'sample_images', 'Handwritten page2.jpg');

async function runLiveRealSubmission() {
  console.log("==========================================================");
  console.log("   LIVE REAL SUBMISSION OCR PIPELINE TRACING TEST        ");
  console.log("==========================================================\n");

  if (!fs.existsSync(SAMPLE_IMAGE_PATH)) {
    console.error(`❌ Sample image missing at path: ${SAMPLE_IMAGE_PATH}`);
    process.exit(1);
  }
  console.log(`✅ Sample image verified: ${SAMPLE_IMAGE_PATH}`);

  await mongoose.connect(MONGO_URI);
  console.log("✅ Step 1: Connected to MongoDB.");

  const { default: AnswerSheet } = await import('../models/AnswerSheet.js');
  const { default: Exam } = await import('../models/Exam.js');
  const { default: User } = await import('../models/User.js');
  const { processAnswerSheetBackground, getAnswerSheetById } = await import('../services/answerSheet.service.js');

  // Retrieve an existing student user or create dummy
  let student = await User.findOne({ role: 'student', isDeleted: false });
  if (!student) {
    student = await User.create({
      name: "Test Student",
      email: "teststudent@example.com",
      password: "password123",
      role: "student",
      rollNo: "TEST1001",
      department: "Computer Engineering",
      semester: 5
    });
  }

  // Retrieve an existing exam
  let exam = await Exam.findOne({ isDeleted: false });
  if (!exam) {
    exam = await Exam.create({
      title: "Live Handwriting Evaluation Exam",
      code: "LIVE202",
      examType: "Midterm",
      examDate: new Date(),
      subject: new mongoose.Types.ObjectId(),
      questions: [
        { _id: new mongoose.Types.ObjectId(), questionNumber: 1, questionText: "Handwriting sample evaluation.", maximumMarks: 10 }
      ],
      totalMarks: 10,
      duration: 60,
      createdBy: student._id,
      updatedBy: student._id
    });
  }
  console.log(`✅ Step 2: Exam & Student verified. Exam ID: ${exam._id}, Student ID: ${student._id}`);

  // Create initial AnswerSheet document
  const answerSheet = await AnswerSheet.create({
    student: student._id,
    subject: exam.subject || new mongoose.Types.ObjectId(),
    exam: exam._id,
    uploadedFileName: "Handwritten page2.jpg",
    uploadedFileUrl: SAMPLE_IMAGE_PATH,
    processingStatus: "processing",
    ocrStatus: "processing",
    segmentationStatus: "processing",
    uploadStatus: "Uploading",
    submissionStatus: "Submitted",
    submissionType: "UPLOAD",
    createdBy: student._id,
    updatedBy: student._id
  });
  console.log(`✅ Step 3: Created AnswerSheet document in MongoDB. ID: ${answerSheet._id}`);

  // Read sample file buffer
  const fileBuffer = fs.readFileSync(SAMPLE_IMAGE_PATH);

  console.log("\n--- Triggering Express Background OCR Processing Pipeline ---");
  const startTime = Date.now();

  try {
    await processAnswerSheetBackground(
      answerSheet._id,
      fileBuffer,
      "image/jpeg",
      "Handwritten page2.jpg",
      exam._id,
      student._id,
      student._id
    );
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Step 4: Background OCR Pipeline completed in ${durationSec} seconds.`);
  } catch (procErr) {
    console.error(`❌ Background OCR Processing Failed: ${procErr.message}`);
    console.error(procErr.stack);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Step 5: Verify MongoDB Document
  const updatedSheet = await AnswerSheet.findById(answerSheet._id).lean();
  console.log("\n--- STAGE D: MongoDB Storage Inspection ---");
  console.log(`Processing Status: ${updatedSheet.processingStatus}`);
  console.log(`Answers Length: ${updatedSheet.answers?.length || 0}`);
  console.log(`Extracted Text:\n"${updatedSheet.extractedText}"`);

  const hasMongoText = !!(updatedSheet.extractedText || updatedSheet.answers?.[0]?.recognizedText);
  console.log(`Stage D MongoDB Text Present: ${hasMongoText ? 'YES (PASS)' : 'NO (FAIL)'}`);

  // Step 6: Test Express GET API Response
  console.log("\n--- STAGE E: Express GET API Response Inspection ---");
  const apiResponseSheet = await getAnswerSheetById(answerSheet._id);

  console.log(`digital_answers Array Present: ${Array.isArray(apiResponseSheet.digital_answers)}`);
  console.log(`digital_answers Count: ${apiResponseSheet.digital_answers?.length || 0}`);
  const q1Text = apiResponseSheet.digital_answers?.[0]?.text || apiResponseSheet.digital_answers?.[0]?.answer_text;
  console.log(`Q1 Digital Text: "${q1Text}"`);

  const hasApiText = !!q1Text && q1Text.trim().length > 0;
  console.log(`Stage E GET API Text Present: ${hasApiText ? 'YES (PASS)' : 'NO (FAIL)'}`);

  // Step 7: Simulate React Client normalizeSheetData Execution
  console.log("\n--- STAGE F: React Normalization Inspection ---");
  const extractText = (ans) => ans?.text ?? ans?.answer_text ?? ans?.recognizedText ?? ans?.extracted_text ?? ans?.extractedText ?? '';

  const frontendDigitalAnswers = apiResponseSheet.digital_answers.map((ans, idx) => ({
    ...ans,
    question_number: String(ans.question_number || idx + 1),
    text: extractText(ans),
    answer_text: extractText(ans),
    recognizedText: extractText(ans)
  }));

  const frontendRenderText = frontendDigitalAnswers[0]?.text;
  console.log(`Frontend Render Text: "${frontendRenderText}"`);

  const hasFrontendText = !!frontendRenderText && frontendRenderText.trim().length > 0;
  console.log(`Stage F React Normalization Text Present: ${hasFrontendText ? 'YES (PASS)' : 'NO (FAIL)'}`);

  console.log("\n==========================================================");
  console.log(`   ANSWER SHEET ID FOR UI BROWSER VERIFICATION: ${answerSheet._id}`);
  console.log("==========================================================\n");

  await mongoose.disconnect();
}

runLiveRealSubmission().catch((err) => {
  console.error("❌ Live Submission Test Error:", err);
  process.exit(1);
});
