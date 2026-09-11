import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Department from "../models/Department.js";
import Subject from "../models/Subject.js";
import subjectService from "../services/subject.service.js";
import { ROLES } from "../constants/roles.js";

async function testCreateSubject() {
  console.log("Connecting database: " + env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  try {
    // Check if courses exist
    const courses = await Course.find({ isDeleted: false });
    console.log(`Found ${courses.length} active courses in DB.`);

    // Find or create a faculty user
    let faculty = await User.findOne({ role: ROLES.FACULTY, isDeleted: false });
    if (!faculty) {
      faculty = await User.create({
        name: "Test Faculty Subject Creator",
        email: `faculty.test.${Date.now()}@example.com`,
        password: "password123",
        role: ROLES.FACULTY,
      });
      console.log("Created test faculty user.");
    }

    let courseId = courses.length > 0 ? courses[0]._id.toString() : null;

    if (!courseId) {
      // Find or create department
      let dept = await Department.findOne({ isDeleted: false });
      if (!dept) {
        dept = await Department.create({
          name: "Computer Science Dept",
          code: "CS" + Math.floor(Math.random() * 100),
          createdBy: faculty._id,
        });
      }
      const newCourse = await Course.create({
        name: "B.Tech Computer Science",
        code: "BTCS" + Math.floor(Math.random() * 100),
        department: dept._id,
        durationYears: 4,
        totalSemesters: 8,
        createdBy: faculty._id,
      });
      courseId = newCourse._id.toString();
      console.log("Created default course: " + courseId);
    }

    const testSubjectData = {
      name: "Subject Test " + Date.now(),
      code: "SUB" + Math.floor(Math.random() * 1000),
      semester: 5,
      credits: 4,
      course: courseId,
      faculty: faculty._id.toString(),
      description: "Test subject description",
    };

    console.log("Creating subject with data:", testSubjectData);
    const createdSubject = await subjectService.createSubject(testSubjectData, faculty._id);
    console.log("✓ Subject created successfully:", createdSubject._id);

    // Clean up created subject
    await Subject.findByIdAndDelete(createdSubject._id);
    console.log("Cleaned up test subject.");
  } catch (err) {
    console.error("❌ Subject Creation Failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

testCreateSubject();
