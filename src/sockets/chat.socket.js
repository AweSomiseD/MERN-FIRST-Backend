import { getParticipantConversation } from "../services/conversation.service.js";

import {
  sendMessage,
  markConversationRead,
} from "../services/message.service.js";

export default function registerChatSocket(io, socket) {
  console.log("Chat socket registered:", socket.id);

  // Join conversation room
  socket.on("conversation:join", async (conversationId, ack) => {
    try {
      const conversation = await getParticipantConversation(
        conversationId,
        socket.userId,
      );

      const room = `conversation:${conversation._id}`;

      socket.join(room);

      console.log(
        "Conversation joined:",
        socket.id,
        "User:",
        socket.userId,
        "Conversation:",
        conversation._id.toString(),
        "Room:",
        room,
      );

      ack?.({
        success: true,
        conversationId: conversation._id,
      });
    } catch (error) {
      console.error("Conversation join error:", error);

      ack?.({
        success: false,
        message: error.message || "Unable to join conversation",
        code: error.code || "CONVERSATION_JOIN_FAILED",
      });
    }
  });

  // Send message
  socket.on("message:send", async (payload, ack) => {
    try {
      const { conversationId, content, clientMessageId } = payload || {};

      const result = await sendMessage({
        conversationId,
        senderId: socket.userId,
        content,
        clientMessageId,
      });

      const room = `conversation:${result.conversation._id}`;

      // Send message to everyone currently inside this conversation
      io.to(room).emit("message:new", result.message);

      // Send acknowledgement to sender
      ack?.({
        success: true,
        message: result.message,
        duplicate: result.duplicate,
      });
    } catch (error) {
      console.error("Message send error:", error);

      ack?.({
        success: false,
        message: error.message || "Unable to send message",
        code: error.code || "MESSAGE_SEND_FAILED",
      });
    }
  });

  // Mark conversation as read
  socket.on("conversation:read", async (conversationId, ack) => {
    try {
      const result = await markConversationRead({
        conversationId,
        userId: socket.userId,
      });

      ack?.({
        success: true,
        conversationId: result.conversationId,
        readAt: result.readAt,
        previousUnreadCount: result.previousUnreadCount,
      });
    } catch (error) {
      console.error("Conversation read error:", error);

      ack?.({
        success: false,
        message: error.message || "Unable to mark conversation as read",
        code: error.code || "CONVERSATION_READ_FAILED",
      });
    }
  });
}
