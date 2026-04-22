const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  message:    { type: String, required: [true, 'Message is required'], trim: true },
  timestamp:  { type: Date, default: Date.now },
  read:       { type: Boolean, default: false },
});

messageSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
