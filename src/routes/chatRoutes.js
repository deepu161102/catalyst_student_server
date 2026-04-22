const express = require('express');
const router  = express.Router();
const protect = require('../middleware/auth');
const {
  getConversations,
  getMessages,
  markRead,
  searchUsers,
} = require('../controllers/chatController');

router.use(protect);

router.get('/users/search',               searchUsers);
router.get('/conversations/:userId',      getConversations);
router.get('/messages/:userId/:otherUserId', getMessages);
router.put('/messages/read',              markRead);

module.exports = router;
