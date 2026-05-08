const mongoose = require('mongoose');

const satQuestionBankSchema = new mongoose.Schema(
  {
    question_id:    { type: String, default: '' },
    cb_question_id: { type: String, default: '' },
    cb_external_id: { type: String, default: '' },
    cb_ibn:         { type: String, default: '' },
    course:         { type: String, default: 'sat' },
    subject:        { type: String, enum: ['math', 'reading_writing'], required: true },
    topic:          { type: String, required: true, trim: true },
    sub_topic:      { type: String, required: true, trim: true },
    skill_tag:      { type: String, default: '' },
    difficulty:     { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    format:         { type: String, enum: ['mcq', 'grid_in'], default: 'mcq' },
    passage_id:     { type: String, default: null },
    stem:           { type: String, required: true },
    option_a:       { type: String, default: '' },
    option_b:       { type: String, default: '' },
    option_c:       { type: String, default: '' },
    option_d:       { type: String, default: '' },
    correct_answer: { type: String, default: '' },
    explanation:    { type: String, default: '' },
    hint_1:         { type: String, default: '' },
    hint_2:         { type: String, default: '' },
    hint_3:         { type: String, default: '' },
    review_status:  { type: String, default: 'approved' },
    source:         { type: String, default: '' },
    points:         { type: Number, default: 1 },
    is_calculator_allowed: { type: Boolean, default: false },
    is_active:             { type: Boolean, default: true },
  },
  { timestamps: true }
);

satQuestionBankSchema.index({ subject: 1, difficulty: 1, is_active: 1 });
satQuestionBankSchema.index({ subject: 1, sub_topic: 1, difficulty: 1 });
satQuestionBankSchema.index({ subject: 1, topic: 1, sub_topic: 1 });
satQuestionBankSchema.index({ question_id: 1 }, { unique: true, sparse: true, partialFilterExpression: { question_id: { $gt: '' } } });

module.exports = mongoose.model('SatQuestionBank', satQuestionBankSchema);
