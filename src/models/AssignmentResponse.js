const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const answerSchema = new mongoose.Schema(
  {
    qid:      { type: String, required: true },
    selected: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
  },
  { _id: false }
);

const moduleResponseSchema = new mongoose.Schema(
  {
    mid:            { type: String, required: true },
    moduleNumber:   { type: Number, required: true },
    answers:        [answerSchema],
    score:          { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
  },
  { _id: false }
);

const sectionResponseSchema = new mongoose.Schema(
  {
    sid:            { type: String, required: true },
    moduleResponses:[moduleResponseSchema],
    sectionScore:   { type: Number, default: 0 },
  },
  { _id: false }
);

const assignmentResponseSchema = new mongoose.Schema(
  {
    responseId:      { type: String, unique: true, default: uuidv4 },
    assignmentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: [true, 'Assignment is required'] },
    studentId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Student',    required: [true, 'Student is required'] },
    batchId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Batch',      default: null },
    status:          { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
    startedAt:       { type: Date, default: Date.now },
    submittedAt:     { type: Date },
    sectionResponses:[sectionResponseSchema],
    overallScore:    { type: Number, default: 0 },
    maxScore:        { type: Number, default: 0 },
    percentage:      { type: Number, default: 0 },
    passed:          { type: Boolean, default: false },
  },
  { timestamps: true }
);

assignmentResponseSchema.index({ assignmentId: 1 });
assignmentResponseSchema.index({ studentId: 1 });
assignmentResponseSchema.index({ batchId: 1 });
assignmentResponseSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('AssignmentResponse', assignmentResponseSchema);
