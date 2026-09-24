import musicModel from "../models/music.model.js";
import uploadFile, {
  deleteMusicFiles,
  deleteAlbumCover,
} from "../services/storage.service.js";
import albumModel from "../models/album.model.js";
import playHistoryModel from "../models/playHistory.model.js";
import { validateFile } from "../utils/fileValidation.js";
import userModel from "../models/user.model.js";
import mongoose from "mongoose";
import {
  getCache,
  setCache,
  deleteCacheByPattern,
} from "../services/cache.service.js";

async function createMusic(req, res) {
  const { title } = req.body;
  const file = req.file;
  const coverImageFile = req.coverImageFile;

  const validation = validateFile(file, "audio");
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  if (coverImageFile) {
    const imageValidation = validateFile(coverImageFile, "image");
    if (!imageValidation.valid) {
      return res.status(400).json({ message: imageValidation.message });
    }
  }

  const result = await uploadFile(file);

  let coverImageUrl = null;
  let coverImageFileId = null;
  if (coverImageFile) {
    const imageResult = await uploadFile({
      ...coverImageFile,
      folder: "covers",
    });
    coverImageUrl = imageResult.url;
    coverImageFileId = imageResult.fileId;
  }

  const music = await musicModel.create({
    uri: result.url,
    fileId: result.fileId,
    title,
    artist: req.user.id,
    coverImage: coverImageUrl,
    coverImageFileId,
  });

  await deleteCacheByPattern("music:*");

  return res.status(201).json({
    message: "Song Created Successfully!!!",
    music: {
      id: music._id,
      uri: music.uri,
      title: music.title,
      artist: music.artist,
      coverImage: music.coverImage,
    },
  });
}

async function createAlbum(req, res) {
  const { title } = req.body;
  let musics = req.body.musics;
  const coverImageFile = req.file; // uploadImageSingle se aayega
  // FormData se musics JSON string ban ke aata hai
  if (typeof musics === "string") {
    try {
      musics = JSON.parse(musics);
    } catch {
      musics = [];
    }
  }

  if (coverImageFile) {
    const imageValidation = validateFile(coverImageFile, "image");
    if (!imageValidation.valid) {
      return res.status(400).json({ message: imageValidation.message });
    }
  }

  if (Array.isArray(musics) && musics.length > 0) {
    const ownedCount = await musicModel.countDocuments({
      _id: { $in: musics },
      artist: req.user.id,
    });

    if (ownedCount !== musics.length) {
      return res.status(403).json({
        message: "You can only add your own music to an album",
      });
    }
  }

  let coverImageUrl = null;
  let coverImageFileId = null;
  if (coverImageFile) {
    const imageResult = await uploadFile({
      ...coverImageFile,
      folder: "covers",
    });
    coverImageUrl = imageResult.url;
    coverImageFileId = imageResult.fileId;
  }

  const album = await albumModel.create({
    title,
    artist: req.user.id,
    musics,
    coverImage: coverImageUrl,
    coverImageFileId,
  });
  await deleteCacheByPattern("music:*");

  return res.status(201).json({
    message: "Album Created Successfully",
    album: {
      id: album._id,
      title: album.title,
      artist: album.artist,
      musics: album.musics,
      coverImage: album.coverImage,
    },
  });
}

async function getAllMusics(req, res) {
  const cacheKey = "music:all";
  const cached = await getCache(cacheKey);
  console.log("⚡ CACHE se mila — DB touch nahi hua");
  if (cached) {
    return res.status(200).json({
      message: "Music Fetched Successfully",
      musics: cached,
    });
  }
  console.log("🐢 DB se le rahe hain — cache khali thi");
  const musics = await musicModel
    .find()
    .limit(10)
    .sort({ createdAt: -1, _id: -1 })
    .populate("artist", "username email");
  await setCache(cacheKey, musics, 60);

  return res.status(200).json({
    message: "Music Fetched Successfully",
    musics,
  });
}

