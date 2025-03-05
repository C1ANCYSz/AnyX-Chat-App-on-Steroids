const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
