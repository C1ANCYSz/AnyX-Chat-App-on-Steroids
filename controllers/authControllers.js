const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const validator = require('validator');

const AppError = require('../utils/appError');

const User = require('./../models/User');

const {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordResetSuccess,
} = require('../mailtrap/emails');

const {
  generateVerificationToken,
} = require('../utils/generateVerificationToken');

require('express-async-errors');

const tokenAndCookie = (id, res) => {
  const token = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });

  res.cookie('jwt', token, {
    httpOnly: true, //to prevent xss attack
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', //to prevent csrf attack
    maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
  });

  return token;
};

exports.login = async (req, res, next) => {
  let { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password) {
    return next(
      new AppError('Please provide username or email and password', 400)
    );
  }
  usernameOrEmail = validator.escape(usernameOrEmail);

  let user;

  validator.isEmail(usernameOrEmail)
    ? (user = await User.findOne({ email: usernameOrEmail }).select(
        '+password'
      ))
    : (user = await User.findOne({ username: usernameOrEmail }).select(
        '+password'
      ));

  //to mitigate bruce force attack [TO BE IMPROVED]

  if (!user || !(await user.checkPassword(password, user.password))) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return next(new AppError('Incorrect username or password', 401));
  }

  tokenAndCookie(user._id, res);

  return res.status(200).json({
    success: true,
    message: 'User logged in successfully',
  });
};

exports.signUp = async (req, res, next) => {
  let { username, email, password, confirmPassword } = req.body;

  console.log(username, email, password, confirmPassword);

  username = username.trim();
  email = email.trim();
  username = validator.escape(username);
  email = validator.escape(email);
  password = validator.escape(password);
  confirmPassword = validator.escape(confirmPassword);

  // Validate inputs
  if (!username || !email || !password || !confirmPassword) {
    return next(new AppError('Please provide all required fields', 400));
  }

  if (!validator.isEmail(email)) {
    return next(new AppError('Please provide a valid email', 400));
  }

  if (password.length < 8) {
    return next(
      new AppError('Password must be at least 8 characters long', 400)
    );
  }

  if (password !== confirmPassword) {
    return next(new AppError('Passwords do not match', 400));
  }

  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    return next(
      new AppError('User with this email or username already exists', 400)
    );
  }

  const verificationToken = generateVerificationToken();
  let newUser = await User.create({
    username,
    email,
    password,
    confirmPassword,
    verificationToken,
    verificationTokenExpiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
  });

  await sendVerificationEmail(newUser.email, verificationToken).catch((err) => {
    console.error('Error sending verification email:', err);
  });

  tokenAndCookie(newUser._id, res);

  res.status(201).json({
    success: true,
    data: {
      user: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        verified: false,
      },
    },
  });
};

exports.logout = async (req, res) => {
  res.clearCookie('jwt');
  res.redirect('/');

  console.log('Logged out successfully');
};

exports.verifyEmail = async (req, res, next) => {
  const { verificationToken } = req.body;
  console.log('Verification Token:', verificationToken);

  try {
    if (!verificationToken) {
      return res.render('verifyEmail', {
        message: 'Please provide verification token',
      });
    }

    const user = await User.findOne({
      verificationToken,
      verificationTokenExpiresAt: { $gt: Date.now() },
    });

    if (!user) {
      return res.render('verifyEmail', { message: 'Invalid or expired token' });
    }

    // Mark user as verified
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiresAt = undefined;

    await user.save({ validateBeforeSave: false });

    // Send welcome email (if you want)

    tokenAndCookie(user._id, res);

    await sendWelcomeEmail(user.email, user.name);

    // Redirect to dashboard after successful verification
    res.status(200).redirect('/dashboard');
  } catch (err) {
    console.error(err);
    return res.render('verifyEmail', {
      message: 'Internal server error, please try again later',
    });
  }
};

exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;
  console.log(email);
  if (!email) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide email',
    });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({
      status: 'fail',
      message: 'No user found with that email',
    });
  }

  const resetToken = await user.createPasswordResetToken();

  await sendPasswordResetEmail(
    user.email,
    `${process.env.CLIENT_URL}/users/reset-password/${resetToken}`
  );

  return res.status(200).json({
    status: 'success',
    message: 'Password reset link sent to email',
  });
};

exports.resetPassword = async (req, res, next) => {
  const token = req.params.token;
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide password and confirm password',
    });
  }

  if (password.length < 8 || confirmPassword.length < 8) {
    return res.status(400).json({
      status: 'fail',
      message: 'Password must be atleast 8 characters',
    });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({
      status: 'fail',
      message: 'Password and confirm password do not match',
    });
  }
  //if this new password is same as the old hashed password

  // Hash the token from the request
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Find the user by the hashed token
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpiresAt: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      status: 'fail',
      message: 'Invalid or expired token',
    });
  }

  // Update the user's password and clear reset fields
  user.password = password;
  user.confirmPassword = undefined;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpiresAt = undefined;

  await user.save({ validateBeforeSave: false });

  await sendPasswordResetSuccess(user.email, user.name);

  return res.status(200).json({
    status: 'success',
    message: 'Password reset successful, please login with your new password',
  });
};

exports.isLoggedIn = async (req, res, next) => {
  // Check for token in headers
  const token = req.cookies.jwt; // "Bearer TOKEN"

  if (!token) {
    return next();
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the user to the request object
    const user = await User.findById(decoded.id);

    if (!user) {
      return next();
    }

    // Attach the user to the request object
    req.user = user;

    next(); // Continue to the next middleware/route
  } catch (err) {
    return next(new appError('Invalid token. Please log in again.', 401));
  }
};

exports.protectRoute = async (req, res, next) => {
  let token;

  // Check for token in cookies
  if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.redirect('/login');
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user by ID
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.redirect('/users/login');
    }

    // Check if the user changed their password after the token was issued
    if (user.passwordChangedAt) {
      const changedTimestamp = parseInt(
        user.passwordChangedAt.getTime() / 1000,
        10
      );

      if (decoded.iat < changedTimestamp) {
        return res.redirect('/users/login');
      }
    }

    // Attach the user to the request object
    req.user = user;
    next();
  } catch (err) {
    console.error('JWT verification failed:', err);

    // Handle specific JWT errors
    if (err instanceof jwt.TokenExpiredError) {
      return res.redirect('/users/login?error=tokenExpired');
    }

    if (err instanceof jwt.JsonWebTokenError) {
      return res.redirect('/users/login?error=invalidToken');
    }

    // Catch all for unexpected errors
    return res.redirect('/users/login');
  }
};

exports.isVerified = async (req, res, next) => {
  try {
    if (!req.cookies.jwt) {
      return res.redirect('/login'); // Redirect to login if no token
    }

    // Verify the token
    const decoded = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET);

    // Find the user by ID
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).render('login', { message: 'User not found' });
    }

    // Attach the user object to the request
    req.user = user;

    // Check if user is verified
    if (!user.isVerified) {
      return res.render('verifyEmail', {
        message: 'Please verify your email to continue',
      });
    }

    // User is verified — proceed to the next middleware
    next();
  } catch (err) {
    console.error(err);
    return res
      .status(401)
      .render('login', { message: 'Invalid token, please log in again' });
  }
};

exports.resendVerificationEmail = async (req, res, next) => {
  await sendVerificationEmail(req.user.email, req.user.name).catch((err) => {
    return next(new AppError(err.message, 500));
  });
  res.status(200).json({
    success: true,
    message: 'Verification email sent successfully',
  });
};
