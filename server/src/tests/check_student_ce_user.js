import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Exam from "../models/Exam.js";
import Subject from "../models/Subject.js";
import { getStudentExams, getStudentEligibleSubjectIds } from "../services/studentExam.service.js";

async function checkStudentCE() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  try {
    const student = await User.findOne({ email: "studentCE@gmail.com" });
    if (!student) {
      console.log("Student studentCE@gmail.com NOT FOUND!");
      return;
    }

    console.log("Student Profile:", {
      _id: student._id.toString(),
      name: student.name,
      email: student.email,
      department: student.department,
      semester: student.semester,
    });

    const eligibleSubjectIds = await getStudentEligibleSubjectIds(student);
    console.log(`Eligible Subject IDs (${eligibleSubjectIds.length}):`, eligibleSubjectIds);

    const allPublishedExams = await Exam.find({
      $or: [{ isPublished: true }, { examStatus: { $in: ["Published", "Active", "Completed"] } }],
      isDeleted: { $ne: true },
    }).populate("subject").lean();

    console.log(`Total Published/Active Exams in DB: ${allPublishedExams.length}`);
    allPublishedExams.forEach(e => {
      console.log(`- Exam ID: ${e._id}, Title: "${e.title}", Status: "${e.examStatus}", Subject: "${e.subject?.name || 'NONE'}" (ID: ${e.subject?._id || 'NONE'})`);
    });

    const result = await getStudentExams(student._id);
    console.log(`getStudentExams returned ${result.exams.length} exams:`);
    result.exams.forEach(e => {
      console.log(`  -> Exam: Title="${e.title}", Status="${e.status}", CanEnter=${e.canEnter}`);
    });

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

checkStudentCE();
