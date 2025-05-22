const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const setUpSocket = require('./utils/sockets');

require('dotenv').config();

const app = require('./app');
const server = http.createServer(app);
const io = new Server(server);

setUpSocket(io);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log('MongoDB connection error:', err));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
