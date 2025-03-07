const express = require('express');
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
  userControllers.searchUsers
);

router.get(
  '/conversations/:id',
  isLoggedIn,
  isVerified,
  userControllers.getConversation
);

router.post(
  '/send-message/:id',
  isLoggedIn,
  isVerified,
  userControllers.sendMessage
);

router.post(
  '/get-conversation-key/:id',
  isLoggedIn,
  isVerified,
  userControllers.getConversationKey
);

module.exports = router;
