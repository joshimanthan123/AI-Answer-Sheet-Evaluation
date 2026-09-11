import mongoose from "mongoose";
import http from "http";

function callFastAPIStrokes(strokes) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ strokes, width: 800, height: 400 });
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 8000,
        path: "/api/v1/ocr/recognize-strokes",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.data?.text || parsed.text || "");
          } catch (e) {
            resolve("");
          }
        });
      }
    );
    req.on("error", () => resolve(""));
    req.write(postData);
    req.end();
  });
}

async function run() {
  await mongoose.connect("mongodb://localhost:27017/ai_evaluation_db");
  console.log("Connected to MongoDB");

  const examId = "6aa38bf1ee09ce4ef5651c60"; // OS Exam
  const exam = await mongoose.connection.collection("exams").findOne({ _id: new mongoose.Types.ObjectId(examId) });

  if (!exam) {
    console.error("OS Exam not found");
    process.exit(1);
  }

  console.log("Found OS Exam:", exam.title, "Questions count:", exam.questions?.length);

  const student = await mongoose.connection.collection("users").findOne({ role: "student" });
  if (!student) {
    console.error("No student found");
    process.exit(1);
  }
  console.log("Found Student:", student.email, student._id.toString());

  // Generate realistic handwritten strokes for text "OPERATING SYSTEM"
  const strokes = [
    // O
    [{ x: 100, y: 100 }, { x: 150, y: 100 }, { x: 150, y: 150 }, { x: 100, y: 150 }, { x: 100, y: 100 }],
    // P
    [{ x: 170, y: 100 }, { x: 170, y: 150 }],
    [{ x: 170, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 125 }, { x: 170, y: 125 }],
    // E
    [{ x: 220, y: 100 }, { x: 220, y: 150 }],
    [{ x: 220, y: 100 }, { x: 250, y: 100 }],
    [{ x: 220, y: 125 }, { x: 245, y: 125 }],
    [{ x: 220, y: 150 }, { x: 250, y: 150 }],
    // R
    [{ x: 270, y: 100 }, { x: 270, y: 150 }],
    [{ x: 270, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 125 }, { x: 270, y: 125 }],
    [{ x: 270, y: 125 }, { x: 300, y: 150 }],
    // S
    [{ x: 320, y: 100 }, { x: 350, y: 100 }, { x: 320, y: 125 }, { x: 350, y: 150 }]
  ];

  // Call FastAPI microservice directly on port 8000
  let ocrText = await callFastAPIStrokes(strokes);
  console.log("PaddleOCR Transcribed Text from FastAPI:", ocrText);
  if (!ocrText) {
    ocrText = "OPERATING SYSTEM";
  }

  const qId = exam.questions?.[0]?._id || new mongoose.Types.ObjectId();

  // Insert student AnswerSheet document for OS Exam
  const answerSheetDoc = {
    exam: exam._id,
    student: student._id,
    studentEmail: student.email,
    studentName: student.name,
    subject: exam.subject,
    status: "Ingestion Active",
    submissionType: "digital_slate",
    evaluationStatus: "Pending",
    digital_answers: [
      {
        questionId: qId,
        questionNumber: 1,
        strokes,
        handwrittenData: JSON.stringify({ strokes, canvasWidth: 800, canvasHeight: 400 }),
        recognizedText: ocrText,
        text: ocrText,
        capturedAt: new Date()
      }
    ],
    answers: [
      {
        questionId: qId,
        questionNumber: 1,
        recognizedText: ocrText,
        handwrittenData: JSON.stringify({ strokes, canvasWidth: 800, canvasHeight: 400 }),
        marksObtained: 0
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const insertResult = await mongoose.connection.collection("answersheets").insertOne(answerSheetDoc);
  const newSheetId = insertResult.insertedId.toString();
  console.log("✓ Created student AnswerSheet for OS Exam! Sheet ID:", newSheetId);

  // Increment exam's ingestedSheets counter
  await mongoose.connection.collection("exams").updateOne(
    { _id: exam._id },
    { $inc: { ingestedSheets: 1 } }
  );

  console.log("✓ OS Exam student answer sheet submitted successfully!");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
