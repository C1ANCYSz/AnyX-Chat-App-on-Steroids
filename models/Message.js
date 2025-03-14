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
  type: { type: String, default: 'text' },
  seen: { type: Boolean, default: false },
  url: { type: String },
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
