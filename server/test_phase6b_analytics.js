import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import analyticsService from './src/services/analytics.service.js';
import AnswerSheet from './src/models/AnswerSheet.js';
import Evaluation from './src/models/Evaluation.js';
import Exam from './src/models/Exam.js';
import Subject from './src/models/Subject.js';
import User from './src/models/User.js';
import { ROLES } from './src/constants/roles.js';

async function runPhase6BTestSuite() {
  console.log('=================================================');
  console.log('       PHASE 6B AUTOMATED TEST SUITE RUNNER       ');
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

    // Cleanup previous test artifacts
    const testExamCode1 = 'TEST6B_101';
    const testExamCode2 = 'TEST6B_102';
    await Exam.deleteMany({ code: { $in: [testExamCode1, testExamCode2] } });
    await User.deleteMany({
      email: {
        $in: [
          'faculty6b@test.com',
          'faculty6b_other@test.com',
          'student6b_1@test.com',
          'student6b_2@test.com',
          'admin6b@test.com'
        ]
      }
    });

    // 1. Create Users
    const facultyUser = await User.create({
      name: 'Dr. Faculty 6B',
      email: 'faculty6b@test.com',
      password: 'password123',
      role: ROLES.FACULTY,
    });

    const otherFacultyUser = await User.create({
      name: 'Dr. Other Faculty 6B',
      email: 'faculty6b_other@test.com',
      password: 'password123',
      role: ROLES.FACULTY,
    });

    const studentUser1 = await User.create({
      name: 'Alice Student 6B',
      email: 'student6b_1@test.com',
      password: 'password123',
      role: ROLES.STUDENT,
    });

    const studentUser2 = await User.create({
      name: 'Bob Student 6B',
      email: 'student6b_2@test.com',
      password: 'password123',
      role: ROLES.STUDENT,
    });

    const adminUser = await User.create({
      name: 'Admin 6B',
      email: 'admin6b@test.com',
      password: 'password123',
      role: ROLES.ADMIN,
    });

    // 2. Create Exams
    const dummySubjectId = new mongoose.Types.ObjectId();
    const exam1 = await Exam.create({
      title: 'DSA Midterm Exam 6B',
      code: testExamCode1,
      examCode: testExamCode1,
      subjectName: 'Data Structures & Algorithms',
      subjectCode: 'CS601',
      subject: dummySubjectId,
      examType: 'MIDTERM',
      examDate: new Date(),
      duration: 90,
      status: 'PUBLISHED',
      createdBy: facultyUser._id,
      totalMarks: 50,
      passingMarks: 20,
      questions: [
        { questionNumber: '1', questionText: 'Explain Binary Search Trees', maxMarks: 25 },
        { questionNumber: '2', questionText: 'Describe Heap Sort Algorithm', maxMarks: 25 },
      ],
      isPublished: true,
      publishedAt: new Date(),
    });

    const exam2 = await Exam.create({
      title: 'DSA Final Exam 6B',
      code: testExamCode2,
      examCode: testExamCode2,
      subjectName: 'Data Structures & Algorithms',
      subjectCode: 'CS601',
      subject: dummySubjectId,
      examType: 'END_SEM',
      examDate: new Date(),
      duration: 180,
      status: 'PUBLISHED',
      createdBy: facultyUser._id,
      totalMarks: 100,
      passingMarks: 40,
      questions: [
        { questionNumber: '1', questionText: 'Graph Traversal Algorithms BFS/DFS', maxMarks: 50 },
        { questionNumber: '2', questionText: 'Dynamic Programming Knapsack Problem', maxMarks: 50 },
      ],
      isPublished: true,
      publishedAt: new Date(),
    });

    // 3. Create Answer Sheets & Evaluations for Exam 1
    // Student 1: 45 / 50 (90%) - Published
    const sheet1 = await AnswerSheet.create({
      exam: exam1._id,
      examId: exam1._id,
      subject: dummySubjectId,
      subjectId: dummySubjectId,
      student: studentUser1._id,
      studentId: studentUser1._id,
      studentIdentifier: 'STU6B-001',
      studentName: 'Alice Student 6B',
      uploadedFileName: 'alice_sheet.pdf',
      status: 'evaluated',
      submissionDate: new Date(),
      processedAt: new Date(),
    });

    const eval1 = await Evaluation.create({
      answerSheet: sheet1._id,
      answerSheetId: sheet1._id,
      examId: exam1._id,
      studentId: studentUser1._id,
      evaluationType: 'Faculty',
      status: 'PUBLISHED',
      evaluationStatus: 'finalized',
      isFinalized: true,
      obtainedMarks: 45,
      totalMarks: 50,
      percentage: 90,
      publishedAt: new Date(),
      questions: [
        {
          questionId: exam1.questions[0]._id.toString(),
          questionNumber: '1',
          aiMarks: 22,
          finalMarks: 23,
          maximumMarks: 25,
          maxMarks: 25,
          isOverridden: true,
          overrideReason: 'Better explanation',
          overrideComment: 'Excellent depth',
          confidence: 90,
          matchedConcepts: ['BST Search', 'Insertion'],
          missingConcepts: [],
        },
        {
          questionId: exam1.questions[1]._id.toString(),
          questionNumber: '2',
          aiMarks: 22,
          finalMarks: 22,
          maximumMarks: 25,
          maxMarks: 25,
          isOverridden: false,
          confidence: 95,
          matchedConcepts: ['Heapify'],
          missingConcepts: [],
        },
      ],
      totalAIMarks: 44,
      totalFinalMarks: 45,
      maximumMarks: 50,
      grade: 'A',
      resultStatus: 'PASS',
    });

    // Student 2: 15 / 50 (30%) - Published
    const sheet2 = await AnswerSheet.create({
      exam: exam1._id,
      examId: exam1._id,
      subject: dummySubjectId,
      subjectId: dummySubjectId,
      student: studentUser2._id,
      studentId: studentUser2._id,
      studentIdentifier: 'STU6B-002',
      studentName: 'Bob Student 6B',
      uploadedFileName: 'bob_sheet.pdf',
      status: 'evaluated',
      submissionDate: new Date(),
      processedAt: new Date(),
    });

    const eval2 = await Evaluation.create({
      answerSheet: sheet2._id,
      answerSheetId: sheet2._id,
      examId: exam1._id,
      studentId: studentUser2._id,
      evaluationType: 'Faculty',
      status: 'PUBLISHED',
      evaluationStatus: 'finalized',
      isFinalized: true,
      obtainedMarks: 15,
      totalMarks: 50,
      percentage: 30,
      publishedAt: new Date(),
      questions: [
        {
          questionId: exam1.questions[0]._id.toString(),
          questionNumber: '1',
          aiMarks: 13,
          finalMarks: 13,
          maximumMarks: 25,
          maxMarks: 25,
          isOverridden: false,
          confidence: 80,
          matchedConcepts: ['BST Definition'],
          missingConcepts: ['Deletion', 'Rotation'],
        },
        {
          questionId: exam1.questions[1]._id.toString(),
          questionNumber: '2',
          aiMarks: 2,
          finalMarks: 2,
          maximumMarks: 25,
          maxMarks: 25,
          isOverridden: false,
          confidence: 85,
          matchedConcepts: [],
          missingConcepts: ['Max Heap', 'Min Heap'],
        },
      ],
      totalAIMarks: 15,
      totalFinalMarks: 15,
      maximumMarks: 50,
      grade: 'F',
      resultStatus: 'FAIL',
    });

    // Student 1: Exam 2 evaluation (85%) - Published
    const sheet3 = await AnswerSheet.create({
      exam: exam2._id,
      examId: exam2._id,
      subject: dummySubjectId,
      subjectId: dummySubjectId,
      student: studentUser1._id,
      studentId: studentUser1._id,
      studentIdentifier: 'STU6B-001',
      studentName: 'Alice Student 6B',
      uploadedFileName: 'alice_sheet_exam2.pdf',
      status: 'evaluated',
      submissionDate: new Date(),
      processedAt: new Date(),
    });

    const eval3 = await Evaluation.create({
      answerSheet: sheet3._id,
      answerSheetId: sheet3._id,
      examId: exam2._id,
      studentId: studentUser1._id,
      evaluationType: 'Faculty',
      status: 'PUBLISHED',
      evaluationStatus: 'finalized',
      isFinalized: true,
      obtainedMarks: 85,
      totalMarks: 100,
      percentage: 85,
      publishedAt: new Date(),
      questions: [
        {
          questionId: exam2.questions[0]._id.toString(),
          questionNumber: '1',
          aiMarks: 40,
          finalMarks: 42,
          maximumMarks: 50,
          maxMarks: 50,
          isOverridden: true,
          confidence: 88,
          matchedConcepts: ['BFS Queue', 'DFS Stack'],
          missingConcepts: [],
        },
        {
          questionId: exam2.questions[1]._id.toString(),
          questionNumber: '2',
          aiMarks: 43,
          finalMarks: 43,
          maximumMarks: 50,
          maxMarks: 50,
          isOverridden: false,
          confidence: 92,
          matchedConcepts: ['Memoization'],
          missingConcepts: [],
        },
      ],
      totalAIMarks: 83,
      totalFinalMarks: 85,
      maximumMarks: 100,
      percentage: 85,
      grade: 'A',
      resultStatus: 'PASS',
    });

    console.log('--- TEST CASE 1: Exam Distribution Analytics (Faculty) ---');
    const distAnalytics = await analyticsService.getExamDistributionAnalytics(
      exam1._id.toString(),
      facultyUser._id,
      ROLES.FACULTY
    );
    assert(distAnalytics.examId === exam1._id.toString(), 'Exam distribution returns correct examId');
    assert(distAnalytics.passFailAnalytics.passCount === 1, 'Pass count is 1 for Exam 1');
    assert(distAnalytics.passFailAnalytics.failCount === 1, 'Fail count is 1 for Exam 1');
    assert(distAnalytics.passFailAnalytics.passPercentage === 50, 'Pass percentage is 50%');
    assert(distAnalytics.distribution['81-100%'] === 1, '81-100% band contains 1 student (Alice)');
    assert(distAnalytics.distribution['21-40%'] === 1, '21-40% band contains 1 student (Bob)');

    console.log('\n--- TEST CASE 2: Question Performance & Lower Performing Questions ---');
    const questionAnalytics = await analyticsService.getQuestionPerformanceAnalytics(
      exam1._id.toString(),
      facultyUser._id,
      ROLES.FACULTY
    );
    assert(questionAnalytics.questions.length === 2, 'Question analytics returns 2 questions');
    assert(
      questionAnalytics.lowerPerformingQuestions.length === 1 &&
        questionAnalytics.lowerPerformingQuestions[0].questionNumber.toString() === '2',
      'Lower-performing question (Q2 avg 29%) correctly identified'
    );

    console.log('\n--- TEST CASE 3: Student Personal Analytics (Student Me) ---');
    const student1Stats = await analyticsService.getStudentMeAnalytics(studentUser1._id);
    assert(student1Stats.hasResults === true, 'Student 1 has published results');
    assert(student1Stats.totalExams === 2, 'Student 1 has 2 published exams');
    assert(student1Stats.highestPercentage === 90, 'Student 1 highest score is 90%');
    assert(student1Stats.lowestPercentage === 85, 'Student 1 lowest score is 85%');
    assert(student1Stats.averagePercentage === 87.5, 'Student 1 average score is 87.5%');

    console.log('\n--- TEST CASE 4: Student Trend Analytics (Student Me Trends) ---');
    const student1Trends = await analyticsService.getStudentMeTrends(studentUser1._id);
    assert(student1Trends.length === 2, 'Student 1 trend returns 2 published evaluations');
    assert(student1Trends[0].percentage === 90, 'First exam trend entry is 90%');
    assert(student1Trends[1].percentage === 85, 'Second exam trend entry is 85%');

    console.log('\n--- TEST CASE 5: Student Exam Details Breakdown ---');
    const student1Exam1Details = await analyticsService.getStudentMeExamDetails(
      studentUser1._id,
      exam1._id.toString()
    );
    assert(student1Exam1Details.examId === exam1._id.toString(), 'Returns details for Exam 1');
    assert(student1Exam1Details.obtainedMarks === 45, 'Obtained marks is 45');
    assert(student1Exam1Details.questions.length === 2, 'Returns breakdown for 2 questions');
    assert(
      student1Exam1Details.questions[0].matchedConcepts.includes('BST Search'),
      'Q1 includes matched concept BST Search'
    );

    console.log('\n--- TEST CASE 6: Admin Overview Analytics ---');
    const adminOverview = await analyticsService.getAdminOverviewAnalytics();
    assert(adminOverview.totalExams >= 2, 'Admin overview reports at least 2 total exams');
    assert(adminOverview.totalEvaluations >= 3, 'Admin overview reports at least 3 total evaluations');
    assert(adminOverview.publishedResults >= 3, 'Admin overview reports at least 3 published results');

    console.log('\n--- TEST CASE 7: Admin Exam Comparison Analytics ---');
    const adminExams = await analyticsService.getAdminExamsAnalytics();
    assert(Array.isArray(adminExams), 'Admin exams analytics returns an array');
    const testExam1Admin = adminExams.find((e) => e.examId === exam1._id.toString());
    assert(testExam1Admin !== undefined, 'Admin exams list includes Exam 1');
    assert(testExam1Admin.totalEvaluated === 2, 'Exam 1 evaluated count is 2');
    assert(testExam1Admin.averagePercentage === 60, 'Exam 1 average percentage is 60% ((90+30)/2)');
    assert(testExam1Admin.passCount === 1, 'Exam 1 pass count is 1');
    assert(testExam1Admin.passRate === 50, 'Exam 1 pass rate is 50%');

    console.log('\n--- TEST CASE 8: Security & Role Authorization Check ---');
    try {
      await analyticsService.getExamDistributionAnalytics(
        exam1._id.toString(),
        otherFacultyUser._id,
        ROLES.FACULTY
      );
      assert(false, 'Unauthorized faculty should be blocked from viewing unassigned exam analytics');
    } catch (err) {
      assert(
        err.message.toLowerCase().includes('denied') ||
        err.message.toLowerCase().includes('permission') ||
        err.message.toLowerCase().includes('forbidden') ||
        err.message.toLowerCase().includes('authorized'),
        'Unauthorized faculty correctly denied access'
      );
    }

    console.log('\n=================================================');
    console.log(`Phase 6B Test Suite Execution Complete!`);
    console.log(`Total Passed: ${passedCount}`);
    console.log(`Total Failed: ${failedCount}`);
    console.log('=================================================\n');

    // Cleanup test records
    await Exam.deleteMany({ code: { $in: [testExamCode1, testExamCode2] } });
    await User.deleteMany({
      email: {
        $in: [
          'faculty6b@test.com',
          'faculty6b_other@test.com',
          'student6b_1@test.com',
          'student6b_2@test.com',
          'admin6b@test.com'
        ]
      }
    });
    await AnswerSheet.deleteMany({ _id: { $in: [sheet1._id, sheet2._id, sheet3._id] } });
    await Evaluation.deleteMany({ _id: { $in: [eval1._id, eval2._id, eval3._id] } });

    await mongoose.disconnect();

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('Test Suite Exception:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runPhase6BTestSuite();
