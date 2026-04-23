const bcrypt = require('bcryptjs');
const Mentor = require('../models/Mentor');
const Batch  = require('../models/Batch');

// GET /api/mentors
const getAllMentors = async (req, res) => {
  try {
    const mentors = await Mentor.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'batches',
          localField: '_id',
          foreignField: 'mentorId',
          as: 'batches',
        },
      },
      { $addFields: { batchCount: { $size: '$batches' } } },
      { $project: { batches: 0, password: 0 } },
    ]);
    res.json({ success: true, count: mentors.length, data: mentors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/mentors/:id
const getMentorById = async (req, res) => {
  try {
    const mentor = await Mentor.findById(req.params.id).lean();
    if (!mentor) return res.status(404).json({ success: false, message: 'Mentor not found' });
    const batchCount = await Batch.countDocuments({ mentorId: req.params.id });
    res.json({ success: true, data: { ...mentor, batchCount } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/mentors
const createMentor = async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'Password is required' });
    const hashed = await bcrypt.hash(password, 12);
    const mentor = await Mentor.create({ ...rest, password: hashed, role: 'mentor' });
    const { password: _p, ...mentorData } = mentor.toObject();
    res.status(201).json({ success: true, data: mentorData });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/mentors/:id
const updateMentor = async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const mentor = await Mentor.findByIdAndUpdate(req.params.id, rest, { new: true, runValidators: true });
    if (!mentor) return res.status(404).json({ success: false, message: 'Mentor not found' });
    res.json({ success: true, data: mentor });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/mentors/:id
const deleteMentor = async (req, res) => {
  try {
    const batchCount = await Batch.countDocuments({ mentorId: req.params.id });
    if (batchCount > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete — mentor is assigned to ${batchCount} batch(es)` });
    }
    const mentor = await Mentor.findByIdAndDelete(req.params.id);
    if (!mentor) return res.status(404).json({ success: false, message: 'Mentor not found' });
    res.json({ success: true, message: 'Mentor deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllMentors, getMentorById, createMentor, updateMentor, deleteMentor };
