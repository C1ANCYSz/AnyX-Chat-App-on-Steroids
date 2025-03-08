const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const mongoose = require('mongoose');

const app = require('./app');
const server = http.createServer(app);
const io = new Server(server);

require('dotenv').config();

const Message = require('./models/Message');

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

// Middleware

// Socket.io logic
io.on('connection', (socket) => {
  console.log('A user connected: ' + socket.id);

  socket.on('joinConversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.id} joined conversation ${conversationId}`);
  });

  socket.on('sendMessage', ({ conversationId, message }) => {
    console.log(`Message in ${conversationId}: ${message}`);

    // Emit the message to everyone in the room (except sender)
    socket.to(conversationId).emit('receiveMessage', {
      sender: socket.id,
      message,
    });
  });

  socket.on('chat message', async (encryptedMsg) => {
    try {
      // Save the encrypted message to the database
      const message = new Message({ text: encryptedMsg });
      await message.save();

      // Broadcast encrypted message
      io.emit('chat message', encryptedMsg);
    } catch (err) {
      console.log('Error saving message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
