import mongoose from 'mongoose';
import env from './src/config/env.js';
import ReferenceAnswer from './src/models/ReferenceAnswer.js';
import referenceAnswerService from './src/services/referenceAnswer.service.js';

async function test() {
  await mongoose.connect(env.MONGODB_URI);
  const refs = await ReferenceAnswer.find({}).sort({ createdAt: -1 });
  console.log(`Found ${refs.length} reference answer records.`);
  
  for (const ref of refs) {
    console.log(`\n-----------------------------------`);
    console.log(`ID: ${ref._id} | File: ${ref.sourceFile?.filename} | Status: ${ref.processingStatus}`);
    console.log(`Re-processing reference answer sheet...`);
    try {
      const updated = await referenceAnswerService.processReferenceAnswer(ref._id);
      console.log(`Updated Status: ${updated.processingStatus}`);
      console.log(`Questions Count: ${updated.questions?.length}`);
      if (updated.questions?.length > 0) {
        updated.questions.forEach((q, idx) => {
          console.log(`  [Q${idx + 1}] Text length: ${q.answerText?.length || 0} | Answer snippet: "${q.answerText?.substring(0, 100)}"`);
        });
      }
    } catch (e) {
      console.error(`Failed to process ${ref._id}: ${e.message}`);
    }
  }

  await mongoose.disconnect();
}
test().catch(err => { console.error('Error:', err); process.exit(1); });
