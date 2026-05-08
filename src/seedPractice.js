require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dns').setServers(['8.8.8.8', '1.1.1.1']);

const connectDB             = require('./config/db');
const SatPracticeTestConfig = require('./models/sat/SatPracticeTestConfig');

// Exact SAT official taxonomy: subject → topic → domain
// Questions in the bank must be tagged with these exact values
const PRACTICE_CONFIGS = [
  // ── Math — Advanced Math (3) ──────────────────────────────────────────────
  { subject: 'math', topic: 'Advanced Math', domain: 'Equivalent expressions',
    name: 'Advanced Math: Equivalent Expressions' },
  { subject: 'math', topic: 'Advanced Math', domain: 'Nonlinear equations in one variable and systems of equations in two variables',
    name: 'Advanced Math: Nonlinear Equations & Systems' },
  { subject: 'math', topic: 'Advanced Math', domain: 'Nonlinear functions',
    name: 'Advanced Math: Nonlinear Functions' },

  // ── Math — Algebra (5) ────────────────────────────────────────────────────
  { subject: 'math', topic: 'Algebra', domain: 'Linear equations in one variable',
    name: 'Algebra: Linear Equations in One Variable' },
  { subject: 'math', topic: 'Algebra', domain: 'Linear equations in two variables',
    name: 'Algebra: Linear Equations in Two Variables' },
  { subject: 'math', topic: 'Algebra', domain: 'Linear functions',
    name: 'Algebra: Linear Functions' },
  { subject: 'math', topic: 'Algebra', domain: 'Linear inequalities in one or two variables',
    name: 'Algebra: Linear Inequalities' },
  { subject: 'math', topic: 'Algebra', domain: 'Systems of two linear equations in two variables',
    name: 'Algebra: Systems of Two Linear Equations' },

  // ── Math — Geometry and Trigonometry (4) ─────────────────────────────────
  { subject: 'math', topic: 'Geometry and Trigonometry', domain: 'Area and volume',
    name: 'Geometry: Area and Volume' },
  { subject: 'math', topic: 'Geometry and Trigonometry', domain: 'Circles',
    name: 'Geometry: Circles' },
  { subject: 'math', topic: 'Geometry and Trigonometry', domain: 'Lines, angles, and triangles',
    name: 'Geometry: Lines, Angles, and Triangles' },
  { subject: 'math', topic: 'Geometry and Trigonometry', domain: 'Right triangles and trigonometry',
    name: 'Geometry: Right Triangles and Trigonometry' },

  // ── Math — Problem-Solving and Data Analysis (7) ─────────────────────────
  { subject: 'math', topic: 'Problem-Solving and Data Analysis', domain: 'Evaluating statistical claims: Observational studies and experiments',
    name: 'Data Analysis: Statistical Claims' },
  { subject: 'math', topic: 'Problem-Solving and Data Analysis', domain: 'Inference from sample statistics and margin of error',
    name: 'Data Analysis: Sample Statistics & Margin of Error' },
  { subject: 'math', topic: 'Problem-Solving and Data Analysis', domain: 'One-variable data: Distributions and measures of center and spread',
    name: 'Data Analysis: One-Variable Distributions' },
  { subject: 'math', topic: 'Problem-Solving and Data Analysis', domain: 'Percentages',
    name: 'Data Analysis: Percentages' },
  { subject: 'math', topic: 'Problem-Solving and Data Analysis', domain: 'Probability and conditional probability',
    name: 'Data Analysis: Probability' },
  { subject: 'math', topic: 'Problem-Solving and Data Analysis', domain: 'Ratios, rates, proportional relationships, and units',
    name: 'Data Analysis: Ratios, Rates, and Proportions' },
  { subject: 'math', topic: 'Problem-Solving and Data Analysis', domain: 'Two-variable data: Models and scatterplots',
    name: 'Data Analysis: Two-Variable Data & Scatterplots' },

  // ── Reading & Writing — Craft and Structure (3) ───────────────────────────
  { subject: 'reading_writing', topic: 'Craft and Structure', domain: 'Cross-Text Connections',
    name: 'Craft and Structure: Cross-Text Connections' },
  { subject: 'reading_writing', topic: 'Craft and Structure', domain: 'Text Structure and Purpose',
    name: 'Craft and Structure: Text Structure and Purpose' },
  { subject: 'reading_writing', topic: 'Craft and Structure', domain: 'Words in Context',
    name: 'Craft and Structure: Words in Context' },

  // ── Reading & Writing — Expression of Ideas (2) ──────────────────────────
  { subject: 'reading_writing', topic: 'Expression of Ideas', domain: 'Rhetorical Synthesis',
    name: 'Expression of Ideas: Rhetorical Synthesis' },
  { subject: 'reading_writing', topic: 'Expression of Ideas', domain: 'Transitions',
    name: 'Expression of Ideas: Transitions' },

  // ── Reading & Writing — Information and Ideas (3) ────────────────────────
  { subject: 'reading_writing', topic: 'Information and Ideas', domain: 'Central Ideas and Details',
    name: 'Information and Ideas: Central Ideas and Details' },
  { subject: 'reading_writing', topic: 'Information and Ideas', domain: 'Command of Evidence',
    name: 'Information and Ideas: Command of Evidence' },
  { subject: 'reading_writing', topic: 'Information and Ideas', domain: 'Inferences',
    name: 'Information and Ideas: Inferences' },

  // ── Reading & Writing — Standard English Conventions (2) ─────────────────
  { subject: 'reading_writing', topic: 'Standard English Conventions', domain: 'Boundaries',
    name: 'Standard English Conventions: Boundaries' },
  { subject: 'reading_writing', topic: 'Standard English Conventions', domain: 'Form, Structure, and Sense',
    name: 'Standard English Conventions: Form, Structure, and Sense' },
];

const DIFF_BY_TOPIC = {
  'Advanced Math':                    { easy: 2, medium: 4, hard: 4 },
  'Algebra':                          { easy: 4, medium: 4, hard: 2 },
  'Geometry and Trigonometry':        { easy: 3, medium: 4, hard: 3 },
  'Problem-Solving and Data Analysis':{ easy: 4, medium: 4, hard: 2 },
  'Craft and Structure':              { easy: 4, medium: 4, hard: 2 },
  'Expression of Ideas':              { easy: 3, medium: 4, hard: 3 },
  'Information and Ideas':            { easy: 3, medium: 4, hard: 3 },
  'Standard English Conventions':     { easy: 4, medium: 4, hard: 2 },
};

const run = async () => {
  await connectDB();

  const existing = await SatPracticeTestConfig.countDocuments();
  if (existing > 0) {
    console.log(`Practice configs already seeded (${existing} found). Skipping.`);
    process.exit(0);
  }

  const docs = PRACTICE_CONFIGS.map((cfg, idx) => ({
    ...cfg,
    total_questions:         10,
    time_limit_minutes:      15,
    difficulty_distribution: DIFF_BY_TOPIC[cfg.topic] || { easy: 4, medium: 4, hard: 2 },
    is_active:               true,
    display_order:           idx,
    is_demo_accessible:      idx < 5,
  }));

  await SatPracticeTestConfig.insertMany(docs);
  console.log(`Seeded ${docs.length} practice configs (first 5 demo-accessible).`);
  console.log('Topics covered:');
  const byTopic = {};
  docs.forEach(d => { byTopic[d.topic] = (byTopic[d.topic] || 0) + 1; });
  Object.entries(byTopic).forEach(([t, n]) => console.log(`  ${t}: ${n}`));
  process.exit(0);
};

run().catch(err => { console.error(err); process.exit(1); });
