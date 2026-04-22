const mongoose = require('mongoose');
const Message = require('../models/Message');
const Student = require('../models/Student');

// GET /api/chat/conversations/:userId
// Returns list of users the person has chatted with, with last message + unread count.
const getConversations = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);

    const conversations = await Message.aggregate([
      {
        $match: { $or: [{ senderId: userId }, { receiverId: userId }] },
      },
      { $sort: { timestamp: -1 } },
      {
        $addFields: {
          otherUserId: {
            $cond: [{ $eq: ['$senderId', userId] }, '$receiverId', '$senderId'],
          },
        },
      },
      {
        $group: {
          _id: '$otherUserId',
          lastMessage: { $first: '$message' },
          lastTime:    { $first: '$timestamp' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiverId', userId] }, { $eq: ['$read', false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from:         'students',
          localField:   '_id',
          foreignField: '_id',
          as:           'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          userId:      '$_id',
          name:        '$user.name',
          email:       '$user.email',
          lastMessage: 1,
          lastTime:    1,
          unreadCount: 1,
        },
      },
      { $sort: { lastTime: -1 } },
    ]);

    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/chat/messages/:userId/:otherUserId?page=1&limit=50
// Returns paginated message history between two users, oldest-first.
const getMessages = async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip  = (page - 1) * limit;

    const filter = {
      $or: [
        { senderId: userId,      receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    };

    const [messages, total] = await Promise.all([
      Message.find(filter).sort({ timestamp: 1 }).skip(skip).limit(limit),
      Message.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: messages,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/chat/messages/read
// Body: { senderId, receiverId } — marks all messages from sender to receiver as read.
const markRead = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
    await Message.updateMany({ senderId, receiverId, read: false }, { $set: { read: true } });
    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/chat/users/search?q=searchTerm
// Searches students by name or email, excludes the current user.
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.userId;

    const filter = {
      _id: { $ne: currentUserId },
      ...(q
        ? {
            $or: [
              { name:  { $regex: q, $options: 'i' } },
              { email: { $regex: q, $options: 'i' } },
            ],
          }
        : {}),
    };

    const users = await Student.find(filter).limit(20).select('name email');
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getConversations, getMessages, markRead, searchUsers };
