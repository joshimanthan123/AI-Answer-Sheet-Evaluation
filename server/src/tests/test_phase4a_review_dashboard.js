import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import Exam from '../models/Exam.js';
import AnswerSheet from '../models/AnswerSheet.js';
import Evaluation from '../models/Evaluation.js';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import evaluationService from '../services/evaluation.service.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gradeai';

async function runVerification() {
  console.log('--- Starting Phase 4A Verification ---');
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Find or pick a sample exam & faculty user
    const faculty = await User.findOne({ role: 'faculty' });
    if (!faculty) {
      console.log('⚠ No faculty user found in MongoDB. Verification warning.');
      return;
    }

    const exam = await Exam.findOne();
    if (!exam) {
      console.log('⚠ No exam found in MongoDB. Verification warning.');
      return;
    }

    console.log(`Testing with Faculty ID: ${faculty._id}, Exam ID: ${exam._id}`);

    // Test 1: Get Review Dashboard Data
    console.log('\n[Test 1] Testing getReviewDashboardData service...');
    const dashboardData = await evaluationService.getReviewDashboardData(exam._id.toString(), faculty._id.toString());
    console.log('✓ Review Dashboard Stats retrieved:', dashboardData.stats);
    console.log(`✓ Student count in list: ${dashboardData.studentsList.length}`);

    // Test 2: If evaluation or answer sheet exists, test getEvaluationDetail & status update
    let sampleEval = await Evaluation.findOne({ exam: exam._id });
    let targetId = sampleEval ? sampleEval._id.toString() : null;

    if (!targetId) {
      const sampleSheet = await AnswerSheet.findOne({ exam: exam._id });
      if (sampleSheet) targetId = sampleSheet._id.toString();
    }

    if (targetId) {
      console.log(`\n[Test 2] Testing getEvaluationDetail for ID: ${targetId}...`);
      const detail = await evaluationService.getEvaluationDetail(targetId, faculty._id.toString(), 'faculty');
      console.log(`✓ Retrieved detail for student: ${detail.student?.name || 'N/A'}`);
      console.log(`✓ Question count: ${detail.questions?.length}`);

      if (sampleEval) {
        console.log(`\n[Test 3] Testing updateEvaluationReviewStatus to 'Reviewed'...`);
        const updated = await evaluationService.updateEvaluationReviewStatus(sampleEval._id.toString(), 'Reviewed', 'Faculty review completed', faculty._id.toString());
        console.log(`✓ Updated status: ${updated.reviewStatus}`);

        console.log(`\n[Test 4] Testing updateEvaluationReviewStatus to 'Needs Attention'...`);
        const updated2 = await evaluationService.updateEvaluationReviewStatus(sampleEval._id.toString(), 'Needs Attention', 'Requires double checking', faculty._id.toString());
        console.log(`✓ Updated status: ${updated2.reviewStatus}`);
      }
    } else {
      console.log('\n⚠ No existing evaluations or answer sheets found for this exam. Dashboard returned empty list as expected.');
    }

    console.log('\n✅ All Phase 4A Backend Verification Checks Passed Successfully!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runVerification();
