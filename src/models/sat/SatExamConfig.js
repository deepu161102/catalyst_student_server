const mongoose = require('mongoose');

const moduleConfigSchema = new mongoose.Schema(
  {
    total_questions:    { type: Number, required: true },
    time_limit_minutes: { type: Number, required: true },
    difficulty_distribution: {
      easy:   { type: Number, required: true },
      medium: { type: Number, required: true },
      hard:   { type: Number, required: true },
    },
  },
  { _id: false }
);

const satExamConfigSchema = new mongoose.Schema(
  {
    name:               { type: String, required: true, trim: true },
    subject:            { type: String, enum: ['math', 'reading_writing'], required: true },
    module_1:                    { type: moduleConfigSchema, required: true },
    module_2_hard:               { type: moduleConfigSchema, required: true },
    module_2_medium:             { type: moduleConfigSchema },
    module_2_easy:               { type: moduleConfigSchema, required: true },
    adaptive_threshold:          { type: Number, default: 60 },
    adaptive_threshold_medium:   { type: Number, default: 40 },
    is_active:          { type: Boolean, default: true },
  },
  { timestamps: true }
);

satExamConfigSchema.index({ subject: 1, is_active: 1 });

module.exports = mongoose.model('SatExamConfig', satExamConfigSchema);
