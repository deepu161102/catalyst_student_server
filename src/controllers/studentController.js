const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const Student  = require('../models/Student');
const Batch    = require('../models/Batch');
const Mentor   = require('../models/Mentor');

// GET /api/students
const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .populate({
        path:     'batchId',
        select:   'name course mentorId',
        populate: { path: 'mentorId', select: 'name email' },
      })
      .lean();
    res.json({ success: true, count: students.length, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/students/:id
const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate({
        path:     'batchId',
        select:   'name course mentorId status totalSessions completedSessions',
        populate: { path: 'mentorId', select: 'name email specialization' },
      })
      .lean();
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/students/:id/mentor
// Returns the mentor + batch info for a student — used by student portal profile/sidebar.
const getStudentMentor = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('batchId').lean();
    if (!student?.batchId) return res.json({ success: true, data: null });

    const batch = await Batch.findById(student.batchId)
      .populate('mentorId', 'name email specialization phone')
      .select('name course mentorId startDate endDate status')
      .lean();

    if (!batch) return res.json({ success: true, data: null });

    res.json({
      success: true,
      data: {
        mentor: batch.mentorId,
        batch:  { _id: batch._id, name: batch.name, course: batch.course, startDate: batch.startDate, endDate: batch.endDate, status: batch.status },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/students/by-mentor/:mentorId
// All students enrolled in any batch owned by this mentor.
// Used by mentor portal (students page, communication auto-load).
const getStudentsByMentor = async (req, res) => {
  try {
    const mentorId = new mongoose.Types.ObjectId(req.params.mentorId);

    // Step 1: mentor's batch IDs (indexed on mentorId)
    const batches  = await Batch.find({ mentorId }).select('_id name course').lean();
    const batchIds = batches.map(b => b._id);

    if (!batchIds.length) return res.json({ success: true, data: [] });

    // Step 2: students in those batches (indexed on batchId)
    const batchMap = Object.fromEntries(batches.map(b => [b._id.toString(), b]));
    const students = await Student
      .find({ batchId: { $in: batchIds } })
      .select('name email phone progress totalSessions completedSessions batchId enrollmentDate isActive')
      .lean();

    // Attach batch info inline so the client doesn't need a second request
    const data = students.map(s => ({
      ...s,
      batch: batchMap[s.batchId?.toString()] || null,
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/students
const createStudent = async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'Password is required' });
    const hashed  = await bcrypt.hash(password, 12);
    const student = await Student.create({ ...rest, password: hashed, enrollmentDate: new Date().toISOString().split('T')[0] });
    const { password: _p, ...studentData } = student.toObject();
    res.status(201).json({ success: true, data: studentData });
  } catch (error) {
    if(error.code === 11000) {
      res.status(400).json({ success: false, message: "Email already exists. Please use a different one." });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/students/:id
const updateStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/students/:id
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllStudents,
  getStudentById,
  getStudentMentor,
  getStudentsByMentor,
  createStudent,
  updateStudent,
  deleteStudent,
};
