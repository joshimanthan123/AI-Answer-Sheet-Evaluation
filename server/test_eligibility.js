import mongoose from 'mongoose';
import User from './src/models/User.js';
import Department from './src/models/Department.js';
import Course from './src/models/Course.js';
import Subject from './src/models/Subject.js';
import Exam from './src/models/Exam.js';
import { getStudentEligibleSubjectIds } from './src/services/studentExam.service.js';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/ai_evaluation_db');

  const student = await User.findOne({ email: 'student@test.com' });
  console.log("Student:", {
    id: student._id,
    semester: student.semester,
    department: student.department
  });

  const subjectsInSemester = await Subject.find({
    semester: student.semester,
    isDeleted: false,
  }).populate({
    path: "course",
    populate: { path: "department" }
  }).lean();

  console.log("Subjects found in semester 5 count:", subjectsInSemester.length);
  for (const sub of subjectsInSemester) {
    const course = sub.course;
    const dept = course ? course.department : null;
    const deptId = dept ? (dept._id ? dept._id.toString() : dept.toString()) : null;
    console.log(`Subject ${sub.code} (${sub.name}):`, {
      course: course ? course.code : null,
      deptCode: dept ? dept.code : null,
      deptId: deptId,
      deptMatch: deptId === student.department?.toString()
    });
  }

  const eligibleIds = await getStudentEligibleSubjectIds(student);
  console.log("Eligible subject IDs:", eligibleIds);

  const exam = await Exam.findOne({ title: "Verification Exam CS-101" });
  if (exam) {
    console.log("Exam Subject string:", exam.subject.toString());
    console.log("Is exam subject eligible?", eligibleIds.includes(exam.subject.toString()));
  } else {
    console.log("Exam not found!");
  }

  await mongoose.disconnect();
}
main().catch(console.error);
