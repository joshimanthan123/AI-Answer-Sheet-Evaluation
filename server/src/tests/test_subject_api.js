import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import jwt from "jsonwebtoken";
import { ROLES } from "../constants/roles.js";

async function testSubjectAPI() {
  await mongoose.connect(env.MONGODB_URI);

  try {
    let faculty = await User.findOne({ role: ROLES.FACULTY, isDeleted: false });
    if (!faculty) {
      faculty = await User.create({
        name: "Prof. API Subject Tester",
        email: `faculty.api.${Date.now()}@example.com`,
        password: "password123",
        role: ROLES.FACULTY,
      });
    }

    const secret = env.JWT.ACCESS_SECRET || "default_jwt_secret_key_change_in_production";
    const token = jwt.sign(
      { id: faculty._id.toString(), role: faculty.role, email: faculty.email },
      secret,
      { expiresIn: "1h" }
    );

    const courses = await Course.find({ isDeleted: false });
    const courseId = courses.length > 0 ? courses[0]._id.toString() : null;

    console.log("Faculty User ID:", faculty._id.toString());
    console.log("Course ID available:", courseId);
    console.log("Sending POST /api/v1/subjects...");

    const payload = {
      name: "API Subject No Course " + Date.now(),
      code: "NOCRS" + Math.floor(Math.random() * 1000),
      semester: 3,
      credits: 4,
      description: "Testing API endpoint without course",
    };

    const res = await fetch("http://localhost:5000/api/v1/subjects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response Body:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

testSubjectAPI();
