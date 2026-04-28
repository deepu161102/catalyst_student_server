const mongoose = require('mongoose');
const Batch   = require('../models/Batch');
const Student = require('../models/Student');
const Mentor  = require('../models/Mentor');

const MENTOR_SELECT  = '-password';
const STUDENT_SELECT = 'name email phone isActive enrollmentDate';

// Adds backward-compat aliases so frontend can use batch.mentor / batch.student / batch.students
function attachAliases(batch) {
  return {
    ...batch,
    mentor:       batch.mentorId,
    student:      batch.studentId,
    students:     batch.studentId ? [batch.studentId] : [],
    studentCount: batch.studentId ? 1 : 0,
  };
}

// ── GET /api/batches ──────────────────────────────────────────────────────────
const getAllBatches = async (req, res) => {
  try {
    const match = {};
    if (req.query.status)    match.status    = req.query.status;
    if (req.query.mentorId)  match.mentorId  = new mongoose.Types.ObjectId(req.query.mentorId);
    if (req.query.studentId) match.studentId = new mongoose.Types.ObjectId(req.query.studentId);

    const batches = await Batch.find(match)
      .populate('mentorId', MENTOR_SELECT)
      .populate('studentId', STUDENT_SELECT)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: batches.length, data: batches.map(attachAliases) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/batches/:id ──────────────────────────────────────────────────────
const getBatchById = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate('mentorId', MENTOR_SELECT)
      .populate('studentId', STUDENT_SELECT)
      .lean();

    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    res.json({ success: true, data: attachAliases(batch) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/batches ─────────────────────────────────────────────────────────
const createBatch = async (req, res) => {
  try {
    const { mentorId, studentId, subject } = req.body;
    if (!mentorId)  return res.status(400).json({ success: false, message: 'mentorId is required' });
    if (!studentId) return res.status(400).json({ success: false, message: 'studentId is required' });
    if (!subject)   return res.status(400).json({ success: false, message: 'subject is required' });

    const [mentor, student] = await Promise.all([
      Mentor.findById(mentorId),
      Student.findById(studentId),
    ]);
    if (!mentor)  return res.status(404).json({ success: false, message: 'Mentor not found' });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const batch = await Batch.create(req.body);
    await batch.populate([
      { path: 'mentorId',  select: MENTOR_SELECT },
      { path: 'studentId', select: STUDENT_SELECT },
    ]);

    res.status(201).json({ success: true, data: attachAliases(batch.toObject()) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── PUT /api/batches/:id ──────────────────────────────────────────────────────
const updateBatch = async (req, res) => {
  try {
    const batch = await Batch.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    })
      .populate('mentorId', MENTOR_SELECT)
      .populate('studentId', STUDENT_SELECT);

    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    res.json({ success: true, data: attachAliases(batch.toObject()) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── DELETE /api/batches/:id ───────────────────────────────────────────────────
const deleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findByIdAndDelete(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    res.json({ success: true, message: 'Batch deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/batches/by-student/:studentId ────────────────────────────────────
// Student portal: all batches for a student with mentor details populated.
const getBatchesByStudent = async (req, res) => {
  try {
    const batches = await Batch.find({ studentId: req.params.studentId })
      .populate('mentorId', MENTOR_SELECT)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: batches.length, data: batches.map(attachAliases) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/batches/mentors ──────────────────────────────────────────────────
// Ops dropdown: list all mentors.
const getAllMentors = async (req, res) => {
  try {
    const mentors = await Mentor.find().select('name email specialization role isActive').lean();
    res.json({ success: true, data: mentors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/batches/students ─────────────────────────────────────────────────
// Ops dropdown: list all students for batch creation.
const getAllStudentsForOps = async (req, res) => {
  try {
    const students = await Student.find().select('name email phone isActive enrollmentDate').lean();
    res.json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
  getBatchesByStudent,
  getAllMentors,
  getAllStudentsForOps,
};
