const mongoose = require('mongoose');
const Batch   = require('../models/Batch');
const Student = require('../models/Student');
const Mentor  = require('../models/Mentor');

// ── Helpers ───────────────────────────────────────────────────────────────────

// Shared aggregation stages used in list + detail queries.
// Uses a sub-pipeline $lookup so we only COUNT students, never pull their documents
// into memory — the batchId index on Student makes the count O(students_in_batch).
const STUDENT_COUNT_STAGE = {
  $lookup: {
    from: 'students',
    let:  { batchId: '$_id' },
    pipeline: [
      { $match: { $expr: { $eq: ['$batchId', '$$batchId'] } } },
      { $count: 'n' },
    ],
    as: 'studentCountArr',
  },
};

const PROJECT_BATCH = {
  $project: {
    studentCountArr: 0,
    'mentor.password': 0,
  },
};

// ── GET /api/batches ──────────────────────────────────────────────────────────
// List all batches with mentor name + student count.
// Optional query: ?status=active  ?mentorId=<id>
const getAllBatches = async (req, res) => {
  try {
    const match = {};
    if (req.query.status)   match.status   = req.query.status;
    if (req.query.mentorId) match.mentorId = new mongoose.Types.ObjectId(req.query.mentorId);

    const batches = await Batch.aggregate([
      { $match: match },
      // Mentor name — single-doc lookup by _id (always fast)
      {
        $lookup: {
          from:         'mentors',
          localField:   'mentorId',
          foreignField: '_id',
          as:           'mentor',
        },
      },
      { $unwind: { path: '$mentor', preserveNullAndEmptyArrays: true } },
      // Student count via sub-pipeline (no array explosion)
      STUDENT_COUNT_STAGE,
      {
        $addFields: {
          studentCount: { $ifNull: [{ $first: '$studentCountArr.n' }, 0] },
        },
      },
      PROJECT_BATCH,
      { $sort: { createdAt: -1 } },
    ]);

    res.json({ success: true, count: batches.length, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/batches/:id ──────────────────────────────────────────────────────
// Single batch with full student list (name + email + progress only).
const getBatchById = async (req, res) => {
  try {
    const batchId = new mongoose.Types.ObjectId(req.params.id);

    const [batchAgg, students] = await Promise.all([
      Batch.aggregate([
        { $match: { _id: batchId } },
        {
          $lookup: {
            from: 'mentors', localField: 'mentorId', foreignField: '_id', as: 'mentor',
          },
        },
        { $unwind: { path: '$mentor', preserveNullAndEmptyArrays: true } },
        STUDENT_COUNT_STAGE,
        {
          $addFields: {
            studentCount: { $ifNull: [{ $first: '$studentCountArr.n' }, 0] },
          },
        },
        PROJECT_BATCH,
      ]),
      // Students fetched separately — uses the batchId index
      Student.find({ batchId })
        .select('name email phone progress totalSessions completedSessions isActive enrollmentDate')
        .lean(),
    ]);

    if (!batchAgg.length) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    res.json({ success: true, data: { ...batchAgg[0], students } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/batches ─────────────────────────────────────────────────────────
const createBatch = async (req, res) => {
  try {
    const batch = await Batch.create(req.body);
    res.status(201).json({ success: true, data: batch });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── PUT /api/batches/:id ──────────────────────────────────────────────────────
const updateBatch = async (req, res) => {
  try {
    // Prevent accidental overwrite of computed fields
    delete req.body.studentCount;

    const batch = await Batch.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── DELETE /api/batches/:id ───────────────────────────────────────────────────
// Refuses deletion if students are still enrolled.
const deleteBatch = async (req, res) => {
  try {
    const count = await Student.countDocuments({ batchId: req.params.id });
    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete batch: ${count} student(s) still enrolled. Remove them first.`,
      });
    }
    const batch = await Batch.findByIdAndDelete(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    res.json({ success: true, message: 'Batch deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/batches/:id/students ────────────────────────────────────────────
// Enroll a student in this batch (sets student.batchId).
const addStudentToBatch = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ success: false, message: 'studentId is required' });

    const batch = await Batch.findById(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

    const student = await Student.findByIdAndUpdate(
      studentId,
      { batchId: batch._id },
      { new: true }
    ).select('name email batchId');

    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    res.json({ success: true, data: student });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── DELETE /api/batches/:id/students/:studentId ───────────────────────────────
// Remove a student from this batch (clears student.batchId).
const removeStudentFromBatch = async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: req.params.studentId, batchId: req.params.id },
      { batchId: null },
      { new: true }
    ).select('name email batchId');

    if (!student) return res.status(404).json({ success: false, message: 'Student not found in this batch' });
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── GET /api/mentors ──────────────────────────────────────────────────────────
// List all mentors (used by ops portal for dropdowns).
const getAllMentors = async (req, res) => {
  try {
    const mentors = await Mentor.find().select('name email specialization role isActive').lean();
    res.json({ success: true, data: mentors });
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
  addStudentToBatch,
  removeStudentFromBatch,
  getAllMentors,
};
