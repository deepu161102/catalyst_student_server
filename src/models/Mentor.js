const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const mentorSchema = new mongoose.Schema(
  {
    mentorId:       { type: String, unique: true, default: uuidv4 },
    name:           { type: String, required: [true, 'Name is required'], trim: true },
    email:          { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    password:       { type: String, select: false },
    role:           { type: String, default: 'mentor' },
    specialization: { type: String },
    experience:     { type: Number, default: 0 },
    bio:            { type: String },
    linkedin:       { type: String },
    phone:          { type: String },
    isActive:       { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Mentor', mentorSchema);
