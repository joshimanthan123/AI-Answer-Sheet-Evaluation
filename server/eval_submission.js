import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env
dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_evaluation_db';

import AnswerKey from './src/models/AnswerKey.js';
import AnswerSheet from './src/models/AnswerSheet.js';

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB!');

  const examId = '6a81b2dcbfc444dd42cb37a4';
  const submissionId = '6a81b9d108ae9aae3cbd7085';
  const facultyId = '6a81ada9bdfba19aaf4919fd'; // faculty user ID from prior steps
  const studentId = '6a81ada9bdfba19aaf491a00'; // student user ID

  // 1. Create or update approved AnswerKey
  console.log(`Setting up approved AnswerKey for Exam ${examId}...`);
  
  // Define parsed answers matching exam configuration
  const parsedAnswers = [
    {
      questionNumber: 1,
      // We will match these by checking exam in the DB if needed, but let's query the exam first!
      answerText: "The Central Processing Unit (CPU) is the primary component of a computer that acts as its brain. It performs basic arithmetic, logical, control and input/output operations.",
      keywords: ["CPU", "processing", "control unit", "ALU", "register"],
      maximumMarks: 5,
      rubric: [
        { criteria: "definition", marks: 2 },
        { criteria: "functions", marks: 3 }
      ]
    },
    {
      questionNumber: 2,
      answerText: "RAM (Random Access Memory) is volatile, read/write memory used for temporary storage of running programs. ROM (Read Only Memory) is non-volatile, read-only memory containing boot system instructions.",
      keywords: ["volatile", "non-volatile", "read", "write"],
      maximumMarks: 10,
      rubric: [
        { criteria: "RAM characteristics", marks: 5 },
        { criteria: "ROM characteristics", marks: 5 }
      ]
    },
    {
      questionNumber: 3,
      answerText: "An operating system (OS) is system software that manages computer hardware, software resources, and provides common services for computer programs.",
      keywords: ["operating system", "resource management", "interface"],
      maximumMarks: 5,
      rubric: [
        { criteria: "definition", marks: 2 },
        { criteria: "key functions", marks: 3 }
      ]
    }
  ];

  // Resolve questionIds from Exam
  const exam = await mongoose.connection.db.collection('exams').findOne({ _id: new mongoose.Types.ObjectId(examId) });
  if (!exam) {
    throw new Error(`Exam ${examId} not found in DB!`);
  }

  for (const pa of parsedAnswers) {
    const matchingQ = exam.questions.find(q => q.questionNumber === pa.questionNumber);
    if (matchingQ) {
      pa.questionId = matchingQ._id;
    }
  }

  // Remove existing approved keys for this exam to avoid conflicts
  await AnswerKey.deleteMany({ examId: new mongoose.Types.ObjectId(examId) });

  const answerKey = await AnswerKey.create({
    examId: new mongoose.Types.ObjectId(examId),
    uploadedBy: new mongoose.Types.ObjectId(facultyId),
    fileName: 'model_answers.pdf',
    fileUrl: 'http://localhost:5000/uploads/model_answers.pdf',
    isActive: true,
    uploadStatus: 'Approved',
    parsedAnswers,
    ocrStatus: 'completed',
    processingStatus: 'completed'
  });

  console.log(`Approved AnswerKey created successfully: ${answerKey._id}`);

  // 2. Mock Handwriting transcription text on student AnswerSheet
  console.log(`Mocking OCR/HWR recognized text on AnswerSheet ${submissionId}...`);
  const answerSheet = await AnswerSheet.findOne({ _id: new mongoose.Types.ObjectId(submissionId) });
  if (!answerSheet) {
    throw new Error(`AnswerSheet ${submissionId} not found!`);
  }

  // Set transcriptions
  const q1 = exam.questions.find(q => q.questionNumber === 1);
  const q2 = exam.questions.find(q => q.questionNumber === 2);
  const q3 = exam.questions.find(q => q.questionNumber === 3);

  answerSheet.answers = [
    {
      questionId: q1._id,
      handwrittenData: JSON.stringify({ strokes: [] }),
      recognizedText: "The CPU (Central Processing Unit) acts as the brain of the computer. It performs processing of instructions, logic calculations using ALU, and manages register data.",
      hwrStatus: 'Completed',
      submissionTime: new Date()
    },
    {
      questionId: q2._id,
      handwrittenData: JSON.stringify({ strokes: [] }),
      recognizedText: "RAM is volatile memory which means it is temporary and loses data when powered off. ROM stands for read only memory and is non-volatile, keeping data permanently.",
      hwrStatus: 'Completed',
      submissionTime: new Date()
    },
    {
      questionId: q3._id,
      handwrittenData: JSON.stringify({ strokes: [] }),
      recognizedText: "An operating system is system software that acts as an interface between user applications and hardware resources, managing running programs.",
      hwrStatus: 'Completed',
      submissionTime: new Date()
    }
  ];

  answerSheet.submissionStatus = 'Submitted';
  answerSheet.processingStatus = 'completed';
  answerSheet.ocrStatus = 'completed';
  answerSheet.segmentationStatus = 'completed';
  answerSheet.evaluationStatus = 'READY_FOR_EVALUATION';

  await answerSheet.save();
  console.log('AnswerSheet updated with recognized text transcriptions & marking statuses.');

  // 3. Import and run pipeline queue evaluation
  console.log('Importing evaluation pipeline service...');
  let evaluationPipelineService;
  try {
    const module = await import('./src/services/ai/evaluationPipeline.service.js');
    evaluationPipelineService = module.default;
  } catch (importErr) {
    console.error('FAILED TO IMPORT EVALUATION PIPELINE SERVICE:', importErr);
    fs.writeFileSync('eval_error.txt', importErr.stack || String(importErr));
    throw importErr;
  }
  
  console.log('Queuing/running evaluation pipeline...');
  const result = await evaluationPipelineService.queueEvaluation(
    new mongoose.Types.ObjectId(submissionId),
    new mongoose.Types.ObjectId(studentId)
  );

  console.log('Pipeline run direct response:', result);
  
  // Wait to let background queue execute
  console.log('Waiting 5 seconds for background pipeline processing...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Print final evaluation
  const Evaluation = mongoose.model('Evaluation');
  const finalEval = await Evaluation.findOne({ answerSheet: new mongoose.Types.ObjectId(submissionId) });
  console.log('Evaluation status in Database:', finalEval ? {
    status: finalEval.evaluationStatus,
    obtainedMarks: finalEval.obtainedMarks,
    totalMarks: finalEval.totalMarks,
    percentage: finalEval.percentage,
    grade: finalEval.grade,
    errors: finalEval.evaluationError
  } : 'NO EVALUATION RECORD FOUND');

  await mongoose.disconnect();
  console.log('Done!');
}

run().catch(async (e) => {
  console.error('Error occurred outside/during run:', e);
  fs.writeFileSync('eval_error.txt', e.stack || String(e));
  await mongoose.disconnect();
});

