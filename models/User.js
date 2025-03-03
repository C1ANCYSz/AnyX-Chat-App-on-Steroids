const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
      unique: true,
      validate: {
        validator: (v) => /^[a-zA-Z0-9_]+$/.test(v),
        message: 'Username can only contain letters, numbers, and underscores',
      },
    },

    image: {
      type: String,
      default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    },

    email: {
      type: String,
      required: [true, 'Please provide your email'],
      trim: true,
      unique: true,
      lowercase: true,
      set: (email) => email.trim(),
      validate: {
        validator: validator.isEmail,
        message: 'Please provide a valid email',
      },
    },

    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false,
    },

    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    confirmPassword: {
      type: String,
      required: [true, 'Please confirm your password'],
      validate: {
        validator: function (el) {
          return el === this.password;
        },
        message: 'Passwords are not the same',
      },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },

    passwordChangedAt: Date,
    resetPasswordToken: String,
    resetPasswordExpiresAt: Date,
    verificationToken: String,
    verificationTokenExpiresAt: Date,
  },
  {
    timestamps: true,
  }
);

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    delete ret.verificationToken;
    delete ret.resetPasswordToken;
    return ret;
  },
});

// Password hashing middleware
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);

  this.confirmPassword = undefined;
  next();
});

// Instance method for checking password
userSchema.methods.checkPassword = async function (
  candidatePassword,
  originalPassword
) {
  return await bcrypt.compare(candidatePassword, originalPassword);
};

// Check if password has changed after JWT was issued
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.methods.isTokenExpired = function (expiresAt) {
  return expiresAt && expiresAt < Date.now();
};

// Create a password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

userSchema.methods.createEmailVerificationToken = function () {
  const verifyToken = crypto.randomBytes(32).toString('hex');

  // Hash the token before storing it
  this.verificationToken = crypto
    .createHash('sha256')
    .update(verifyToken)
    .digest('hex');
  this.verificationTokenExpiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes

  return verifyToken; // Return the unhashed token for email sending
};

userSchema.methods.isAccountVerified = function () {
  return this.isVerified;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
