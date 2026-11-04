import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Exam from "../models/Exam.js";
import Subject from "../models/Subject.js";
import Course from "../models/Course.js";
import Department from "../models/Department.js";
import { getStudentEligibleSubjectIds, getStudentExams } from "../services/studentExam.service.js";

async function diagnoseStudentExams() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Database connected.");

  try {
    const totalExams = await Exam.countDocuments({ isDeleted: { $ne: true } });
    console.log(`Total active Exams in DB: ${totalExams}`);

    const allExams = await Exam.find({ isDeleted: { $ne: true } })
      .populate({
        path: "subject",
        populate: { path: "course", populate: { path: "department" } }
      })
      .lean();

    console.log("\n--- EXAMS LIST IN DB ---");
    allExams.forEach((ex, i) => {
      console.log(`Exam [${i + 1}]: ID=${ex._id}, Title="${ex.title}", Status="${ex.examStatus}", isPublished=${ex.isPublished}`);
      if (ex.subject) {
        console.log(`   Subject: ID=${ex.subject._id}, Name="${ex.subject.name}", Code="${ex.subject.code}", Semester=${ex.subject.semester}`);
        if (ex.subject.course) {
          console.log(`   Course: Name="${ex.subject.course.name}", Dept=${JSON.stringify(ex.subject.course.department)}`);
        } else {
          console.log(`   Course: NONE / NULL`);
        }
      } else {
        console.log(`   Subject: NONE / NULL`);
      }
    });

    const students = await User.find({ role: "student", isDeleted: { $ne: true } }).lean();
    console.log(`\nFound ${students.length} active students in DB.`);

    for (const student of students) {
      console.log(`\nStudent: ID=${student._id}, Name="${student.name}", Email="${student.email}"`);
      console.log(`   Profile Dept="${student.department}", Sem=${student.semester}`);

      const eligibleSubjectIds = await getStudentEligibleSubjectIds(student);
      console.log(`   Eligible Subject IDs (${eligibleSubjectIds.length}):`, eligibleSubjectIds);

      const studentExamsRes = await getStudentExams(student._id);
      console.log(`   getStudentExams returned ${studentExamsRes.exams.length} exams.`);
      studentExamsRes.exams.forEach(e => {
        console.log(`     -> Exam: Title="${e.title}", Status="${e.status}", CanEnter=${e.canEnter}`);
      });
    }
  } catch (err) {
    console.error("Diagnosis Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

diagnoseStudentExams();
