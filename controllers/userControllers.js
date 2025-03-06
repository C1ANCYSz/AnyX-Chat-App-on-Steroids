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
    let myId = req.user._id.toString();
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Validate and sanitize pagination inputs
    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 50);

    const conversation = await Conversation.findById(id)
      .populate({ path: 'members', select: 'username image' })
      .lean();

    if (!conversation) {
      return next(new AppError('Conversation not found', 404));
    }

    // Check if the user is part of the conversation
    if (
      !conversation.members.some((member) => member._id.toString() === myId)
    ) {
      return next(
        new AppError('Unauthorized access to this conversation', 403)
      );
    }

    // Paginated message fetch
    const messages = await Message.find({ conversation: id })
      .populate('sender', 'username profileImage')
      .sort({ timestamp: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    conversation.messages = messages;

    // Check for more messages
    const hasMoreMessages = messages.length === limitNum && messages.length > 0;

    res.status(200).json({ conversation, myId, hasMoreMessages });
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
