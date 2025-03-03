const http = require('http');
const { Server } = require('socket.io');

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
  console.log('A user connected');

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
