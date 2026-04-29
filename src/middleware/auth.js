const jwt = require('jsonwebtoken');

const extractToken = (req) =>
  req.cookies?.token ||
  (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.split(' ')[1]);

// Any authenticated user (student, guest, mentor, operations)
const protect = (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_dev_secret');
    req.userId   = decoded.id;
    req.userRole = decoded.role || 'student';
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

// Blocks guest accounts — only fully paid students, mentors, or ops can proceed
const requireFullAccess = (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_dev_secret');
    req.userId   = decoded.id;
    req.userRole = decoded.role || 'student';
    if (req.userRole === 'guest') {
      return res.status(403).json({ success: false, message: 'Full access required. Please upgrade your account.' });
    }
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

module.exports = protect;
module.exports.requireFullAccess = requireFullAccess;
