import mongoose from 'mongoose';
import AnswerSheet from './src/models/AnswerSheet.js';
import Evaluation from './src/models/Evaluation.js';
import User from './src/models/User.js';
import Exam from './src/models/Exam.js';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/ai_evaluation_db');
  console.log('Connected to DB');

  const sheets = await AnswerSheet.find({}).populate('exam').populate('student', 'email name').lean();
  const filteredSheets = sheets.filter(s => s.student && s.student.email === 'student@test.com');
  console.log(`Found ${filteredSheets.length} answer sheets for student@test.com:`);

  // Query faculty user as well
  const faculty = await User.findOne({ email: 'faculty@test.com' }).lean();
  console.log(`Faculty ID for faculty@test.com: ${faculty ? faculty._id : 'Not Found'}`);
  
  for (const s of filteredSheets) {
    console.log(`\nSheet ID: ${s._id}`);
    console.log(`Student: ${s.student ? s.student.name : 'Unknown'} (${s.student ? s.student.email : 'N/A'})`);
    console.log(`Exam: ${s.exam ? s.exam.title : 'N/A'}`);
    console.log(`Exam CreatedBy: ${s.exam ? s.exam.createdBy : 'N/A'}`);
    console.log(`SubmissionStatus (sheet): ${s.submissionStatus}`);
    console.log(`ReviewStatus (sheet): ${s.reviewStatus}`);
    console.log(`EvaluationStatus (sheet): ${s.evaluationStatus}`);
    console.log(`ProcessingStatus (sheet): ${s.processingStatus}`);
    console.log(`OCRStatus (sheet): ${s.ocrStatus}`);
    console.log(`SegmentationStatus (sheet): ${s.segmentationStatus}`);
    console.log(`Error Message: ${s.errorMessage}`);
    console.log(`Extracted Text preview:`, s.extractedText);
    
    // Check answer items
    if (s.answers) {
      s.answers.forEach((ans, idx) => {
        console.log(`  Ans ${idx+1} recognizedText: "${ans.recognizedText}"`);
      });
    }

    const ev = await Evaluation.findOne({ answerSheet: s._id }).lean();
    if (ev) {
      console.log(`Evaluation:`);
      console.log(`  Status: ${ev.evaluationStatus}`);
      console.log(`  Obtained Marks: ${ev.obtainedMarks} / ${ev.totalMarks}`);
      console.log(`  Grade: ${ev.grade}`);
      console.log(`  Errors:`, ev.evaluationError);
    } else {
      console.log(`Evaluation: None found`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
