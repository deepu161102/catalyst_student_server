const jwt = require('jsonwebtoken');
const Student = require('../models/Student');

// POST /api/auth/login
// Finds student by email (auto-creates if first login). No password stored in DB —
// password validation is intentionally kept on the client for this demo system.
const login = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    let student = await Student.findOne({ email: email.toLowerCase().trim() });

    if (!student) {
      // Auto-create from email on first login (demo system — no separate registration flow)
      const derivedName =
        name ||
        email
          .split('@')[0]
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
      student = await Student.create({ name: derivedName, email: email.toLowerCase().trim() });
    }

    const token = jwt.sign(
      { id: student._id },
      process.env.JWT_SECRET || 'fallback_dev_secret',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: student._id, name: student.name, email: student.email },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { login };
