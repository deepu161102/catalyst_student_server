const mongoose = require('mongoose');
const Message  = require('../models/Message');
const Student  = require('../models/Student');
const Mentor   = require('../models/Mentor');
const Batch    = require('../models/Batch');

// GET /api/chat/conversations/:userId
// Returns list of users the person has chatted with, with last message + unread count.
// Looks up name/email from both Student and Mentor collections.
const getConversations = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);

    const conversations = await Message.aggregate([
      { $match: { $or: [{ senderId: userId }, { receiverId: userId }] } },
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
          _id:         '$otherUserId',
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
      // Look up in both collections — only one will match per _id
      {
        $lookup: {
          from: 'students', localField: '_id', foreignField: '_id', as: 'studentUser',
        },
      },
      {
        $lookup: {
          from: 'mentors', localField: '_id', foreignField: '_id', as: 'mentorUser',
        },
      },
      {
        $addFields: {
          userArray: { $concatArrays: ['$studentUser', '$mentorUser'] },
        },
      },
      { $unwind: '$userArray' },
      {
        $project: {
          userId:      '$_id',
          name:        '$userArray.name',
          email:       '$userArray.email',
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
// Batch-scoped: students only see their mentor; mentors only see their batch students.
const searchUsers = async (req, res) => {
  try {
    const { q }         = req.query;
    const currentUserId = req.userId;
    const role          = req.userRole || 'student';
    const textFilter    = q
      ? { $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }] }
      : {};

    if (role === 'student') {
      // Student → return all their assigned mentors (one per batch)
      const student = await Student.findById(currentUserId).select('batchIds batchId').lean();
      const ids = student?.batchIds?.length ? student.batchIds
                : student?.batchId          ? [student.batchId]
                : [];
      if (!ids.length) return res.json({ success: true, data: [] });

      const batches = await Batch.find({ _id: { $in: ids } }).select('mentorId').lean();
      const mentorIds = [...new Set(batches.map(b => b.mentorId?.toString()).filter(Boolean))];
      if (!mentorIds.length) return res.json({ success: true, data: [] });

      const mentors = await Mentor.find({ _id: { $in: mentorIds }, ...textFilter })
        .select('name email').lean();
      return res.json({ success: true, data: mentors });
    }

    // Mentor/Operations → return only students in their batches
    // Step 1: mentor's batch IDs (uses mentorId index on Batch)
    const batches  = await Batch.find({ mentorId: currentUserId }).select('_id').lean();
    const batchIds = batches.map(b => b._id);

    if (!batchIds.length) return res.json({ success: true, data: [] });

    // Step 2: students in any of those batches — support both old batchId and new batchIds
    const batchFilter = { $or: [{ batchIds: { $in: batchIds } }, { batchId: { $in: batchIds } }] };
    const users = await Student
      .find(q ? { $and: [batchFilter, textFilter] } : batchFilter)
      .limit(50)
      .select('name email batchIds batchId')
      .lean();

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getConversations, getMessages, markRead, searchUsers };
