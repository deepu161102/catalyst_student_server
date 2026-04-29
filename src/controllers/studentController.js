const bcrypt  = require('bcryptjs');
const Student = require('../models/Student');
const Batch   = require('../models/Batch');

// GET /api/students
const getAllStudents = async (req, res) => {
  try {
    const [students, batches] = await Promise.all([
      Student.find().lean(),
      Batch.find()
        .populate('mentorId', 'name email')
        .select('name subject status studentId mentorId')
        .lean(),
    ]);
    const batchesByStudent = {};
    for (const b of batches) {
      if (b.studentId) {
        const key = b.studentId.toString();
        if (!batchesByStudent[key]) batchesByStudent[key] = [];
        batchesByStudent[key].push(b);
      }
    }
    const data = students.map(s => ({ ...s, batches: batchesByStudent[s._id.toString()] || [] }));
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/students/:id
const getStudentById = async (req, res) => {
  try {
    const [student, batches] = await Promise.all([
      Student.findById(req.params.id).lean(),
      Batch.find({ studentId: req.params.id })
        .populate('mentorId', 'name email specialization')
        .select('name subject mentorId status totalSessions completedSessions startDate endDate')
        .lean(),
    ]);

    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: { ...student, batches } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/students/:id/mentor
// Returns all { mentor, batch } pairs for a student — used by student portal profile/sidebar.
const getStudentMentor = async (req, res) => {
  try {
    const batches = await Batch.find({ studentId: req.params.id })
      .populate('mentorId', 'name email specialization phone')
      .select('name subject mentorId startDate endDate status')
      .lean();

    const data = batches
      .filter(b => b.mentorId)
      .map(b => ({
        mentor: b.mentorId,
        batch:  { _id: b._id, name: b.name, subject: b.subject, startDate: b.startDate, endDate: b.endDate, status: b.status },
      }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/students/by-mentor/:mentorId
// All students in any of this mentor's batches — used by mentor portal.
const getStudentsByMentor = async (req, res) => {
  try {
    const batches = await Batch.find({ mentorId: req.params.mentorId })
      .populate('studentId', 'name email phone progress totalSessions completedSessions enrollmentDate isActive')
      .select('name subject studentId status startDate endDate totalSessions completedSessions')
      .lean();

    const data = batches
      .filter(b => b.studentId)
      .map(b => ({
        student: b.studentId,
        batch: {
          _id:               b._id,
          name:              b.name,
          subject:           b.subject,
          status:            b.status,
          startDate:         b.startDate,
          endDate:           b.endDate,
          totalSessions:     b.totalSessions,
          completedSessions: b.completedSessions,
        },
      }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/students
const createStudent = async (req, res) => {
  try {
    const { password, email, ...rest } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'Password is required' });

    const normalizedEmail = email?.toLowerCase().trim();

    // If a guest account already exists with this email, promote it instead of erroring
    const existing = await Student.findOne({ email: normalizedEmail });
    if (existing) {
      if (existing.accountType === 'guest') {
        const hashed  = await bcrypt.hash(password, 12);
        const updated = await Student.findByIdAndUpdate(
          existing._id,
          {
            ...rest,
            password:       hashed,
            accountType:    'student',
            isActive:       true,
            enrollmentDate: new Date().toISOString().split('T')[0],
          },
          { new: true, runValidators: true }
        );
        const { password: _p, ...studentData } = updated.toObject();
        return res.status(201).json({ success: true, data: studentData, promoted: true });
      }
      return res.status(400).json({ success: false, message: 'Email already exists. Please use a different one.' });
    }

    const hashed  = await bcrypt.hash(password, 12);
    const student = await Student.create({
      ...rest,
      email:          normalizedEmail,
      password:       hashed,
      accountType:    'student',
      enrollmentDate: new Date().toISOString().split('T')[0],
    });
    const { password: _p, ...studentData } = student.toObject();
    res.status(201).json({ success: true, data: studentData });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already exists. Please use a different one.' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/students/:id/grant-access
const grantAccess = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    if (student.accountType === 'student' && student.isActive) {
      return res.status(400).json({ success: false, message: 'Student already has full access' });
    }

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      {
        accountType:    'student',
        isActive:       true,
        enrollmentDate: student.enrollmentDate || new Date().toISOString().split('T')[0],
      },
      { new: true }
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
  grantAccess,
};
