const path = require('path');
require('dotenv').config();
const express = require('express');
const app = express();
const morgan = require('morgan');
const Message = require('./models/Message');
const userRouter = require('./routes/userRoutes');
const viewsRouter = require('./routes/viewsRoutes');
const cookieParser = require('cookie-parser');
const errorController = require('./controllers/errorControllers');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

app.use('/', viewsRouter);
app.use('/api/users', userRouter);

app.use(errorController);

module.exports = app;
