import express from "express";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.routes.js";
import musicRouter from "./routes/music.routes.js";
import cors from "cors";
import "dotenv/config";
import adminRouter from "./routes/admin.routes.js";
// import helmet from "helmet";
import Limiter from "express-rate-limit";
import { connectRedis } from "../src/config/redis.js";
import compression from "compression";

const app = express();
app.use(compression());
connectRedis(); // Redis connection establish karne ke liye
const generalLimiter = Limiter({
  windowMs: 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after a minute.",
});

const authLimiter = Limiter({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many attempts from this IP, please try again after a minute.",
});

const musicLimiter = Limiter({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many requests from this IP, please try again after a minute.",
});

app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "http://localhost:5173", // frontend URL
    credentials: true, // Cookies allow karne ke liye
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
// app.use(helmet()); only to use this package when you are deploying the app in production, otherwise it will block some requests in development
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(generalLimiter);
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/music", musicLimiter, musicRouter);
app.use("/api/admin", adminRouter);

export default app;
