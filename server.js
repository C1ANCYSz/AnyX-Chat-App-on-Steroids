const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = require('./app');
const server = http.createServer(app);
const io = new Server(server);

const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const User = require('./models/User');

const users = new Map(); // Map to store user IDs and their socket IDs (TO BE CACHED IN REDIS)

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log('MongoDB connection error:', err));

const verifyToken = (socket) => {
  try {
    const cookie = socket.handshake.headers.cookie;
    const token = cookie
      ?.split('; ')
      .find((c) => c.startsWith('jwt='))
      ?.split('=')[1];
    if (!token) throw new Error('JWT token missing');
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    socket.emit('error', { message: 'Authentication failed' });
    throw error;
  }
};

io.on('connection', async (socket) => {
  console.log('User connected');

  socket.on('register', async () => {
    try {
      const decoded = verifyToken(socket);
      const senderUser = await User.findById(decoded.id);
      if (!senderUser) throw new Error('User not found');

      users.set(decoded.id, socket.id);
      console.log(`User ${decoded.id} registered with socket ID: ${socket.id}`);
    } catch (error) {
      console.error('Registration error:', error.message);
    }
  });

  socket.on('joinConversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.id} joined conversation ${conversationId}`);
  });

  socket.on('leaveConversation', (conversationId) => {
    socket.leave(conversationId);
    console.log(`User ${socket.id} left conversation ${conversationId}`);
  });

  socket.on('sendMessage', async ({ conversationId, message, replyingTo }) => {
    try {
      const decoded = verifyToken(socket);
      const senderUser = await User.findById(decoded.id);
      if (!senderUser) throw new Error('User not found');

      const newMessage = await Message.create({
        text: message,
        conversation: conversationId,
        sender: decoded.id,
        replyingTo,
      });

      const populatedMessage = await newMessage.populate([
        { path: 'sender', select: 'username image' },
        { path: 'replyingTo', select: 'text sender', populate: 'sender' },
      ]);

      const conversation = await Conversation.findById(conversationId);
      if (conversation) {
        conversation.lastMessage = newMessage._id;
        await conversation.save();
      }

      io.to(conversationId).emit('receiveMessage', {
        newMessage: populatedMessage,
        conversationId,
      });

      const participants = conversation.members.filter(
        (id) => id.toString() !== decoded.id,
      );
      participants.forEach((memberId) => {
        const receiverSocketId = users.get(memberId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('notification', {
            sender: senderUser.username,
            conversationId: conversation._id,
            message: populatedMessage.text,
          });
        }
      });
    } catch (error) {
      console.error('Error sending message:', error.message);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('startCall', async ({ conversationId, isVideoCall, offer }) => {
    try {
      const decoded = verifyToken(socket);
      const user = await User.findById(decoded.id);
      if (!user) throw new Error('User not found');

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const callRoom = `call_${conversationId}`;
      socket.join(callRoom);

      console.log(`User ${user.username} started a call in ${conversationId}`);

      conversation.members
        .filter((id) => id.toString() !== user._id.toString())
        .forEach((memberId) => {
          const receiverSocketId = users.get(memberId.toString());
          if (receiverSocketId) {
            io.to(receiverSocketId).emit('incomingCall', {
              conversationId,
              callerId: user._id,
              callerName: user.username,
              callerImage: user.image,
              isVideoCall,
              offer,
            });
          }
        });
    } catch (error) {
      console.error('Error starting call:', error);
      socket.emit('error', { message: 'Failed to start call' });
    }
  });

  socket.on('acceptCall', ({ conversationId, answer }) => {
    const callRoom = `call_${conversationId}`;
    console.log(`User accepted call in ${conversationId}`);

    io.to(callRoom).emit('callAccepted', { answer });
  });

  socket.on('answer', ({ answer, conversationId }) => {
    const callRoom = `call_${conversationId}`;
    console.log(`Answer received for conversation ${conversationId}`);
    io.to(callRoom).emit('callAccepted', { answer });
  });

  socket.on('candidate', ({ candidate, conversationId }) => {
    const callRoom = `call_${conversationId}`;
    console.log(`ICE Candidate for ${conversationId}:`, candidate);
    io.to(callRoom).emit('candidate', candidate);
  });

  socket.on('endCall', ({ conversationId, userId }) => {
    console.log(`User ${userId} ended the call in ${conversationId}`);

    socket.to(conversationId).emit('userLeft', { userId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    socket.broadcast.emit('userLeft', { userId: socket.id });
    users.forEach((socketId, userId) => {
      if (socketId === socket.id) {
        users.delete(userId);
        console.log(`User ${userId} unregistered`);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