async function getMyMusics(req, res) {
  const musics = await musicModel
    .find({ artist: req.user.id })
    .sort({ createdAt: -1, _id: -1 })
    .populate("artist", "username email");

  // Har music ke liye playHistory se count nikalo, ek hi aggregation call mein
  const musicIds = musics.map((m) => m._id);

  const playCounts = await playHistoryModel.aggregate([
    { $match: { music: { $in: musicIds } } },
    { $group: { _id: "$music", count: { $sum: 1 } } },
  ]);

  // { musicId: count } shape mein map banao, fast lookup ke liye
  const countMap = {};
  playCounts.forEach((pc) => {
    countMap[pc._id.toString()] = pc.count;
  });

  const musicsWithCount = musics.map((m) => {
    const data = m.toObject();
    data.playCount = countMap[m._id.toString()] || 0;
    return data;
  });

  return res.status(200).json({
    message: "Artist Music Fetched Successfully",
    musics: musicsWithCount,
  });
}

async function getAllAlbums(req, res) {
  const albums = await albumModel
    .find()
    .sort({ createdAt: -1, _id: -1 })
    .populate("artist", "username email")
    .populate({
      path: "musics",
      populate: { path: "artist", select: "username email" },
    });
  const normalizedAlbums = albums.map((album) => {
    const data = album.toObject();
    if (!data.artist && data.musics?.[0]?.artist)
      data.artist = data.musics[0].artist;
    return data;
  });

  return res.status(200).json({
    message: "Albums Fetched Successfully",
    albums: normalizedAlbums,
  });
}

async function getMyAlbums(req, res) {
  const albums = await albumModel
    .find({ artist: req.user.id })
    .sort({ createdAt: -1, _id: -1 })
    .populate("artist", "username email")
    .populate({
      path: "musics",
      populate: { path: "artist", select: "username email" },
    });

  return res.status(200).json({
    message: "Artist Albums Fetched Successfully",
    albums,
  });
}

async function getAlbumById(req, res) {
  const albumId = req.params.albumId;

  const album = await albumModel
    .findById(albumId)
    .populate("artist", "username email")
    .populate({
      path: "musics",
      populate: { path: "artist", select: "username email" },
    });

  if (!album) {
    return res.status(404).json({
      message: "Album not found",
    });
  }

  // Older records may not have an album artist reference. Use the owner of
  // the first track as a backwards-compatible fallback for those records.
  const albumData = album.toObject();
  if (!albumData.artist && albumData.musics?.[0]?.artist) {
    albumData.artist = albumData.musics[0].artist;
  }

  return res.status(200).json({
    message: "Album Fetched Successfully",
    album: albumData,
  });
}

async function deleteMusic(req, res) {
  const { musicId } = req.params;

  const music = await musicModel.findById(musicId);

  if (!music) {
    return res.status(404).json({ message: "Music not found" });
  }

  if (music.artist.toString() !== req.user.id) {
    return res
      .status(403)
      .json({ message: "You can only delete your own music" });
  }

  await musicModel.findByIdAndDelete(musicId);
  await deleteCacheByPattern("music:*");
  // DB delete ho gaya, ab ImageKit se files hatao (best effort)
  await deleteMusicFiles(music);

  return res.status(200).json({ message: "Music deleted successfully" });
}

async function deleteAlbum(req, res) {
  const { albumId } = req.params;

  const album = await albumModel.findById(albumId);

  if (!album) {
    return res.status(404).json({ message: "Album not found" });
  }

  if (album.artist.toString() !== req.user.id) {
    return res
      .status(403)
      .json({ message: "You can only delete your own album" });
  }

  await albumModel.findByIdAndDelete(albumId);
  await deleteCacheByPattern("music:*");
  await deleteAlbumCover(album);

  return res.status(200).json({ message: "Album deleted successfully" });
}

