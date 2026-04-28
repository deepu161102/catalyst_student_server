const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const operationsSchema = new mongoose.Schema(
  {
    userId:   { type: String, unique: true, default: uuidv4 },
    name:     { type: String, required: [true, 'Name is required'], trim: true },
    email:    { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    role:     { type: String, default: 'operations' },
    phone:    { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Operations', operationsSchema);
