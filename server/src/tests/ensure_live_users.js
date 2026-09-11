import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import env from "../config/env.js";
import User from "../models/User.js";
import Department from "../models/Department.js";

async function ensureUsers() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("12345678", salt);

    let dept = await Department.findOne({ $or: [{ code: "CE" }, { name: "Computer Engineering" }] });
    if (!dept) {
      dept = await Department.create({
        name: "Computer Engineering Department " + Date.now(),
        code: "CE",
        isActive: true,
      });
    }

    // 1. Faculty
    let faculty = await User.findOne({ email: "cefaculty@gmail.com" });
    if (!faculty) {
      faculty = await User.create({
        name: "CE Faculty",
        email: "cefaculty@gmail.com",
        password: hashedPassword,
        role: "faculty",
        lecturerId: "LECCE001",
        department: "CE",
        isDeleted: false,
      });
      console.log("Created cefaculty@gmail.com");
    } else {
      faculty.password = hashedPassword;
      faculty.role = "faculty";
      faculty.department = "CE";
      faculty.isDeleted = false;
      await faculty.save();
      console.log("Updated cefaculty@gmail.com password to 12345678");
    }

    // 2. Student
    let student = await User.findOne({ email: "studentCE@gmail.com" });
    if (!student) {
      student = await User.create({
        name: "Student CE",
        email: "studentCE@gmail.com",
        password: hashedPassword,
        role: "student",
        studentId: "STUDCE001",
        semester: 5,
        department: "CE",
        isDeleted: false,
      });
      console.log("Created studentCE@gmail.com");
    } else {
      student.password = hashedPassword;
      student.role = "student";
      student.semester = 5;
      student.department = "CE";
      student.isDeleted = false;
      await student.save();
      console.log("Updated studentCE@gmail.com password to 12345678");
    }

  } catch (err) {
    console.error("Error ensuring live users:", err);
  } finally {
    await mongoose.disconnect();
  }
}

ensureUsers();
