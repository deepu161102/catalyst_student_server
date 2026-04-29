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
    let role = user?.accountType === 'guest' ? 'guest' : 'student';

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

// POST /api/auth/guest-signup
const guestSignup = async (req, res) => {
  try {
    const { name, email, password, phone, grade, targetYear, city, parentName, parentPhone } = req.body;

    if (!name?.trim())  return res.status(400).json({ success: false, message: 'Name is required' });
    if (!email?.trim()) return res.status(400).json({ success: false, message: 'Email is required' });
    if (!password)      return res.status(400).json({ success: false, message: 'Password is required' });
    if (!phone?.trim()) return res.status(400).json({ success: false, message: 'Phone number is required' });
    if (!grade?.trim()) return res.status(400).json({ success: false, message: 'Grade is required' });

    const normalizedEmail = email.toLowerCase().trim();

    // If email already exists as a guest, don't create duplicate — just log them in
    const existing = await Student.findOne({ email: normalizedEmail }).select('+password');
    if (existing) {
      if (existing.accountType === 'student') {
        return res.status(400).json({ success: false, message: 'An account with this email already exists. Please sign in.' });
      }
      // Already a guest — treat as re-registration attempt, just sign them in
      const token = signToken(existing._id, 'guest');
      res.cookie('token', token, COOKIE_OPTS);
      const { password: _p, ...rest } = existing.toObject();
      return res.json({ success: true, token, data: { ...rest, role: 'guest' } });
    }

    const hashed  = await bcrypt.hash(password, 12);
    const student = await Student.create({
      name:        name.trim(),
      email:       normalizedEmail,
      password:    hashed,
      phone,
      grade,
      targetYear,
      city,
      parentName,
      parentPhone,
      accountType: 'guest',
      isActive:    false,
    });

    const token = signToken(student._id, 'guest');
    res.cookie('token', token, COOKIE_OPTS);

    const { password: _p, ...studentData } = student.toObject();
    res.status(201).json({ success: true, token, data: { ...studentData, role: 'guest' } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/logout
const logout = (_req, res) => {
  res.clearCookie('token', COOKIE_OPTS);
  res.json({ success: true, message: 'Logged out' });
};

const getModel = (role) => (role === 'mentor' ? Mentor : role === 'operations' ? Operations : Student);

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

module.exports = { login, guestSignup, logout, getMe, updateMe };
