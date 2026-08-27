import express from "express";
import musicControllers from "../controllers/music.controllers.js";
import multer from "multer";
import authMiddleware from "../middlewares/auth.middleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
});
const Router = express.Router();
Router.post(
  "/upload",
  authMiddleware.authArtist,
  upload.single("music"),
  musicControllers.createMusic,
);
Router.post("/album", authMiddleware.authArtist, musicControllers.createAlbum);

Router.get(
  "/my-music",
  authMiddleware.authArtist,
  musicControllers.getMyMusics,
);
Router.get("/", authMiddleware.authUser, musicControllers.getAllMusics);

Router.get(
  "/my-albums",
  authMiddleware.authArtist,
  musicControllers.getMyAlbums,
);
Router.get("/albums", authMiddleware.authUser, musicControllers.getAllAlbums);

Router.get(
  "/albums/:albumId",
  authMiddleware.authUser,
  musicControllers.getAlbumById,
);

// ✅ Test route for music
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
