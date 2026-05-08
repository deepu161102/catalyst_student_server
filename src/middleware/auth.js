const jwt = require('jsonwebtoken');

const extractToken = (req) =>
  (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.split(' ')[1]) ||
  req.cookies?.token;

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

const requireOperations = (req, res, next) => {
  if (req.userRole !== 'operations')
    return res.status(403).json({ success: false, message: 'Operations access required' });
  next();
};

const requireMentor = (req, res, next) => {
  if (!['mentor', 'operations'].includes(req.userRole))
    return res.status(403).json({ success: false, message: 'Mentor access required' });
  next();
};

module.exports = protect;
module.exports.requireFullAccess = requireFullAccess;
module.exports.requireOperations = requireOperations;
module.exports.requireMentor     = requireMentor;
