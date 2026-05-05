const mongoose = require('mongoose');

const satFullLengthExamConfigSchema = new mongoose.Schema(
  {
    name:               { type: String, required: true, trim: true },
    math_exam_config_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SatExamConfig', required: true },
    rw_exam_config_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'SatExamConfig', required: true },
    is_active:           { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SatFullLengthExamConfig', satFullLengthExamConfigSchema);
