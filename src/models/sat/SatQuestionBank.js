const mongoose = require('mongoose');

const satQuestionBankSchema = new mongoose.Schema(
  {
    subject:       { type: String, enum: ['math', 'reading_writing'], required: true },
    domain:        { type: String, required: true, trim: true },
    topic:         { type: String, required: true, trim: true },
    difficulty:    { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    title:         { type: String, required: true, trim: true },
    description:   { type: String, default: '' },
    question_type: { type: String, enum: ['mcq', 'grid_in'], default: 'mcq' },
    choices: {
      A: { type: String, default: '' },
      B: { type: String, default: '' },
      C: { type: String, default: '' },
      D: { type: String, default: '' },
    },
    correct_answer:      { type: String, required: true },
    explanation:         { type: String, default: '' },
    explanation_wrong:   { type: String, default: '' },
    hint:                { type: String, default: '' },
    points:              { type: Number, default: 1 },
    image_url:           { type: String, default: '' },
    is_active:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

satQuestionBankSchema.index({ subject: 1, difficulty: 1, is_active: 1 });
satQuestionBankSchema.index({ subject: 1, domain: 1, difficulty: 1 });

module.exports = mongoose.model('SatQuestionBank', satQuestionBankSchema);