async function recordPlay(req, res) {
  const { musicId } = req.params;

  const music = await musicModel.findById(musicId);

  if (!music) {
    return res.status(404).json({ message: "Music not found" });
  }

  // Duplicate guard — agar wahi user usi gaane ko pichle
  // 10 second mein already track kar chuka hai, dobara mat banao
  // (StrictMode double-effects, ya accidental double-call se bachne ke liye)
  const recentDuplicate = await playHistoryModel.findOne({
    user: req.user.id,
    music: musicId,
    playedAt: { $gte: new Date(Date.now() - 10 * 1000) },
  });

  if (!recentDuplicate) {
    await playHistoryModel.create({
      user: req.user.id,
      music: musicId,
    });
  }

  return res.status(200).json({ message: "Play recorded" });
}

// ========================================
// Search
// ========================================

async function searchMusic(req, res) {
  const { q } = req.query;

  if (!q || !q.trim()) {
    return res.status(400).json({ message: "Search query is required" });
  }

  const searchRegex = new RegExp(q.trim(), "i");

  const matchingArtists = await userModel
    .find({ username: searchRegex, role: "artist" })
    .select("_id");

  const matchingArtistIds = matchingArtists.map((a) => a._id);

  const musics = await musicModel
    .find({
      $or: [{ title: searchRegex }, { artist: { $in: matchingArtistIds } }],
    })
    .sort({ createdAt: -1, _id: -1 })
    .limit(20)
    .populate("artist", "username email");

  return res.status(200).json({
    message: "Search results fetched successfully",
    musics,
  });
}

// ========================================
// Like / Unlike
// ========================================

async function toggleLikeMusic(req, res) {
  const { musicId } = req.params;

  const music = await musicModel.findById(musicId);

  if (!music) {
    return res.status(404).json({ message: "Music not found" });
  }

  const user = await userModel.findById(req.user.id);

  const alreadyLiked = user.likedMusics.some((id) => id.toString() === musicId);

  if (alreadyLiked) {
    user.likedMusics = user.likedMusics.filter(
      (id) => id.toString() !== musicId,
    );
  } else {
    user.likedMusics.push(musicId);
  }

  await user.save();

  return res.status(200).json({
    message: alreadyLiked ? "Music unliked" : "Music liked",
    liked: !alreadyLiked,
  });
}

async function getLikedMusics(req, res) {
  const user = await userModel.findById(req.user.id).populate({
    path: "likedMusics",
    populate: { path: "artist", select: "username email" },
  });

  return res.status(200).json({
    message: "Liked music fetched successfully",
    musics: user.likedMusics,
  });
}

// ========================================
// Follow / Unfollow Artist
// ========================================

async function toggleFollowArtist(req, res) {
  const { artistId } = req.params;

  if (artistId === req.user.id) {
    return res.status(400).json({ message: "You cannot follow yourself" });
  }

  const artist = await userModel.findById(artistId);

  if (!artist || artist.role !== "artist") {
    return res.status(404).json({ message: "Artist not found" });
  }

  const user = await userModel.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const followedArtists = user.followedArtists || [];
  const alreadyFollowing = followedArtists.some(
    (id) => id.toString() === artistId,
  );

  if (alreadyFollowing) {
    user.followedArtists = followedArtists.filter(
      (id) => id.toString() !== artistId,
    );
  } else {
    user.followedArtists = followedArtists;
    user.followedArtists.push(artistId);
  }

  await user.save();

  return res.status(200).json({
    message: alreadyFollowing ? "Artist unfollowed" : "Artist followed",
    following: !alreadyFollowing,
  });
}

async function getFollowedArtists(req, res) {
  const user = await userModel
    .findById(req.user.id)
    .populate("followedArtists", "username email");

  return res.status(200).json({
    message: "Followed artists fetched successfully",
    artists: user.followedArtists,
  });
}

async function getArtists(req, res) {
  const { q } = req.query;
  const filter = { role: "artist" };
  if (q?.trim()) filter.username = new RegExp(q.trim(), "i");
  const artists = await userModel
    .find(filter)
    .select("_id username email")
    .sort({ username: 1 });
  return res
    .status(200)
    .json({ message: "Artists fetched successfully", artists });
}

