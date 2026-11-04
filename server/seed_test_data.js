import mongoose from 'mongoose';
import User from './src/models/User.js';
import Department from './src/models/Department.js';
import Course from './src/models/Course.js';
import Subject from './src/models/Subject.js';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/ai_evaluation_db');
  console.log('Connected to DB');

  // get faculty
  const faculty = await User.findOne({ email: 'faculty@test.com' });
  if (!faculty) {
    console.error('Faculty user faculty@test.com not found!');
    process.exit(1);
  }
  const facultyId = faculty._id;

  // 1. Department
  let dept = await Department.findOne({ code: 'CS' });
  if (!dept) {
    dept = await Department.create({
      name: 'Computer Science & Engineering',
      code: 'CS',
      description: 'Computer Science Department',
      createdBy: facultyId
    });
    console.log('Created Department:', dept.code);
  } else {
    console.log('Existing Department:', dept.code);
  }

  // 2. Course
  let course = await Course.findOne({ code: 'BTECH-CS' });
  if (!course) {
    course = await Course.create({
      department: dept._id,
      name: 'Bachelor of Technology in CS',
      code: 'BTECH-CS',
      durationYears: 4,
      totalSemesters: 8,
      description: 'BTech CS course',
      createdBy: facultyId
    });
    console.log('Created Course:', course.code);
  } else {
    console.log('Existing Course:', course.code);
  }

  // 3. Subject
  let subject = await Subject.findOne({ code: 'ASGP' });
  if (!subject) {
    subject = await Subject.create({
      course: course._id,
      semester: 5,
      name: 'Advanced Software Group Product',
      code: 'ASGP',
      credits: 4,
      faculty: facultyId,
      description: 'SGP subject',
      createdBy: facultyId
    });
    console.log('Created Subject:', subject.code);
  } else {
    console.log('Existing Subject:', subject.code);
  }

  console.log('Test reference data successfully seeded!');
  await mongoose.disconnect();
}

main().catch(console.error);
