import mongoose from 'mongoose';
import AnswerSheet from './src/models/AnswerSheet.js';
import Evaluation from './src/models/Evaluation.js';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/ai_evaluation_db');

  const sheet = await AnswerSheet.findById("6a81b9d108ae9aae3cbd7085");
  if (!sheet) {
    console.log("AnswerSheet 6a81b9d108ae9aae3cbd7085 not found!");
  } else {
    console.log("AnswerSheet Details:", {
      id: sheet._id,
      submissionStatus: sheet.submissionStatus,
      processingStatus: sheet.processingStatus,
      ocrStatus: sheet.ocrStatus,
      uploadStatus: sheet.uploadStatus,
      answersCount: sheet.answers?.length || 0,
      createdAt: sheet.createdAt,
      updatedAt: sheet.updatedAt
    });
    
    // Print each question's answer details (like text extracted)
    if (sheet.answers) {
      sheet.answers.forEach((ans, idx) => {
        console.log(`Answer ${idx + 1}:`, {
          questionId: ans.questionId,
          hasHandwrittenData: !!ans.handwrittenData,
          handwrittenDataLength: ans.handwrittenData?.length,
          extractedText: ans.extractedText,
          ocrConfidence: ans.ocrConfidence
        });
      });
    }
  }

  const evaluation = await Evaluation.findOne({ answerSheet: "6a81b9d108ae9aae3cbd7085" });
  if (!evaluation) {
    console.log("No Evaluation document found yet for this sheet.");
  } else {
    console.log("Evaluation details:", {
      id: evaluation._id,
      evaluationStatus: evaluation.evaluationStatus,
      totalInitialMarks: evaluation.totalInitialMarks,
      totalFinalMarks: evaluation.totalFinalMarks,
      evaluatorId: evaluation.evaluator,
      grades: evaluation.grades // if any
    });
  }

  await mongoose.disconnect();
}
main().catch(console.error);
