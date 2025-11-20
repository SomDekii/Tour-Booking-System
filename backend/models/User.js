const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide a name"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Please provide an email"],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: 12,
    select: false,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  phone: {
    type: String,
    trim: true,
  },
  country: {
    type: String,
    trim: true,
  },
  mfaEnabled: {
    type: Boolean,
    default: false,
  },
  mfaSecret: {
    type: String,
    select: false,
  },
  mfaTempSecret: {
    type: String,
    select: false,
  },
  resetToken: {
    type: String,
    select: false,
  },
  resetTokenExpires: {
    type: Date,
    select: false,
  },
  mfaBackupCodes: {
    type: [String],
    select: false,
  },
  // Temporary per-login OTP (email) storage (hashed) and expiry
  mfaOtpHash: {
    type: String,
    select: false,
  },
  mfaOtpExpires: {
    type: Date,
    select: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
