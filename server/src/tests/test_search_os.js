import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import { getStudentExams } from "../services/studentExam.service.js";

async function testSearchOS() {
  await mongoose.connect(env.MONGODB_URI);
  try {
    const student = await User.findOne({ email: "studentCE@gmail.com" });
    
    console.log("--- Test 1: No query params ---");
    const res1 = await getStudentExams(student._id, {});
    console.log(`Count: ${res1.exams.length}`);
    res1.exams.forEach(e => console.log(`  -> Title: "${e.title}", Subject: "${e.subject}", Status: "${e.status}"`));

    console.log("\n--- Test 2: status='active' ---");
    const res2 = await getStudentExams(student._id, { status: "active" });
    console.log(`Count: ${res2.exams.length}`);
    res2.exams.forEach(e => console.log(`  -> Title: "${e.title}", Subject: "${e.subject}", Status: "${e.status}"`));

    console.log("\n--- Test 3: status='active', search='OS' ---");
    const res3 = await getStudentExams(student._id, { status: "active", search: "OS" });
    console.log(`Count: ${res3.exams.length}`);
    res3.exams.forEach(e => console.log(`  -> Title: "${e.title}", Subject: "${e.subject}", Status: "${e.status}"`));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

testSearchOS();
