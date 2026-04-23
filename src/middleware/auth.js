const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  // Support both cookie (browser) and Authorization header (Postman)
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.split(' ')[1]);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_dev_secret');
    req.userId   = decoded.id;
    req.userRole = decoded.role || 'student'; // backward-compat: old tokens without role field default to student
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

module.exports = protect;
