import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "conversation",
      required: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    // Abhi sirf text. Baad mein: "image", "system", etc.
    type: {
      type: String,
      enum: ["text"],
      default: "text",
    },

    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },

    // Client apni taraf se ek unique id bhejta hai.
    // Network retry ya double-click par same message do baar save nahi hota.
    clientMessageId: {
      type: String,
      maxlength: 64,
    },
  },
  { timestamps: true },
);

// Chat history: "is conversation ke naye messages pehle" + cursor pagination
messageSchema.index({ conversation: 1, _id: -1 });

// Duplicate send se bachao (sirf tab jab clientMessageId diya gaya ho)
messageSchema.index(
  { conversation: 1, sender: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: "string" } },
  },
);

const messageModel = mongoose.model("message", messageSchema);

export default messageModel;
