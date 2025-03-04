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

router.get('/dashboard', isLoggedIn, isVerified, userControllers.dashboard);

router.get(
  '/search-users',
  isLoggedIn,
  isVerified,
  userControllers.searchUsers
);

module.exports = router;
