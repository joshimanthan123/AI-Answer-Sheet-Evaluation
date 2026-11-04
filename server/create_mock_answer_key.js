import mongoose from 'mongoose';
import AnswerKey from './src/models/AnswerKey.js';
import Exam from './src/models/Exam.js';
import User from './src/models/User.js';
import Course from './src/models/Course.js';
import Subject from './src/models/Subject.js';
import Evaluation from './src/models/Evaluation.js';
import Department from './src/models/Department.js';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/ai_evaluation_db');
  console.log('Connected to MongoDB.');

  const exam = await Exam.findOne({ title: 'Verification Exam CS-101' });
  if (!exam) throw new Error('Exam not found.');

  const faculty = await User.findOne({ email: 'faculty@test.com' });
  if (!faculty) throw new Error('Faculty user not found.');

  // Create an approved AnswerKey for the exam
  const key = await AnswerKey.create({
    examId: exam._id,
    fileName: 'answer_key_cs101.pdf',
    fileUrl: '/uploads/answer_keys/answer_key_cs101.pdf',
    uploadedBy: faculty._id,
    parsedAnswers: [
      {
        questionNumber: 1,
        questionId: exam.questions[0]._id,
        answerText: "REST uses standard HTTP methods like GET, POST, PUT, DELETE with resource-based URLs. It returns full payloads and can cause over-fetching or under-fetching. GraphQL uses a single POST endpoint where the client specifies exactly what fields it needs in a query schema, preventing over-fetching and under-fetching.",
        keywords: ["REST", "GraphQL", "GET", "POST", "endpoints", "over-fetching", "relationship"],
        rubric: [
          { criteria: "REST HTTP methods and architecture", marks: 5, description: "Correctly outlines standard REST verbs, URLs, and behaviors." },
          { criteria: "GraphQL queries and single endpoint", marks: 5, description: "States GraphQL uses queries, types, and single POST endpoint." },
          { criteria: "Over-fetching and under-fetching comparison", marks: 5, description: "Explains resource differences/performance improvements." }
        ]
      },
      {
        questionNumber: 2,
        questionId: exam.questions[1]._id,
        answerText: "A FIFO (First In First Out) queue inserts elements at the Rear/Tail and removes elements from the Front/Head. It behaves like a line of people waiting. Visual enqueue adds to tail, dequeue removes from front.",
        keywords: ["FIFO", "queue", "rear", "front", "head", "tail", "enqueue", "dequeue"],
        rubric: [
          { criteria: "FIFO principle definition", marks: 5, description: "Defines First In First Out." },
          { criteria: "Rear / Tail insertions", marks: 5, description: "Identifies enqueue adding at rear." },
          { criteria: "Front / Head deletions", marks: 5, description: "Identifies dequeue removing at front." }
        ]
      }
    ],
    uploadStatus: 'Approved',
    isActive: true,
    createdBy: faculty._id,
    updatedBy: faculty._id
  });

  console.log('AnswerKey created successfully:', key._id);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
