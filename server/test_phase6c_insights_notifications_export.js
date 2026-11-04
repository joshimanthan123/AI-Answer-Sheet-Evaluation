import mongoose from "mongoose";
import assert from "assert";
import dotenv from "dotenv";
import Exam from "./src/models/Exam.js";
import User from "./src/models/User.js";
import AnswerSheet from "./src/models/AnswerSheet.js";
import Evaluation from "./src/models/Evaluation.js";
import Notification from "./src/models/Notification.js";
import * as insightService from "./src/services/insight.service.js";
import * as notificationService from "./src/services/notification.service.js";
import * as resultPublicationService from "./src/services/resultPublication.service.js";
import * as analyticsService from "./src/services/analytics.service.js";
import { ROLES } from "./src/constants/roles.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai_evaluation_db";

async function runPhase6CTestSuite() {
  console.log("=================================================");
  console.log("       PHASE 6C AUTOMATED TEST SUITE RUNNER       ");
  console.log("=================================================\n");

  let passedCount = 0;
  let failedCount = 0;

  function logPass(msg) {
    console.log(`  ✓ PASSED: ${msg}`);
    passedCount++;
  }

  function logFail(msg, err) {
    console.log(`  ✗ FAILED: ${msg}`);
    console.error(err);
    failedCount++;
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB: ${mongoose.connection.name}\n`);

    // Clean up any old test data
    const testExamCode1 = "EXAM6C_01";
    const testExamCode2 = "EXAM6C_02";

    await Exam.deleteMany({ code: { $in: [testExamCode1, testExamCode2] } });
    await User.deleteMany({
      email: {
        $in: [
          "faculty6c@test.com",
          "faculty6c_other@test.com",
          "student6c_1@test.com",
          "student6c_2@test.com",
          "admin6c@test.com",
        ],
      },
    });

    // 1. Create Users
    const facultyUser = await User.create({
      name: "Prof. 6C Faculty",
      email: "faculty6c@test.com",
      password: "password123",
      role: ROLES.FACULTY,
    });

    const otherFacultyUser = await User.create({
      name: "Prof. Other Faculty",
      email: "faculty6c_other@test.com",
      password: "password123",
      role: ROLES.FACULTY,
    });

    const student1 = await User.create({
      name: "Student Alice 6C",
      email: "student6c_1@test.com",
      password: "password123",
      role: ROLES.STUDENT,
      rollNo: "ST6C001",
    });

    const student2 = await User.create({
      name: "Student Bob 6C",
      email: "student6c_2@test.com",
      password: "password123",
      role: ROLES.STUDENT,
      rollNo: "ST6C002",
    });

    const adminUser = await User.create({
      name: "Admin 6C User",
      email: "admin6c@test.com",
      password: "password123",
      role: ROLES.ADMIN,
    });

    // 2. Create Exams
    const exam1 = await Exam.create({
      title: "Data Structures 6C",
      code: testExamCode1,
      examType: "MID_TERM",
      subject: new mongoose.Types.ObjectId(),
      createdBy: facultyUser._id,
      totalMarks: 50,
      duration: 60,
      examDate: new Date(),
      status: "PUBLISHED",
      passPercentage: 40,
      questions: [
        { questionNumber: "1", questionText: "BST Search Algorithm", maxMarks: 25 },
        { questionNumber: "2", questionText: "Tree Rotation Algorithm", maxMarks: 25 },
      ],
    });

    const exam2 = await Exam.create({
      title: "Algorithms 6C",
      code: testExamCode2,
      examType: "MID_TERM",
      subject: new mongoose.Types.ObjectId(),
      createdBy: facultyUser._id,
      totalMarks: 100,
      duration: 120,
      examDate: new Date(),
      status: "PUBLISHED",
      passPercentage: 50,
      questions: [
        { questionNumber: "1", questionText: "Graph Traversal BFS/DFS", maxMarks: 50 },
        { questionNumber: "2", questionText: "Dynamic Programming Knapsack", maxMarks: 50 },
      ],
    });

    // 3. Create Answer Sheets and Evaluations
    const testSubjectId = new mongoose.Types.ObjectId();

    // Sheet 1 & Eval 1 for Student 1 on Exam 1
    const sheet1 = await AnswerSheet.create({
      student: student1._id,
      exam: exam1._id,
      subject: testSubjectId,
      processingStatus: "completed",
      ocrStatus: "completed",
      evaluationStatus: "EVALUATION_COMPLETED",
      reviewStatus: "FINALIZED",
      finalizedAt: new Date(),
      evaluationSummary: {
        totalAwardedMarks: 45,
        totalMaximumMarks: 50,
        percentage: 90,
      },
    });

    const eval1 = await Evaluation.create({
      answerSheet: sheet1._id,
      student: student1._id,
      exam: exam1._id,
      evaluationType: "Faculty",
      obtainedMarks: 45,
      totalMarks: 50,
      percentage: 90,
      grade: "A",
      evaluationStatus: "finalized",
      questions: [
        {
          questionId: exam1.questions[0]._id,
          questionNumber: 1,
          maxMarks: 25,
          maximumMarks: 25,
          finalScore: 25,
          obtainedMarks: 25,
          aiScore: 25,
          matchedConcepts: ["BST Search"],
        },
        {
          questionId: exam1.questions[1]._id,
          questionNumber: 2,
          maxMarks: 25,
          maximumMarks: 25,
          finalScore: 20,
          obtainedMarks: 20,
          aiScore: 18,
          facultyScore: 20,
          isOverridden: true,
          matchedConcepts: ["Tree Rotation"],
        },
      ],
    });

    // Sheet 2 & Eval 2 for Student 2 on Exam 1
    const sheet2 = await AnswerSheet.create({
      student: student2._id,
      exam: exam1._id,
      subject: testSubjectId,
      processingStatus: "completed",
      ocrStatus: "completed",
      evaluationStatus: "EVALUATION_COMPLETED",
      reviewStatus: "FINALIZED",
      finalizedAt: new Date(),
      evaluationSummary: {
        totalAwardedMarks: 15,
        totalMaximumMarks: 50,
        percentage: 30,
      },
    });

    const eval2 = await Evaluation.create({
      answerSheet: sheet2._id,
      student: student2._id,
      exam: exam1._id,
      evaluationType: "Faculty",
      obtainedMarks: 15,
      totalMarks: 50,
      percentage: 30,
      grade: "F",
      evaluationStatus: "finalized",
      questions: [
        {
          questionId: exam1.questions[0]._id,
          questionNumber: 1,
          maxMarks: 25,
          maximumMarks: 25,
          finalScore: 10,
          obtainedMarks: 10,
          aiScore: 10,
        },
        {
          questionId: exam1.questions[1]._id,
          questionNumber: 2,
          maxMarks: 25,
          maximumMarks: 25,
          finalScore: 5,
          obtainedMarks: 5,
          aiScore: 5,
        },
      ],
    });

    // Sheet 3 & Eval 3 for Student 1 on Exam 2
    const sheet3 = await AnswerSheet.create({
      student: student1._id,
      exam: exam2._id,
      subject: testSubjectId,
      processingStatus: "completed",
      ocrStatus: "completed",
      evaluationStatus: "EVALUATION_COMPLETED",
      reviewStatus: "FINALIZED",
      finalizedAt: new Date(),
      evaluationSummary: {
        totalAwardedMarks: 85,
        totalMaximumMarks: 100,
        percentage: 85,
      },
    });

    const eval3 = await Evaluation.create({
      answerSheet: sheet3._id,
      student: student1._id,
      exam: exam2._id,
      evaluationType: "Faculty",
      obtainedMarks: 85,
      totalMarks: 100,
      percentage: 85,
      grade: "A",
      evaluationStatus: "finalized",
      questions: [
        {
          questionId: exam2.questions[0]._id,
          questionNumber: 1,
          maxMarks: 50,
          maximumMarks: 50,
          finalScore: 45,
          obtainedMarks: 45,
          aiScore: 45,
        },
        {
          questionId: exam2.questions[1]._id,
          questionNumber: 2,
          maxMarks: 50,
          maximumMarks: 50,
          finalScore: 40,
          obtainedMarks: 40,
          aiScore: 40,
        },
      ],
    });

    console.log("--- TEST CASE 1: Result Publication & Automated Notification ---");
    try {
      // Publish Sheet 1 result
      const pubRes1 = await resultPublicationService.publishResult(sheet1._id.toString(), facultyUser._id.toString(), "Published for Alice");
      assert(pubRes1.success === true, "Result 1 published successfully");

      // Check student notification created
      const notifs1 = await notificationService.getAllNotifications({ user: student1._id.toString() });
      assert(notifs1.data.length >= 1, "Student 1 received result publication notification");
      const pubNotif = notifs1.data.find((n) => n.type === "Results Published" || n.type === "RESULT_PUBLISHED");
      assert(pubNotif !== undefined, "Notification type is Results Published");
      assert(pubNotif.relatedEntityId.toString() === eval1._id.toString(), "Notification links to correct Evaluation entity ID");
      logPass("Result publication automatically generated notification for Student 1");
    } catch (err) {
      logFail("Result publication notification test failed", err);
    }

    console.log("\n--- TEST CASE 2: Student Personal Insights ---");
    try {
      // Publish Sheet 3 result as well for Student 1
      await resultPublicationService.publishResult(sheet3._id.toString(), facultyUser._id.toString(), "Published for Alice Exam 2");

      const studentInsights = await insightService.getStudentInsights(student1._id.toString());
      assert(Array.isArray(studentInsights), "Student insights returns an array");
      assert(studentInsights.length >= 3, "Returns average, highest, and trend insights");

      const avgInsight = studentInsights.find((i) => i.title === "Average Score");
      assert(avgInsight && avgInsight.metric === 87.5, "Calculated average score metric is 87.5%");

      const highestInsight = studentInsights.find((i) => i.title === "Highest Score");
      assert(highestInsight && highestInsight.metric === 90, "Calculated highest score metric is 90%");

      const trendInsight = studentInsights.find((i) => i.title === "Performance Trend");
      assert(trendInsight !== undefined, "Performance trend insight generated");
      logPass("Student personal insights computed accurately from published evaluations");
    } catch (err) {
      logFail("Student personal insights test failed", err);
    }

    console.log("\n--- TEST CASE 3: Faculty Exam Insights ---");
    try {
      const facultyInsights = await insightService.getFacultyInsights(exam1._id.toString(), facultyUser._id.toString(), ROLES.FACULTY);
      assert(Array.isArray(facultyInsights), "Faculty insights returns an array");

      const perfInsight = facultyInsights.find((i) => i.title === "Average Performance");
      assert(perfInsight !== undefined, "Contains Average Performance insight");

      const questionInsight = facultyInsights.find((i) => i.type === "QUESTION_PERFORMANCE");
      assert(questionInsight !== undefined, "Contains Question Performance insight");
      logPass("Faculty exam insights generated correctly from consolidated analytics");
    } catch (err) {
      logFail("Faculty exam insights test failed", err);
    }

    console.log("\n--- TEST CASE 4: Admin Aggregate Insights ---");
    try {
      const adminInsights = await insightService.getAdminInsights();
      assert(Array.isArray(adminInsights), "Admin insights returns an array");
      assert(adminInsights.length >= 2, "Admin insights returns volume and average metrics");
      logPass("Admin aggregate insights generated correctly");
    } catch (err) {
      logFail("Admin aggregate insights test failed", err);
    }

    console.log("\n--- TEST CASE 5: Notification Unread Count & Mark-as-Read ---");
    try {
      const unreadInitial = await notificationService.getUnreadCount(student1._id.toString());
      assert(unreadInitial.unreadCount > 0, "Initial unread notification count > 0");

      const notifList = await notificationService.getAllNotifications({ user: student1._id.toString() });
      const targetNotif = notifList.data[0];

      await notificationService.markAsRead(targetNotif._id.toString(), student1._id.toString());
      const notifAfter = await notificationService.getNotificationById(targetNotif._id.toString());
      assert(notifAfter.read === true, "Notification marked as read");
      assert(notifAfter.readAt !== undefined, "Notification has readAt timestamp set");

      await notificationService.markAllAsRead(student1._id.toString(), student1._id.toString());
      const unreadFinal = await notificationService.getUnreadCount(student1._id.toString());
      assert(unreadFinal.unreadCount === 0, "Unread notification count is 0 after markAllAsRead");
      logPass("Notification unread count, single read, and markAllAsRead work correctly");
    } catch (err) {
      logFail("Notification unread count and read status test failed", err);
    }

    console.log("\n--- TEST CASE 6: CSV Analytics Export ---");
    try {
      const csvOutput = await analyticsService.generateAnalyticsCSV(exam1._id.toString(), facultyUser._id.toString(), ROLES.FACULTY);
      assert(typeof csvOutput === "string", "CSV generator returns string output");
      assert(csvOutput.includes('"Exam Title","Data Structures 6C"'), "CSV contains Exam Title header");
      assert(csvOutput.includes('"Student Name"'), "CSV contains Student Name column");
      assert(csvOutput.includes('"QUESTION PERFORMANCE"'), "CSV contains Question analytics section");
      logPass("CSV analytics export generated with full exam and question statistics");
    } catch (err) {
      logFail("CSV analytics export test failed", err);
    }

    console.log("\n--- TEST CASE 7: HTML/PDF & Excel Analytics Export ---");
    try {
      const htmlOutput = await analyticsService.generateAnalyticsHTML(exam1._id.toString(), facultyUser._id.toString(), ROLES.FACULTY);
      assert(typeof htmlOutput === "string", "HTML/PDF generator returns string output");
      assert(htmlOutput.includes("<!DOCTYPE html>") || htmlOutput.includes("<html"), "Returns valid HTML document format");

      const excelOutput = await analyticsService.generateAnalyticsExcel(exam1._id.toString(), facultyUser._id.toString(), ROLES.FACULTY);
      assert(typeof excelOutput === "string", "Excel generator returns XML/Excel document output");
      assert(excelOutput.includes("<?xml") || excelOutput.includes("<Workbook"), "Returns valid XML Excel Workbook format");
      logPass("HTML/PDF and Excel export generators work correctly");
    } catch (err) {
      logFail("HTML/PDF & Excel export test failed", err);
    }

    console.log("\n--- TEST CASE 8: Security & Role Authorization Boundaries ---");
    try {
      // Unauthorized faculty accessing other faculty's exam insights
      try {
        await insightService.getFacultyInsights(exam1._id.toString(), otherFacultyUser._id.toString(), ROLES.FACULTY);
        assert(false, "Unauthorized faculty should be blocked from accessing exam insights");
      } catch (err) {
        assert(
          err.message.toLowerCase().includes("denied") ||
          err.message.toLowerCase().includes("permission") ||
          err.message.toLowerCase().includes("forbidden"),
          "Unauthorized faculty blocked from accessing unassigned exam insights"
        );
      }

      // Notification isolation check
      const otherUserNotifs = await notificationService.getAllNotifications({ user: otherFacultyUser._id.toString() });
      assert(otherUserNotifs.data.length === 0, "Student 1 notifications not visible to other user");

      logPass("Role authorization and notification privacy boundaries strictly enforced");
    } catch (err) {
      logFail("Security & authorization boundary test failed", err);
    }

    console.log("\n=================================================");
    console.log(`Phase 6C Test Suite Execution Complete!`);
    console.log(`Total Passed: ${passedCount}`);
    console.log(`Total Failed: ${failedCount}`);
    console.log("=================================================\n");

    // Cleanup test records
    await Exam.deleteMany({ code: { $in: [testExamCode1, testExamCode2] } });
    await User.deleteMany({
      email: {
        $in: [
          "faculty6c@test.com",
          "faculty6c_other@test.com",
          "student6c_1@test.com",
          "student6c_2@test.com",
          "admin6c@test.com",
        ],
      },
    });
    await AnswerSheet.deleteMany({ _id: { $in: [sheet1._id, sheet2._id, sheet3._id] } });
    await Evaluation.deleteMany({ _id: { $in: [eval1._id, eval2._id, eval3._id] } });
    await Notification.deleteMany({ user: { $in: [student1._id, student2._id] } });

    await mongoose.disconnect();
  } catch (globalErr) {
    console.error("Test Suite Exception:", globalErr);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runPhase6CTestSuite();
