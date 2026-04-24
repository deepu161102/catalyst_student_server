const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const studentSchema = new mongoose.Schema(
  {
    userId:            { type: String, unique: true, default: uuidv4 },
    name:              { type: String, required: [true, 'Name is required'], trim: true },
    email:             { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    password:          { type: String, select: false },
    phone:             { type: String },
    enrollmentDate:    { type: String },
    // A student can be enrolled in multiple batches (one per subject/mentor)
    batchIds:          [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }],
    // Student-level progress (owned by student, not batch)
    progress:          { type: Number, default: 0 },
    totalSessions:     { type: Number, default: 0 },
    completedSessions: { type: Number, default: 0 },
    upcomingSessions:  { type: Number, default: 0 },
    isActive:          { type: Boolean, default: true },
  },
  { timestamps: true }
);

studentSchema.index({ batchIds: 1 });
studentSchema.index({ batchIds: 1, isActive: 1 });

module.exports = mongoose.model('Student', studentSchema);
