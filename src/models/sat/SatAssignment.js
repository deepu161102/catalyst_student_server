const mongoose = require('mongoose');

const satAssignmentSchema = new mongoose.Schema(
  {
    assigned_by:                { type: mongoose.Schema.Types.ObjectId, required: true },
    assigned_by_role:           { type: String, enum: ['mentor', 'operations'], required: true },
    student_id:                 { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    test_type:                  { type: String, enum: ['subject', 'full_length', 'practice'], required: true },
    exam_config_id:             { type: mongoose.Schema.Types.ObjectId, ref: 'SatExamConfig' },
    full_length_exam_config_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SatFullLengthExamConfig' },
    practice_config_id:         { type: mongoose.Schema.Types.ObjectId, ref: 'SatPracticeTestConfig' },
    due_date:                   { type: Date },
    status:                     { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    session_id:                 { type: mongoose.Schema.Types.ObjectId },
    is_active:                  { type: Boolean, default: true },
  },
  { timestamps: true }
);

satAssignmentSchema.index({ student_id: 1, status: 1 });
satAssignmentSchema.index({ assigned_by: 1 });
satAssignmentSchema.index({ exam_config_id: 1 });

module.exports = mongoose.model('SatAssignment', satAssignmentSchema);
