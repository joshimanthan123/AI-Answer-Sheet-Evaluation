import mongoose from "mongoose";

async function run() {
  await mongoose.connect("mongodb://localhost:27017/ai_evaluation_db");
  const faculty = await mongoose.connection.collection("users").findOne({ email: "faculty999@charusat.edu.in" });
  if (!faculty) {
    console.error("Faculty user not found");
    process.exit(1);
  }
  const result = await mongoose.connection.collection("exams").updateOne(
    { _id: new mongoose.Types.ObjectId("6aa38bf1ee09ce4ef5651c60") },
    { $set: { createdBy: faculty._id } }
  );
  console.log("OS Exam updated count:", result.modifiedCount);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
