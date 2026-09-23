import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import resultsService from './src/services/results.service.js';
import AnswerSheet from './src/models/AnswerSheet.js';
import Evaluation from './src/models/Evaluation.js';
import Exam from './src/models/Exam.js';
import User from './src/models/User.js';
import Subject from './src/models/Subject.js';
import { ROLES } from './src/constants/roles.js';

async function runPhase4CTestSuite() {
  console.log('=================================================');
  console.log('       PHASE 4C AUTOMATED TEST SUITE RUNNER       ');
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
    const testExamCode = 'TEST4C_101';
    await Exam.deleteMany({ code: testExamCode });
    await User.deleteMany({ email: { $in: ['pass.student4c@test.com', 'fail.student4c@test.com'] } });

    // 1. Create a dummy Exam with passing rule (passing percentage 40% -> 12 marks out of 30)
    const dummySubjectId = new mongoose.Types.ObjectId();
    const exam = await Exam.create({
      title: 'Phase 4C Test Examination',
      code: testExamCode,
      examCode: testExamCode,
      subjectName: 'Software System Architecture',
      subjectCode: 'CS401',
      subject: dummySubjectId,
      examType: 'MID_TERM',
      examDate: new Date(),
      totalMarks: 30,
      duration: 60,
      status: 'PUBLISHED',
      passingPercentage: 40,
      passingMarks: 12,
      questions: [
        { questionNumber: 1, questionText: 'Define Microservices Architecture.', maximumMarks: 10, maxMarks: 10, keywords: ['microservices', 'decoupled'] },
        { questionNumber: 2, questionText: 'Explain REST API constraints.', maximumMarks: 10, maxMarks: 10, keywords: ['stateless', 'uniform'] },
        { questionNumber: 3, questionText: 'Compare SQL vs NoSQL.', maximumMarks: 10, maxMarks: 10, keywords: ['acid', 'relational', 'document'] }
      ]
    });

    // 2. Create Dummy Students
    const passStudent = await User.create({
      name: 'Pass Student',
      email: 'pass.student4c@test.com',
      password: 'password123',
      role: ROLES.STUDENT,
      rollNo: 'PASS001',
      studentId: 'PASS001'
    });

    const failStudent = await User.create({
      name: 'Fail Student',
      email: 'fail.student4c@test.com',
      password: 'password123',
      role: ROLES.STUDENT,
      rollNo: 'FAIL001',
      studentId: 'FAIL001'
    });

    // 3. Create Answer Sheets
    const passSheet = await AnswerSheet.create({
      exam: exam._id,
      examId: exam._id,
      subject: dummySubjectId,
      student: passStudent._id,
      studentId: passStudent._id,
      studentIdentifier: 'PASS001',
      uploadedFileName: 'pass_sheet.pdf',
      originalFileUrl: '/uploads/pass_sheet.pdf',
      filename: 'pass_sheet.pdf',
      status: 'evaluated',
      submissionDate: new Date(),
      resultPublication: {
        status: 'RESULT_PUBLISHED',
        publishedAt: new Date()
      }
    });

    const failSheet = await AnswerSheet.create({
      exam: exam._id,
      examId: exam._id,
      subject: dummySubjectId,
      student: failStudent._id,
      studentId: failStudent._id,
      studentIdentifier: 'FAIL001',
      uploadedFileName: 'fail_sheet.pdf',
      originalFileUrl: '/uploads/fail_sheet.pdf',
      filename: 'fail_sheet.pdf',
      status: 'evaluated',
      submissionDate: new Date(),
      resultPublication: {
        status: 'RESULT_UNPUBLISHED',
        publishedAt: null
      }
    });

    // 4. Create Finalized Evaluations
    const q1Id = exam.questions[0]._id;
    const q2Id = exam.questions[1]._id;
    const q3Id = exam.questions[2]._id;

    // Pass Student: AI gave 10 (8+2+0), Faculty Overrode Q2 to 6, Total = 8+6+0 = 14 (14/30 = 46.67% >= 40% -> PASS)
    const passEval = await Evaluation.create({
      answerSheet: passSheet._id,
      answerSheetId: passSheet._id,
      examId: exam._id,
      studentId: passStudent._id,
      evaluationType: 'Faculty',
      status: 'finalized',
      evaluationStatus: 'finalized',
      questions: [
        {
          questionId: q1Id,
          questionNumber: '1',
          maximumMarks: 10,
          recognizedText: 'Microservices are loosely coupled services.',
          aiAwardedMarks: 8,
          finalAwardedMarks: 8,
          wasOverridden: false,
          feedback: 'Good explanation.',
          matchedKeywords: ['microservices']
        },
        {
          questionId: q2Id,
          questionNumber: '2',
          maximumMarks: 10,
          recognizedText: 'REST is stateless and client-server.',
          aiAwardedMarks: 2,
          finalAwardedMarks: 6,
          wasOverridden: true,
          overrideReason: 'PARTIAL_CREDIT',
          facultyComment: 'Student explained core concepts adequately.',
          feedback: 'Incomplete.',
          matchedKeywords: ['stateless']
        },
        {
          questionId: q3Id,
          questionNumber: '3',
          maximumMarks: 10,
          recognizedText: 'SQL is relational.',
          aiAwardedMarks: 0,
          finalAwardedMarks: 0,
          wasOverridden: false,
          feedback: 'Lacks depth.',
          matchedKeywords: []
        }
      ],
      totalMarks: 30,
      obtainedMarks: 14,
      percentage: 46.67
    });

    // Fail Student: AI gave 6, Faculty confirmed 6 (6/30 = 20% < 40% -> FAIL)
    const failEval = await Evaluation.create({
      answerSheet: failSheet._id,
      answerSheetId: failSheet._id,
      examId: exam._id,
      studentId: failStudent._id,
      evaluationType: 'Faculty',
      status: 'finalized',
      evaluationStatus: 'finalized',
      questions: [
        {
          questionId: q1Id,
          questionNumber: '1',
          maximumMarks: 10,
          recognizedText: 'Microservices.',
          aiAwardedMarks: 2,
          finalAwardedMarks: 2,
          wasOverridden: false,
          feedback: 'Too brief.',
          matchedKeywords: []
        },
        {
          questionId: q2Id,
          questionNumber: '2',
          maximumMarks: 10,
          recognizedText: 'REST.',
          aiAwardedMarks: 2,
          finalAwardedMarks: 2,
          wasOverridden: false,
          feedback: 'Too brief.',
          matchedKeywords: []
        },
        {
          questionId: q3Id,
          questionNumber: '3',
          maximumMarks: 10,
          recognizedText: 'NoSQL.',
          aiAwardedMarks: 2,
          finalAwardedMarks: 2,
          wasOverridden: false,
          feedback: 'Too brief.',
          matchedKeywords: []
        }
      ],
      totalMarks: 30,
      obtainedMarks: 6,
      percentage: 20
    });

    // TEST CASE 1: Pass/Fail Rule Accuracy
    console.log('\n--- Test 1: Pass/Fail Rule Accuracy ---');
    const examResults = await resultsService.getResultsForExam(exam._id.toString());
    const passCandidate = examResults.results.find(r => r.studentIdentifier === 'PASS001');
    const failCandidate = examResults.results.find(r => r.studentIdentifier === 'FAIL001');
    assert(passCandidate && passCandidate.resultStatus === 'PASS', `Student with 46.67% is classified as PASS (Passing Rule: 40%). Got: ${passCandidate?.resultStatus}`);
    assert(failCandidate && failCandidate.resultStatus === 'FAIL', `Student with 20% is classified as FAIL (Passing Rule: 40%). Got: ${failCandidate?.resultStatus}`);

    // TEST CASE 2: AI vs. Faculty Total Comparison
    console.log('\n--- Test 2: AI vs. Faculty Total Comparison ---');
    assert(passCandidate.aiTotalMarks === 10, `Pass candidate AI Total is 10 (Got: ${passCandidate?.aiTotalMarks})`);
    assert(passCandidate.finalTotalMarks === 14, `Pass candidate Final Total is 14 (Got: ${passCandidate?.finalTotalMarks})`);
    const passDiff = (passCandidate.finalTotalMarks || 0) - (passCandidate.aiTotalMarks || 0);
    assert(passDiff === 4, `Pass candidate Difference is +4 (Got: ${passDiff})`);

    // TEST CASE 3: Faculty Override Summary
    console.log('\n--- Test 3: Faculty Override Summary ---');
    const passDetail = await resultsService.getIndividualResult(passEval._id.toString());
    const passOverrides = passDetail.questions.filter(q => q.wasOverridden).length;
    const failDetail = await resultsService.getIndividualResult(failEval._id.toString());
    const failOverrides = failDetail.questions.filter(q => q.wasOverridden).length;
    assert(passOverrides === 1, `Pass candidate override count is 1 (Got: ${passOverrides})`);
    assert(failOverrides === 0, `Fail candidate override count is 0 (Got: ${failOverrides})`);

    // TEST CASE 4: Question-Wise Performance Aggregate Analytics
    console.log('\n--- Test 4: Question-Wise Performance Analytics ---');
    const analytics = await resultsService.getExamAnalytics(exam._id.toString());
    assert(analytics.finalizedResults === 2, `Total finalized exams count is 2 (Got: ${analytics.finalizedResults})`);
    assert(analytics.passCount === 1, `Passed count is 1 (Got: ${analytics.passCount})`);
    assert(analytics.failCount === 1, `Failed count is 1 (Got: ${analytics.failCount})`);
    assert(analytics.passPercentage === 50, `Pass percentage is 50% (Got: ${analytics.passPercentage})`);
    assert(analytics.aiFacultyComparison.aiOverriddenCount === 1, `Exam-wide total overrides count is 1 (Got: ${analytics.aiFacultyComparison?.aiOverriddenCount})`);

    const q2Analytics = analytics.questionAnalytics.find(q => q.questionNumber === 2 || q.questionNumber === '2');
    assert(q2Analytics && q2Analytics.overriddenCount === 1, `Q2 analytics records 1 faculty override (Got: ${q2Analytics?.overriddenCount})`);
    assert(q2Analytics && q2Analytics.averageMarks === 4, `Q2 average final marks is (6+2)/2 = 4 (Got: ${q2Analytics?.averageMarks})`);

    // TEST CASE 5: Student Access Restriction (Unpublished)
    console.log('\n--- Test 5: Student Access Restriction (Unpublished Result) ---');
    let errorThrown = false;
    try {
      await resultsService.getIndividualResult(failEval._id.toString(), failStudent._id.toString(), ROLES.STUDENT);
    } catch (err) {
      errorThrown = true;
      assert(err.message.includes('not been published'), `Unpublished result throws restriction error: "${err.message}"`);
    }
    assert(errorThrown, 'Unpublished result access by student correctly rejected');

    // TEST CASE 6: Student Access Authorization (Published Result)
    console.log('\n--- Test 6: Student Access Authorization (Published Result) ---');
    const publishedResult = await resultsService.getIndividualResult(passEval._id.toString(), passStudent._id.toString(), ROLES.STUDENT);
    assert(publishedResult && publishedResult.obtainedMarks === 14, `Student can access their published result (Marks: ${publishedResult?.obtainedMarks}/30)`);
    assert(publishedResult.publicationStatus === 'RESULT_PUBLISHED', 'Result publication status is RESULT_PUBLISHED');

    // TEST CASE 7: Cross-Student Data Isolation
    console.log('\n--- Test 7: Cross-Student Data Isolation Security ---');
    let isolationError = false;
    try {
      await resultsService.getIndividualResult(passEval._id.toString(), failStudent._id.toString(), ROLES.STUDENT);
    } catch (err) {
      isolationError = true;
      assert(err.message.includes('Access denied'), `Cross-student access throws Forbidden error: "${err.message}"`);
    }
    assert(isolationError, 'Cross-student access attempt blocked successfully');

    // TEST CASE 8: Dynamic CSV Export Columns
    console.log('\n--- Test 8: Dynamic CSV Export Columns ---');
    const csvContent = await resultsService.exportExamResultsCSV(exam._id.toString());
    assert(csvContent.includes('Q1 AI') && csvContent.includes('Q1 Final'), 'CSV header includes Q1 dynamic comparison columns');
    assert(csvContent.includes('Q2 AI') && csvContent.includes('Q2 Final'), 'CSV header includes Q2 dynamic comparison columns');
    assert(csvContent.includes('PASS001'), 'CSV includes Pass Student row');
    assert(csvContent.includes('FAIL001'), 'CSV includes Fail Student row');

    // TEST CASE 9: HTML Exam Summary Academic Report Generation
    console.log('\n--- Test 9: HTML Exam Summary Report Generation ---');
    const summaryHtml = resultsService.generateExamSummaryHTML(exam, analytics, examResults.results);
    assert(summaryHtml.includes('Class-Level Academic Result & Evaluation Summary'), 'HTML summary contains official document header');
    assert(summaryHtml.includes('Phase 4C Test Examination'), 'HTML summary contains exam title');
    assert(summaryHtml.includes('PASS001') && summaryHtml.includes('FAIL001'), 'HTML summary contains candidate result rows');
    assert(summaryHtml.includes('50%'), 'HTML summary contains pass rate');

    // TEST CASE 10: HTML Individual Candidate Report & Audit Justifications
    console.log('\n--- Test 10: HTML Individual Candidate Report & Audit Justification ---');
    const individualHtml = resultsService.generateIndividualReportHTML(passDetail);
    assert(individualHtml.includes('Official Student Examination Result'), 'HTML individual report contains official header');
    assert(individualHtml.includes('PASS001'), 'HTML individual report contains student identifier');
    assert(individualHtml.includes('Faculty Override Justification'), 'HTML report renders Faculty Override Justification section');
    assert(individualHtml.includes('Student explained core concepts adequately.'), 'HTML report renders faculty override comment');

    // Clean up test data
    console.log('\n--- Cleaning up test artifacts ---');
    await Evaluation.deleteMany({ examId: exam._id });
    await AnswerSheet.deleteMany({ examId: exam._id });
    await User.deleteMany({ _id: { $in: [passStudent._id, failStudent._id] } });
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

runPhase4CTestSuite();
