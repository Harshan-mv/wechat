const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: {
    type: Boolean,
    default: false // Regular users are not admins by default
  },
  isVerified: {
    type: Boolean,
    default: false // Users need to be verified by the admin
  }
});

module.exports = mongoose.model('User', userSchema);
