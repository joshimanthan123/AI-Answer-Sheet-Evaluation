import mongoose from 'mongoose';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/ai_evaluation_db');
  console.log('Connected to DB');
  
  const res1 = await mongoose.connection.collection('users').deleteMany({
    $or: [
      { email: { $in: ['faculty@test.com', 'student@test.com', 'student_new@university.edu'] } },
      { studentId: '22CE123' }
    ]
  });
  console.log('Deleted users count:', res1.deletedCount);
  
  await mongoose.disconnect();
}
main().catch(console.error);
