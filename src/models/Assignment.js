const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  qid:           { type: String, default: null },
  number:        { type: Number },
  title:         { type: String },
  description:   { type: String, default: null },
  image:         { type: String, default: null },
  choices: {
    A: { type: String },
    B: { type: String },
    C: { type: String },
    D: { type: String },
  },
  correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'] },
  explanation:   { type: String },
  score:         { type: Number, default: 1 },
}, { _id: false });

const moduleSchema = new mongoose.Schema({
  mid:               { type: String, default: null },
  number:            { type: Number },
  timeLimit:         { type: Number },
  calculatorAllowed: { type: Boolean, default: false },
  questions:         [questionSchema],
}, { _id: false });

const sectionSchema = new mongoose.Schema({
  sid:     { type: String, default: null },
  name:    { type: String },
  modules: [moduleSchema],
}, { _id: false });

const assignmentSchema = new mongoose.Schema(
  {
    title:           { type: String, required: [true, 'Title is required'], trim: true },
    description:     { type: String, default: '' },
    type:            { type: String, enum: ['SAT'], default: 'SAT' },
    status:          { type: String, enum: ['draft', 'published'], default: 'draft' },
    batchId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null },
    enrolledBatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }],
    assignedTo:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'Mentor', required: true },
    dueDate:         { type: Date, default: null },
    passingScore:    { type: Number, default: 70 },
    rules:           [{ type: String }],
    sections:        [sectionSchema],
  },
  { timestamps: true }
);

assignmentSchema.index({ createdBy: 1 });
assignmentSchema.index({ status: 1 });
assignmentSchema.index({ enrolledBatches: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
