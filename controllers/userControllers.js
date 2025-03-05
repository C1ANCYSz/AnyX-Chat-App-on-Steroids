const User = require('../models/User');
const Conversation = require('../models/Conversation');
const AppError = require('../utils/AppError');
const Message = require('../models/Message');

require('express-async-errors');

exports.searchUsers = async (req, res) => {
  const query = req.query.query;

  if (!query) return res.json([]);

  try {
    const users = await User.find({
      username: { $regex: query, $options: 'i' },
    }).limit(10);

    res.json(
      users.map((user) => ({
        id: user._id,
        username: user.username,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getConversation = async (req, res, next) => {
  try {
    let myId = req.user._id;
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    myId = myId.toString();

    const conversation = await Conversation.findById(id)
      .populate({
        path: 'members',
        select: 'username image',
      })
      .lean();

    if (!conversation) {
      return next(new AppError('Conversation not found', 404));
    }

    // Paginated message fetch
    const messages = await Message.find({ conversation: id })
      .populate('sender', 'username profileImage')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    conversation.messages = messages;

    res
      .status(200)
      .json({ conversation, myId, hasMoreMessages: messages.length === limit });
  } catch (error) {
    next(new AppError('Failed to fetch conversation', 500));
  }
};

exports.sendMessage = async (req, res, next) => {
  const { id } = req.params;
  const { message } = req.body;

  try {
    console.log(message);

    if (!message) {
      return next(new AppError('Message is required', 400));
    }

    let conversation = await Conversation.findById(id);

    if (!conversation) {
      return next(new AppError('Conversation not found', 404));
    }

    // Create and save the new message
    const newMessage = await Message.create({
      text: message,
      sender: req.user._id,
      conversation: id,
    });

    // Update the lastMessage in the conversation
    conversation = await Conversation.findByIdAndUpdate(
      id,
      {
        $set: { lastMessage: newMessage._id },
      },
      { new: true }
    );

    res.status(200).json(newMessage);
  } catch (err) {
    console.log(err.message);
    next(new AppError('Failed to send message', 500));
  }
};
