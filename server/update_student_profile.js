import mongoose from 'mongoose';
import User from './src/models/User.js';
import Department from './src/models/Department.js';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/ai_evaluation_db');
  
  const dept = await Department.findOne({ code: 'CS' });
  if (!dept) {
    console.error("Department CS not found!");
    process.exit(1);
  }

  const updatedStudent = await User.findOneAndUpdate(
    { email: 'student@test.com' },
    { 
      $set: { 
        semester: 5,
        department: dept._id.toString()
      } 
    },
    { new: true }
  );

  console.log("Updated Student Record:", JSON.stringify(updatedStudent, null, 2));
  await mongoose.disconnect();
}
main().catch(console.error);
