import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import authService from "../services/auth.service.js";

async function testAuth() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  try {
    // 1. Reset passwords properly by passing unhashed plaintext password so pre("save") hashes it exactly once
    let faculty = await User.findOne({ email: "cefaculty@gmail.com" });
    if (!faculty) {
      faculty = new User({
        name: "CE Faculty Member",
        email: "cefaculty@gmail.com",
        password: "password123",
        role: "faculty",
        lecturerId: "LECCE001",
        department: "CE",
      });
    }
    faculty.password = "12345678"; // Set unhashed plaintext
    await faculty.save();
    console.log("✓ Reset cefaculty@gmail.com password cleanly.");

    let student = await User.findOne({ email: "studentCE@gmail.com" });
    if (!student) {
      student = new User({
        name: "Student CE",
        email: "studentCE@gmail.com",
        password: "password123",
        role: "student",
        studentId: "STUDCE001",
        semester: 5,
        department: "CE",
      });
    }
    student.password = "12345678"; // Set unhashed plaintext
    await student.save();
    console.log("✓ Reset studentCE@gmail.com password cleanly.");

    // 2. Test login using authService.loginUser
    console.log("\nTesting login for cefaculty@gmail.com...");
    const facLogin = await authService.loginUser("cefaculty@gmail.com", "12345678");
    console.log("✓ Faculty login successful! User ID:", facLogin.user._id, "Role:", facLogin.user.role);

    console.log("\nTesting login for studentCE@gmail.com...");
    const stuLogin = await authService.loginUser("studentCE@gmail.com", "12345678");
    console.log("✓ Student login successful! User ID:", stuLogin.user._id, "Role:", stuLogin.user.role);

  } catch (err) {
    console.error("Auth Test Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

testAuth();
