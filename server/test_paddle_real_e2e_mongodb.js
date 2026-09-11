import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });


function generateStrokesForAnswer() {
  const text = "PADDLE OCR PERSISTENCE TEST";
  const strokes = [];
  let cursorX = 50.0;
  let cursorY = 100.0;

  const addStroke = (pts, width = 6, color = "#000000") => {
    strokes.push({
      points: pts.map(p => ({ x: p[0], y: p[1] })),
      width,
      color
    });
  };

  for (const char of text.toUpperCase()) {
    const cx = cursorX;
    const cy = cursorY;
    if (char === 'P') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy], [cx + 40, cy], [cx + 40, cy + 50], [cx, cy + 50]]);
      cursorX += 55;
    } else if (char === 'A') {
      addStroke([[cx, cy + 100], [cx + 25, cy]]);
      addStroke([[cx + 25, cy], [cx + 50, cy + 100]]);
      addStroke([[cx + 10, cy + 60], [cx + 40, cy + 60]]);
      cursorX += 60;
    } else if (char === 'D') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy], [cx + 35, cy + 20], [cx + 35, cy + 80], [cx, cy + 100]]);
      cursorX += 55;
    } else if (char === 'L') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy + 100], [cx + 40, cy + 100]]);
      cursorX += 50;
    } else if (char === 'E') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy], [cx + 40, cy]]);
      addStroke([[cx, cy + 50], [cx + 30, cy + 50]]);
      addStroke([[cx, cy + 100], [cx + 40, cy + 100]]);
      cursorX += 50;
    } else if (char === 'O') {
      addStroke([[cx, cy], [cx + 40, cy], [cx + 40, cy + 100], [cx, cy + 100], [cx, cy]]);
      cursorX += 55;
    } else if (char === 'C') {
      addStroke([[cx + 40, cy], [cx, cy], [cx, cy + 100], [cx + 40, cy + 100]]);
      cursorX += 50;
    } else if (char === 'R') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy], [cx + 40, cy], [cx + 40, cy + 50], [cx, cy + 50]]);
      addStroke([[cx + 15, cy + 50], [cx + 40, cy + 100]]);
      cursorX += 55;
    } else if (char === 'T') {
      addStroke([[cx, cy], [cx + 50, cy]]);
      addStroke([[cx + 25, cy], [cx + 25, cy + 100]]);
      cursorX += 60;
    } else if (char === 'S') {
      addStroke([[cx + 40, cy], [cx, cy], [cx, cy + 50], [cx + 40, cy + 50], [cx + 40, cy + 100], [cx, cy + 100]]);
      cursorX += 50;
    } else if (char === 'I') {
      addStroke([[cx + 10, cy], [cx + 30, cy]]);
      addStroke([[cx + 20, cy], [cx + 20, cy + 100]]);
      addStroke([[cx + 10, cy + 100], [cx + 30, cy + 100]]);
      cursorX += 40;
    } else if (char === 'N') {
      addStroke([[cx, cy + 100], [cx, cy]]);
      addStroke([[cx, cy], [cx + 40, cy + 100]]);
      addStroke([[cx + 40, cy + 100], [cx + 40, cy]]);
      cursorX += 50;
    } else {
      cursorX += 30;
    }
  }
  return strokes;
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function runPaddleE2EMongoDBTest() {
  console.log("=================================================");
  console.log("   FRESH PADDLEOCR E2E & MONGODB VERIFICATION    ");
  console.log("   Identifier: PADDLE_REAL_OCR_E2E_20260902      ");
  console.log("=================================================\n");

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai_evaluation_db';
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB:", mongoUri);

  const { default: User } = await import('./src/models/User.js');
  const { default: Subject } = await import('./src/models/Subject.js');
  const { default: Course } = await import('./src/models/Course.js');
  const { default: Department } = await import('./src/models/Department.js');
  const { default: Exam } = await import('./src/models/Exam.js');
  const { default: AnswerSheet } = await import('./src/models/AnswerSheet.js');
  const { default: AnswerKey } = await import('./src/models/AnswerKey.js');

  // 1. Create or retrieve test entities
  let dept = await Department.findOne({ code: 'CS-PADDLE' });
  if (!dept) {
    dept = await Department.create({ name: 'CS Paddle Department', code: 'CS-PADDLE' });
  }

  let course = await Course.findOne({ code: 'PADDLE-101' });
  if (!course) {
    course = await Course.create({ name: 'Paddle OCR Course', code: 'PADDLE-101', department: dept._id, durationYears: 4, totalSemesters: 8 });
  }

  let faculty = await User.findOne({ email: 'paddle_faculty@test.com' });
  if (!faculty) {
    faculty = await User.create({
      name: 'Paddle Faculty',
      email: 'paddle_faculty@test.com',
      password: 'Password@123',
      passwordHash: 'hashed_pw',
      role: 'faculty',
      facultyId: 'FAC-PAD-001'
    });
  }

  let student = await User.findOne({ email: 'paddle_student@test.com' });
  if (!student) {
    student = await User.create({
      name: 'Paddle Student',
      email: 'paddle_student@test.com',
      password: 'Password@123',
      passwordHash: 'hashed_pw',
      role: 'student',
      studentId: 'STU-PAD-001',
      department: dept._id,
      semester: 5
    });
  }

  let subject = await Subject.findOne({ code: 'SUB-PADDLE' });
  if (!subject) {
    subject = await Subject.create({ name: 'Paddle Subject', code: 'SUB-PADDLE', course: course._id, department: dept._id, semester: 5, credits: 3, faculty: [faculty._id] });
  }

  const uniqueExamCode = `EXAM-PADDLE-${Date.now()}`;
  const exam = await Exam.create({
    title: 'Paddle Real OCR Exam',
    code: uniqueExamCode,
    subject: subject._id,
    creator: faculty._id,
    createdBy: faculty._id,
    totalMarks: 50,
    duration: 180,
    examType: 'DIGITAL',
    examDate: new Date(),
    questions: [
      {
        questionNumber: 1,
        questionText: 'Question 1',
        maximumMarks: 10,
        required: true,
        modelAnswer: 'PADDLE OCR PERSISTENCE TEST'
      }
    ]
  });

  // Approved Answer Key
  const answerKey = await AnswerKey.create({
    examId: exam._id,
    exam: exam._id,
    version: 1,
    isActive: true,
    uploadedBy: faculty._id,
    fileName: 'paddle_answer_key.pdf',
    fileType: 'application/pdf',
    fileUrl: '/uploads/paddle_answer_key.pdf',
    uploadStatus: 'Approved',
    parsedAnswers: [
      {
        questionNumber: 1,
        questionText: 'Question 1',
        answerText: 'PADDLE OCR PERSISTENCE TEST',
        maximumMarks: 10,
        keywords: ['PADDLE', 'OCR', 'PERSISTENCE']
      }
    ],
    createdBy: faculty._id,
    approvedBy: faculty._id,
    approvedAt: new Date()
  });
  console.log(`Created Exam (${exam.code}) and Approved AnswerKey (${answerKey._id}).`);

  const { processDigitalExamHWRBackground } = await import('./src/services/studentExam.service.js');

  // 2. Submit Digital Answer Sheet directly
  const strokes = generateStrokesForAnswer();
  
  const createdSheet = await AnswerSheet.create({
    studentExam: new mongoose.Types.ObjectId(),
    exam: exam._id,
    subject: subject._id,
    student: student._id,
    submissionType: 'DIGITAL',
    submissionStatus: 'Submitted',
    ocrStatus: 'pending',
    processingStatus: 'processing',
    evaluationStatus: 'READY_FOR_EVALUATION',
    answers: [
      {
        questionId: exam.questions[0]._id,
        handwrittenData: JSON.stringify({ strokes: strokes })
      }
    ]
  });

  console.log(`Created AnswerSheet ID: ${createdSheet._id}. Running processDigitalExamHWRBackground...`);

  await processDigitalExamHWRBackground(createdSheet._id, student._id, student._id);
  console.log("processDigitalExamHWRBackground finished. Fetching persisted AnswerSheet from MongoDB...");

  // 3. Retrieve AnswerSheet from MongoDB
  const answerSheet = await AnswerSheet.findById(createdSheet._id).lean();

  if (!answerSheet) {
    console.error("Failed to find AnswerSheet in MongoDB for studentExamId:", studentExamId);
    process.exit(1);
  }

  console.log("\n=================================================");
  console.log("          MONGODB ANSWERSHEET PERSISTENCE DATA   ");
  console.log("=================================================");
  console.log("AnswerSheet ID:", answerSheet._id.toString());
  console.log("StudentExam ID:", answerSheet.studentExam ? answerSheet.studentExam.toString() : answerSheet.studentExamId);
  console.log("hwrStatus:", answerSheet.hwrStatus);
  console.log("ocrStatus:", answerSheet.ocrStatus);
  console.log("processingStatus:", answerSheet.processingStatus || answerSheet.status);
  console.log("extractedText / recognizedText:", JSON.stringify(answerSheet.extractedText || answerSheet.recognizedText));
  console.log("ocrConfidence / overallConfidence:", answerSheet.overallConfidence || answerSheet.confidence || answerSheet.ocrConfidence);
  console.log("digitalAnswers length:", answerSheet.digitalAnswers?.length);
  if (answerSheet.digitalAnswers && answerSheet.digitalAnswers[0]) {
    console.log("Q1 Transcribed Text:", JSON.stringify(answerSheet.digitalAnswers[0].transcribedText || answerSheet.digitalAnswers[0].answerText));
  }

  // 4. Validate findings
  const hasRecognizedText = answerSheet.extractedText || answerSheet.recognizedText || (answerSheet.digitalAnswers && answerSheet.digitalAnswers[0]?.transcribedText);
  if (hasRecognizedText && (answerSheet.ocrStatus === 'completed' || answerSheet.hwrStatus === 'COMPLETED')) {
    console.log("\n>>> FRESH PADDLEOCR E2E & MONGODB VERIFICATION: PASS <<<");
  } else {
    console.log("\n>>> FRESH PADDLEOCR E2E & MONGODB VERIFICATION: FAIL <<<");
  }

  await mongoose.disconnect();
}

runPaddleE2EMongoDBTest().catch(err => {
  console.error("E2E Test execution error:", err);
  process.exit(1);
});
