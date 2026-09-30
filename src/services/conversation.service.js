import mongoose from "mongoose";
import conversationModel from "../models/conversation.model.js";
import userModel from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";

// ========================================
// Chhote helpers
// ========================================
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export const isObjectId = (value) =>
  typeof value === "string" && OBJECT_ID_REGEX.test(value);

export const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

export const clampLimit = (value, fallback = 20, max = 50) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
};

const notFound = () =>
  new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");

// ========================================
// Policy: kaun kis se conversation shuru kar sakta hai (SIRF ek jagah)
// Baad mein admin support / artist<->artist yahan add hoga.
// ========================================
export const canStartConversation = (actor, target) =>
  actor.role === "listener" && target.role === "artist";

// ========================================
// Authorization ka main gate:
// Conversation sirf tab milti hai jab user uska participant ho.
// Participant nahi -> 404 (403 nahi, taake conversation ka wujood leak na ho)
// ========================================
export async function getParticipantConversation(conversationId, userId) {
  if (!isObjectId(String(conversationId))) throw notFound();

  const conversation = await conversationModel
    .findOne({ _id: conversationId, "participants.user": userId })
    .lean();

  if (!conversation) throw notFound();

  return conversation;
}

// ========================================
// Raw conversation -> frontend ke liye DTO (viewer ke nazariye se)
// otherUser null ho to matlab doosra user delete ho chuka hai
// ========================================
export async function toConversationDTOs(conversations, viewerId) {
  const viewer = String(viewerId);

  const otherIds = conversations
    .map((c) => c.participants.find((p) => String(p.user) !== viewer)?.user)
    .filter(Boolean);

  const users = otherIds.length
    ? await userModel
        .find({ _id: { $in: otherIds } })
        .select("username role")
        .lean()
    : [];

  const userMap = new Map(users.map((u) => [String(u._id), u]));

  return conversations.map((c) => {
    const me = c.participants.find((p) => String(p.user) === viewer);
    const other = c.participants.find((p) => String(p.user) !== viewer);
    const otherUser = other ? userMap.get(String(other.user)) : null;

    return {
      _id: c._id,
      type: c.type,
      otherUserId: other?.user ?? null,
      otherUser: otherUser
        ? {
            _id: otherUser._id,
            username: otherUser.username,
            role: otherUser.role,
          }
        : null,
      unreadCount: me?.unreadCount ?? 0,
      lastReadAt: me?.lastReadAt ?? null,
      otherLastReadAt: other?.lastReadAt ?? null, // read receipts ke liye
      lastMessage: c.lastMessage ?? null,
      lastMessageAt: c.lastMessageAt ?? null,
      createdAt: c.createdAt,
    };
  });
}

// ========================================
// Find or create (duplicate kabhi nahi banegi: pairKey unique index)
// ========================================
export async function findOrCreateConversation(actorId, targetId) {
  if (!isObjectId(String(targetId))) {
    throw new AppError(400, "INVALID_ID", "Invalid artist id");
  }

  if (String(actorId) === String(targetId)) {
    throw new AppError(400, "INVALID_TARGET", "You cannot message yourself");
  }

  // Role/ban hamesha DB se (JWT ka role 15 minute purana ho sakta hai)
  const users = await userModel
    .find({ _id: { $in: [actorId, targetId] } })
    .select("role isBanned")
    .lean();

  const actor = users.find((u) => String(u._id) === String(actorId));
  const target = users.find((u) => String(u._id) === String(targetId));

  if (!actor || actor.isBanned) {
    throw new AppError(403, "FORBIDDEN", "You cannot start conversations");
  }

  if (!target) {
    throw new AppError(404, "USER_NOT_FOUND", "Artist not found");
  }

  if (!canStartConversation(actor, target)) {
    throw new AppError(
      403,
      "NOT_ALLOWED",
      "You are not allowed to message this user",
    );
  }

  if (target.isBanned) {
    throw new AppError(403, "USER_UNAVAILABLE", "This artist is unavailable");
  }

  const pairKey = conversationModel.buildPairKey(actor._id, target._id);

  let conversation;
  let created = false;

  try {
    const result = await conversationModel
      .findOneAndUpdate(
        { pairKey },
        {
          $setOnInsert: {
            type: "direct",
            pairKey,
            participants: [
              {
                user: actor._id,
                role: actor.role,
                unreadCount: 0,
                lastReadAt: null,
              },
              {
                user: target._id,
                role: target.role,
                unreadCount: 0,
                lastReadAt: null,
              },
            ],
            lastMessage: null,
            lastMessageAt: null,
          },
        },
        // { upsert: true, new: true, includeResultMetadata: true },
        { upsert: true, returnDocument: "after", includeResultMetadata: true },
      )
      .lean();

    conversation = result.value;
    // updatedExisting false => nayi document insert hui
    created = !result.lastErrorObject?.updatedExisting;
  } catch (error) {
    // Bohat rare race: dono requests ek saath insert karne gayin
    if (error.code !== 11000) throw error;
    conversation = await conversationModel.findOne({ pairKey }).lean();
  }

  const [dto] = await toConversationDTOs([conversation], actor._id);

  return { conversation: dto, created };
}

// ========================================
// Meri conversations (nayi pehle). Khali conversations (koi message nahi) hidden.
// ========================================
export async function listConversations(userId, { limit, cursor } = {}) {
  const pageSize = clampLimit(limit);

  const filter = {
    "participants.user": userId,
    lastMessageAt: { $ne: null },
  };

  if (cursor) {
    const cursorDate = new Date(cursor);
    if (Number.isNaN(cursorDate.getTime())) {
      throw new AppError(400, "INVALID_CURSOR", "Invalid cursor");
    }
    filter.lastMessageAt = { $lt: cursorDate };
  }

  const docs = await conversationModel
    .find(filter)
    .sort({ lastMessageAt: -1, _id: -1 })
    .limit(pageSize + 1)
    .lean();

  const hasMore = docs.length > pageSize;
  const page = hasMore ? docs.slice(0, pageSize) : docs;

  const conversations = await toConversationDTOs(page, userId);

  return {
    conversations,
    nextCursor: hasMore
      ? page[page.length - 1].lastMessageAt.toISOString()
      : null,
  };
}

// ========================================
// Ek conversation (deep link /messages/:id ke liye). Khali conversation bhi milti hai.
// ========================================
export async function getConversationForUser(conversationId, userId) {
  const conversation = await getParticipantConversation(conversationId, userId);
  const [dto] = await toConversationDTOs([conversation], userId);
  return dto;
}

// ========================================
// Unread summary:
//   messages      = meri saari conversations ke unreadCount ka sum
//   conversations = wo conversations jahan mera unreadCount > 0
// ========================================
export async function getUnreadSummary(userId) {
  const me = toObjectId(userId);

  const [result] = await conversationModel.aggregate([
    { $match: { "participants.user": me } },
    { $unwind: "$participants" },
    {
      $match: {
        "participants.user": me,
        "participants.unreadCount": { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        messages: { $sum: "$participants.unreadCount" },
        conversations: { $sum: 1 },
      },
    },
  ]);

  return {
    messages: result?.messages ?? 0,
    conversations: result?.conversations ?? 0,
  };
}
