import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai_evaluation_db';

function generateStrokesForText(text) {
  const strokes = [];
  let cursorX = 50.0;
  let cursorY = 100.0;

  const addStroke = (pts, width = 5, color = "#000000") => {
    strokes.push({
      points: pts.map(p => ({ x: p[0], y: p[1] })),
      width,
      color
    });
  };

  for (const char of text.toUpperCase()) {
    const cx = cursorX;
    const cy = cursorY;
    if (char === 'H') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy + 50], [cx + 40, cy + 50]]);
      addStroke([[cx + 40, cy], [cx + 40, cy + 100]]);
      cursorX += 60;
    } else if (char === 'E') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy], [cx + 40, cy]]);
      addStroke([[cx, cy + 50], [cx + 30, cy + 50]]);
      addStroke([[cx, cy + 100], [cx + 40, cy + 100]]);
      cursorX += 55;
    } else if (char === 'L') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy + 100], [cx + 40, cy + 100]]);
      cursorX += 55;
    } else if (char === 'O') {
      const oPts = [];
      for (let angle = 0; angle <= 360; angle += 20) {
        const rad = (angle * Math.PI) / 180;
        oPts.push([cx + 20 + 20 * Math.cos(rad), cy + 50 + 45 * Math.sin(rad)]);
      }
      addStroke(oPts);
      cursorX += 60;
    } else if (char === 'W') {
      addStroke([[cx, cy], [cx + 15, cy + 100]]);
      addStroke([[cx + 15, cy + 100], [cx + 30, cy + 40]]);
      addStroke([[cx + 30, cy + 40], [cx + 45, cy + 100]]);
      addStroke([[cx + 45, cy + 100], [cx + 60, cy]]);
      cursorX += 75;
    } else {
      addStroke([[cx, cy], [cx + 30, cy], [cx + 30, cy + 100], [cx, cy + 100], [cx, cy]]);
      cursorX += 45;
    }
  }
  return strokes;
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function runLiveTests() {
  console.log("=================================================");
  console.log("   LIVE E2E SYSTEM TESTING & VERIFICATION RUN   ");
  console.log("=================================================\n");

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB:", MONGO_URI);

  const { default: User } = await import('./src/models/User.js');
  const { default: Subject } = await import('./src/models/Subject.js');
  const { default: Course } = await import('./src/models/Course.js');
  const { default: Department } = await import('./src/models/Department.js');
  const { default: Exam } = await import('./src/models/Exam.js');
  const { default: AnswerSheet } = await import('./src/models/AnswerSheet.js');
  const { default: AnswerKey } = await import('./src/models/AnswerKey.js');
  const { default: Evaluation } = await import('./src/models/Evaluation.js');
  const { default: answerKeyService } = await import('./src/services/answerKey.service.js');
  const { processDigitalExamHWRBackground } = await import('./src/services/studentExam.service.js');

  // Setup test department, course, users, subject
  let dept = await Department.findOne({ code: 'CS-TEST' });
  if (!dept) {
    dept = await Department.create({ name: 'Computer Science Test', code: 'CS-TEST' });
  }

  let course = await Course.findOne({ code: 'BTECH-CS-TEST' });
  if (!course) {
    course = await Course.create({ name: 'B.Tech CS Test', code: 'BTECH-CS-TEST', department: dept._id, durationYears: 4, totalSemesters: 8 });
  }

  let faculty = await User.findOne({ email: 'e2e.faculty@test.com' });
  if (!faculty) {
    faculty = await User.create({
      name: 'E2E Test Faculty',
      email: 'e2e.faculty@test.com',
      password: 'Password@123',
      passwordHash: 'hashed_pw',
      role: 'faculty',
      facultyId: 'FAC-E2E-001'
    });
  }

  let student = await User.findOne({ email: 'e2e.student@test.com' });
  if (!student) {
    student = await User.create({
      name: 'E2E Test Student',
      email: 'e2e.student@test.com',
      password: 'Password@123',
      passwordHash: 'hashed_pw',
      role: 'student',
      studentId: 'STU-E2E-001',
      department: dept._id,
      semester: 5
    });
  }

  let subject = await Subject.findOne({ code: 'CS301-TEST' });
  if (!subject) {
    subject = await Subject.create({ name: 'Database Systems Test', code: 'CS301-TEST', course: course._id, semester: 5, credits: 4, faculty: faculty._id });
  }

  console.log(`\n--- TEST L1: DIGITAL SUBMISSION WITHOUT APPROVED ANSWER KEY ---`);

  // Create an Exam with NO approved answer key
  const examL1 = await Exam.create({
    title: `E2E Exam L1 - No Key ${Date.now()}`,
    description: 'Exam without approved answer key for L1 testing',
    subject: subject._id,
    examType: 'Midterm',
    examDate: new Date(),
    duration: 60,
    totalMarks: 20,
    examStatus: 'Active',
    createdBy: faculty._id,
    questions: [
      {
        questionNumber: 1,
        questionText: 'What is a Database Management System?',
        maximumMarks: 10,
        required: true,
        modelAnswer: 'A DBMS is software that handles storage, retrieval, and management of data.'
      },
      {
        questionNumber: 2,
        questionText: 'Explain SQL ACID properties.',
        maximumMarks: 10,
        required: true,
        modelAnswer: 'ACID stands for Atomicity, Consistency, Isolation, and Durability.'
      }
    ]
  });

  console.log(`Created L1 Exam ID: ${examL1._id}`);

  // Ensure NO approved answer key exists for examL1
  await AnswerKey.deleteMany({ examId: examL1._id });

  // Create digital submission with canvas strokes
  const q1Strokes = generateStrokesForText("HELLO DBMS");
  const q2Strokes = generateStrokesForText("ACID WORLD");

  const sheetL1 = await AnswerSheet.create({
    student: student._id,
    subject: subject._id,
    exam: examL1._id,
    submissionStatus: 'Submitted',
    submissionType: 'DIGITAL',
    answers: [
      {
        questionId: examL1.questions[0]._id,
        handwrittenData: JSON.stringify({ strokes: q1Strokes }),
        recognizedText: '',
        hwrStatus: 'Pending',
        submissionTime: new Date()
      },
      {
        questionId: examL1.questions[1]._id,
        handwrittenData: JSON.stringify({ strokes: q2Strokes }),
        recognizedText: '',
        hwrStatus: 'Pending',
        submissionTime: new Date()
      }
    ],
    createdBy: student._id,
    updatedBy: student._id
  });

  console.log(`Created AnswerSheet L1 ID: ${sheetL1._id}`);
  console.log("Triggering HWR Background processing for L1 sheet...");

  // Run HWR background task (which will recognize text using FastAPI OCR and attempt evaluation queueing)
  await processDigitalExamHWRBackground(sheetL1._id, student._id, student._id);
  await sleep(500);

  // Poll database for state of sheetL1
  let reloadedSheetL1 = await AnswerSheet.findById(sheetL1._id).lean();
  console.log(`L1 AnswerSheet Status after HWR:`);
  console.log(`  ocrStatus: ${reloadedSheetL1.ocrStatus}`);
  console.log(`  processingStatus: ${reloadedSheetL1.processingStatus}`);
  console.log(`  evaluationStatus: ${reloadedSheetL1.evaluationStatus}`);
  console.log(`  evaluationCurrentStep: ${reloadedSheetL1.evaluationCurrentStep}`);
  console.log(`  Extracted Text:\n${reloadedSheetL1.extractedText}`);

  const testL1Pass = reloadedSheetL1.evaluationStatus === 'AWAITING_ANSWER_KEY' &&
                     reloadedSheetL1.ocrStatus === 'completed' &&
                     reloadedSheetL1.submissionStatus !== 'Failed';

  console.log(`\nTEST L1 RESULT: ${testL1Pass ? 'PASS' : 'FAIL'}`);

  console.log(`\n--- TEST L2: APPROVE ANSWER KEY & AUTOMATIC RE-QUEUE ---`);

  // Create an AnswerKey for examL1 and approve it
  const answerKeyL1 = await AnswerKey.create({
    examId: examL1._id,
    version: 1,
    isActive: false,
    uploadedBy: faculty._id,
    fileName: 'l1_answer_key.pdf',
    fileType: 'application/pdf',
    fileUrl: '/uploads/l1_answer_key.pdf',
    uploadStatus: 'Ready for Review',
    parsedAnswers: [
      {
        questionId: examL1.questions[0]._id,
        questionNumber: 1,
        questionText: examL1.questions[0].questionText,
        answerText: examL1.questions[0].modelAnswer,
        maximumMarks: 10,
        rubric: [{ criterion: 'Definition', marks: 5 }, { criterion: 'Examples', marks: 5 }],
        keywords: ['DBMS', 'software', 'management']
      },
      {
        questionId: examL1.questions[1]._id,
        questionNumber: 2,
        questionText: examL1.questions[1].questionText,
        answerText: examL1.questions[1].modelAnswer,
        maximumMarks: 10,
        rubric: [{ criterion: 'ACID explanation', marks: 10 }],
        keywords: ['Atomicity', 'Consistency', 'Isolation', 'Durability']
      }
    ]
  });

  console.log(`Created AnswerKey for L1 Exam ID: ${answerKeyL1._id}`);
  console.log("Approving AnswerKey...");

  await answerKeyService.approveAnswerKey(answerKeyL1._id, faculty._id);

  console.log("AnswerKey approved. Waiting 3 seconds for background re-queue and AI evaluation...");
  await sleep(3000);

  reloadedSheetL1 = await AnswerSheet.findById(sheetL1._id).lean();
  const evalL1 = await Evaluation.findOne({ answerSheet: sheetL1._id }).lean();

  console.log(`L1 AnswerSheet Status after AnswerKey Approval & Auto Re-Queue:`);
  console.log(`  evaluationStatus: ${reloadedSheetL1.evaluationStatus}`);
  console.log(`  submissionStatus: ${reloadedSheetL1.submissionStatus}`);
  console.log(`  reviewStatus: ${reloadedSheetL1.reviewStatus}`);
  if (evalL1) {
    console.log(`  Evaluation Obtained Marks: ${evalL1.obtainedMarks}/${evalL1.totalMarks}`);
    console.log(`  Evaluation Status: ${evalL1.evaluationStatus}`);
  }

  const testL2Pass = (reloadedSheetL1.evaluationStatus === 'READY_FOR_FACULTY_REVIEW' ||
                      reloadedSheetL1.evaluationStatus === 'QUEUED_FOR_EVALUATION' ||
                      reloadedSheetL1.submissionStatus === 'Faculty Review') &&
                     evalL1 !== null;

  console.log(`\nTEST L2 RESULT: ${testL2Pass ? 'PASS' : 'FAIL'}`);

  console.log(`\n--- TEST L3: DIGITAL SUBMISSION WITH APPROVED ANSWER KEY ---`);

  // Submit a new sheet L3 for examL1 which now has an approved answer key
  const q1StrokesL3 = generateStrokesForText("DATABASE MANAGEMENT SYSTEM SOFTWARE");
  const q2StrokesL3 = generateStrokesForText("ATOMICITY CONSISTENCY ISOLATION DURABILITY");

  const sheetL3 = await AnswerSheet.create({
    student: student._id,
    subject: subject._id,
    exam: examL1._id,
    submissionStatus: 'Submitted',
    submissionType: 'DIGITAL',
    answers: [
      {
        questionId: examL1.questions[0]._id,
        handwrittenData: JSON.stringify({ strokes: q1StrokesL3 }),
        recognizedText: '',
        hwrStatus: 'Pending',
        submissionTime: new Date()
      },
      {
        questionId: examL1.questions[1]._id,
        handwrittenData: JSON.stringify({ strokes: q2StrokesL3 }),
        recognizedText: '',
        hwrStatus: 'Pending',
        submissionTime: new Date()
      }
    ],
    createdBy: student._id,
    updatedBy: student._id
  });

  console.log(`Created AnswerSheet L3 ID: ${sheetL3._id}`);
  console.log("Triggering HWR and AI Evaluation for L3...");

  await processDigitalExamHWRBackground(sheetL3._id, student._id, student._id);

  console.log("Waiting 3 seconds for AI evaluation pipeline to complete...");
  await sleep(3000);

  const reloadedSheetL3 = await AnswerSheet.findById(sheetL3._id).lean();
  const evalL3 = await Evaluation.findOne({ answerSheet: sheetL3._id }).lean();

  console.log(`L3 AnswerSheet Status:`);
  console.log(`  ocrStatus: ${reloadedSheetL3.ocrStatus}`);
  console.log(`  evaluationStatus: ${reloadedSheetL3.evaluationStatus}`);
  console.log(`  submissionStatus: ${reloadedSheetL3.submissionStatus}`);
  if (evalL3) {
    console.log(`  Evaluation Obtained Marks: ${evalL3.obtainedMarks}/${evalL3.totalMarks}`);
    console.log(`  Evaluation Status: ${evalL3.evaluationStatus}`);
    console.log(`  Questions Evaluated: ${evalL3.questions?.length}`);
  }

  const testL3Pass = reloadedSheetL3.ocrStatus === 'completed' &&
                     reloadedSheetL3.evaluationStatus === 'READY_FOR_FACULTY_REVIEW' &&
                     evalL3 && evalL3.evaluationStatus === 'READY_FOR_FACULTY_REVIEW';

  console.log(`\nTEST L3 RESULT: ${testL3Pass ? 'PASS' : 'FAIL'}`);

  console.log(`\n--- TEST L4: FACULTY REVIEW UI VERIFICATION ---`);

  // Verify that the answer sheet payload contains all data expected by Faculty Review UI:
  // - original strokes / handwrittenData
  // - recognizedText
  // - question-wise marks and feedback
  // - total marks
  // - correct evaluation status
  const facultyViewDataL3 = {
    submissionId: reloadedSheetL3._id,
    studentName: student.name,
    submissionStatus: reloadedSheetL3.submissionStatus,
    evaluationStatus: reloadedSheetL3.evaluationStatus,
    answers: reloadedSheetL3.answers.map(ans => ({
      questionId: ans.questionId,
      recognizedText: ans.recognizedText,
      hasStrokes: !!ans.handwrittenData
    })),
    evaluationSummary: evalL3 ? {
      obtainedMarks: evalL3.obtainedMarks,
      totalMarks: evalL3.totalMarks,
      percentage: evalL3.percentage,
      questions: evalL3.questions
    } : null
  };

  const testL4Pass = facultyViewDataL3.answers.every(a => a.recognizedText && a.hasStrokes) &&
                     facultyViewDataL3.evaluationSummary !== null &&
                     facultyViewDataL3.evaluationSummary.obtainedMarks !== undefined;

  console.log(`Faculty Review Data Object verified:`);
  console.log(`  Student: ${facultyViewDataL3.studentName}`);
  console.log(`  Answers Count: ${facultyViewDataL3.answers.length}`);
  console.log(`  Obtained Marks: ${facultyViewDataL3.evaluationSummary?.obtainedMarks}`);

  console.log(`\nTEST L4 RESULT: ${testL4Pass ? 'PASS' : 'FAIL'}`);

  console.log(`\n=================================================`);
  console.log(`   FINAL SUMMARY OF LIVE WORKFLOW VERIFICATION   `);
  console.log(`=================================================`);
  console.log(`L1 (AWAITING_ANSWER_KEY):       ${testL1Pass ? 'PASS' : 'FAIL'}`);
  console.log(`L2 (ANSWER KEY APPROVAL & REQUEUE): ${testL2Pass ? 'PASS' : 'FAIL'}`);
  console.log(`L3 (DIGITAL EVALUATION WITH KEY):  ${testL3Pass ? 'PASS' : 'FAIL'}`);
  console.log(`L4 (FACULTY REVIEW UI DATA):      ${testL4Pass ? 'PASS' : 'FAIL'}`);

  await mongoose.disconnect();
}

runLiveTests().catch(err => {
  console.error("Live test execution error:", err);
  process.exit(1);
});
