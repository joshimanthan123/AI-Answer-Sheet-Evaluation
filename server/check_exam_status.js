import mongoose from 'mongoose';
import Exam from './src/models/Exam.js';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/ai_evaluation_db');
  console.log('Exam query started...');
  const exam = await Exam.findOne({ title: 'Verification Exam CS-101' });
  console.log('Exam details in DB:', JSON.stringify(exam, null, 2));
  await mongoose.disconnect();
}
main().catch(console.error);
