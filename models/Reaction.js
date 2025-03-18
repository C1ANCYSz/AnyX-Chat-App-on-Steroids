const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true,
  },
  type: { type: String, required: true },
});

const Reaction = mongoose.model('Reaction', reactionSchema);

module.exports = Reaction;
