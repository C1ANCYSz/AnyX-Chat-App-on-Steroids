const User = require('../models/User');
const Conversation = require('../models/Conversation');
const AppError = require('../utils/AppError');
const Message = require('../models/Message');
const crypto = require('crypto');
const fs = require('fs');
const NodeRSA = require('node-rsa');

require('express-async-errors');

const privateKey = fs.readFileSync('./keys/private.pem', 'utf8');
const redis = require('redis');

const client = redis.createClient();
client.on('error', (err) => console.error('Redis error:', err));
(async () => {
  try {
    await client.connect();
    console.log('Connected to Redis!');
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();

function decryptWithRSA(encryptedData, privateKey) {
  try {
    const key = new NodeRSA(privateKey, 'pkcs8-private-pem');
    return key.decrypt(encryptedData, 'utf8');
  } catch (err) {
    console.error('RSA decryption failed:', err.message);
    return null;
  }
}

function encryptWithRSA(data, publicKey) {
  try {
    const key = new NodeRSA(publicKey, 'pkcs8-public-pem');
    return key.encrypt(data, 'base64');
  } catch (err) {
    console.error('RSA encryption failed:', err.message);
    return null;
  }
}

exports.getConversationKey = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { publicKey } = req.body;

    const conversation = await Conversation.findById(id);

    if (!conversation) return next(new AppError('Conversation not found', 404));

    if (!conversation.members.includes(req.user._id)) {
      return next(
        new AppError('Unauthorized access to this conversation', 403),
      );
    }

    let decryptedKey = await client.get(`convKey:${id}`);

    if (!decryptedKey) {
      decryptedKey = decryptWithRSA(conversation.key, privateKey);
      if (!decryptedKey)
        return next(new AppError('Failed to decrypt conversation key', 500));

      await client.setEx(`convKey:${id}`, 3600, decryptedKey);
    }

    const encryptedKey = encryptWithRSA(decryptedKey, publicKey);
    if (!encryptedKey)
      return next(new AppError('Failed to encrypt conversation key', 500));

    res.status(200).json({ encryptedKey });
  } catch (err) {
    console.error('Failed to get conversation key:', err.message);
    next(new AppError('Failed to get conversation key', 500));
  }
};

exports.searchUsers = async (req, res, next) => {
  const query = req.query.query;

  if (!query) return next(new AppError('Query is required', 400));

  try {
    // Find the user
    const user = await User.findOne({ username: query }).select(
      'username image',
    );

    if (!user) return next(new AppError('User not found', 404));

    // Check for an existing conversation
    let conversation = await Conversation.findOne({
      members: { $all: [req.user._id, user._id] },
    });

    // If no conversation exists, create one
    if (!conversation) {
      conversation = await Conversation.create({
        members: [req.user._id, user._id],
      });
    }

    res.json({
      success: true,
      user,
      convo: {
        conversationId: conversation._id,
        otherUserImage: user.image,
        otherUsername: user.username,
        lastMessage: conversation.lastMessage || null, // Ensure last message is included
        lastMessageTime: conversation.updatedAt,
      },
    });
  } catch (err) {
    return next(new AppError('Failed to search users', 500));
  }
};

exports.getConversation = async (req, res, next) => {
  try {
    let myId = req.user._id.toString();
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 50);

    const conversation = await Conversation.findById(id)
      .populate({ path: 'members', select: 'username image' })
      .lean();

    if (!conversation) {
      return next(new AppError('Conversation not found', 404));
    }

    if (
      !conversation.members.some((member) => member._id.toString() === myId)
    ) {
      return next(
        new AppError('Unauthorized access to this conversation', 403),
      );
    }

    const messages = await Message.find({ conversation: id })
      .populate('sender', 'username profileImage')
      .populate({
        path: 'replyingTo',
        select: 'text sender type',
        populate: {
          path: 'sender',
          select: 'username profileImage',
        },
      })
      .sort({ timestamp: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean({ virtuals: true });
    conversation.messages = messages;

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

    const newMessage = await Message.create({
      text: message,
      sender: req.user._id,
      conversation: id,
    });

    conversation = await Conversation.findByIdAndUpdate(
      id,
      {
        $set: { lastMessage: newMessage._id },
      },
      { new: true },
    );

    res.status(200).json(newMessage);
  } catch (err) {
    console.log(err.message);
    next(new AppError('Failed to send message', 500));
  }
};

exports.uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    res.json({ secure_url: req.file.path });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
};
