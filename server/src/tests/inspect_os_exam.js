import mongoose from "mongoose";
import env from "../config/env.js";
import Exam from "../models/Exam.js";

async function checkOS() {
  await mongoose.connect(env.MONGODB_URI);
  const exam = await Exam.findOne({ title: "OS" }).sort({ createdAt: -1 });
  if (exam) {
    console.log("OS Exam details:", {
      _id: exam._id,
      title: exam.title,
      examDate: exam.examDate,
      startTime: exam.startTime,
      endTime: exam.endTime,
      duration: exam.duration,
      isPublished: exam.isPublished,
      examStatus: exam.examStatus,
      createdAt: exam.createdAt,
    });
  } else {
    console.log("No OS exam found");
  }
  await mongoose.disconnect();
}

checkOS();
