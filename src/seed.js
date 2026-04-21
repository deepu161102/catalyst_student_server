require('dotenv').config();
const connectDB = require('./config/db');
const Student = require('./models/Student');

const seed = async () => {
  await connectDB();
  await Student.deleteOne({ email: 'arjun.mehta@example.com' });
  await Student.create({
    name: 'Arjun Mehta',
    email: 'arjun.mehta@example.com',
    password: 'student123',
    grade: 'Full Stack Web Development',
  });
  console.log('Demo student seeded: arjun.mehta@example.com / student123');
  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });
