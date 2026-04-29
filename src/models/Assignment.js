const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const questionSchema = new mongoose.Schema(
  {
    qid:           { type: String, required: true },
    number:        { type: Number, required: true },
    title:         { type: String, required: true },
    description:   { type: String, default: '' },
    topic:         { type: String, default: '' },
    choices:       {
      A: { type: String, default: '' },
      B: { type: String, default: '' },
      C: { type: String, default: '' },
      D: { type: String, default: '' },
    },
    correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    explanation:   { type: String, default: '' },
    score:         { type: Number, default: 1 },
  },
  { _id: false }
);

const moduleSchema = new mongoose.Schema(
  {
    mid:               { type: String, required: true },
    number:            { type: Number, required: true },
    timeLimit:         { type: Number, required: true },
    calculatorAllowed: { type: Boolean, default: false },
    questions:         [questionSchema],
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    sid:     { type: String, required: true },
    name:    { type: String, required: true },
    modules: [moduleSchema],
  },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema(
  {
    assignmentId:    { type: String, unique: true, default: uuidv4 },
    title:           { type: String, required: [true, 'Title is required'], trim: true },
    description:     { type: String, default: '' },
    dueDate:         { type: Date },
    mentorId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Mentor' },
    ownedBy:         { type: String, enum: ['mentor', 'ops'], default: 'mentor' },
    opsId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Operations' },
    status:          { type: String, enum: ['draft', 'published'], default: 'draft' },
    passingScore:    { type: Number, default: 70 },
    rules:           [{ type: String }],
    enrolledBatches:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }],
    sections:           [sectionSchema],
    isActive:           { type: Boolean, default: true },
    isGuestAccessible:  { type: Boolean, default: false },
    assignmentType:     { type: String, enum: ['diagnostic', 'practice', 'full'], default: 'full' },
  },
  { timestamps: true }
);

assignmentSchema.index({ mentorId: 1 });
assignmentSchema.index({ mentorId: 1, status: 1 });
assignmentSchema.index({ opsId: 1 });
assignmentSchema.index({ ownedBy: 1, opsId: 1 });
assignmentSchema.index({ enrolledBatches: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
