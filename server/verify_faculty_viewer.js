import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function run() {
  console.log('Logging in as Faculty...');
  const loginRes = await fetch("http://127.0.0.1:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "faculty@test.com", password: "password123" })
  });
  
  if (!loginRes.ok) {
    const text = await loginRes.text();
    fs.writeFileSync('viewer_error.txt', `Login status ${loginRes.status}: ${text}`);
    throw new Error(`Login failed with status ${loginRes.status}: ${text}`);
  }
  
  const loginData = await loginRes.json();
  const token = loginData.data?.token || loginData.token;
  console.log('Login successful!');

  const submissionId = '6a81b9d108ae9aae3cbd7085';
  console.log(`Fetching Faculty review details for AnswerSheet: ${submissionId}...`);

  const reviewRes = await fetch(`http://127.0.0.1:5000/api/faculty/answer-sheets/${submissionId}/review`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (!reviewRes.ok) {
    const text = await reviewRes.text();
    fs.writeFileSync('viewer_error.txt', `Fetch review details status ${reviewRes.status}: ${text}`);
    throw new Error(`Failed to fetch review details: status ${reviewRes.status}: ${text}`);
  }

  const reviewJson = await reviewRes.json();
  console.log('--- REVIEW DETAILS API RESPONSE ---');
  console.log(JSON.stringify(reviewJson, null, 2));

  // Connect to DB to double check the stored evaluation
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_evaluation_db');
  
  const details = await mongoose.connection.db.collection('evaluations').findOne({
    answerSheet: new mongoose.Types.ObjectId(submissionId)
  });
  console.log('--- MONGO EVALUATION DOCUMENT ---');
  console.log(JSON.stringify(details, null, 2));

  await mongoose.disconnect();
  console.log('Done!');
}

run().catch((e) => {
  console.error(e);
  fs.writeFileSync('viewer_error.txt', e.stack || String(e));
});

