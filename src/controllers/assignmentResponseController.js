const AssignmentResponse = require('../models/AssignmentResponse');

// GET /api/assignment-responses?assignmentId=&studentId=
const getResponses = async (req, res) => {
  try {
    const filter = {};
    if (req.query.assignmentId) filter.assignmentId = req.query.assignmentId;
    if (req.query.studentId)    filter.studentId    = req.query.studentId;

    const responses = await AssignmentResponse.find(filter)
      .populate('assignmentId', 'title dueDate maxScore')
      .populate('studentId',    'name email')
      .sort({ submittedAt: -1 })
      .lean();

    res.json({ success: true, count: responses.length, data: responses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/assignment-responses/:id
const getResponseById = async (req, res) => {
  try {
    const response = await AssignmentResponse.findById(req.params.id)
      .populate('assignmentId', 'title dueDate maxScore')
      .populate('studentId',    'name email')
      .lean();

    if (!response) return res.status(404).json({ success: false, message: 'Response not found' });
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/assignment-responses
const createResponse = async (req, res) => {
  try {
    const response = await AssignmentResponse.create(req.body);
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/assignment-responses/:id  (grade / update)
const updateResponse = async (req, res) => {
  try {
    const response = await AssignmentResponse.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!response) return res.status(404).json({ success: false, message: 'Response not found' });
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/assignment-responses/:id
const deleteResponse = async (req, res) => {
  try {
    const response = await AssignmentResponse.findByIdAndDelete(req.params.id);
    if (!response) return res.status(404).json({ success: false, message: 'Response not found' });
    res.json({ success: true, message: 'Response deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getResponses, getResponseById, createResponse, updateResponse, deleteResponse };
