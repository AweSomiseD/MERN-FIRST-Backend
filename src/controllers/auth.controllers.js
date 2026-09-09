import userModel from "../models/user.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import generateVerificationToken from "../utils/verificationToken.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../services/email.service.js";
import {
  generateOAuthState,
  getGoogleAuthorizationUrl,
  exchangeCodeForTokens,
  verifyGoogleIdToken,
} from "../services/googleOAuth.service.js";
import generateUsername from "../utils/generateUsername.js";

//  ACTUALL CONTROLLERS WERE DOWN BELOW...
async function registerUser(req, res) {
  try {
    const { username, email, password, role = "listener" } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email and password are required",
      });
    }
    if (!["listener", "artist"].includes(role)) {
      return res.status(400).json({
        message: "Invalid role",
      });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const isUserExist = await userModel.findOne({
      $or: [{ username }, { email: normalizedEmail }],
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

    // Email fail ho bhi jaye to registration ko fail mat karo
    try {
      await sendVerificationEmail(normalizedEmail, plainToken);
    } catch (emailError) {
      console.error("Verification email failed to send:", emailError);
      // ignore — user register ho chuka hai, email baad mein resend ho sakti hai
    }

    return res.status(201).json({
      message: "User Register successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
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
    // check if user is banned
    if (user.isBanned) {
      return res.status(403).json({
        message: "Your account has been banned. Please contact support.",
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
    console.log("GET CURRENT USER - req.user:", req.user);

    const user = await userModel.findById(req.user.id).select("-password");

    console.log("GET CURRENT USER - DB USER:", user);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        message: "Your account has been banned. Please contact support.",
      });
    }

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Get Current User Error:", error);

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

    if (user.isBanned) {
      return res.status(403).json({
        message: "Your account has been banned. Please contact support.",
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

const googleAuth = (req, res) => {
  const state = generateOAuthState();
  res.cookie("oauthState", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 5 * 60 * 1000,
  });
  const googleUrl = getGoogleAuthorizationUrl(state);
  res.redirect(googleUrl);
};

const googleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).json({
        message: "Authorization code is missing",
      });
    }
    const storedState = req.cookies.oauthState;
    if (!storedState || storedState !== state) {
      return res.status(400).json({
        message: "Invalid OAuth state",
      });
    }
    console.log("OAuth state verified successfully");
    console.log("Google OAuth code received");
    const googleTokens = await exchangeCodeForTokens(code);
    console.log("Google tokens received");
    const googleUser = await verifyGoogleIdToken(googleTokens.id_token);
    console.log("Google User:", googleUser);
    // Check if Google account is already linked
    const existingGoogleUser = await userModel.findOne({
      googleId: googleUser.sub,
    });
    let user;
    if (existingGoogleUser) {
      // Google account already linked
      user = existingGoogleUser;
      console.log("Existing Google user found");
    } else {
      // Check if email already exists
      const existingEmailUser = await userModel.findOne({
        email: googleUser.email,
      });
      if (existingEmailUser) {
        // Link Google account with existing user
        existingEmailUser.googleId = googleUser.sub;
        existingEmailUser.emailVerified = googleUser.email_verified;
        await existingEmailUser.save();
        user = existingEmailUser;
        console.log("Existing user found by email - Google account linked");
      } else {
        // New Google user // Do NOT create the user yet. // First ask the user to select a role.
        res.cookie(
          "googlePendingUser",
          JSON.stringify({
            googleId: googleUser.sub,
            email: googleUser.email,
            name: googleUser.name,
            emailVerified: googleUser.email_verified,
          }),
          {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            path: "/",
            maxAge: 5 * 60 * 1000,
          },
        );
        console.log("New Google user pending role selection");

        res.clearCookie("oauthState", {
          httpOnly: true,
          sameSite: "lax",
          secure: false,
          path: "/",
        });
        return res.redirect("http://localhost:5173/choose-role");
      }
    }
    // Create application access token
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

    // Create application refresh token
    const refreshToken = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: "7d",
      },
    );

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

    // OAuth state is no longer needed
    console.log("Clearing OAuth state cookie...");
    res.clearCookie("oauthState", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    console.log("OAuth state cookie clear command sent");

    const dashboardPath = user.role === "artist" ? "/artist" : "/listener";

    return res.redirect(`http://localhost:5173${dashboardPath}`);
  } catch (error) {
    console.error("Google Callback Error:", error);

    return res.status(500).json({
      message: "Google authentication failed",
    });
  }
};

const completeGoogleRegistration = async (req, res) => {
  try {
    const { role } = req.body;
    // Validate role
    if (!role || !["listener", "artist"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    // Get pending Google user
    const pendingUser = req.cookies.googlePendingUser;
    if (!pendingUser) {
      return res
        .status(400)
        .json({ message: "Google registration session expired" });
    }
    const googleUser = JSON.parse(pendingUser);
    // Double-check that email/google account was not registered
    const existingUser = await userModel.findOne({
      $or: [{ email: googleUser.email }, { googleId: googleUser.googleId }],
    });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }
    // Generate unique username
    const username = await generateUsername(googleUser.name);
    // Create user
    const newUser = new userModel({
      username,
      email: googleUser.email,
      googleId: googleUser.googleId,
      authProvider: "google",
      emailVerified: googleUser.emailVerified,
      role,
    });
    await newUser.save();
    // Create access token
    const accessToken = jwt.sign(
      { id: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
    // Create refresh token
    const refreshToken = jwt.sign(
      { id: newUser._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" },
    );
    // Access token cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 15 * 60 * 1000,
    });
    // Refresh token cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // Clear pending Google registration
    res.clearCookie("googlePendingUser", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    console.log(`Google user created successfully with role: ${role}`);
    return res.status(201).json({
      message: "Google registration completed successfully",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Complete Google Registration Error:", error);
    return res.status(500).json({ message: "Google registration failed" });
  }
};

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
  googleAuth,
  googleCallback,
  completeGoogleRegistration,
};
