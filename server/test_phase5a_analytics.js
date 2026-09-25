import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import analyticsService from './src/services/analytics.service.js';
import resultsService from './src/services/results.service.js';
import AnswerSheet from './src/models/AnswerSheet.js';
import Evaluation from './src/models/Evaluation.js';
import Exam from './src/models/Exam.js';
import Subject from './src/models/Subject.js';
import User from './src/models/User.js';
import { ROLES } from './src/constants/roles.js';

async function runPhase5ATestSuite() {
  console.log('=================================================');
  console.log('       PHASE 5A AUTOMATED TEST SUITE RUNNER       ');
  console.log('=================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASSED: ${message}`);
      passedCount++;
    } else {
      console.error(`  ✗ FAILED: ${message}`);
      failedCount++;
    }
  }

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_evaluation_db';
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB: ${mongoose.connection.name}\n`);

    // Clean up previous test artifacts if any
    const testExamCode = 'TEST5A_101';
    await Exam.deleteMany({ code: testExamCode });
    await User.deleteMany({ email: { $in: ['faculty5a@test.com', 'student5a_1@test.com', 'student5a_2@test.com', 'student5a_forbidden@test.com'] } });

    // 1. Create a Dummy Faculty User
    const facultyUser = await User.create({
      name: 'Dr. Faculty Five',
      email: 'faculty5a@test.com',
      password: 'password123',
      role: ROLES.FACULTY,
    });

    // 2. Create a Dummy Student User for forbidden test
    const studentUser = await User.create({
      name: 'Student Five',
      email: 'student5a_forbidden@test.com',
      password: 'password123',
      role: ROLES.STUDENT,
    });

    // 3. Create a test Exam
    const dummySubjectId = new mongoose.Types.ObjectId();
    const exam = await Exam.create({
      title: 'Big Data Analytics - CIE 2',
      code: testExamCode,
      examCode: testExamCode,
      subjectName: 'Big Data Analytics',
      subjectCode: 'BDA501',
      subject: dummySubjectId,
      examType: 'CIE_2',
      examDate: new Date(),
      totalMarks: 40,
      duration: 60,
      status: 'PUBLISHED',
      createdBy: facultyUser._id,
      passingPercentage: 40,
      passingMarks: 16,
      questions: [
        { questionNumber: 1, questionText: 'Explain Hadoop Architecture.', maximumMarks: 10, maxMarks: 10 },
        { questionNumber: 2, questionText: 'Describe MapReduce Programming Model.', maximumMarks: 10, maxMarks: 10 },
        { questionNumber: 3, questionText: 'What is Spark Resilient Distributed Dataset?', maximumMarks: 10, maxMarks: 10 },
        { questionNumber: 4, questionText: 'Compare HDFS vs HBase.', maximumMarks: 10, maxMarks: 10 },
      ],
    });

    // 4. Create Students and Answer Sheets
    const student1 = await User.create({
      name: 'Alice Smith',
      email: 'student5a_1@test.com',
      password: 'password123',
      role: ROLES.STUDENT,
      rollNo: 'STU001',
    });

    const student2 = await User.create({
      name: 'Bob Jones',
      email: 'student5a_2@test.com',
      password: 'password123',
      role: ROLES.STUDENT,
      rollNo: 'STU002',
    });

    const sheet1 = await AnswerSheet.create({
      exam: exam._id,
      subject: dummySubjectId,
      student: student1._id,
      studentIdentifier: 'STU001',
      uploadedFileName: 'alice_sheet.pdf',
      status: 'evaluated',
      submissionDate: new Date(),
    });

    const sheet2 = await AnswerSheet.create({
      exam: exam._id,
      subject: dummySubjectId,
      student: student2._id,
      studentIdentifier: 'STU002',
      uploadedFileName: 'bob_sheet.pdf',
      status: 'evaluated',
      submissionDate: new Date(),
    });

    const q1Id = exam.questions[0]._id;
    const q2Id = exam.questions[1]._id;
    const q3Id = exam.questions[2]._id;
    const q4Id = exam.questions[3]._id;

    // 5. Create Finalized Evaluations
    // Student 1 (Alice): AI = 28 (7+6+8+7), Faculty Overrode Q2 from 6 to 9 (+3 diff, OCR error), Final = 31 / 40 = 77.5%
    const eval1 = await Evaluation.create({
      answerSheet: sheet1._id,
      examId: exam._id,
      studentId: student1._id,
      evaluationType: 'Faculty',
      status: 'finalized',
      evaluationStatus: 'finalized',
      obtainedMarks: 31,
      totalMarks: 40,
      percentage: 77.5,
      reviewStartedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
      finalizedAt: new Date(),
      questions: [
        {
          questionId: q1Id,
          questionNumber: '1',
          maximumMarks: 10,
          aiMarks: 7,
          aiAwardedMarks: 7,
          finalAwardedMarks: 7,
          wasOverridden: false,
          confidence: 0.95,
        },
        {
          questionId: q2Id,
          questionNumber: '2',
          maximumMarks: 10,
          aiMarks: 6,
          aiAwardedMarks: 6,
          finalAwardedMarks: 9,
          wasOverridden: true,
          overrideReason: 'OCR error',
          facultyComment: 'HWR misread key term in line 3',
          confidence: 0.72,
        },
        {
          questionId: q3Id,
          questionNumber: '3',
          maximumMarks: 10,
          aiMarks: 8,
          aiAwardedMarks: 8,
          finalAwardedMarks: 8,
          wasOverridden: false,
          confidence: 0.92,
        },
        {
          questionId: q4Id,
          questionNumber: '4',
          maximumMarks: 10,
          aiMarks: 7,
          aiAwardedMarks: 7,
          finalAwardedMarks: 7,
          wasOverridden: false,
          confidence: 0.88,
        },
      ],
    });

    // Student 2 (Bob): AI = 34 (9+8+9+8), Faculty Accepted all, Final = 34 / 40 = 85.0%
    const eval2 = await Evaluation.create({
      answerSheet: sheet2._id,
      examId: exam._id,
      studentId: student2._id,
      evaluationType: 'Faculty',
      status: 'finalized',
      evaluationStatus: 'finalized',
      obtainedMarks: 34,
      totalMarks: 40,
      percentage: 85.0,
      reviewStartedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 mins ago
      finalizedAt: new Date(),
      questions: [
        {
          questionId: q1Id,
          questionNumber: '1',
          maximumMarks: 10,
          aiMarks: 9,
          aiAwardedMarks: 9,
          finalAwardedMarks: 9,
          wasOverridden: false,
          confidence: 0.98,
        },
        {
          questionId: q2Id,
          questionNumber: '2',
          maximumMarks: 10,
          aiMarks: 8,
          aiAwardedMarks: 8,
          finalAwardedMarks: 8,
          wasOverridden: false,
          confidence: 0.91,
        },
        {
          questionId: q3Id,
          questionNumber: '3',
          maximumMarks: 10,
          aiMarks: 9,
          aiAwardedMarks: 9,
          finalAwardedMarks: 9,
          wasOverridden: false,
          confidence: 0.96,
        },
        {
          questionId: q4Id,
          questionNumber: '4',
          maximumMarks: 10,
          aiMarks: 8,
          aiAwardedMarks: 8,
          finalAwardedMarks: 8,
          wasOverridden: false,
          confidence: 0.94,
        },
      ],
    });

    // TEST CASE 1: Accessible Exams List
    console.log('\n--- Test 1: Accessible Exams List ---');
    const accessibleExams = await analyticsService.getAccessibleExams(facultyUser._id.toString(), ROLES.FACULTY);
    const foundExam = accessibleExams.find((e) => e.id === exam._id.toString() || e._id === exam._id.toString());
    assert(foundExam && foundExam.title === 'Big Data Analytics - CIE 2', `Faculty user can access created exam in dropdown. Got: ${foundExam?.title}`);

    // TEST CASE 2: Exam Overview Summary Metrics
    console.log('\n--- Test 2: Exam Overview Summary Metrics ---');
    const overview = await analyticsService.getExamOverviewAnalytics(exam._id.toString(), facultyUser._id.toString(), ROLES.FACULTY);
    assert(overview.totalStudents === 2, `Total students count is 2 (Got: ${overview.totalStudents})`);
    assert(overview.finalizedStudents === 2, `Finalized count is 2 (Got: ${overview.finalizedStudents})`);
    assert(overview.averageFinalMarks === 32.5, `Average final marks is (31+34)/2 = 32.5 (Got: ${overview.averageFinalMarks})`);
    assert(overview.averagePercentage === 81.25, `Average percentage is 81.25% (Got: ${overview.averagePercentage})`);
    assert(overview.highestFinalMarks === 34, `Highest final mark is 34 (Got: ${overview.highestFinalMarks})`);
    assert(overview.lowestFinalMarks === 31, `Lowest final mark is 31 (Got: ${overview.lowestFinalMarks})`);

    // TEST CASE 3: Student Performance & Distribution
    console.log('\n--- Test 3: Student Performance & Distribution ---');
    const studentPerf = await analyticsService.getStudentPerformanceAnalytics(exam._id.toString(), {}, facultyUser._id.toString(), ROLES.FACULTY);
    assert(studentPerf.students.length === 2, `Student performance directory contains 2 candidates (Got: ${studentPerf.students.length})`);
    assert(studentPerf.distribution['61-80%'] === 1, `1 student in 61-80% distribution band (Got: ${studentPerf.distribution['61-80%']})`);
    assert(studentPerf.distribution['81-100%'] === 1, `1 student in 81-100% distribution band (Got: ${studentPerf.distribution['81-100%']})`);

    // TEST CASE 4: Question-Wise Performance & Observed Performance Indicators
    console.log('\n--- Test 4: Question Performance & Observed Indicators ---');
    const qPerf = await analyticsService.getQuestionPerformanceAnalytics(exam._id.toString(), facultyUser._id.toString(), ROLES.FACULTY);
    assert(qPerf.questions.length === 4, `4 exam questions compiled (Got: ${qPerf.questions.length})`);
    const q1Data = qPerf.questions.find((q) => q.questionNumber === 1);
    assert(q1Data && q1Data.averageMarks === 8, `Q1 average final score is (7+9)/2 = 8 (Got: ${q1Data?.averageMarks})`);
    assert(q1Data && q1Data.observedPerformanceLabel === 'Higher observed performance', `Q1 with 80% average classified as "Higher observed performance" (Got: ${q1Data?.observedPerformanceLabel})`);

    // TEST CASE 5: AI vs Faculty Comparative Metrics
    console.log('\n--- Test 5: AI vs Faculty Comparative Metrics ---');
    const aiFaculty = await analyticsService.getAIVsFacultyAnalytics(exam._id.toString(), facultyUser._id.toString(), ROLES.FACULTY);
    assert(aiFaculty.averageAIMarks === 31, `Average AI marks is (28+34)/2 = 31 (Got: ${aiFaculty.averageAIMarks})`);
    assert(aiFaculty.averageFacultyMarks === 32.5, `Average Faculty final marks is 32.5 (Got: ${aiFaculty.averageFacultyMarks})`);
    assert(aiFaculty.averageDifference === 1.5, `Average difference is +1.5 (Got: ${aiFaculty.averageDifference})`);
    assert(aiFaculty.questionsAccepted === 7, `7 questions accepted by faculty (Got: ${aiFaculty.questionsAccepted})`);
    assert(aiFaculty.questionsOverridden === 1, `1 question overridden by faculty (Got: ${aiFaculty.questionsOverridden})`);
    assert(aiFaculty.markChanges.marksIncreased === 1, `1 mark increase recorded (Got: ${aiFaculty.markChanges.marksIncreased})`);

    // TEST CASE 6: Confidence Analytics & Override Distribution
    console.log('\n--- Test 6: AI Confidence Analytics ---');
    const confidenceData = await analyticsService.getConfidenceAnalytics(exam._id.toString(), facultyUser._id.toString(), ROLES.FACULTY);
    assert(confidenceData.totalEvaluatedQuestions === 8, `Total 8 evaluated question items (Got: ${confidenceData.totalEvaluatedQuestions})`);
    assert(confidenceData.highConfidenceCount === 6, `6 high confidence items (Got: ${confidenceData.highConfidenceCount})`);
    assert(confidenceData.moderateConfidenceCount === 1, `1 moderate confidence item (Got: ${confidenceData.moderateConfidenceCount})`);
    assert(confidenceData.lowConfidenceCount === 1, `1 low confidence item (Got: ${confidenceData.lowConfidenceCount})`);
    const lowBand = confidenceData.observedOverrideDistribution.find((b) => b.range.includes('Low'));
    assert(lowBand && lowBand.overrides === 1, `Low confidence band records 1 override (Got: ${lowBand?.overrides})`);

    // TEST CASE 7: Review Workload & Override Reasons Analysis
    console.log('\n--- Test 7: Review Workload & Override Reasons ---');
    const overrideData = await analyticsService.getOverrideAnalytics(exam._id.toString(), facultyUser._id.toString(), ROLES.FACULTY);
    assert(overrideData.reviewWorkload.totalEvaluations === 2, `Workload total evaluations is 2 (Got: ${overrideData.reviewWorkload.totalEvaluations})`);
    assert(overrideData.reviewWorkload.finalized === 2, `Workload finalized evaluations is 2 (Got: ${overrideData.reviewWorkload.finalized})`);
    assert(overrideData.reviewWorkload.overridden === 1, `Workload overridden evaluations is 1 (Got: ${overrideData.reviewWorkload.overridden})`);
    const ocrReason = overrideData.overrideReasons.find((r) => r.reason === 'OCR error');
    assert(ocrReason && ocrReason.count === 1, `Override reason "OCR error" count is 1 (Got: ${ocrReason?.count})`);
    assert(overrideData.reviewComments.length === 1, `Review comments feed contains 1 detailed comment (Got: ${overrideData.reviewComments.length})`);

    // TEST CASE 8: Consolidated Endpoint Integration
    console.log('\n--- Test 8: Consolidated Endpoint Integration ---');
    const consolidated = await analyticsService.getConsolidatedAnalytics(exam._id.toString(), facultyUser._id.toString(), ROLES.FACULTY);
    assert(consolidated.overview && consolidated.studentPerformance && consolidated.questionPerformance && consolidated.aiVsFaculty && consolidated.confidence && consolidated.overrides, 'Consolidated analytics compiles all 6 modules');

    // TEST CASE 9: Export Functionality (CSV, PDF/HTML, Excel XML)
    console.log('\n--- Test 9: Export Format Generators ---');
    const csvStr = await analyticsService.generateAnalyticsCSV(exam._id.toString(), facultyUser._id.toString(), ROLES.FACULTY);
    assert(csvStr.includes('EVALUATION ANALYTICS REPORT') && csvStr.includes('Big Data Analytics - CIE 2'), 'CSV export generates formatted summary');

    const htmlStr = await analyticsService.generateAnalyticsHTML(exam._id.toString(), facultyUser._id.toString(), ROLES.FACULTY);
    assert(htmlStr.includes('Evaluation Analytics & Performance Insights Report') && htmlStr.includes('Alice Smith'), 'Printable HTML/PDF export generates report');

    const excelXml = await analyticsService.generateAnalyticsExcel(exam._id.toString(), facultyUser._id.toString(), ROLES.FACULTY);
    assert(excelXml.includes('<Workbook') && excelXml.includes('Student Performance'), 'Excel export generates multi-sheet Workbook XML');

    // TEST CASE 10: Authorization Security Check
    console.log('\n--- Test 10: Authorization Boundary Security ---');
    let studentError = false;
    try {
      await analyticsService.getConsolidatedAnalytics(exam._id.toString(), studentUser._id.toString(), ROLES.STUDENT);
    } catch (err) {
      studentError = true;
      assert(err.statusCode === 403 || err.message.includes('Access denied'), `Student role access attempt rejected with Forbidden error (Message: "${err.message}")`);
    }
    assert(studentError, 'Student role unauthorized access attempt blocked successfully');

    // TEST CASE 11: Regression Check for Phase 3 & 4 Services
    console.log('\n--- Test 11: Phase 3 & Phase 4 Regression Verification ---');
    const phase4cResults = await resultsService.getResultsForExam(exam._id.toString());
    assert(phase4cResults.results.length === 2, `Phase 4C Results service remains fully functional (Results: ${phase4cResults.results.length})`);

    // Clean up test data
    console.log('\n--- Cleaning up test artifacts ---');
    await Evaluation.deleteMany({ examId: exam._id });
    await AnswerSheet.deleteMany({ exam: exam._id });
    await User.deleteMany({ _id: { $in: [facultyUser._id, studentUser._id, student1._id, student2._id] } });
    await Exam.deleteMany({ _id: exam._id });
    console.log('Cleanup completed successfully.');

  } catch (err) {
    console.error('Test suite failed with unexpected error:', err);
    failedCount++;
  } finally {
    await mongoose.disconnect();
    console.log('\n=================================================');
    console.log(`   TEST SUITE SUMMARY: ${passedCount} PASSED / ${failedCount} FAILED   `);
    console.log('=================================================\n');
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runPhase5ATestSuite();
