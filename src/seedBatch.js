require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dns').setServers(['8.8.8.8', '1.1.1.1']);

const connectDB = require('./config/db');
const Batch     = require('./models/Batch');
const Mentor    = require('./models/Mentor');
const Student   = require('./models/Student');

const seed = async () => {
  await connectDB();

  // ── Find seeded mentor ──────────────────────────────────────────────────────
  const mentor = await Mentor.findOne({ email: 'mentor@catalyst.com' });
  if (!mentor) {
    console.error('Run seedMentor.js first — mentor@catalyst.com not found');
    process.exit(1);
  }

  // ── Create / upsert batch ───────────────────────────────────────────────────
  const batch = await Batch.findOneAndUpdate(
    { name: 'Full Stack Batch 01' },
    {
      name:              'Full Stack Batch 01',
      course:            'Full Stack Development',
      mentorId:          mentor._id,
      startDate:         new Date('2024-02-10'),
      endDate:           new Date('2024-08-10'),
      status:            'active',
      totalSessions:     60,
      completedSessions: 15,
      description:       'Beginner to advanced full stack web development',
    },
    { upsert: true, new: true }
  );
  console.log(`Batch upserted → ${batch.name} (${batch._id})`);

  // ── Link all existing students to this batch ────────────────────────────────
  const result = await Student.updateMany(
    { batchId: null },
    { batchId: batch._id }
  );
  console.log(`Linked ${result.modifiedCount} student(s) → batch ${batch.name}`);

  console.log('\nRelationship: mentor@catalyst.com → Full Stack Batch 01 → all students');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
