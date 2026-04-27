const Assignment = require('../models/Assignment');

// GET /api/assignments?mentorId=xxx
const getAllAssignments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.mentorId) filter.createdBy = req.query.mentorId;

    const assignments = await Assignment.find(filter)
      .populate('batchId', 'name course')
      .populate('enrolledBatches', 'name course')
      .populate('createdBy', 'name email')
      .select('-sections')
      .lean();
    res.json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/assignments/batch/:batchId
const getAssignmentsByBatch = async (req, res) => {
  try {
    const assignments = await Assignment.find({
      $or: [
        { batchId: req.params.batchId },
        { enrolledBatches: req.params.batchId },
      ],
    })
      .populate('createdBy', 'name email')
      .lean();

    // Strip answer-revealing fields before sending to students
    const sanitized = assignments.map((a) => ({
      ...a,
      sections: (a.sections || []).map((s) => ({
        ...s,
        modules: (s.modules || []).map((m) => ({
          ...m,
          questions: (m.questions || []).map(({ correctAnswer, explanation, ...q }) => q),
        })),
      })),
    }));

    res.json({ success: true, count: sanitized.length, data: sanitized });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/assignments/:id
const getAssignmentById = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('batchId', 'name course')
      .populate('enrolledBatches', 'name course')
      .populate('createdBy', 'name email')
      .lean();
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/assignments
const createAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.create({
      ...req.body,
      createdBy: req.userId,
    });
    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/assignments/:id
const updateAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, data: assignment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/assignments/:id/status
const setAssignmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'published'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be draft or published' });
    }
    const assignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, data: assignment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// POST /api/assignments/:id/enroll
const enrollBatches = async (req, res) => {
  try {
    const { batchIds } = req.body;
    const assignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      { enrolledBatches: batchIds },
      { new: true }
    ).populate('enrolledBatches', 'name course');
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, data: assignment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/assignments/:id
const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllAssignments,
  getAssignmentsByBatch,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  setAssignmentStatus,
  enrollBatches,
  deleteAssignment,
};
