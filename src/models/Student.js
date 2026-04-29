const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const studentSchema = new mongoose.Schema(
  {
    userId:            { type: String, unique: true, default: uuidv4 },
    name:              { type: String, required: [true, 'Name is required'], trim: true },
    email:             { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    password:          { type: String, select: false },
    phone:             { type: String },
    grade:             { type: String },
    targetYear:        { type: String },
    city:              { type: String },
    parentName:        { type: String },
    parentPhone:       { type: String },
    accountType:       { type: String, enum: ['guest', 'student'], default: 'student' },
    enrollmentDate:    { type: String },
    progress:          { type: Number, default: 0 },
    totalSessions:     { type: Number, default: 0 },
    completedSessions: { type: Number, default: 0 },
    upcomingSessions:  { type: Number, default: 0 },
    isActive:          { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
