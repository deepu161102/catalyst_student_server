const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const mentorSchema = new mongoose.Schema({
  mentorId:       { type: String },
  name:           { type: String },
  specialisation: { type: String },
  experience:     { type: String },
  email:          { type: String },
  phone:          { type: String },
}, { _id: false });

const studentSchema = new mongoose.Schema(
  {
    userId:           { type: String, unique: true, default: uuidv4 },
    name:             { type: String, required: [true, 'Name is required'], trim: true },
    email:            { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    password:         { type: String, select: false },
    phone:            { type: String },
    course:           { type: String },
    batch:            { type: String },
    enrollmentDate:   { type: String },
    progress:         { type: Number, default: 0 },
    totalSessions:    { type: Number, default: 0 },
    completedSessions:{ type: Number, default: 0 },
    upcomingSessions: { type: Number, default: 0 },
    mentor:           { type: mentorSchema },
    isActive:         { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
