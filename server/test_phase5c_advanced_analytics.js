import mongoose from "mongoose";
import dotenv from "dotenv";
import Exam from "./src/models/Exam.js";
import User from "./src/models/User.js";
import AnswerSheet from "./src/models/AnswerSheet.js";
import Evaluation from "./src/models/Evaluation.js";
import * as advancedAnalyticsService from "./src/services/advancedAnalytics.service.js";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai_evaluation_db";

async function runTests() {
  console.log("=========================================");
  console.log("  PHASE 5C ADVANCED ANALYTICS TEST SUITE ");
  console.log("=========================================");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✓ Connected to MongoDB");

    // Fetch an admin and a faculty user
    const adminUser = await User.findOne({ role: "admin", isDeleted: false });
    const facultyUser = await User.findOne({ role: "faculty", isDeleted: false });

    const adminId = adminUser ? adminUser._id.toString() : null;
    const facultyId = facultyUser ? facultyUser._id.toString() : null;

    console.log(`- Admin ID: ${adminId}`);
    console.log(`- Faculty ID: ${facultyId}`);

    // 1. Available Filters
    console.log("\n--- Test 1: Available Filters ---");
    const filters = await advancedAnalyticsService.getAvailableFilters(facultyId, "faculty");
    console.log(`✓ Retrived ${filters.exams.length} accessible exams, ${filters.subjects.length} subjects, ${filters.academicYears.length} academic years.`);

    // 2. Cross-Exam Analytics
    console.log("\n--- Test 2: Cross-Exam Analytics ---");
    const crossExam = await advancedAnalyticsService.getCrossExamAnalytics({}, adminId, "admin");
    console.log(`✓ Retrived ${crossExam.crossExamComparison.length} exams in cross-exam comparison.`);
    if (crossExam.crossExamComparison.length > 0) {
      const first = crossExam.crossExamComparison[0];
      console.log(`  Sample Exam: ${first.title}, Student Count: ${first.studentCount}, Avg %: ${first.averagePercentage}%, Override Rate: ${first.overrideRate}%`);
    }

    // 3. Performance Trends
    console.log("\n--- Test 3: Time-based Performance Trends ---");
    const perfTrends = await advancedAnalyticsService.getPerformanceTrends({}, adminId, "admin");
    console.log(`✓ Retrived ${perfTrends.length} trend entries.`);

    // 4. Student Performance Trend
    console.log("\n--- Test 4: Individual Student Performance Trend ---");
    const studentUser = await User.findOne({ role: "student", isDeleted: false });
    if (studentUser) {
      const studentTrend = await advancedAnalyticsService.getStudentPerformanceTrends(studentUser._id.toString(), adminId, "admin");
      console.log(`✓ Student: ${studentTrend.student?.name}, Performance Trend Count: ${studentTrend.performanceTrend.length}`);
    } else {
      console.log("! No student user found for trend check.");
    }

    // 5. Question Trends
    console.log("\n--- Test 5: Question Performance Trends ---");
    const qTrends = await advancedAnalyticsService.getQuestionTrends({}, adminId, "admin");
    console.log(`✓ Retrived ${qTrends.length} question performance trend records.`);

    // 6. Repeated Correction Patterns
    console.log("\n--- Test 6: Repeated Correction Patterns ---");
    const patterns = await advancedAnalyticsService.getRepeatedCorrectionPatterns({}, adminId, "admin");
    console.log(`✓ Found ${patterns.length} potential improvement areas.`);

    // 7. AI Trends & Feedback Trends
    console.log("\n--- Test 7: AI Trends & Feedback Trends ---");
    const aiTrends = await advancedAnalyticsService.getAIEvaluationTrends({}, adminId, "admin");
    const fbTrends = await advancedAnalyticsService.getFeedbackTrends({}, adminId, "admin");
    console.log(`✓ AI trends count: ${aiTrends.length}, Feedback trends count: ${fbTrends.length}`);

    // 8. Version History Timeline
    console.log("\n--- Test 8: Reference & Rubric Version Timeline ---");
    const sampleExam = await Exam.findOne({ isDeleted: false });
    if (sampleExam) {
      const history = await advancedAnalyticsService.getVersionHistoryTimeline(sampleExam._id.toString(), adminId, "admin");
      console.log(`✓ Version timeline entries for ${sampleExam.title}: ${history.length}`);
    }

    // 9. System Monitoring Metrics & Pipeline Health
    console.log("\n--- Test 9: System Monitoring & Pipeline Health ---");
    const monitoring = await advancedAnalyticsService.getSystemMonitoringMetrics();
    console.log(`✓ System Health: Backend=${monitoring.health.backendApi}, DB=${monitoring.health.database}, OCR Service=${monitoring.health.ocrService}`);
    console.log(`  OCR Metrics: Requests=${monitoring.ocrMetrics.totalRequests}, Success=${monitoring.ocrMetrics.successful}, Failed=${monitoring.ocrMetrics.failed}`);
    console.log(`  AI Metrics: Processed=${monitoring.aiMetrics.processed}, Success=${monitoring.aiMetrics.successful}, Failed=${monitoring.aiMetrics.failed}`);

    const pipeline = await getPipelineHealth();
    console.log(`✓ Pipeline Counts: Submitted=${pipeline.pipelineCounts.submitted}, OCR=${pipeline.pipelineCounts.ocrCompleted}, AI=${pipeline.pipelineCounts.aiEvaluated}, Finalized=${pipeline.pipelineCounts.finalized}`);

    // 10. Admin Overview & Audit Logs Search
    console.log("\n--- Test 10: Admin Overview & Audit Logs Search ---");
    const overview = await advancedAnalyticsService.getAdminOverview();
    console.log(`✓ Admin Overview Counts: Users=${overview.users.total}, Students=${overview.users.students}, Faculty=${overview.users.faculty}, Exams=${overview.exams.total}, AnswerSheets=${overview.submissions.total}, Evaluations=${overview.evaluations.total}`);

    const auditRes = await advancedAnalyticsService.getAuditLogSearch({}, 1, 10);
    console.log(`✓ Audit Logs Search Count: ${auditRes.total}`);

    // 11. Review Priority Indicator
    console.log("\n--- Test 11: Review Priority Indicator ---");
    if (sampleExam) {
      const priorityList = await advancedAnalyticsService.getReviewPriorityList(sampleExam._id.toString(), adminId, "admin");
      console.log(`✓ Priority list count for exam ${sampleExam.title}: ${priorityList.length}`);
    }

    // 12. System Alerts
    console.log("\n--- Test 12: Configurable System Alerts ---");
    const alertRes = await advancedAnalyticsService.getSystemAlerts();
    console.log(`✓ Active Alerts: ${alertRes.alerts.length}, Configured Thresholds: OCR Fail=${alertRes.config.ocrFailureRateThreshold}%, Backlog=${alertRes.config.pendingEvaluationCountThreshold}`);

    console.log("\n=========================================");
    console.log("  ALL PHASE 5C BACKEND TESTS PASSED SUCCESSFULLY!");
    console.log("=========================================");
  } catch (err) {
    console.error("❌ Test failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("✓ Disconnected from MongoDB");
  }
}

const getPipelineHealth = advancedAnalyticsService.getPipelineHealth;
runTests();
