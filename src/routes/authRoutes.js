const express = require('express');
const router  = express.Router();
const { login, logout, getMe, updateMe } = require('../controllers/authController');
const protect = require('../middleware/auth');

router.post('/login',  login);
router.post('/logout', protect, logout);
router.get('/me',      protect, getMe);
router.put('/me',      protect, updateMe);

module.exports = router;
