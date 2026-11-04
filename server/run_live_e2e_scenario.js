import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:5000/api';

function generateStrokesForText(text) {
  const strokes = [];
  let cursorX = 50.0;
  let cursorY = 100.0;

  const addStroke = (pts, width = 5, color = "#000000") => {
    strokes.push({
      points: pts.map(p => ({ x: p[0], y: p[1] })),
      width,
      color
    });
  };

  for (const char of text.toUpperCase()) {
    const cx = cursorX;
    const cy = cursorY;
    if (char === 'H') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy + 50], [cx + 40, cy + 50]]);
      addStroke([[cx + 40, cy], [cx + 40, cy + 100]]);
      cursorX += 60;
    } else if (char === 'E') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy], [cx + 40, cy]]);
      addStroke([[cx, cy + 50], [cx + 30, cy + 50]]);
      addStroke([[cx, cy + 100], [cx + 40, cy + 100]]);
      cursorX += 55;
    } else if (char === 'L') {
      addStroke([[cx, cy], [cx, cy + 100]]);
      addStroke([[cx, cy + 100], [cx + 40, cy + 100]]);
      cursorX += 55;
    } else if (char === 'O') {
      const oPts = [];
      for (let angle = 0; angle <= 360; angle += 20) {
        const rad = (angle * Math.PI) / 180;
        oPts.push([cx + 20 + 20 * Math.cos(rad), cy + 50 + 45 * Math.sin(rad)]);
      }
      addStroke(oPts);
      cursorX += 60;
    } else if (char === 'W') {
      addStroke([[cx, cy], [cx + 15, cy + 100]]);
      addStroke([[cx + 15, cy + 100], [cx + 30, cy + 40]]);
      addStroke([[cx + 30, cy + 40], [cx + 45, cy + 100]]);
      addStroke([[cx + 45, cy + 100], [cx + 60, cy]]);
      cursorX += 75;
    } else {
      addStroke([[cx, cy], [cx + 30, cy], [cx + 30, cy + 100], [cx, cy + 100], [cx, cy]]);
      cursorX += 45;
    }
  }
  return strokes;
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function main() {
  const results = {};
  console.log("=================================================");
  console.log("   LIVE E2E COMPREHENSIVE FUNCTIONAL SUITE    ");
  console.log("=================================================\n");

  // 1. AUTHENTICATION
  console.log("1. Authenticating Faculty & Student...");
  const facLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e2e.faculty@test.com', password: 'Password@123' })
  });
  const facData = await facLoginRes.json();
  const facToken = facData.data?.token || facData.token;
  results.facultyLogin = facLoginRes.ok ? 'PASS' : 'FAIL';

  const stuLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e2e.student@test.com', password: 'Password@123' })
  });
  const stuData = await stuLoginRes.json();
  const stuToken = stuData.data?.token || stuData.token;
  results.studentLogin = stuLoginRes.ok ? 'PASS' : 'FAIL';

  console.log(`Faculty Login: ${results.facultyLogin}, Student Login: ${results.studentLogin}`);

  // Fetch subject
  const subRes = await fetch(`${BASE_URL}/subjects`, {
    headers: { Authorization: `Bearer ${facToken}` }
  });
  const subData = await subRes.json();
  const subjectList = subData.data?.subjects || subData.data || [];
  const subjectId = subjectList[0]?._id;

  if (!subjectId) {
    throw new Error("No Subject found for testing!");
  }

  // 2. EXAM CREATION
  console.log("\n2. Creating Exam via Faculty API...");
  const createExamRes = await fetch(`${BASE_URL}/exams`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${facToken}`
    },
    body: JSON.stringify({
      title: `LIVE E2E TEST — Answer Evaluation ${Date.now()}`,
      description: 'Live E2E test exam for answer evaluation',
      subject: subjectId,
      examType: 'Midterm',
      examDate: new Date().toISOString(),
      duration: 60,
      totalMarks: 10,
      examStatus: 'Active',
      questions: [
        {
          questionNumber: 1,
          questionText: 'Explain the basic concept of operating systems.',
          maximumMarks: 10,
          required: true,
          modelAnswer: 'An operating system is system software that manages computer hardware and software resources and provides services for application programs. It manages processes, memory, files, storage, and input/output devices.'
        }
      ]
    })
  });

  const examData = await createExamRes.json();
  const exam = examData.data?.exam || examData.data;
  const examId = exam._id;
  const questionId = exam.questions[0]._id;

  results.examCreation = createExamRes.ok ? 'PASS' : 'FAIL';
  console.log(`Exam Creation: ${results.examCreation} (ID: ${examId})`);

  // 3. CREATE & APPROVE ANSWER KEY / RUBRIC
  console.log("\n3. Creating & Approving Answer Key / Rubric...");
  const createKeyRes = await fetch(`${BASE_URL}/answer-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${facToken}`
    },
    body: JSON.stringify({
      examId: examId,
      fileName: 'live_e2e_answer_key.pdf',
      fileType: 'application/pdf',
      fileUrl: '/uploads/live_e2e_answer_key.pdf',
      parsedAnswers: [
        {
          questionId: questionId,
          questionNumber: 1,
          questionText: 'Explain the basic concept of operating systems.',
          answerText: 'An operating system is system software that manages computer hardware and software resources and provides services for application programs. It manages processes, memory, files, storage, and input/output devices.',
          maximumMarks: 10,
          rubric: [
            { criterion: 'Definition', marks: 2 },
            { criterion: 'Resource management', marks: 2 },
            { criterion: 'Process management', marks: 2 },
            { criterion: 'Memory management', marks: 2 },
            { criterion: 'File/I/O management', marks: 2 }
          ],
          keywords: ['operating system', 'system software', 'hardware', 'software', 'processes', 'memory', 'files', 'input/output']
        }
      ]
    })
  });

  const keyData = await createKeyRes.json();
  const answerKeyId = keyData.data?._id || keyData._id || keyData.data?.answerKey?._id;

  const approveRes = await fetch(`${BASE_URL}/answer-keys/approve/${answerKeyId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${facToken}` }
  });
  results.answerKeyApproval = approveRes.ok ? 'PASS' : 'FAIL';
  console.log(`Answer Key Creation & Approval: ${results.answerKeyApproval}`);

  // 4. STUDENT EXAM SUBMISSION
  console.log("\n4. Student Submitting Handwritten Answer...");
  const strokes = generateStrokesForText("OPERATING SYSTEM IS SYSTEM SOFTWARE WHICH ACTS AS AN INTERFACE BETWEEN USER AND COMPUTER HARDWARE IT MANAGES PROCESSES MEMORY FILES AND INPUT OUTPUT DEVICES");

  const startRes = await fetch(`${BASE_URL}/exams/${examId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${stuToken}` }
  });
  const startData = await startRes.json();

  const submitRes = await fetch(`${BASE_URL}/exams/${examId}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${stuToken}`
    },
    body: JSON.stringify({
      submissionType: 'DIGITAL',
      answers: [
        {
          questionId: questionId,
          handwrittenData: JSON.stringify({ strokes })
        }
      ]
    })
  });

  const submitData = await submitRes.json();
  const answerSheetId = submitData.data?._id || submitData.data?.answerSheet?._id;
  results.answerSubmission = submitRes.ok ? 'PASS' : 'FAIL';
  console.log(`Answer Submission: ${results.answerSubmission} (AnswerSheet ID: ${answerSheetId})`);

  // Wait 3 seconds for background HWR & AI Evaluation
  console.log("Waiting for background PaddleOCR processing & AI Evaluation...");
  await sleep(4000);

  // Check Answer Sheet Status & OCR Result
  const sheetStatusRes = await fetch(`${BASE_URL}/exams/${examId}/status`, {
    headers: { Authorization: `Bearer ${stuToken}` }
  });
  const sheetStatusData = await sheetStatusRes.json();

  console.log("\n5. Verifying Real PaddleOCR & Question Mapping...");
  const sheetRes = await fetch(`${BASE_URL}/exams/${examId}/answer-sheets`, {
    headers: { Authorization: `Bearer ${facToken}` }
  });
  const sheetListData = await sheetRes.json();
  const sheets = sheetListData.data?.answerSheets || sheetListData.data || [];
  const targetSheet = sheets.find(s => String(s._id) === String(answerSheetId)) || sheets[0];

  const ocrText = targetSheet?.answers?.[0]?.recognizedText || targetSheet?.extractedText || "";
  results.ocrProcessing = (targetSheet?.ocrStatus === 'completed' && ocrText.length > 0) ? 'PASS' : 'FAIL';
  results.digitizedText = ocrText.length > 0 ? 'PASS' : 'FAIL';
  results.questionMapping = (targetSheet?.answers?.[0]?.questionId === questionId) ? 'PASS' : 'FAIL';

  console.log(`PaddleOCR Processing: ${results.ocrProcessing}`);
  console.log(`Digitized Text Recognized: "${ocrText}" (${results.digitizedText})`);
  console.log(`Question Mapping: ${results.questionMapping}`);

  // 6. AI EVALUATION & MARKS
  console.log("\n6. Checking AI Evaluation Result...");
  const evalListRes = await fetch(`${BASE_URL}/evaluations/exam/${examId}`, {
    headers: { Authorization: `Bearer ${facToken}` }
  });
  let evalListData = await evalListRes.json();
  let evaluations = evalListData.data?.evaluations || evalListData.data || [];
  let evaluationObj = evaluations[0];

  if (!evaluationObj && targetSheet) {
    // Trigger bulk evaluation or single evaluation if pending
    console.log("Triggering explicit evaluation call...");
    const evalTriggerRes = await fetch(`${BASE_URL}/exams/${examId}/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facToken}` }
    });
    await sleep(2000);
    const evalListRes2 = await fetch(`${BASE_URL}/evaluations/exam/${examId}`, {
      headers: { Authorization: `Bearer ${facToken}` }
    });
    evalListData = await evalListRes2.json();
    evaluations = evalListData.data?.evaluations || evalListData.data || [];
    evaluationObj = evaluations[0];
  }

  const hasAiEval = !!evaluationObj;
  results.aiEvaluation = hasAiEval ? 'PASS' : 'FAIL';
  results.aiMarks = (hasAiEval && evaluationObj.obtainedMarks !== undefined) ? 'PASS' : 'FAIL';
  results.aiExplanation = (hasAiEval && evaluationObj.feedback) ? 'PASS' : 'FAIL';

  console.log(`AI Evaluation: ${results.aiEvaluation}`);
  if (hasAiEval) {
    console.log(`AI Obtained Marks: ${evaluationObj.obtainedMarks}/${evaluationObj.totalMarks}`);
    console.log(`AI Feedback: ${evaluationObj.feedback}`);
  }

  // 7. FACULTY REVIEW & OVERRIDE
  console.log("\n7. Faculty Review & Override Test...");
  let overrideSuccess = false;
  if (evaluationObj) {
    const overrideRes = await fetch(`${BASE_URL}/evaluations/${evaluationObj._id}/override`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facToken}`
      },
      body: JSON.stringify({
        obtainedMarks: 7,
        feedback: 'Faculty verified answer: full clarity on OS definition and process management.',
        overrideReason: 'Faculty adjustment after live manual review.'
      })
    });
    overrideSuccess = overrideRes.ok;
  }
  results.facultyReview = evaluationObj ? 'PASS' : 'FAIL';
  results.facultyOverride = overrideSuccess ? 'PASS' : 'FAIL';
  results.finalMarks = overrideSuccess ? 'PASS' : 'FAIL';
  console.log(`Faculty Review: ${results.facultyReview}, Override: ${results.facultyOverride}`);

  // 8. RESULT PUBLICATION
  console.log("\n8. Result Publication Test...");
  let publishSuccess = false;
  if (evaluationObj) {
    const pubRes = await fetch(`${BASE_URL}/evaluations/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facToken}`
      },
      body: JSON.stringify({
        examId: examId,
        evaluationIds: [evaluationObj._id]
      })
    });
    publishSuccess = pubRes.ok;
  }
  results.resultPublication = publishSuccess ? 'PASS' : 'FAIL';
  console.log(`Result Publication: ${results.resultPublication}`);

  // 9. STUDENT RESULT & REPORT & ANALYTICS
  console.log("\n9. Student Result View & Analytics Verification...");
  const stuResultRes = await fetch(`${BASE_URL}/results/my-results`, {
    headers: { Authorization: `Bearer ${stuToken}` }
  });
  const stuResultData = await stuResultRes.json();
  results.studentResult = stuResultRes.ok ? 'PASS' : 'FAIL';

  const analyticsRes = await fetch(`${BASE_URL}/exams/${examId}/analytics`, {
    headers: { Authorization: `Bearer ${facToken}` }
  });
  results.analytics = analyticsRes.ok ? 'PASS' : 'FAIL';

  const exportRes = await fetch(`${BASE_URL}/exams/${examId}/results/export`, {
    headers: { Authorization: `Bearer ${facToken}` }
  });
  results.reports = exportRes.ok ? 'PASS' : 'FAIL';

  console.log(`Student Result Access: ${results.studentResult}`);
  console.log(`Analytics Dashboard: ${results.analytics}`);
  console.log(`Reports Export: ${results.reports}`);

  // 10. SECURITY TESTS
  console.log("\n10. Executing Security Authorization Tests...");
  // Student trying to access Faculty endpoint (e.g. bulk evaluate or analytics)
  const secStudentRes = await fetch(`${BASE_URL}/exams/${examId}/analytics`, {
    headers: { Authorization: `Bearer ${stuToken}` }
  });
  results.securityStudentDenied = secStudentRes.status === 403 ? 'PASS' : 'FAIL';

  // Unauthenticated user trying to access results
  const secUnauthRes = await fetch(`${BASE_URL}/exams/${examId}/results`);
  results.securityUnauthDenied = secUnauthRes.status === 401 ? 'PASS' : 'FAIL';

  results.security = (results.securityStudentDenied === 'PASS' && results.securityUnauthDenied === 'PASS') ? 'PASS' : 'FAIL';
  console.log(`Security Auth Enforcement: ${results.security} (Student 403: ${results.securityStudentDenied}, Unauth 401: ${results.securityUnauthDenied})`);

  // 11. FAILURE SAFETY TEST
  console.log("\n11. Executing Failure-Safety Test...");
  // Try evaluating with invalid parameters or invalid answerSheetId
  const failRes = await fetch(`${BASE_URL}/evaluations/000000000000000000000000/override`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${facToken}`
    },
    body: JSON.stringify({ obtainedMarks: 100 })
  });
  results.failureSafety = (failRes.status === 404 || failRes.status === 400) ? 'PASS' : 'FAIL';
  console.log(`Failure Safety Enforcement: ${results.failureSafety}`);

  console.log("\n=================================================");
  console.log("       LIVE E2E TEST SUMMARY RESULTS           ");
  console.log("=================================================");
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync('e2e_suite_output.json', JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
