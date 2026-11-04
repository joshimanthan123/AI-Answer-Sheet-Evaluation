import mongoose from "mongoose";
import connectDB from "../config/db.js";
import authService from "../services/auth.service.js";

async function verifyAllAccounts() {
  await connectDB();
  console.log("Connected to DB via connectDB(). Seeding check finished.\n");

  const accountsToTest = [
    { email: "studentCE@gmail.com", pass: "Password123!", role: "student" },
    { email: "cefaculty@gmail.com", pass: "Password123!", role: "faculty" },
    { email: "student@test.com", pass: "Password123!", role: "student" },
    { email: "faculty@test.com", pass: "Password123!", role: "faculty" },
    { email: "admin@test.com", pass: "Password123!", role: "admin" },
    { email: "student@university.edu", pass: "password", role: "student" },
    { email: "faculty@university.edu", pass: "password", role: "faculty" },
    { email: "admin@university.edu", pass: "password", role: "admin" },
  ];

  let passed = 0;
  for (const acc of accountsToTest) {
    try {
      const res = await authService.loginUser(acc.email, acc.pass);
      console.log(`✓ [SUCCESS] Logged in ${acc.email} (${res.user.role}) - Token generated!`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAILED]  Login failed for ${acc.email}:`, err.message);
    }
  }

  console.log(`\n========================================`);
  console.log(`Verified ${passed}/${accountsToTest.length} accounts successfully!`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
}

verifyAllAccounts().catch(console.error);
