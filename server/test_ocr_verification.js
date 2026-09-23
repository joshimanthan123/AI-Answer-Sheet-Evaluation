import mongoose from 'mongoose';
import dotenv from 'dotenv';
import answerSheetService from './src/services/answerSheet.service.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_evaluation_db');
  console.log('Connected to MongoDB');

  const AnswerSheet = mongoose.models.AnswerSheet || mongoose.model('AnswerSheet', new mongoose.Schema({}, { strict: false }));
  
  // Find or create a test answer sheet document
  let sheet = await AnswerSheet.findOne().sort({ createdAt: -1 });
  if (!sheet) {
    console.log('No existing answer sheet found. Creating a test document...');
    sheet = await AnswerSheet.create({
      studentIdentifier: 'TestStudent',
      processingStatus: 'completed',
      uploadStatus: 'COMPLETED',
      ocrStatus: 'completed',
      answers: [
        {
          question_number: '1',
          recognizedText: 'This is the recognized handwritten text for Question 1 from PaddleOCR.',
          confidence: 0.96
        },
        {
          question_number: '2',
          recognizedText: 'Binary Search Tree algorithm operates in O(log n) time complexity.',
          confidence: 0.94
        }
      ]
    });
  } else {
    // Ensure the sheet has sample recognized text for verification
    sheet.answers = [
      {
        question_number: '1',
        recognizedText: 'This is the recognized handwritten text for Question 1 from PaddleOCR microservice.',
        confidence: 0.96
      },
      {
        question_number: '2',
        recognizedText: 'Binary Search Tree operates in O(log n) average time complexity.',
        confidence: 0.94
      }
    ];
    sheet.processingStatus = 'completed';
    sheet.uploadStatus = 'COMPLETED';
    await AnswerSheet.updateOne({ _id: sheet._id }, { answers: sheet.answers, processingStatus: 'completed', uploadStatus: 'COMPLETED' });
  }

  console.log('Testing answerSheetService.getAnswerSheetById for ID:', sheet._id.toString());
  const retrieved = await answerSheetService.getAnswerSheetById(sheet._id.toString());

  console.log('--- RETRIEVED ANSWER SHEET OUTPUT ---');
  console.log('ID:', retrieved._id);
  console.log('Processing Status:', retrieved.processingStatus);
  console.log('Digital Answers Array Length:', retrieved.digital_answers?.length);
  console.log('Digital Answers Items:', JSON.stringify(retrieved.digital_answers, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
