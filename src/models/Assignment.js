const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    title:       { type: String, required: [true, 'Title is required'], trim: true },
    description: { type: String, trim: true },
    dueDate:     { type: Date },
    batchId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: [true, 'Batch is required'] },
    mentorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Mentor', required: [true, 'Mentor is required'] },
    maxScore:    { type: Number, default: 100 },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

assignmentSchema.index({ batchId: 1 });
assignmentSchema.index({ mentorId: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
