const User = require('../models/User');

require('express-async-errors');

exports.dashboard = async (req, res) => {
  if (req.user) {
    const id = req.user.id;

    const user = await User.findById(id).populate('courses');
    const courses = user.courses || [];
    if (courses.length === 0) {
      return res.render('dashboard', {
        user: req.user,
        courses,
        courseOrNot: 'You have not enrolled in any courses',
      });
    }

    return res.render('dashboard', {
      user: req.user,
      courses,
      courseOrNot: 'Your courses',
    });
  }
  res.redirect('/users/login');
};

exports.searchUsers = async (req, res) => {
  const query = req.query.query;

  if (!query) return res.json([]);

  try {
    const users = await User.find({
      username: { $regex: query, $options: 'i' },
    }).limit(10);

    res.json(
      users.map((user) => ({
        id: user._id,
        username: user.username,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
