import mongoose from 'mongoose';
import User from './src/models/User.js';
import Exam from './src/models/Exam.js';
import AnswerSheet from './src/models/AnswerSheet.js';
import Course from './src/models/Course.js';
import Subject from './src/models/Subject.js';
import Evaluation from './src/models/Evaluation.js';
import Department from './src/models/Department.js';

async function main() {
  // 1. Database Connection
  await mongoose.connect('mongodb://localhost:27017/ai_evaluation_db');
  console.log('[DB] Connected to MongoDB.');

  const student = await User.findOne({ email: 'student@test.com' });
  if (!student) throw new Error('Student user not found.');

  const exam = await Exam.findOne({ title: 'Verification Exam CS-101' });
  if (!exam) throw new Error('Exam not found.');

  console.log('[Info] Student ID:', student._id);
  console.log('[Info] Exam ID:', exam._id);

  // 2. Locate and Reset Student\'s AnswerSheet
  const sheet = await AnswerSheet.findOne({ student: student._id, exam: exam._id });
  if (!sheet) throw new Error('AnswerSheet not found.');

  // Reset to Started status to allow submission
  sheet.submissionStatus = 'Started';
  sheet.processingStatus = 'uploaded';
  sheet.ocrStatus = 'pending';
  sheet.errorMessage = null;

  // Insert mock strokes for Question 2 (FIFO queue visual flow)
  const mockStrokesQ2 = {
    strokes: [
      {
        points: [{ x: 50, y: 50 }, { x: 250, y: 50 }, { x: 250, y: 150 }, { x: 50, y: 150 }],
        color: '#0000FF',
        width: 3
      }
    ]
  };

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
  await sheet.save();
  console.log('[DB] ✓ AnswerSheet submissionStatus reset to "Started" and strokes saved for Q2.');

  // 3. Login via HTTP API to acquire JWT token
  console.log('[API] Authenticating student via HTTP API...');
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'student@test.com',
      password: 'password123'
    })
  });

  const loginData = await loginRes.json();
  const token = loginData?.data?.token || loginData?.token || loginData?.accessToken;
  if (!token) {
    console.error('Full response data:', loginData);
    throw new Error('Authentication failed (no token in response).');
  }
  console.log('[API] ✓ Student logged in successfully. JWT Token acquired.');

  // 4. Trigger Submission Endpoint via HTTP API (this runs in Express server process)
  console.log('[API] Submitting exam through student UI endpoint...');
  const submitRes = await fetch(
    `http://localhost:5000/api/v1/student/exams/${exam._id}/submit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const submitData = await submitRes.json();
  console.log('[API] Submit response:', submitData);

  // 5. Polling Database to Monitor Background Processing Pipeline
  console.log('\n[Monitor] Monitoring Digital HWR & AI Evaluation pipeline progress...');
  let complete = false;
  let attempts = 0;
  const maxAttempts = 30; // 90 seconds total

  while (!complete && attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 3000));

    const updatedSheet = await AnswerSheet.findById(sheet._id).lean();
    const evaluation = await Evaluation.findOne({ answerSheet: sheet._id }).lean();

    const subStatus = updatedSheet?.submissionStatus || 'Unknown';
    const ocrStatus = updatedSheet?.ocrStatus || 'Unknown';
    const evalStatus = evaluation?.evaluationStatus || 'Pending/Not Started';
    const evalMarks = evaluation?.totalFinalMarks !== undefined ? evaluation.totalFinalMarks : 'N/A';

    console.log(`[Monitor] [Secs:${attempts * 3}] AnswerSheet: ${subStatus} | OCR: ${ocrStatus} | AI Eval: ${evalStatus} | Marks: ${evalMarks}`);

    if (
      subStatus === 'Faculty Review' || 
      subStatus === 'Completed' ||
      subStatus === 'Failed' ||
      updatedSheet?.processingStatus === 'failed' ||
      ocrStatus === 'failed' ||
      ['FACULTY_REVIEW', 'COMPLETED', 'FAILED'].includes(evalStatus)
    ) {
      complete = true;
      console.log('\n[Monitor] Pipeline execution has terminated.');
      console.log('[Monitor] Final AnswerSheet details:', {
        submissionStatus: updatedSheet.submissionStatus,
        ocrStatus: updatedSheet.ocrStatus,
        processingStatus: updatedSheet.processingStatus,
        extractedText: updatedSheet.extractedText
      });
      if (evaluation) {
        console.log('[Monitor] Final Evaluation details:', {
          evaluationStatus: evaluation.evaluationStatus,
          totalScore: evaluation.totalScore,
          totalFinalMarks: evaluation.totalFinalMarks,
          feedback: evaluation.generalFeedback || evaluation.feedback
        });
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
