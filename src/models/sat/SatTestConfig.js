const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const diffDistSchema = new mongoose.Schema(
  {
    easy:   { type: Number, required: true, default: 0 },
    medium: { type: Number, required: true, default: 0 },
    hard:   { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const moduleConfigSchema = new mongoose.Schema(
  {
    total_questions:    { type: Number, required: true },
    time_limit_minutes: { type: Number, required: true },
    difficulty_distribution: { type: diffDistSchema, required: true },
  },
  { _id: false }
);

const scoreBandSchema = new mongoose.Schema(
  {
    min_score:  { type: Number, required: true },
    label:      { type: String, required: true },
    easy_pct:   { type: Number, required: true },
    medium_pct: { type: Number, required: true },
    hard_pct:   { type: Number, required: true },
  },
  { _id: false }
);

// M1 score >= adaptive_threshold → module_2_hard (2b), else → module_2_easy (2a)
const subjectConfigSchema = new mongoose.Schema(
  {
    module_1:           { type: moduleConfigSchema, required: true },
    module_2_easy:      { type: moduleConfigSchema, required: true },
    module_2_hard:      { type: moduleConfigSchema, required: true },
    adaptive_threshold: { type: Number, required: true, default: 60, min: 0, max: 100 },
    score_bands:        { type: [scoreBandSchema], default: [] },
  },
  { _id: false }
);

const satTestConfigSchema = new mongoose.Schema(
  {
    testId: {
      type:    String,
      default: uuidv4,
      unique:  true,
      index:   true,
    },
    name:               { type: String, required: true, trim: true },
    type:               { type: String, enum: ['mock', 'diagnostic'], required: true },
    is_demo_accessible: { type: Boolean, default: false },
    is_active:          { type: Boolean, default: true },
    subjects: {
      reading_writing: { type: subjectConfigSchema, required: true },
      math:            { type: subjectConfigSchema, required: true },
    },
  },
  { timestamps: true, collection: 'sattestconfigs' }
);

module.exports = mongoose.model('SatTestConfig', satTestConfigSchema);
