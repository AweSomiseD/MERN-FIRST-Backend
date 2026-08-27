import userModel from "../models/user.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import generateVerificationToken from "../utils/verificationToken.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../services/email.service.js";

async function registerUser(req, res) {
  const { username, email, password, role = "user" } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({
      message: "Username, email and password are required",
    });
  }
  if (!["user", "artist"].includes(role)) {
    return res.status(400).json({
      message: "Invalid role",
    });
  }
  const normalizedEmail = email.toLowerCase().trim();
  const isUserExist = await userModel.findOne({
    $or: [{ username }, { email: normalizedEmail }],
  });
  console.log({
    username: username.trim(),
    email: email.toLowerCase().trim(),
    isUserExist: !!isUserExist,
  });
  if (isUserExist) {
    return res.status(409).json({
      message: "User Already Exists",
    });
  }
  const pepperedPassword = password + process.env.PASSWORD_PEPPER;
  const hash = await bcrypt.hash(pepperedPassword, 10);
  const { plainToken, hashedToken } = generateVerificationToken();

  const user = await userModel.create({
    username,
    email: normalizedEmail,
    password: hash,
    role: role,
    emailVerified: false,
    emailVerificationToken: hashedToken,
    emailVerificationExpires: new Date(Date.now() + 15 * 60 * 1000),
  });
  await sendVerificationEmail(normalizedEmail, plainToken);

  return res.status(201).json({
    message: "User Register successfully",
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
}

async function loginUser(req, res) {
  try {
    const { username, email, password } = req.body;
    // Check password
    if (!password) {
      return res.status(400).json({
        message: "Password is required",
      });
    }
    // At least username or email required
    if (!username && !email) {
      return res.status(400).json({
        message: "Username or email is required",
      });
    }
    let user;
    // Login with username
    if (username) {
      user = await userModel.findOne({
        username: username.trim(),
      });
    }
    // If username not found, try email
    if (!user && email) {
      user = await userModel.findOne({
        email: email.toLowerCase().trim(),
      });
    }
    // User not found
    if (!user) {
      return res.status(401).json({
        message: "Invalid Credentials",
      });
    }
    // Check password
    const pepperedPassword = password + process.env.PASSWORD_PEPPER;
    const isPassValid = await bcrypt.compare(pepperedPassword, user.password);

    if (!isPassValid) {
      return res.status(401).json({
        message: "Invalid Credentials",
      });
    }
    // Create JWT
    const accessToken = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
      },
    );
    const refreshToken = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: "7d",
      },
    );

    // Set cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Logged In Successfully!!!",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

async function getCurrentUser(req, res) {
  try {
    const user = await userModel.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

async function logoutUser(req, res) {
  // Clear both access and refresh tokens
  res.clearCookie("accessToken", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return res.status(200).json({
    message: "Logged out successfully",
  });
}

async function refreshToken(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        message: "Refresh token required",
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await userModel.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    const accessToken = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
      },
    );

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 15 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Access token refreshed",
    });
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired refresh token",
    });
  }
}

async function verifyEmail(req, res) {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({
        message: "Verification token is required",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await userModel.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification token",
      });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();
    return res.status(200).json({
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Email Verification Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}

async function resendVerification(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }
    const user = await userModel.findOne({
      email: email.toLowerCase().trim(),
    });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    if (user.emailVerified) {
      return res.status(400).json({
        message: "Email is already verified",
      });
    }
    const { plainToken, hashedToken } = generateVerificationToken();
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    await sendVerificationEmail(user.email, plainToken);
    return res.status(200).json({
      message: "Verification email sent successfully",
    });
  } catch (error) {
    console.error("Resend Verification Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = await userModel.findOne({
      email: normalizedEmail,
    });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    const { plainToken, hashedToken } = generateVerificationToken();
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    // Reset email yahan send karenge
    await sendPasswordResetEmail(user.email, plainToken);
    return res.status(200).json({
      message: "Password reset email sent successfully",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}

async function resetPassword(req, res) {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;
    if (!token) {
      return res.status(400).json({
        message: "Reset token is required",
      });
    }
    if (!newPassword) {
      return res.status(400).json({
        message: "New password is required",
      });
    }
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await userModel.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token",
      });
    }
    const pepperedPassword = newPassword + process.env.PASSWORD_PEPPER;
    const hashedPassword = await bcrypt.hash(pepperedPassword, 10);
    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();
    return res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}

export default {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  refreshToken,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};
