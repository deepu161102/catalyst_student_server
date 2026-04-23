require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
const connectDB    = require('./config/db');
const Mentor       = require('./models/Mentor');
const Operations   = require('./models/Operations');
const bcrypt       = require('bcryptjs');

const seed = async () => {
  await connectDB();
  const hashed = await bcrypt.hash('mentor123', 10);

  await Mentor.findOneAndUpdate(
    { email: 'mentor@catalyst.com' },
    { name: 'Arjun Sharma', email: 'mentor@catalyst.com', password: hashed, role: 'mentor', specialization: 'Full Stack Development', experience: 5 },
    { upsert: true, new: true }
  );
  console.log('Mentor seeded → mentor@catalyst.com / mentor123');

  // Remove ops user from mentors collection if it was there (migration: moved to its own collection)
  await Mentor.deleteOne({ email: 'ops@catalyst.com' });

  // Ops user lives in the separate operations collection
  await Operations.findOneAndUpdate(
    { email: 'ops@catalyst.com' },
    { name: 'Priya Menon', email: 'ops@catalyst.com', password: hashed, role: 'operations' },
    { upsert: true, new: true }
  );
  console.log('Operations seeded → ops@catalyst.com / mentor123');

  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });
