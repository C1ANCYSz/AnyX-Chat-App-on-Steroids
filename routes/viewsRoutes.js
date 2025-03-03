const express = require('express');
const router = express.Router();
const { isVerified } = require('../controllers/authControllers');

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

router.get('/dashboard', isVerified, (req, res) => res.render('dashboard'));

module.exports = router;
