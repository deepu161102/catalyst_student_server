const mongoose = require('mongoose');

const satStudentQuestionHistorySchema = new mongoose.Schema(
  {
    student_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    subject:           { type: String, enum: ['math', 'reading_writing'], required: true },
    seen_question_ids: [{ type: mongoose.Schema.Types.ObjectId }],
  },
  { timestamps: true }
);

satStudentQuestionHistorySchema.index({ student_id: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model('SatStudentQuestionHistory', satStudentQuestionHistorySchema);
