import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai_evaluation_db';

async function verifyMongoDBResult() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  const { default: AnswerSheet } = await import('./src/models/AnswerSheet.js');

  const sheets = await AnswerSheet.find({}).sort({ updatedAt: -1 }).limit(1).lean();
  if (!sheets || sheets.length === 0) {
    console.error("No AnswerSheet found!");
    process.exit(1);
  }

  const sheet = sheets[0];
  console.log("\n=================================================");
  console.log("    LATEST PERSISTED MONGODB ANSWERSHEET DATA    ");
  console.log("=================================================");
  console.log("AnswerSheet ID:", sheet._id.toString());
  console.log("ocrStatus:", sheet.ocrStatus);
  console.log("processingStatus:", sheet.processingStatus);
  console.log("evaluationStatus:", sheet.evaluationStatus);
  console.log("extractedText:", JSON.stringify(sheet.extractedText));
  console.log("answers count:", sheet.answers?.length);
  if (sheet.answers && sheet.answers[0]) {
    console.log("Q1 recognizedText:", JSON.stringify(sheet.answers[0].recognizedText));
    console.log("Q1 hwrStatus:", sheet.answers[0].hwrStatus);
    console.log("Q1 confidence:", sheet.answers[0].confidence);
    console.log("Q1 confidenceLevel:", sheet.answers[0].confidenceLevel);
  }

  await mongoose.disconnect();
}

verifyMongoDBResult().catch(err => {
  console.error("Verification error:", err);
  process.exit(1);
});
