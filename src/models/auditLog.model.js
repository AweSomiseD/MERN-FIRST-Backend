import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "USER_ROLE_CHANGED",
        "USER_BANNED",
        "USER_UNBANNED",
        "USER_DELETED",
        "MUSIC_DELETED",
        "ALBUM_DELETED",
      ],
      required: true,
    },
    targetType: {
      type: String,
      enum: ["user", "music", "album"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    details: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true },
);

auditLogSchema.index({ createdAt: -1 });

const auditLogModel = mongoose.model("auditLog", auditLogSchema);

export default auditLogModel;
