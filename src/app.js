import express from "express";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.routes.js";
import musicRouter from "./routes/music.routes.js";
import cors from "cors";
import "dotenv/config";
import adminRouter from "./routes/admin.routes.js";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "http://localhost:5173", // frontend URL
    credentials: true, // Cookies allow karne ke liye
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRouter);
app.use("/api/music", musicRouter);
app.use("/api/admin", adminRouter);

export default app;
