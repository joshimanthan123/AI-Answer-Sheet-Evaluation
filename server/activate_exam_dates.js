import mongoose from 'mongoose';
import Exam from './src/models/Exam.js';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/ai_evaluation_db');

  const now = new Date();
  
  // Set start time to 1 hour ago
  const startTime = new Date(now.getTime() - 60 * 60 * 1000);
  // Set end time to 3 hours from now
  const endTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  
  const updatedExam = await Exam.findOneAndUpdate(
    { title: "Verification Exam CS-101" },
    { 
      $set: { 
        examDate: startTime,
        startTime: startTime,
        endTime: endTime,
        examStatus: "Active"
      } 
    },
    { new: true }
  );

  console.log("Updated Exam Schedule:", {
    id: updatedExam._id,
    title: updatedExam.title,
    examStatus: updatedExam.examStatus,
    examDate: updatedExam.examDate,
    startTime: updatedExam.startTime,
    endTime: updatedExam.endTime
  });

  await mongoose.disconnect();
}
main().catch(console.error);
