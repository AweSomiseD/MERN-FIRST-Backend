import conversationModel from "../models/conversation.model.js";
import messageModel from "../models/message.model.js";
import userModel from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import {
  getParticipantConversation,
  isObjectId,
  toObjectId,
  clampLimit,
} from "./conversation.service.js";

const MAX_CONTENT_LENGTH = 2000;
const PREVIEW_LENGTH = 120;

const toMessageDTO = (message) => ({
  _id: message._id,
  conversation: message.conversation,
  sender: message.sender,
  type: message.type,
  content: message.content,
  clientMessageId: message.clientMessageId ?? null,
  createdAt: message.createdAt,
});

// ========================================
// Chat history (cursor pagination: purane messages "before" se)
// Response: messages purane -> naye order mein
// ========================================
export async function getMessages(conversationId, userId, { before, limit }) {
  // Pehle authorization: participant nahi to 404
  await getParticipantConversation(conversationId, userId);

  const pageSize = clampLimit(limit, 30, 50);
  const filter = { conversation: conversationId };

  if (before) {
    if (!isObjectId(String(before))) {
      throw new AppError(400, "INVALID_CURSOR", "Invalid cursor");
    }
    filter._id = { $lt: before };
  }

  const docs = await messageModel
    .find(filter)
    .sort({ _id: -1 })
    .limit(pageSize + 1)
    .lean();

  const hasMore = docs.length > pageSize;
  const page = hasMore ? docs.slice(0, pageSize) : docs;

  const messages = page.reverse().map(toMessageDTO);

  return {
    messages,
    nextCursor: hasMore ? String(messages[0]._id) : null,
  };
}

// ========================================
// Message bhejna (Step 3 mein socket isi ko call karega)
//  1. validate  2. participant check  3. Message save  4. Conversation atomic update
// ========================================
export async function sendMessage({
  conversationId,
  senderId,
  content,
  clientMessageId,
}) {
  if (typeof content !== "string") {
    throw new AppError(400, "INVALID_CONTENT", "Message content is required");
  }

  const text = content.trim();

  if (text.length < 1 || text.length > MAX_CONTENT_LENGTH) {
    throw new AppError(
      400,
      "INVALID_CONTENT",
      `Message must be 1-${MAX_CONTENT_LENGTH} characters`,
    );
  }

  if (
    clientMessageId != null &&
    (typeof clientMessageId !== "string" || clientMessageId.length > 64)
  ) {
    throw new AppError(400, "INVALID_CLIENT_ID", "Invalid clientMessageId");
  }

  const conversation = await getParticipantConversation(
    conversationId,
    senderId,
  );

  const receiver = conversation.participants.find(
    (p) => String(p.user) !== String(senderId),
  );

  // Doosra user delete ho chuka ho to message nahi bhej sakte
  const receiverExists =
    receiver && (await userModel.exists({ _id: receiver.user }));
  if (!receiverExists) {
    throw new AppError(
      409,
      "RECIPIENT_UNAVAILABLE",
      "This user no longer exists",
    );
  }

  let message;

  try {
    message = await messageModel.create({
      conversation: conversation._id,
      sender: senderId,
      content: text,
      clientMessageId: clientMessageId || undefined,
    });
  } catch (error) {
    // Same clientMessageId dobara aaya (retry/double-click): purana message hi wapas do
    if (error.code === 11000 && clientMessageId) {
      const existing = await messageModel
        .findOne({
          conversation: conversation._id,
          sender: senderId,
          clientMessageId,
        })
        .lean();

      if (existing) {
        return {
          message: toMessageDTO(existing),
          conversation,
          duplicate: true,
        };
      }
    }
    throw error;
  }

  // Ek hi atomic update:
  //  - receiver ka unreadCount +1
  //  - sender ka unreadCount 0 aur lastReadAt = ab (jawab dene ka matlab usne parha)
  //  - lastMessage / lastMessageAt
  const updatedConversation = await conversationModel
    .findOneAndUpdate(
      { _id: conversation._id },
      {
        $inc: { "participants.$[receiver].unreadCount": 1 },
        $set: {
          "participants.$[sender].unreadCount": 0,
          "participants.$[sender].lastReadAt": message.createdAt,
          lastMessage: {
            messageId: message._id,
            sender: message.sender,
            preview: text.slice(0, PREVIEW_LENGTH),
            createdAt: message.createdAt,
          },
          lastMessageAt: message.createdAt,
        },
      },
      {
        // new: true,
        returnDocument: "after",
        arrayFilters: [
          { "receiver.user": toObjectId(receiver.user) },
          { "sender.user": toObjectId(senderId) },
        ],
      },
    )
    .lean();

  return {
    message: toMessageDTO(message.toObject()),
    conversation: updatedConversation,
    duplicate: false,
  };
}

// ========================================
// Conversation "read" mark karna
// previousUnreadCount > 0 ho to socket layer doosri taraf ko read-event bhejegi
// ========================================
export async function markConversationRead({ conversationId, userId }) {
  if (!isObjectId(String(conversationId))) {
    throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
  }

  const readAt = new Date();

  const before = await conversationModel
    .findOneAndUpdate(
      { _id: conversationId, "participants.user": userId },
      {
        $set: {
          "participants.$[me].unreadCount": 0,
          "participants.$[me].lastReadAt": readAt,
        },
      },
      {
        // new: false, // purani state wapas do, taake pata chale kitne unread thay
        returnDocument: "before", // purani state wapas do, taake pata chale kitne unread thay
        arrayFilters: [{ "me.user": toObjectId(userId) }],
      },
    )
    .lean();

  if (!before) {
    throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
  }

  const me = before.participants.find((p) => String(p.user) === String(userId));

  return {
    conversationId: before._id,
    readAt,
    previousUnreadCount: me?.unreadCount ?? 0,
  };
}
