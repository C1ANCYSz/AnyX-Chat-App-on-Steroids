const express = require('express');
const router = express.Router();
const { isVerified } = require('../controllers/authControllers');
const conversation = require('../models/Conversation');
const Conversation = require('../models/Conversation');
router.get('/', (req, res) => {
  if (req.user) {
    return res.render('dashboard');
  }
  res.render('home');
});
router.get('/login', (req, res) => {
  res.render('login');
});
router.get('/signup', (req, res) => {
  res.render('signup');
});

router.get('/forgot-password', (req, res) => {
  res.render('forgotPassword');
});

router.get('/reset-password/:token', (req, res) => {
  res.render('resetPassword', { token: req.params.token });
});

router.get('/verify-email', (req, res) => {
  res.render('verifyEmail', { message: '' });
});

router.get('/forgot-password', (req, res) => res.render('forgotPassword'));

router.get('/convos', isVerified, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const conversations = await Conversation.find({
      members: { $in: [req.user._id] },
    })
      .populate('members')
      .populate('lastMessage')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const filteredConversations = conversations.map((convo) => {
      const otherUser = convo.members.find(
        (member) => member._id.toString() !== req.user._id.toString()
      );

      return {
        conversationId: convo._id,
        otherUsername: otherUser?.username || 'Unknown User',
        otherUserImage: otherUser?.image || '/default-avatar.png',
        lastMessage: convo.lastMessage?.text || 'No messages yet',
        lastMessageTime: convo.lastMessage?.timestamp
          ? convo.lastMessage.timestamp.toLocaleTimeString()
          : '',
      };
    });

    res.json(filteredConversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/dashboard', isVerified, async (req, res) => {
  res.render('dashboard');
});

module.exports = router;
