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
        path:     'batchIds',
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
        path:     'batchIds',
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
// Returns all {mentor, batch} pairs for a student — used by student portal profile/sidebar.
const getStudentMentor = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('batchIds batchId').lean();

    // Support legacy batchId (single) while batchIds (array) hasn't been migrated yet
    const ids = student?.batchIds?.length ? student.batchIds
              : student?.batchId           ? [student.batchId]
              : [];

    if (!ids.length) return res.json({ success: true, data: [] });

    const batches = await Batch.find({ _id: { $in: ids } })
      .populate('mentorId', 'name email specialization phone')
      .select('name course mentorId startDate endDate status')
      .lean();

    const data = batches
      .filter(b => b.mentorId)
      .map(b => ({
        mentor: b.mentorId,
        batch:  { _id: b._id, name: b.name, course: b.course, startDate: b.startDate, endDate: b.endDate, status: b.status },
      }));

    res.json({ success: true, data });
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

    // Step 2: students in any of those batches — support both old batchId and new batchIds
    const batchMap = Object.fromEntries(batches.map(b => [b._id.toString(), b]));
    const students = await Student
      .find({ $or: [{ batchIds: { $in: batchIds } }, { batchId: { $in: batchIds } }] })
      .select('name email phone progress totalSessions completedSessions batchIds batchId enrollmentDate isActive')
      .lean();

    // Attach only the batches belonging to this mentor
    const data = students.map(s => {
      const allIds = s.batchIds?.length ? s.batchIds : s.batchId ? [s.batchId] : [];
      return {
        ...s,
        batches: allIds
          .filter(id => batchMap[id?.toString()])
          .map(id => batchMap[id?.toString()]),
      };
    });

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
