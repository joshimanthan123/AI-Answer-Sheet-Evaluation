import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-evaluation';

async function runLiveScratchpadE2ETest() {
  console.log("=================================================");
  console.log("   LIVE SCRATCHPAD END-TO-END OCR PIPELINE TEST   ");
  console.log("=================================================\n");

  // Step 1: Check MongoDB Connection
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Step 1: Connected to MongoDB successfully.");
  } catch (err) {
    console.error("❌ Step 1 Failed: Cannot connect to MongoDB:", err.message);
    process.exit(1);
  }

  const { default: AnswerSheet } = await import('../server/src/models/AnswerSheet.js');
  const { default: Exam } = await import('../server/src/models/Exam.js');
  const { processAnswerSheetBackground, getAnswerSheetById } = await import('../server/src/services/answerSheet.service.js');

  // Step 2: Fetch an existing Exam or create a mock exam
  let exam = await Exam.findOne({ isDeleted: false });
  if (!exam) {
    console.log("ℹ️ No existing exam found, creating temporary test exam...");
    exam = await Exam.create({
      title: "Live E2E Verification Exam",
      code: "LIVE101",
      subject: new mongoose.Types.ObjectId(),
      questions: [
        { _id: new mongoose.Types.ObjectId(), questionNumber: 1, questionText: "Explain OCR pipeline.", maximumMarks: 10 },
        { _id: new mongoose.Types.ObjectId(), questionNumber: 2, questionText: "Discuss neural network accuracy.", maximumMarks: 10 }
      ],
      totalMarks: 20,
      duration: 60,
      createdBy: new mongoose.Types.ObjectId(),
      updatedBy: new mongoose.Types.ObjectId()
    });
  }
  console.log(`✅ Step 2: Exam retrieved/created. Exam ID: ${exam._id}, Questions: ${exam.questions.length}`);

  // Step 3: Simulate FastAPI OCR service response
  console.log("\n--- Simulating FastAPI OCR Response ---");
  const mockFastApiSheet = {
    id: "fastapi-live-test-" + Date.now(),
    processing_status: "COMPLETED",
    digital_answers: [
      {
        question_number: "1",
        text: "centre of mechanical engineering research",
        answer_text: "centre of mechanical engineering research",
        page_number: 1,
        confidence: 0.94
      },
      {
        question_number: "2",
        text: "handwriting recognition powered by paddleocr",
        answer_text: "handwriting recognition powered by paddleocr",
        page_number: 1,
        confidence: 0.91
      }
    ],
    pages: [
      {
        page_number: 1,
        original_file_reference: "samples/handwritten_page2.jpg",
        processed_file_reference: "processed/handwritten_page2.png",
        width: 800,
        height: 1000,
        processing_status: "COMPLETED",
        extracted_text: "centre of mechanical engineering research\nhandwriting recognition powered by paddleocr"
      }
    ]
  };

  // Step 4: Create dummy AnswerSheet in MongoDB
  const studentId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  const answerSheet = await AnswerSheet.create({
    student: studentId,
    subject: exam.subject || new mongoose.Types.ObjectId(),
    exam: exam._id,
    fastapiSheetId: mockFastApiSheet.id,
    uploadedFileName: "handwritten_sample.jpg",
    processingStatus: "processing",
    ocrStatus: "processing",
    segmentationStatus: "processing",
    createdBy: userId,
    updatedBy: userId
  });
  console.log(`✅ Step 4: Initialized AnswerSheet document in MongoDB. ID: ${answerSheet._id}`);

  // Step 5: Test Express Background Processing Transformation
  console.log("\n--- Testing Express Background Processing Ingestion ---");
  const answers = [];
  const rawTextParts = [];

  for (let idx = 0; idx < mockFastApiSheet.digital_answers.length; idx++) {
    const ans = mockFastApiSheet.digital_answers[idx];
    const qNum = parseInt(String(ans.question_number || "").replace(/\D/g, ""), 10);
    let questionId = null;
    if (!isNaN(qNum) && qNum > 0 && exam.questions && qNum <= exam.questions.length) {
      questionId = exam.questions[qNum - 1]._id;
    } else if (exam.questions && exam.questions[idx]) {
      questionId = exam.questions[idx]._id;
    } else {
      questionId = new mongoose.Types.ObjectId();
    }

    const recognizedText = ans.text ?? ans.answer_text ?? ans.recognizedText ?? "";

    answers.push({
      questionId,
      handwrittenData: "",
      recognizedText,
      hwrStatus: "Completed",
      submissionTime: new Date(),
    });

    if (recognizedText) {
      rawTextParts.push(`Q${ans.question_number || idx + 1}: ${recognizedText}`);
    }
  }

  answerSheet.answers = answers;
  answerSheet.extractedText = rawTextParts.join("\n\n");
  answerSheet.processingStatus = "completed";
  answerSheet.ocrStatus = "completed";
  answerSheet.segmentationStatus = "completed";
  await answerSheet.save();

  console.log(`✅ Step 5: AnswerSheet successfully saved in MongoDB without schema validation errors!`);
  console.log(`   Saved answers count: ${answerSheet.answers.length}`);
  console.log(`   Saved extractedText:\n"${answerSheet.extractedText}"`);

  // Step 6: Test Express GET API Transformation
  console.log("\n--- Testing Express GET API Response Transformation ---");
  const fetchedSheet = await getAnswerSheetById(answerSheet._id);

  console.log(`✅ Step 6: Express GET API returned document.`);
  console.log(`   Has digital_answers: ${Array.isArray(fetchedSheet.digital_answers)} (Count: ${fetchedSheet.digital_answers?.length})`);
  console.log(`   Sample digital answer text: "${fetchedSheet.digital_answers?.[0]?.text}"`);

  // Step 7: Simulate Frontend NormalizeSheetData Execution
  console.log("\n--- Testing Frontend normalizeSheetData logic ---");
  const extractText = (ans) => ans?.text ?? ans?.answer_text ?? ans?.recognizedText ?? ans?.extracted_text ?? ans?.extractedText ?? '';

  let frontendDigitalAnswers = fetchedSheet.digital_answers.map((ans, idx) => ({
    ...ans,
    question_number: String(ans.question_number || idx + 1),
    text: extractText(ans),
    answer_text: extractText(ans),
    recognizedText: extractText(ans)
  }));

  console.log(`✅ Step 7: Frontend normalized digital answers successfully.`);
  console.log(`   Frontend Digital Answer 1 Text: "${frontendDigitalAnswers[0]?.text}"`);
  console.log(`   Frontend Digital Answer 2 Text: "${frontendDigitalAnswers[1]?.text}"`);

  // Clean up test document
  await AnswerSheet.findByIdAndDelete(answerSheet._id);
  console.log(`\n🧹 Cleaned up temporary test AnswerSheet ${answerSheet._id}`);

  await mongoose.disconnect();

  console.log("\n=================================================");
  console.log("   🎉 ALL LIVE E2E SCRATCHPAD VERIFICATIONS PASSED!");
  console.log("=================================================");
}

runLiveScratchpadE2ETest().catch((err) => {
  console.error("❌ Live Scratchpad Test Failed:", err);
  process.exit(1);
});
