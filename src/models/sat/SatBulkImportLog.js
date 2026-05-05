const mongoose = require('mongoose');

const satBulkImportLogSchema = new mongoose.Schema(
  {
    uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Operations', required: true },
    file_name:   { type: String },
    subject:     { type: String },
    total_rows:  { type: Number },
    successful:  { type: Number },
    failed:      { type: Number },
    row_errors:  [{ row_number: Number, reason: String, _id: false }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('SatBulkImportLog', satBulkImportLogSchema);
