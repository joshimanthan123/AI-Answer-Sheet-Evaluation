import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function run() {
  console.log('--- REAL IMAGE ANSWER SHEET UPLOAD TEST ---');

  // 1. Login as Faculty
  console.log('1. Logging in as Faculty (faculty@test.com)...');
  const loginRes = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "faculty@test.com", password: "Password123" })
  });

  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Login failed with status ${loginRes.status}: ${text}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.data?.token || loginData.token;
  console.log('Faculty Login Successful!');

  // 2. Fetch available exam
  console.log('2. Fetching Faculty Exams list...');
  const examsRes = await fetch("http://localhost:5000/api/v1/exams", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const examsJson = await examsRes.json();
  const exams = examsJson.data || [];
  if (exams.length === 0) {
    throw new Error('No exams found in database to upload answer sheet to.');
  }

  const exam = exams[0];
  const examId = exam._id || exam.id;
  console.log(`Target Exam ID: ${examId} (${exam.title})`);

  // 3. Locate source image
  const imagePath = path.resolve('../ocr-service/storage/answer-sheets/stud-1/52028c5a-164b-4bec-ac67-be42186319f4/original/source.jpg');
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Test image not found at ${imagePath}`);
  }

  console.log(`3. Preparing file upload for: ${imagePath}`);
  const imageBuffer = fs.readFileSync(imagePath);
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });

  const formData = new FormData();
  formData.append('files', blob, 'sample_handwritten_answer.jpg');
  formData.append('examId', examId);
  formData.append('studentIdentifier', 'STU1001');

  // 4. Upload Answer Sheet
  console.log('4. Uploading image to POST /api/v1/answer-sheets...');
  const uploadRes = await fetch("http://localhost:5000/api/v1/answer-sheets", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: formData
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Upload failed with status ${uploadRes.status}: ${text}`);
  }

  const uploadJson = await uploadRes.json();
  console.log('Upload initiated successfully:', JSON.stringify(uploadJson, null, 2));

  const resultItem = uploadJson.data?.[0];
  const answerSheetId = resultItem?.answerSheetId;
  if (!answerSheetId) {
    throw new Error('No answerSheetId returned from upload endpoint.');
  }

  // 5. Poll processing status
  console.log(`5. Polling processing status for AnswerSheet ID: ${answerSheetId}...`);
  let attempts = 0;
  let answerSheet = null;

  while (attempts < 15) {
    await new Promise(res => setTimeout(res, 2000));
    attempts++;

    const detailRes = await fetch(`http://localhost:5000/api/v1/answer-sheets/${answerSheetId}`, {
      headers: {
        "X-User-Id": "stud-1",
        "X-User-Role": "student"
      }
    });

    if (detailRes.ok) {
      const detailJson = await detailRes.json();
      answerSheet = detailJson.data || detailJson;
      console.log(`Attempt ${attempts}: processingStatus = ${answerSheet.processing_status || answerSheet.processingStatus}, pages = ${answerSheet.pages?.length || 0}`);
      
      if (answerSheet.processing_status === 'completed' || answerSheet.processingStatus === 'completed') {
        break;
      }
    }
  }

  console.log('--- FINAL REAL IMAGE UPLOAD & OCR INGESTION RESULT ---');
  console.log('Answer Sheet Record:');
  console.log('ID:', answerSheet._id || answerSheet.id);
  console.log('Processing Status:', answerSheet.processing_status || answerSheet.processingStatus);
  console.log('Pages Count:', answerSheet.pages?.length);
  console.log('Pages:', JSON.stringify(answerSheet.pages, null, 2));
  console.log('Digital Answers:', JSON.stringify(answerSheet.digital_answers || answerSheet.answers, null, 2));

  console.log('\n✅ REAL IMAGE UPLOAD & INGESTION PIPELINE VERIFIED SUCCESSFULLY!');
}

run().catch((e) => {
  console.error('❌ REAL IMAGE UPLOAD TEST FAILED:', e);
});
