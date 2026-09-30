import mongoose from "mongoose";

// ========================================
// Participant = conversation ka ek member + us ka apna unread/read state
// ========================================
const participantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    // Role ka snapshot (conversation banate waqt).
    // Authorization ke liye NAHI, sirf UI/filtering ke liye.
    role: {
      type: String,
      enum: ["listener", "artist", "admin"],
      required: true,
    },

    // Is user ke liye kitne messages unread hain (unread messages)
    // "unread conversations" = jahan yeh > 0 ho
    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Read cursor: is waqt tak ke sab messages is user ne parh liye
    lastReadAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

// ========================================
// Last message ki chhoti copy (conversation list ke liye,
// taake har row ke liye alag Message query na karni paye)
// ========================================
const lastMessageSchema = new mongoose.Schema(
  {
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: "message" },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    preview: { type: String, maxlength: 120 },
    createdAt: { type: Date },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    // Abhi sirf "direct". Baad mein: "support", "group"
    type: {
      type: String,
      enum: ["direct"],
      default: "direct",
    },

    // Duplicate conversation rokne ke liye:
    // "direct:<chhota userId>:<bada userId>" (dono taraf se same key)
    // unique + sparse: future group chats ke liye pairKey optional rahega
    pairKey: {
      type: String,
      unique: true,
      sparse: true,
    },

    participants: {
      type: [participantSchema],
      validate: {
        validator(list) {
          if (this.type !== "direct") return true;
          return (
            list.length === 2 && String(list[0].user) !== String(list[1].user)
          );
        },
        message: "A direct conversation needs exactly 2 different participants",
      },
    },

    lastMessage: {
      type: lastMessageSchema,
      default: null,
    },

    // Conversation list isi se sort hoti hai
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// "Meri conversations, sab se nayi pehle" query ke liye
conversationSchema.index({ "participants.user": 1, lastMessageAt: -1 });

// Dono users ke liye hamesha same key banata hai (order matter nahi karta)
conversationSchema.statics.buildPairKey = function (userIdA, userIdB) {
  const [first, second] = [String(userIdA), String(userIdB)].sort();
  return `direct:${first}:${second}`;
};

const conversationModel = mongoose.model("conversation", conversationSchema);

export default conversationModel;
