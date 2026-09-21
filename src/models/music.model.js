import mongoose from "mongoose";

const musicSchema = new mongoose.Schema(
  {
    uri: {
      type: String,
      required: true,
    },
    fileId: {
      type: String,
      default: null,
    },
    title: {
      type: String,
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
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
  },
  { timestamps: true },
);

const musicModel = mongoose.model("music", musicSchema);

export default musicModel;
