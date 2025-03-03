const path = require('path');
require('dotenv').config();
const express = require('express');
const app = express();
const morgan = require('morgan');
const Message = require('./models/Message');
const userRouter = require('./routes/userRoutes');
const viewsRouter = require('./routes/viewsRoutes');
const cookieParser = require('cookie-parser');

app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

app.use('/', viewsRouter);
app.use('/api/users', userRouter);

module.exports = app;
