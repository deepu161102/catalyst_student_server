const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const batchSchema = new mongoose.Schema(
  {
    batchId:           { type: String, unique: true, default: uuidv4 },
    name:              { type: String, required: [true, 'Batch name is required'], trim: true },
    course:            { type: String, required: [true, 'Course is required'], trim: true },
    mentorId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Mentor', required: [true, 'Mentor is required'] },
    startDate:         { type: Date },
    endDate:           { type: Date },
    status:            { type: String, enum: ['upcoming', 'active', 'completed'], default: 'active' },
    totalSessions:     { type: Number, default: 60 },
    completedSessions: { type: Number, default: 0 },
    description:       { type: String, trim: true },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Primary access pattern: "all batches for mentor X"
batchSchema.index({ mentorId: 1 });
// Filtered: "active batches for mentor X" — covers mentorId-only queries too
batchSchema.index({ mentorId: 1, status: 1 });
// Ops dashboard: "all active batches across platform"
batchSchema.index({ status: 1 });

module.exports = mongoose.model('Batch', batchSchema);
