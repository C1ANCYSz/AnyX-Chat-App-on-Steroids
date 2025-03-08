const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = require('./app');
const server = http.createServer(app);
const io = new Server(server);
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
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

  socket.on('sendMessage', async ({ conversationId, message }) => {
    const sender = socket.handshake.headers.cookie
      .split(';')
      .find((cookie) => cookie.startsWith('jwt='))
      .split('=')[1];

    const decoded = jwt.verify(sender, process.env.JWT_SECRET);

    const newMessage = await Message.create({
      text: message,
      conversation: conversationId,
      sender: decoded.id,
    });

    const conversation = await Conversation.findById(conversationId);

    conversation.lastMessage = newMessage._id;
    await conversation.save();

    socket.to(conversationId).emit('receiveMessage', {
      sender: socket.id,
      message,
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
