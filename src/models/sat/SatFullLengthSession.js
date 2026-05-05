const mongoose = require('mongoose');

const satFullLengthSessionSchema = new mongoose.Schema(
  {
    student_id:                 { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    full_length_exam_config_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SatFullLengthExamConfig', required: true },
    assignment_id:              { type: mongoose.Schema.Types.ObjectId, ref: 'SatAssignment' },
    math_session_id:            { type: mongoose.Schema.Types.ObjectId, ref: 'SatTestSession' },
    rw_session_id:              { type: mongoose.Schema.Types.ObjectId, ref: 'SatTestSession' },
    status:                     { type: String, enum: ['in_progress', 'complete'], default: 'in_progress' },
    total_score:                { type: Number },
  },
  { timestamps: true }
);

satFullLengthSessionSchema.index({ student_id: 1, status: 1 });

module.exports = mongoose.model('SatFullLengthSession', satFullLengthSessionSchema);
