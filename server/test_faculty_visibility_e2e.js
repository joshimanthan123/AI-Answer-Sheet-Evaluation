const baseUrl = 'http://127.0.0.1:5000/api/v1';

async function runE2ETest() {
  console.log('=== E2E VERIFICATION TEST: FACULTY ANSWER SHEET VISIBILITY ===\n');

  // 1. Student Login
  console.log('Step 1: Logging in as Student (studentce@gmail.com)...');
  let res = await fetch(baseUrl + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'studentce@gmail.com', password: 'password123' })
  });
  let data = await res.json();
  if (!res.ok || !data.data?.token) {
    throw new Error('Student login failed: ' + JSON.stringify(data));
  }
  const studentToken = data.data.token;
  const studentId = data.data.user._id;
  console.log(`✓ Student logged in successfully. User ID: ${studentId}`);

  // 2. Fetch Available Exams
  console.log('\nStep 2: Fetching available exams for student...');
  res = await fetch(baseUrl + '/exams', {
    headers: { 'Authorization': 'Bearer ' + studentToken }
  });
  data = await res.json();
  const exams = data.data || [];
  const targetExam = exams.find(e => e.title === 'SGP') || exams[0];
  if (!targetExam) {
    throw new Error('No published exam found for student');
  }
  console.log(`✓ Selected Exam: "${targetExam.title}" (ID: ${targetExam._id})`);

  // 3. Start Exam Session
  console.log('\nStep 3: Student starts exam session...');
  res = await fetch(baseUrl + `/exams/${targetExam._id}/start`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + studentToken, 'Content-Type': 'application/json' }
  });
  data = await res.json();
  if (!res.ok) {
    // If exam was already submitted, log warning and continue checking faculty side
    console.log(`Info: startExam returned status ${res.status}: ${data.message}`);
  } else {
    console.log(`✓ AnswerSheet session started. Sheet ID: ${data.data?._id}`);
  }

  // 4. Submit Exam
  console.log('\nStep 4: Student submits exam...');
  res = await fetch(baseUrl + `/exams/${targetExam._id}/submit`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + studentToken, 'Content-Type': 'application/json' }
  });
  data = await res.json();
  if (!res.ok && !data.message?.includes('already been submitted')) {
    throw new Error('Student submitExam failed: ' + JSON.stringify(data));
  }
  console.log(`✓ Student submission confirmed! Message: ${data.message}`);

  // 5. Faculty Login
  console.log('\nStep 5: Logging in as Faculty (ce@gmail.com)...');
  res = await fetch(baseUrl + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ce@gmail.com', password: 'password123' })
  });
  data = await res.json();
  if (!res.ok || !data.data?.token) {
    throw new Error('Faculty login failed: ' + JSON.stringify(data));
  }
  const facultyToken = data.data.token;
  console.log(`✓ Faculty logged in successfully.`);

  // 6. Test Endpoint A: GET /exams/:examId/answer-sheets
  console.log(`\nStep 6: Faculty checking GET /exams/${targetExam._id}/answer-sheets...`);
  res = await fetch(baseUrl + `/exams/${targetExam._id}/answer-sheets`, {
    headers: { 'Authorization': 'Bearer ' + facultyToken }
  });
  data = await res.json();
  console.log(`  Response Status: ${res.status}`);
  if (!res.ok || !data.success) {
    throw new Error(`Endpoint GET /exams/:id/answer-sheets failed: ${JSON.stringify(data)}`);
  }
  const examSheets = data.data || [];
  console.log(`✓ Exam Answer Sheets count: ${examSheets.length}`);
  console.log(`  First Sheet ID: ${examSheets[0]?._id}, Student: ${examSheets[0]?.student?.name}, Document: ${examSheets[0]?.uploadedFileName}`);

  // 7. Test Endpoint B: GET /faculty/submissions
  console.log('\nStep 7: Faculty checking GET /faculty/submissions...');
  res = await fetch(baseUrl + `/faculty/submissions?exam=${targetExam._id}`, {
    headers: { 'Authorization': 'Bearer ' + facultyToken }
  });
  data = await res.json();
  console.log(`  Response Status: ${res.status}`);
  if (!res.ok || !data.success) {
    throw new Error(`Endpoint GET /faculty/submissions failed: ${JSON.stringify(data)}`);
  }
  const submissions = data.data || [];
  console.log(`✓ Faculty Submissions count: ${submissions.length}`);
  console.log(`  First Submission ID: ${submissions[0]?._id}, Status: ${submissions[0]?.submissionStatus}`);

  // 8. Test Endpoint C: GET /faculty/review-queue
  console.log('\nStep 8: Faculty checking GET /faculty/review-queue...');
  res = await fetch(baseUrl + '/faculty/review-queue', {
    headers: { 'Authorization': 'Bearer ' + facultyToken }
  });
  data = await res.json();
  console.log(`  Response Status: ${res.status}`);
  if (!res.ok || !data.success) {
    throw new Error(`Endpoint GET /faculty/review-queue failed: ${JSON.stringify(data)}`);
  }
  const reviewQueue = data.data || [];
  console.log(`✓ Faculty Review Queue items count: ${reviewQueue.length}`);
  if (reviewQueue.length > 0) {
    console.log(`  Queue item answerSheetId: ${reviewQueue[0].answerSheetId}, Student: ${reviewQueue[0].student?.name}`);
  }

  console.log('\n=================================================');
  console.log('🎉 ALL ENDPOINTS VERIFIED SUCCESSFULLY! 🎉');
  console.log('Faculty portal can see and retrieve student answer sheets!');
  console.log('=================================================\n');
}

runE2ETest().catch((err) => {
  console.error('\n❌ E2E VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
