import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";

async function checkStudentCE() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to DB.");

  const student = await User.findOne({ email: "studentCE@gmail.com" });
  if (!student) {
    console.log("studentCE@gmail.com does NOT exist in DB!");
  } else {
    console.log("Found studentCE@gmail.com:");
    console.log("- ID:", student._id);
    console.log("- Role:", student.role);
    console.log("- isActive:", student.isActive);
    console.log("- isDeleted:", student.isDeleted);
    console.log("- password hash:", student.password);

    const matchPassword123 = await student.comparePassword("Password123!");
    const match12345678 = await student.comparePassword("12345678");
    const matchPassword = await student.comparePassword("password");

    console.log("Test Password123!:", matchPassword123);
    console.log("Test 12345678    :", match12345678);
    console.log("Test password    :", matchPassword);
  }

  await mongoose.disconnect();
}

checkStudentCE().catch(console.error);
