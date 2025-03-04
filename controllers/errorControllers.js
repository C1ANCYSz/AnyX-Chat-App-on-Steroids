const AppError = require('../utils/AppError');

const handleExpiredJwtError = () =>
  new AppError('Token expired, please log in again', 401);
const handleJwtError = () =>
  new AppError('Token Validation Failed, Unauthorized!', 401);
const handleCastError = (err) =>
  new AppError(`Invalid ${err.path}: ${err.value}`, 400);

const handleDuplicateFields = (err) => {
  const arr = Object.entries(err.keyValue).map(
    ([key, value]) => `${key}: ${value}`
  );
  const message = `The field(s) [${arr.join(
    ', '
  )}] already exists, it must be unique.`;
  return new AppError(message, 400);
};

const handleValidationError = (err) => new AppError(err.message, 400);

const development = (err, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status,
    err,
    message: err.message,
    stack: err.stack,
  });
};

const production = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode || 500).json({
      status: err.status,
      message: err.message,
    });
  } else {
    console.error('ERROR:', err.name, err.message);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong, please try again later',
    });
  }
};

const errorController = (err, req, res, next) => {
  err.status = err.status || 'error';
  err.statusCode = err.statusCode || 500;

  if (process.env.NODE_ENV === 'development') {
    development(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = Object.create(err);

    if (error.name === 'CastError') error = handleCastError(error);
    if (error.code === 11000) error = handleDuplicateFields(error);
    if (error.name === 'ValidationError') error = handleValidationError(error);
    if (error.name === 'JsonWebTokenError') error = handleJwtError();
    if (error.name === 'TokenExpiredError') error = handleExpiredJwtError();

    production(error, res);
  }
};

module.exports = errorController;
