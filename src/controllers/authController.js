const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const Student  = require('../models/Student');

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,           // HTTPS only in prod
  sameSite: isProd ? 'none' : 'lax', // 'none' required for cross-origin cookies
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days in ms
};

const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_dev_secret', { expiresIn: '7d' });

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const student = await Student.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!student || !student.password) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken(student._id);

    // Set httpOnly cookie (browser uses this automatically)
    res.cookie('token', token, COOKIE_OPTS);

    const { password: _p, ...data } = student.toObject();
    // Also return token in body so Postman can use it via Authorization header
    res.json({ success: true, token, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/logout
const logout = (_req, res) => {
  res.clearCookie('token', COOKIE_OPTS);
  res.json({ success: true, message: 'Logged out' });
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const student = await Student.findById(req.userId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/auth/me
const updateMe = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const student = await Student.findByIdAndUpdate(
        req.userId,
        { name: name.trim() },
        { new: true, runValidators: true }
    );
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { login, logout, getMe, updateMe };

