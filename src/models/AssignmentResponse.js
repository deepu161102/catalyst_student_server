const mongoose = require('mongoose');

const assignmentResponseSchema = new mongoose.Schema(
  {
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: [true, 'Assignment is required'] },
    studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student',    required: [true, 'Student is required'] },
    answer:       { type: String, trim: true },
    submittedAt:  { type: Date, default: Date.now },
    score:        { type: Number },
    feedback:     { type: String, trim: true },
    status:       { type: String, enum: ['submitted', 'graded'], default: 'submitted' },
  },
  { timestamps: true }
);

assignmentResponseSchema.index({ assignmentId: 1 });
assignmentResponseSchema.index({ studentId: 1 });
assignmentResponseSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('AssignmentResponse', assignmentResponseSchema);
