import express from "express";
import musicControllers from "../controllers/music.controllers.js";
import multer from "multer";
import authMiddleware from "../middlewares/auth.middleware.js";
import roleMiddleware from "../middlewares/role.middleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
});

const Router = express.Router();

// Artist only
Router.post(
  "/upload",
  authMiddleware.authUser,
  roleMiddleware(["artist"]),
  upload.single("music"),
  musicControllers.createMusic,
);

Router.post(
  "/album",
  authMiddleware.authUser,
  roleMiddleware(["artist"]),
  musicControllers.createAlbum,
);

Router.get(
  "/my-music",
  authMiddleware.authUser,
  roleMiddleware(["artist"]),
  musicControllers.getMyMusics,
);

Router.get(
  "/my-albums",
  authMiddleware.authUser,
  roleMiddleware(["artist"]),
  musicControllers.getMyAlbums,
);

// Listener + Artist
Router.get("/", authMiddleware.authUser, musicControllers.getAllMusics);

Router.get("/albums", authMiddleware.authUser, musicControllers.getAllAlbums);

Router.get(
  "/albums/:albumId",
  authMiddleware.authUser,
  musicControllers.getAlbumById,
);

// Test route
Router.get("/test", (req, res) => {
  res.json({
    message: "✅ Music route working!",
    routes: {
      upload: "POST /api/music/upload",
      albums: "GET /api/music/albums",
    },
  });
});

export default Router;
