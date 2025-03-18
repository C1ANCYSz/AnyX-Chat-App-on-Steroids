const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const {
  login,
  signUp,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  isLoggedIn,
  isVerified,
} = require('./../controllers/authControllers');

const userControllers = require('./../controllers/userControllers');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'chat_media',
    resource_type: 'auto',
  },
});

const upload = multer({ storage });

const router = express.Router();

router.post('/signup', signUp);

router.post('/login', login);

router.post('/logout', logout);

router.post('/verify-email', verifyEmail);

router.post('/forgot-password', forgotPassword);

router.post('/reset-password/:token', resetPassword);

router.get(
  '/search-users',
  isLoggedIn,
  isVerified,
  userControllers.searchUsers,
);

router.get(
  '/conversations/:id',
  isLoggedIn,
  isVerified,
  userControllers.getConversation,
);

router.post(
  '/conversations/:id/upload-media',
  isLoggedIn,
  isVerified,
  upload.single('file'),
  userControllers.uploadMedia,
);

router.post(
  '/send-message/:id',
  isLoggedIn,
  isVerified,
  userControllers.sendMessage,
);

router.post(
  '/get-conversation-key/:id',
  isLoggedIn,
  isVerified,
  userControllers.getConversationKey,
);

module.exports = router;
