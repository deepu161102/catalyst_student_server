const mongoose = require('mongoose');

const satPracticeTestConfigSchema = new mongoose.Schema(
  {
    name:               { type: String, required: true, trim: true },
    subject:            { type: String, enum: ['math', 'reading_writing'], required: true },
    topic:              { type: String, required: true, trim: true },
    sub_topic:          { type: String, required: true, trim: true },
    total_questions:    { type: Number, default: 10 },
    time_limit_minutes: { type: Number, default: 15 },
    difficulty_distribution: {
      easy:   { type: Number, default: 4 },
      medium: { type: Number, default: 4 },
      hard:   { type: Number, default: 2 },
    },
    is_demo_accessible: { type: Boolean, default: false },
    display_order:      { type: Number, default: 0 },
    is_active:          { type: Boolean, default: true },
  },
  { timestamps: true }
);

satPracticeTestConfigSchema.index({ subject: 1, topic: 1, sub_topic: 1 });
satPracticeTestConfigSchema.index({ is_demo_accessible: 1, is_active: 1 });

module.exports = mongoose.model('SatPracticeTestConfig', satPracticeTestConfigSchema);
