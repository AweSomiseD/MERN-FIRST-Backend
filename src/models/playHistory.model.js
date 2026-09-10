import mongoose from "mongoose";

const playHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  music: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "music",
    required: true,
  },
  playedAt: {
    type: Date,
    default: Date.now,
  },
});

// Fast lookups: "iss user ki recently played" aur "iss music ka play count"
playHistorySchema.index({ user: 1, playedAt: -1 });
playHistorySchema.index({ music: 1 });

const playHistoryModel = mongoose.model("playHistory", playHistorySchema);

export default playHistoryModel;
