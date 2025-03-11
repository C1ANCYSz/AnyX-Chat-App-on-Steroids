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

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

io.on('connection', (socket) => {
  console.log('A user connected: ' + socket.id);

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
      const cookie = socket.handshake.headers.cookie;
      const token = cookie
        ?.split('; ')
        .find((c) => c.startsWith('jwt='))
        ?.split('=')[1];
      if (!token) throw new Error('JWT token missing');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

      socket.emit('messageSent', {
        newMessage: populatedMessage,
        conversationId,
      });
      socket.to(conversationId).emit('receiveMessage', {
        newMessage: populatedMessage,
        conversationId,
      });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
