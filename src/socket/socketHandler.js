const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');

// userId (string) -> Set of socket IDs
const onlineUsers = new Map();

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL
        ? process.env.CLIENT_URL.split(',').map(o => o.trim())
        : ['http://localhost:5173', 'http://localhost:5174'],
      credentials: true,
    },
  });

  // ── Auth middleware ──────────────────────────────────────────────────────────
  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie || '';
    const cookieToken  = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith('token='))?.slice(6) || null;
    const token = socket.handshake.auth.token || socket.handshake.query.token || cookieToken;
    if (!token) {
      console.log('[Socket] Auth failed: no token provided');
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_dev_secret');
      socket.userId = decoded.id.toString();
      next();
    } catch (err) {
      console.log('[Socket] Auth failed: invalid token -', err.message);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`[Socket] Connected: userId=${userId} socketId=${socket.id}`);

    // Join personal room so others can target this user
    socket.join(userId);

    // Track online users
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Broadcast to all that this user is online
    io.emit('user_online', { userId });

    // Send the current full list of online user IDs to the newly connected socket
    socket.emit('online_users', Array.from(onlineUsers.keys()));

    // ── send_message ──────────────────────────────────────────────────────────
    socket.on('send_message', async ({ senderId, receiverId, message, tempId }) => {
      if (senderId !== userId) {
        console.log(`[Socket] send_message rejected: senderId mismatch`);
        return;
      }
      if (!message || !message.trim()) return;
      if (senderId === receiverId) return;

      try {
        const saved = await Message.create({ senderId, receiverId, message: message.trim() });
        console.log(`[Socket] Message saved: ${saved._id} (${senderId} -> ${receiverId})`);

        // Deliver to receiver
        io.to(receiverId).emit('receive_message', {
          _id:        saved._id,
          senderId:   saved.senderId,
          receiverId: saved.receiverId,
          message:    saved.message,
          timestamp:  saved.timestamp,
          read:       saved.read,
        });

        // Confirm to sender with the real DB id
        socket.emit('message_sent', {
          _id:       saved._id,
          tempId,
          timestamp: saved.timestamp,
        });
      } catch (err) {
        console.error('[Socket] Error saving message:', err.message);
        socket.emit('message_error', { tempId, error: 'Failed to send message' });
      }
    });

    // ── typing ────────────────────────────────────────────────────────────────
    socket.on('typing', ({ senderId, receiverId }) => {
      if (senderId !== userId) return;
      io.to(receiverId).emit('user_typing', { senderId });
    });

    // ── message_read ──────────────────────────────────────────────────────────
    socket.on('message_read', async ({ senderId, receiverId }) => {
      try {
        await Message.updateMany(
          { senderId, receiverId, read: false },
          { $set: { read: true } }
        );
        // Tell the original sender their messages have been read
        io.to(senderId).emit('messages_read', { receiverId });
      } catch (err) {
        console.error('[Socket] Error marking read:', err.message);
      }
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user_offline', { userId });
          console.log(`[Socket] User offline: ${userId}`);
        }
      }
      console.log(`[Socket] Disconnected: userId=${userId} socketId=${socket.id}`);
    });
  });

  return io;
};

module.exports = setupSocket;
