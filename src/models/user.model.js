import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    default: null,
  },

  googleId: {
    type: String,
    default: null,
    unique: true,
    sparse: true,
  },

  authProvider: {
    type: String,
    enum: ["local", "google"],
    default: "local",
  },

  role: {
    type: String,
    enum: ["listener", "artist"],
    default: "listener",
  },

  emailVerified: {
    type: Boolean,
    default: false,
  },

  emailVerificationToken: {
    type: String,
    default: null,
  },

  emailVerificationExpires: {
    type: Date,
    default: null,
  },

  passwordResetToken: {
    type: String,
    default: null,
  },

  passwordResetExpires: {
    type: Date,
    default: null,
  },
});

const userModel = mongoose.model("user", userSchema);

export default userModel;
