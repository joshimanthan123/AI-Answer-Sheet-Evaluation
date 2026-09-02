import mongoose from 'mongoose';
import User from './src/models/User.js';
import Exam from './src/models/Exam.js';
import AnswerSheet from './src/models/AnswerSheet.js';
import Course from './src/models/Course.js';
import Subject from './src/models/Subject.js';
import Evaluation from './src/models/Evaluation.js';
import Department from './src/models/Department.js';
import { submitStudentExam } from './src/services/studentExam.service.js';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/ai_evaluation_db');
  console.log('Connected to MongoDB.');

  const student = await User.findOne({ email: 'student@test.com' });
  if (!student) throw new Error('Student user not found.');

  const exam = await Exam.findOne({ title: 'Verification Exam CS-101' });
  if (!exam) throw new Error('Verification Exam not found.');

  console.log('Student ID:', student._id);
  console.log('Exam ID:', exam._id);

  // Locate the student's AnswerSheet
  const sheet = await AnswerSheet.findOne({ student: student._id, exam: exam._id });
  if (!sheet) throw new Error('AnswerSheet not found.');

  console.log('Found AnswerSheet. Current answers count:', sheet.answers.length);

  // Set nice simulated strokes for Question 2 (FIFO queue explanation drawing)
  const mockStrokesQ2 = {
    strokes: [
      {
        points: [{ x: 50, y: 50 }, { x: 250, y: 50 }, { x: 250, y: 150 }, { x: 50, y: 150 }],
        color: '#0000FF',
        width: 3
      }
    ]
  };

  // Find index of Q2 answer
  const q2Id = exam.questions[1]._id;
  const q2Index = sheet.answers.findIndex(ans => ans.questionId.toString() === q2Id.toString());

  if (q2Index !== -1) {
    sheet.answers[q2Index].handwrittenData = JSON.stringify(mockStrokesQ2);
    sheet.answers[q2Index].submissionTime = new Date();
  } else {
    sheet.answers.push({
      questionId: q2Id,
      handwrittenData: JSON.stringify(mockStrokesQ2),
      submissionTime: new Date()
    });
  }

  sheet.lastSavedAt = new Date();
  sheet.submissionStatus = 'Auto Saving';
  await sheet.save();
  console.log('✓ Simulated strokes saved for Question 2.');

  // Trigger submission
  console.log('Calling submitStudentExam...');
  const submitResult = await submitStudentExam(student._id, exam._id);
  console.log('Submission API result:', submitResult);

  // Disconnect
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
