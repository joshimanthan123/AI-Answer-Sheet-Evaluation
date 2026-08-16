import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import studentController from "../controllers/student.controller.js";
import notificationController from "../controllers/notification.controller.js";

const makeMockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

// Helper to await asyncHandler controller methods
async function callController(controllerMethod, req, res) {
  return new Promise((resolve, reject) => {
    const next = (err) => {
      if (err) reject(err);
      else resolve();
    };

    const originalJson = res.json;
    res.json = (data) => {
      const ret = originalJson ? originalJson(data) : res;
      resolve();
      return ret;
    };

    Promise.resolve(controllerMethod(req, res, next)).catch(reject);
  });
}

async function runTests() {
  console.log("Starting Student Profile & Notifications Integration Tests...");
  console.log("Connecting database: " + env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  let studentUser = null;
  let unauthorizedStudent = null;
  let adminUser = null;
  let testNotifications = [];

  try {
    // 1. Setup Users
    studentUser = await User.create({
      name: "Test Student P6",
      email: "student.p6@example.com",
      password: "password123",
      role: "student",
      studentId: "STUDP6" + Date.now(),
      rollNo: "ROLLP6" + Date.now(),
      department: "Computer Engineering",
      semester: 5,
    });

    unauthorizedStudent = await User.create({
      name: "Unauthorized Student P6",
      email: "unauthorized.p6@example.com",
      password: "password123",
      role: "student",
      studentId: "STUDP6_BAD" + Date.now(),
      rollNo: "ROLLP6_BAD" + Date.now(),
      department: "Information Technology",
      semester: 3,
    });

    adminUser = await User.create({
      name: "Test Admin P6",
      email: "admin.p6@example.com",
      password: "password123",
      role: "admin",
    });

    console.log("Database test setup completed successfully.");

    // --- Scenario 1: Retrieve Profile ---
    console.log("\n--- Scenario 1: Retrieve Profile ---");
    const req1 = { user: studentUser };
    const res1 = makeMockResponse();
    await callController(studentController.getStudentProfile, req1, res1);

    if (res1.statusCode !== 200 || !res1.body.success) {
      throw new Error(`Scenario 1 Failed! Status: ${res1.statusCode}`);
    }
    const retrievedUser = res1.body.data.user;
    console.log("Retrieved personal / academic info: ", {
      name: retrievedUser.name,
      email: retrievedUser.email,
      department: retrievedUser.department,
      semester: retrievedUser.semester,
      rollNo: retrievedUser.rollNo,
    });

    if (
      retrievedUser.name !== "Test Student P6" ||
      retrievedUser.email !== "student.p6@example.com" ||
      retrievedUser.department !== "Computer Engineering" ||
      retrievedUser.semester !== 5
    ) {
      throw new Error("Scenario 1 Failed: Profile data mismatch.");
    }
    console.log("Scenario 1 Passed!");


    // --- Scenario 2: Update Whitelisted Fields ---
    console.log("\n--- Scenario 2: Update Whitelisted Fields ---");
    const req2 = {
      user: studentUser,
      body: { name: "Updated Test Student P6" }
    };
    const res2 = makeMockResponse();
    await callController(studentController.updateStudentProfile, req2, res2);

    if (res2.statusCode !== 200 || !res2.body.success) {
      throw new Error(`Scenario 2 Failed! Status: ${res2.statusCode}`);
    }
    if (res2.body.data.user.name !== "Updated Test Student P6") {
      throw new Error("Scenario 2 Failed: Name was not updated in response.");
    }
    // Verify in database
    const dbUser = await User.findById(studentUser._id);
    if (dbUser.name !== "Updated Test Student P6") {
      throw new Error("Scenario 2 Failed: Name change did not persist in database.");
    }
    console.log("Scenario 2 Passed!");


    // --- Scenario 3: Update Non-Whitelisted Fields ---
    console.log("\n--- Scenario 3: Update Non-Whitelisted Fields (Ignored) ---");
    // Change profile but try to modify semester, role and rollNo
    const req3 = {
      user: studentUser,
      body: { 
        name: "Malicious Student", 
        semester: 8, 
        role: "admin",
        rollNo: "STEAL_ROLL"
      }
    };
    const res3 = makeMockResponse();
    await callController(studentController.updateStudentProfile, req3, res3);

    const checkMaliciousDbUser = await User.findById(studentUser._id);
    console.log("Fields after malicious update attempt:", {
      role: checkMaliciousDbUser.role,
      semester: checkMaliciousDbUser.semester,
      rollNo: checkMaliciousDbUser.rollNo
    });

    if (
      checkMaliciousDbUser.role !== "student" ||
      checkMaliciousDbUser.semester !== 5 ||
      checkMaliciousDbUser.rollNo === "STEAL_ROLL"
    ) {
      throw new Error("Scenario 3 Failed: Non-whitelisted field updating was not filtered / blocked.");
    }
    console.log("Scenario 3 Passed!");


    // Setup Notifications
    const n1 = await Notification.create({
      user: studentUser._id,
      title: "Exam Published",
      message: "Your AI grading sheet is ready.",
      type: "Exam Published",
    });
    const n2 = await Notification.create({
      user: studentUser._id,
      title: "Autosave Synced",
      message: "Canvas saved.",
      type: "System Notification",
    });
    const n3 = await Notification.create({
      user: unauthorizedStudent._id,
      title: "Secret Alert",
      message: "Private notification.",
      type: "General Announcement",
    });
    testNotifications = [n1, n2, n3];


    // --- Scenario 4: Retrieve Own Notifications Only ---
    console.log("\n--- Scenario 4: Retrieve Own Notifications Only ---");
    const req4 = {
      user: studentUser,
      query: {}
    };
    const res4 = makeMockResponse();
    await callController(notificationController.getAllNotifications, req4, res4);

    if (res4.statusCode !== 200) {
      throw new Error(`Scenario 4 Failed! Status: ${res4.statusCode}`);
    }
    const myNotifs = res4.body.data;
    console.log(`Retrieved ${myNotifs.length} notifications:`, myNotifs.map(n => n.title));

    if (myNotifs.length !== 2 || myNotifs.some(n => n.title === "Secret Alert")) {
      throw new Error("Scenario 4 Failed: Leaked notifications belonging to other students.");
    }
    console.log("Scenario 4 Passed!");


    // --- Scenario 5: Retrieve Bypass Attempt ---
    console.log("\n--- Scenario 5: Retrieve Bypass Attempt (Forcing Query user ID) ---");
    const req5 = {
      user: studentUser,
      query: { user: unauthorizedStudent._id.toString() } // Attempt to fetch other student's alerts
    };
    const res5 = makeMockResponse();
    await callController(notificationController.getAllNotifications, req5, res5);

    const bypassNotifs = res5.body.data;
    if (bypassNotifs.length !== 2 || bypassNotifs.some(n => n.title === "Secret Alert")) {
      throw new Error("Scenario 5 Failed: Bypassed user check by passing user query parameter.");
    }
    console.log("Scenario 5 Passed!");


    // --- Scenario 6: Unauthorized ID Access Attempt ---
    console.log("\n--- Scenario 6: Unauthorized ID Access Attempt (Expects 403) ---");
    const req6 = {
      user: studentUser,
      params: { id: n3._id.toString() }
    };
    const res6 = makeMockResponse();
    try {
      await callController(notificationController.getNotificationById, req6, res6);
      throw new Error("Scenario 6 Failed: Accessed other student's notification ID without error.");
    } catch (err) {
      console.log("Caught expected exception: " + err.message);
      if (err.statusCode !== 403) {
        throw new Error(`Scenario 6 Failed: Expected 403, got ${err.statusCode}`);
      }
    }
    console.log("Scenario 6 Passed!");


    // --- Scenario 7: Unauthorized ID Update Attempt ---
    console.log("\n--- Scenario 7: Unauthorized ID Update Attempt (Expects 403) ---");
    const req7 = {
      user: studentUser,
      params: { id: n3._id.toString() },
      body: { read: true }
    };
    const res7 = makeMockResponse();
    try {
      await callController(notificationController.updateNotification, req7, res7);
      throw new Error("Scenario 7 Failed: Updated other student's notification status.");
    } catch (err) {
      console.log("Caught expected exception: " + err.message);
      if (err.statusCode !== 403) {
        throw new Error(`Scenario 7 Failed: Expected 403, got ${err.statusCode}`);
      }
    }
    console.log("Scenario 7 Passed!");


    // --- Scenario 8: Unauthorized ID Delete Attempt ---
    console.log("\n--- Scenario 8: Unauthorized ID Delete Attempt (Expects 403) ---");
    const req8 = {
      user: studentUser,
      params: { id: n3._id.toString() }
    };
    const res8 = makeMockResponse();
    try {
      await callController(notificationController.deleteNotification, req8, res8);
      throw new Error("Scenario 8 Failed: Deleted other student's notification.");
    } catch (err) {
      console.log("Caught expected exception: " + err.message);
      if (err.statusCode !== 403) {
        throw new Error(`Scenario 8 Failed: Expected 403, got ${err.statusCode}`);
      }
    }
    console.log("Scenario 8 Passed!");


    // --- Scenario 9: Mark All as Read (Limits scope) ---
    console.log("\n--- Scenario 9: Mark All as Read ---");
    const req9 = { user: studentUser };
    const res9 = makeMockResponse();
    await callController(notificationController.markAllAsRead, req9, res9);

    if (res9.statusCode !== 200) {
      throw new Error(`Scenario 9 Failed! Status: ${res9.statusCode}`);
    }

    // Assert studentUser notifications are read, while unauthorized student notification is NOT read
    const checkN1 = await Notification.findById(n1._id);
    const checkN2 = await Notification.findById(n2._id);
    const checkN3 = await Notification.findById(n3._id);

    console.log("Notification read statuses:", {
      n1: checkN1.read,
      n2: checkN2.read,
      n3: checkN3.read
    });

    if (!checkN1.read || !checkN2.read) {
      throw new Error("Scenario 9 Failed: Student notifications were not marked read.");
    }
    if (checkN3.read) {
      throw new Error("Scenario 9 Failed: Unauthorized student notification was marked read.");
    }
    console.log("Scenario 9 Passed!");


    console.log("\n--- ALL PROFILE & NOTIFICATIONS TESTS PASSED SUCCESSFULLY! ---");

  } finally {
    console.log("Cleaning test database entries...");
    if (studentUser) await User.findByIdAndDelete(studentUser._id);
    if (unauthorizedStudent) await User.findByIdAndDelete(unauthorizedStudent._id);
    if (adminUser) await User.findByIdAndDelete(adminUser._id);
    if (testNotifications.length) {
      const ids = testNotifications.map(n => n._id);
      await Notification.deleteMany({ _id: { $in: ids } });
    }

    console.log("Disconnecting database...");
    await mongoose.disconnect();
    console.log("Database disconnected.");
  }
}

runTests().catch(err => {
  console.error("Test execution failed: " + err.message);
  process.exit(1);
});