async function getArtistById(req, res) {
  const artist = await userModel
    .findOne({ _id: req.params.artistId, role: "artist" })
    .select("_id username email");
  if (!artist) return res.status(404).json({ message: "Artist not found" });
  const musics = await musicModel
    .find({ artist: artist._id })
    .sort({ createdAt: -1, _id: -1 })
    .populate("artist", "username email");
  return res
    .status(200)
    .json({ message: "Artist fetched successfully", artist, musics });
}

// ========================================
// Recently Played
// ========================================

async function getRecentlyPlayed(req, res) {
  const history = await playHistoryModel.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(req.user.id) } },
    { $sort: { playedAt: -1 } },
    { $group: { _id: "$music", lastPlayedAt: { $first: "$playedAt" } } },
    { $sort: { lastPlayedAt: -1 } },
    { $limit: 20 },
  ]);

  const musicIds = history.map((h) => h._id);

  const musics = await musicModel
    .find({ _id: { $in: musicIds } })
    .populate("artist", "username email");

  // Aggregation ka order preserve karo (most recent pehle)
  const orderedMusics = musicIds
    .map((id) => musics.find((m) => m._id.toString() === id.toString()))
    .filter(Boolean);

  return res.status(200).json({
    message: "Recently played fetched successfully",
    musics: orderedMusics,
  });
}

async function updateMusic(req, res) {
  const { musicId } = req.params;
  const { title } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ message: "Title is required" });
  }

  const music = await musicModel.findById(musicId);

  if (!music) {
    return res.status(404).json({ message: "Music not found" });
  }

  if (music.artist.toString() !== req.user.id) {
    return res
      .status(403)
      .json({ message: "You can only edit your own music" });
  }

  music.title = title.trim();
  await music.save();
  await deleteCacheByPattern("music:*");

  return res.status(200).json({
    message: "Music updated successfully",
    music,
  });
}

async function updateAlbum(req, res) {
  const { albumId } = req.params;
  const { title } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ message: "Title is required" });
  }

  const album = await albumModel.findById(albumId);

  if (!album) {
    return res.status(404).json({ message: "Album not found" });
  }

  if (album.artist.toString() !== req.user.id) {
    return res
      .status(403)
      .json({ message: "You can only edit your own album" });
  }

  album.title = title.trim();
  await album.save();
  await deleteCacheByPattern("music:*");

  return res.status(200).json({
    message: "Album updated successfully",
    album,
  });
}

async function removeMusicFromAlbum(req, res) {
  const { albumId, musicId } = req.params;

  const album = await albumModel.findById(albumId);

  if (!album) {
    return res.status(404).json({ message: "Album not found" });
  }

  if (album.artist.toString() !== req.user.id) {
    return res
      .status(403)
      .json({ message: "You can only edit your own album" });
  }

  const wasPresent = album.musics.some((id) => id.toString() === musicId);

  if (!wasPresent) {
    return res
      .status(404)
      .json({ message: "This song is not part of the album" });
  }

  album.musics = album.musics.filter((id) => id.toString() !== musicId);
  await album.save();

  const updatedAlbum = await albumModel
    .findById(albumId)
    .populate("artist", "username email")
    .populate({
      path: "musics",
      populate: { path: "artist", select: "username email" },
    });
  await deleteCacheByPattern("music:*");

  return res.status(200).json({
    message: "Song removed from album",
    album: updatedAlbum,
  });
}

export default {
  createMusic,
  createAlbum,
  getAllMusics,
  getMyMusics,
  getAllAlbums,
  getMyAlbums,
  getAlbumById,
  deleteMusic,
  deleteAlbum,
  recordPlay,
  searchMusic,
  toggleLikeMusic,
  getLikedMusics,
  toggleFollowArtist,
  getFollowedArtists,
  getArtists,
  getArtistById,
  getRecentlyPlayed,
  updateMusic,
  updateAlbum,
  removeMusicFromAlbum,
};
