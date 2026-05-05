const mongoose = require('mongoose');

const answerSchema = {
  question_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'SatQuestionBank' },
  selected:      { type: String, default: null },
  is_correct:    { type: Boolean },
  points_earned: { type: Number, default: 0 },
};

const satTestSessionSchema = new mongoose.Schema(
  {
    student_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    exam_config_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SatExamConfig', required: true },
    assignment_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'SatAssignment' },
    subject:        { type: String, enum: ['math', 'reading_writing'], required: true },
    status: {
      type:    String,
      enum:    ['m1_in_progress', 'm1_complete', 'm2_in_progress', 'complete'],
      default: 'm1_in_progress',
    },
    module_1: {
      question_ids: [{ type: mongoose.Schema.Types.ObjectId }],
      answers:      [{ ...answerSchema, _id: false }],
      score:        { type: Number },
      max_score:    { type: Number },
      percentage:   { type: Number },
      started_at:   { type: Date },
      submitted_at: { type: Date },
    },
    module_2: {
      tier:         { type: String, enum: ['hard', 'medium', 'easy'] },
      question_ids: [{ type: mongoose.Schema.Types.ObjectId }],
      answers:      [{ ...answerSchema, _id: false }],
      score:        { type: Number },
      max_score:    { type: Number },
      percentage:   { type: Number },
      started_at:   { type: Date },
      submitted_at: { type: Date },
    },
    prefetched: {
      hard:   [{ type: mongoose.Schema.Types.ObjectId }],
      medium: [{ type: mongoose.Schema.Types.ObjectId }],
      easy:   [{ type: mongoose.Schema.Types.ObjectId }],
    },
    total_score:              { type: Number },
    full_length_session_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'SatFullLengthSession' },
  },
  { timestamps: true }
);

satTestSessionSchema.index({ student_id: 1, status: 1 });
satTestSessionSchema.index({ assignment_id: 1 });

module.exports = mongoose.model('SatTestSession', satTestSessionSchema);
