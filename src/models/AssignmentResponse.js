const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionNumber: { type: Number, required: true },
  selectedAnswer: { type: String, enum: ['A', 'B', 'C', 'D', null], default: null },
}, { _id: false });

const moduleResponseSchema = new mongoose.Schema({
  moduleNumber:     { type: Number, required: true },
  startedAt:        { type: Date, default: null },
  submittedAt:      { type: Date, default: null },
  timeTakenSeconds: { type: Number, default: null },
  answers:          [answerSchema],
  score:            { type: Number, default: 0 },
}, { _id: false });

const sectionResponseSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  modules: [moduleResponseSchema],
}, { _id: false });

const assignmentResponseSchema = new mongoose.Schema(
  {
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    batchId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    status:       { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
    startedAt:    { type: Date, default: null },
    submittedAt:  { type: Date, default: null },
    sections:     [sectionResponseSchema],
    totalScore: {
      readingWriting: { type: Number, default: 0 },
      math:           { type: Number, default: 0 },
      overall:        { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

assignmentResponseSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
assignmentResponseSchema.index({ batchId: 1 });
assignmentResponseSchema.index({ studentId: 1 });

module.exports = mongoose.model('AssignmentResponse', assignmentResponseSchema);
