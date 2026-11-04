import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { getAnswerSheetById } from './src/services/answerSheet.service.js';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

async function verifyExpressAnswerSheetAPI() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_evaluation_db';
  console.log('Connecting to MongoDB:', mongoUri);
  await mongoose.connect(mongoUri);

  const AnswerSheet = mongoose.model('AnswerSheet');
  const latestSheet = await AnswerSheet.findOne().sort({ createdAt: -1 }).lean();

  if (!latestSheet) {
    console.log('No AnswerSheet document found in database.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Testing getAnswerSheetById for Sheet ID: ${latestSheet._id}`);
  const result = await getAnswerSheetById(latestSheet._id.toString());

  console.log('\n--- EXPRESS API ANSWER SHEET OUTPUT ---');
  console.log('Sheet ID:', result._id);
  console.log('Student ID:', result.studentId);
  console.log('Digital Answers Count:', result.digital_answers?.length);

  if (result.digital_answers && result.digital_answers.length > 0) {
    result.digital_answers.forEach((ans, i) => {
      console.log(`\nQuestion #${ans.question_number || i + 1}:`);
      console.log('  Question ID:', ans.question_id);
      console.log('  Recognized Text:', JSON.stringify(ans.recognizedText));
      console.log('  Text:', JSON.stringify(ans.text));
      console.log('  Handwritten Strokes Count:', ans.strokes ? ans.strokes.length : 0);
      console.log('  Handwritten Data Present:', Boolean(ans.handwrittenData));
    });
  }

  const hasPlaceholder = JSON.stringify(result).includes('Transcribed canvas response');
  console.log('\n--- VERIFICATION RESULT ---');
  if (hasPlaceholder) {
    console.log('FAIL: Placeholder text still found in AnswerSheet output.');
  } else {
    console.log('PASS: No placeholder text found in AnswerSheet output! Placeholder text successfully eliminated.');
  }

  await mongoose.disconnect();
}

verifyExpressAnswerSheetAPI().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
