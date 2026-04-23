const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const Student    = require('../models/Student');
const Mentor     = require('../models/Mentor');
const Operations = require('../models/Operations');

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   isProd,
  sameSite: isProd ? 'none' : 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000,
};

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET || 'fallback_dev_secret', { expiresIn: '7d' });

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Try Student → Mentor → Operations
    let user = await Student.findOne({ email: normalizedEmail }).select('+password');
    let role = 'student';

    if (!user) {
      user = await Mentor.findOne({ email: normalizedEmail }).select('+password');
      role = 'mentor';
    }

    if (!user) {
      user = await Operations.findOne({ email: normalizedEmail }).select('+password');
      role = 'operations';
    }

    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken(user._id, role);
    res.cookie('token', token, COOKIE_OPTS);

    const { password: _p, ...rest } = user.toObject();
    res.json({ success: true, token, data: { ...rest, role } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/logout
const logout = (_req, res) => {
  res.clearCookie('token', COOKIE_OPTS);
  res.json({ success: true, message: 'Logged out' });
};

const getModel = (role) => role === 'student' ? Student : role === 'mentor' ? Mentor : Operations;

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const Model = getModel(req.userRole);
    const user  = await Model.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: { ...user.toObject(), role: req.userRole } });
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
    const Model = getModel(req.userRole);
    const user  = await Model.findByIdAndUpdate(
      req.userId,
      { name: name.trim() },
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: { ...user.toObject(), role: req.userRole } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { login, logout, getMe, updateMe };
