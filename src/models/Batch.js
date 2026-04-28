const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const batchSchema = new mongoose.Schema(
  {
    batchId:           { type: String, unique: true, default: uuidv4 },
    name:              { type: String, required: [true, 'Batch name is required'], trim: true },
    subject:           { type: String, enum: ['english', 'maths'], required: [true, 'Subject is required'] },
    mentorId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Mentor', required: [true, 'Mentor is required'] },
    studentId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: [true, 'Student is required'] },
    startDate:         { type: Date },
    endDate:           { type: Date },
    status:            { type: String, enum: ['upcoming', 'active', 'completed'], default: 'active' },
    totalSessions:     { type: Number, default: 60 },
    completedSessions: { type: Number, default: 0 },
    description:       { type: String, trim: true },
  },
  { timestamps: true }
);

batchSchema.index({ mentorId: 1 });
batchSchema.index({ mentorId: 1, status: 1 });
batchSchema.index({ studentId: 1 });
batchSchema.index({ studentId: 1, status: 1 });
batchSchema.index({ status: 1 });

module.exports = mongoose.model('Batch', batchSchema);
