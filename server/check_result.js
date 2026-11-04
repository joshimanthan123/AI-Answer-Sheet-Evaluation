import mongoose from 'mongoose';
import env from './src/config/env.js';
import ReferenceAnswer from './src/models/ReferenceAnswer.js';
import referenceAnswerService from './src/services/referenceAnswer.service.js';

async function test() {
  await mongoose.connect(env.MONGODB_URI);
  const ref = await ReferenceAnswer.findOne({ "sourceFile.filename": "file-1790947062740-452485897.jpg" });
  if (ref) {
    console.log("Processing target file ID:", ref._id);
    const updated = await referenceAnswerService.processReferenceAnswer(ref._id);
    console.log("Status:", updated.processingStatus);
    console.log("Error:", updated.processingError);
    console.log("Questions Count:", updated.questions?.length);
    if (updated.questions?.length > 0) {
      updated.questions.forEach((q, i) => {
        console.log(`Q${i+1} answerText length:`, q.answerText?.length);
        console.log(`FULL TEXT:\n"${q.answerText}"`);
      });
    }
  } else {
    console.log("File not found!");
  }
  await mongoose.disconnect();
}
test().catch(console.error);
