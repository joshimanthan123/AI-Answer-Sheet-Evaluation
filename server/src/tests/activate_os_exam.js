import mongoose from "mongoose";
import env from "../config/env.js";
import Exam from "../models/Exam.js";

async function activateOS() {
  await mongoose.connect(env.MONGODB_URI);
  const now = new Date();
  const startTime = new Date(now.getTime() - 10 * 60 * 1000);
  const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const res = await Exam.updateMany(
    { title: "OS" },
    {
      $set: {
        startTime: startTime,
        endTime: endTime,
        examDate: startTime,
        isPublished: true,
        examStatus: "Active",
      }
    }
  );
  console.log(`Updated ${res.modifiedCount} OS exam(s) to Active (valid for 24 hours).`);
  await mongoose.disconnect();
}

activateOS();
