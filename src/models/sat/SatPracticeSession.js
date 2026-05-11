const mongoose = require('mongoose');

const practiceAnswerSchema = {
  question_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'SatQuestionBank' },
  selected:      { type: String, default: null },
  is_correct:    { type: Boolean },
  points_earned: { type: Number, default: 0 },
};

const satPracticeSessionSchema = new mongoose.Schema(
  {
    student_id:         { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    practice_config_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SatPracticeTestConfig', required: true },
    assignment_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'SatAssignment' },
    subject:            { type: String },
    sub_topic:          { type: String },
    status:             { type: String, enum: ['in_progress', 'complete'], default: 'in_progress' },
    question_ids:       [{ type: mongoose.Schema.Types.ObjectId }],
    answers:            [{ ...practiceAnswerSchema, _id: false }],
    score:              { type: Number },
    max_score:          { type: Number },
    percentage:         { type: Number },
    started_at:         { type: Date },
    submitted_at:       { type: Date },
  },
  { timestamps: true }
);

satPracticeSessionSchema.index({ student_id: 1, status: 1 });
satPracticeSessionSchema.index({ practice_config_id: 1 });

module.exports = mongoose.model('SatPracticeSession', satPracticeSessionSchema);
