import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_evaluation_db');
  
  const AnswerSheet = mongoose.model('AnswerSheet', new mongoose.Schema({}, { strict: false }));
  
  const latestSheet = await AnswerSheet.findOne().sort({ createdAt: -1 }).lean();
  
  console.log('--- LATEST ANSWER SHEET DOCUMENT ---');
  console.log('ID:', latestSheet._id);
  console.log('Student Identifier:', latestSheet.studentIdentifier);
  console.log('Processing Status:', latestSheet.processingStatus);
  console.log('Uploaded File Name:', latestSheet.uploadedFileName);
  console.log('Pages Count:', latestSheet.pages?.length);
  console.log('Pages Array:', JSON.stringify(latestSheet.pages, null, 2));
  console.log('Answers Array:', JSON.stringify(latestSheet.answers, null, 2));
  
  await mongoose.disconnect();
}

run().catch(console.error);
