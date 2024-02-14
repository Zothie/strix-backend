const mongoose = require('mongoose');

const User = mongoose.model('User', {
    user: String,
    email: String,
    password: String,
});

module.exports = User;