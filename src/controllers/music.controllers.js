import musicModel from "../models/music.model.js";
import uploadFile from "../services/storage.service.js";
import albumModel from "../models/album.model.js";

async function createMusic(req, res) {
  const { title } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      message: "Music file is required!",
    });
  }

  const result = await uploadFile(file.buffer.toString("base64"));

  const music = await musicModel.create({
    uri: result.url,
    title,
    artist: req.user.id,
  });

  return res.status(201).json({
    message: "Song Created Successfully!!!",
    music: {
      id: music._id,
      uri: music.uri,
      title: music.title,
      artist: music.artist,
    },
  });
}

async function createAlbum(req, res) {
  const { title, musics } = req.body;
  const album = await albumModel.create({
    title,
    artist: req.user.id,
    musics,
  });

  return res.status(201).json({
    message: "Album Created Successfully",
    album: {
      id: album._id,
      title: album.title,
      artist: album.artist,
      musics: album.musics,
    },
  });
}

async function getAllMusics(req, res) {
  const musics = await musicModel
    .find()
    // .skip(2)
    .limit(10)
    .populate("artist", "username email");
  return res.status(200).json({
    message: "Music Fetched Successfully",
    musics,
  });
}

async function getMyMusics(req, res) {
  const musics = await musicModel
    .find({ artist: req.user.id })
    .populate("artist", "username email");

  return res.status(200).json({
    message: "Artist Music Fetched Successfully",
    musics,
  });
}

async function getAllAlbums(req, res) {
  const albums = await albumModel
    .find()
    .populate("artist", "username email")
    .populate("musics");

  return res.status(200).json({
    message: "Albums Fetched Successfully",
    albums,
  });
}

async function getMyAlbums(req, res) {
  const albums = await albumModel
    .find({ artist: req.user.id })
    .populate("artist", "username email")
    .populate("musics");

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
    .populate("musics");

  if (!album) {
    return res.status(404).json({
      message: "Album not found",
    });
  }

  return res.status(200).json({
    message: "Album Fetched Successfully",
    album,
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
};
