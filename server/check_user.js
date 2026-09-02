import mongoose from 'mongoose';
import User from './src/models/User.js';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/ai_evaluation_db');
    const user = await User.findOne({ studentId: '22CE123' });
    console.log("Student User Record:", JSON.stringify(user, null, 2));
  await mongoose.disconnect();
}
main();
