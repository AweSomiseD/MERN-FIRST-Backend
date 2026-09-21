import mongoose from "mongoose";

const albumSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    musics: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "music",
      },
    ],
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    coverImage: {
      type: String,
      default: null,
    },
    coverImageFileId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);
const albumModel = mongoose.model("album", albumSchema);

export default albumModel;
