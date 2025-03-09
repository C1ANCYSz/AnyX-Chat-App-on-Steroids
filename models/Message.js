const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  replyingTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
