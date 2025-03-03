const appError = require('../utils/appError');

const handleExpiredJwtError = () => {
  return new appError('Token expired, please log in again', 401);
};
const handleJwtError = () => {
  const message = 'Token Validation Failed, Unauthorized!';

  return new appError(message, 401);
};
const handleCastError = (err) => {
  const message = `Invalid ${err.path} : ${err.value}`;

  return new appError(message, 400);
};

const handleDuplicateFields = (err) => {
  let arr = Object.entries(err.keyValue).map(
    ([key, value]) => `${key}: ${value}`
  );
  console.log(arr.join(', '));

  const message = `The field(s) [${arr}] already exists, it must be unique.`;

  return new appError(message, 400);
};

const handleValidationError = (err) => {
  return new appError(err.message, 400);
};

const development = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    err,
    message: err.message,
    stack: err.stack,
  });
};

const production = (err, res) => {
  if (err.isOperational === true) {
    res.status(err.statusCode).json({
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

const errorController = (temp, err, req, res, next) => {
  err.status = err.status || 'error';
  err.statusCode = err.statusCode || 500;

  if (process.env.NODE_ENV === 'development') {
    development(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = Object.assign(err);

    if (error.name === 'CastError') {
      error = handleCastError(error);
    }
    if (error.code === 11000) {
      error = handleDuplicateFields(error);
    }
    if (error.name === 'ValidationError') {
      error = handleValidationError(error);
    }
    if (error.name === 'JsonWebTokenError') {
      error = handleJwtError();
    }
    if (error.name === 'TokenExpiredError') {
      error = handleExpiredJwtError();
    }

    production(error, res, temp);
  }
};

module.exports = errorController;
