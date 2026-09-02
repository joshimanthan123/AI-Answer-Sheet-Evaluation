import mongoose from "mongoose";
import env from "./src/config/env.js";
import AnswerSheet from "./src/models/AnswerSheet.js";

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  const sheet = await AnswerSheet.findOne({ processingStatus: "failed" }).sort({ updatedAt: -1 });
  if (!sheet) {
    console.log("No failed AnswerSheet found.");
  } else {
    console.log("Failed AnswerSheet details:");
    console.log("ID:", sheet._id);
    console.log("processingStatus:", sheet.processingStatus);
    console.log("ocrStatus:", sheet.ocrStatus);
    console.log("errorMessage:", sheet.errorMessage);
    console.log("answers:", JSON.stringify(sheet.answers, null, 2));
  }
  await mongoose.connection.close();
}
run();
