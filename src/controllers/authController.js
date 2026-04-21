const jwt = require('jsonwebtoken');
const Student = require('../models/Student');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }
  const student = await Student.findOne({ email }).select('+password');
  if (!student || !(await student.matchPassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }
  const token = signToken(student._id);
  const { password: _p, ...data } = student.toObject();
  res.json({ success: true, token, data });
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const student = await Student.create(req.body);
    const token = signToken(student._id);
    const { password: _p, ...data } = student.toObject();
    res.status(201).json({ success: true, token, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ success: true, data: req.student });
};

module.exports = { login, register, getMe };
