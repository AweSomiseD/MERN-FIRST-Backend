import express from "express";
import authControllers from "../controllers/auth.controllers.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const Router = express.Router();

// ✅ Auth routes
Router.post("/register", authControllers.registerUser);
Router.post("/login", authControllers.loginUser);
Router.post("/refresh", authControllers.refreshToken);

// Protected routes
Router.get("/me", authMiddleware.authUser, authControllers.getCurrentUser);
Router.post("/logout", authControllers.logoutUser);
Router.get("/verify-email/:token", authControllers.verifyEmail);
Router.post("/resend-verification", authControllers.resendVerification);
Router.post("/forgot-password", authControllers.forgotPassword);
Router.post("/reset-password/:token", authControllers.resetPassword);

// ✅ Test route for auth
Router.get("/test", (req, res) => {
  res.json({
    message: "✅ Auth route working!",
    routes: {
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
    },
  });
});

export default Router;
