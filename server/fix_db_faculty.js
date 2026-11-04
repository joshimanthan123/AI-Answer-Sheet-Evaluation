import mongoose from 'mongoose';
import User from './src/models/User.js';
import Exam from './src/models/Exam.js';
import AnswerSheet from './src/models/AnswerSheet.js';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/ai_evaluation_db');
  console.log('Connected to DB');

  const faculty = await User.findOne({ email: 'faculty@test.com' });
  if (!faculty) {
    console.error('Faculty user faculty@test.com not found!');
    process.exit(1);
  }
  console.log(`Found faculty user with ID: ${faculty._id}`);

  // Update exams createdBy field
  const examUpdate = await Exam.updateMany(
    { title: 'Verification Exam CS-101' },
    { $set: { createdBy: faculty._id } }
  );
  console.log(`Updated exams:`, examUpdate);

  // Update AnswerSheet reviewStatus field for student@test.com
  const student = await User.findOne({ email: 'student@test.com' });
  if (student) {
    console.log(`Found student user with ID: ${student._id}`);
    const sheetUpdate = await AnswerSheet.updateMany(
      { student: student._id, submissionStatus: 'Faculty Review' },
      { $set: { reviewStatus: 'READY_FOR_FACULTY_REVIEW' } }
    );
    console.log(`Updated AnswerSheets:`, sheetUpdate);
  } else {
    console.log('Student user student@test.com not found.');
  }

  await mongoose.disconnect();
  console.log('Disconnected');
}

main().catch(console.error);
