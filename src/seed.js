require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
const connectDB = require('./config/db');
const Student = require('./models/Student');
const bcrypt = require('bcryptjs');

const seed = async () => {
  await connectDB();
  const hashed = await bcrypt.hash('student123', 10);
  await Student.findOneAndUpdate(
    { email: 'arjun.mehta@example.com' },
    { password: hashed },
    { upsert: true, new: true }
  );
  console.log('Password set for arjun.mehta@example.com → student123');
  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });
