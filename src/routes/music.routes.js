import express from "express";
import musicControllers from "../controllers/music.controllers.js";
import { uploadAudioSingle } from "../middlewares/upload.middleware.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import roleMiddleware from "../middlewares/role.middleware.js";

const Router = express.Router();

// Artist only
Router.post(
  "/upload",
  authMiddleware.authUser,
  roleMiddleware(["artist"]),
  uploadAudioSingle("music"),
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

Router.delete(
  "/:musicId",
  authMiddleware.authUser,
  roleMiddleware(["artist"]),
  musicControllers.deleteMusic,
);

Router.delete(
  "/album/:albumId",
  authMiddleware.authUser,
  roleMiddleware(["artist"]),
  musicControllers.deleteAlbum,
);

// Listener + Artist
Router.get("/", authMiddleware.authUser, musicControllers.getAllMusics);

Router.get("/albums", authMiddleware.authUser, musicControllers.getAllAlbums);

Router.get("/artists", authMiddleware.authUser, musicControllers.getArtists);

Router.get(
  "/artists/:artistId",
  authMiddleware.authUser,
  musicControllers.getArtistById,
);

Router.get(
  "/albums/:albumId",
  authMiddleware.authUser,
  musicControllers.getAlbumById,
);

// Any authenticated user (listener or artist) can trigger a play event
Router.post(
  "/:musicId/play",
  authMiddleware.authUser,
  musicControllers.recordPlay,
);

Router.get("/search", authMiddleware.authUser, musicControllers.searchMusic);

Router.get("/liked", authMiddleware.authUser, musicControllers.getLikedMusics);

Router.post(
  "/:musicId/like",
  authMiddleware.authUser,
  musicControllers.toggleLikeMusic,
);

Router.get(
  "/followed-artists",
  authMiddleware.authUser,
  musicControllers.getFollowedArtists,
);

Router.post(
  "/artists/:artistId/follow",
  authMiddleware.authUser,
  musicControllers.toggleFollowArtist,
);

Router.get(
  "/recently-played",
  authMiddleware.authUser,
  musicControllers.getRecentlyPlayed,
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
