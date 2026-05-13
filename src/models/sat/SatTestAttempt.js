const mongoose = require('mongoose');

const answerSchema = {
  question_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'SatQuestionBank' },
  selected:      { type: String, default: null },
  is_correct:    { type: Boolean },
  points_earned: { type: Number, default: 0 },
};

const module1Def = new mongoose.Schema({
  question_ids: [{ type: mongoose.Schema.Types.ObjectId }],
  answers:      [{ ...answerSchema, _id: false }],
  score:        { type: Number },
  max_score:    { type: Number },
  percentage:   { type: Number },
  started_at:   { type: Date },
  submitted_at: { type: Date },
}, { _id: false });

const module2Def = new mongoose.Schema({
  tier:         { type: String, enum: ['hard', 'easy'] },
  question_ids: [{ type: mongoose.Schema.Types.ObjectId }],
  answers:      [{ ...answerSchema, _id: false }],
  score:        { type: Number },
  max_score:    { type: Number },
  percentage:   { type: Number },
  started_at:   { type: Date },
  submitted_at: { type: Date },
}, { _id: false });

const subjectDef = new mongoose.Schema({
  module_1:   module1Def,
  module_2:   module2Def,
  prefetched: {
    hard: [{ type: mongoose.Schema.Types.ObjectId }],
    easy: [{ type: mongoose.Schema.Types.ObjectId }],
  },
  total_score: { type: Number },
}, { _id: false });

const satTestAttemptSchema = new mongoose.Schema(
  {
    student_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    test_config_id: { type: String, required: true },
    type:           { type: String, enum: ['mock', 'diagnostic'] },
    status: {
      type:    String,
      enum:    [
        'rw_m1_in_progress', 'rw_m1_complete', 'rw_m2_in_progress', 'rw_done',
        'math_m1_in_progress', 'math_m1_complete', 'math_m2_in_progress', 'complete',
      ],
      default: 'rw_m1_in_progress',
    },
    reading_writing: subjectDef,
    math:            subjectDef,
    overall_score:   { type: Number },
  },
  { timestamps: true }
);

satTestAttemptSchema.index({ student_id: 1, test_config_id: 1, status: 1 });

module.exports = mongoose.model('SatTestAttempt', satTestAttemptSchema);
