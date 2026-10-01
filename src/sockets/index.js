import userModel from "../models/user.model.js";
import registerChatSocket from "./chat.socket.js";
import conversationModel from "../models/conversation.model.js";
import {
  addOnlineUser,
  isUserOnline,
  removeOnlineUser,
} from "./presence.js";

const emitPresenceToPartners = async (io, userId, isOnline) => {
  try {
    const conversations = await conversationModel
      .find({
        "participants.user": userId,
      })
      .select("participants.user")
      .lean();

    for (const conversation of conversations) {
      if (isUserOnline(userId) !== isOnline) return;

      const otherParticipants = conversation.participants.filter(
        (participant) => String(participant.user) !== String(userId),
      );

      for (const participant of otherParticipants) {
        io.to(`user:${participant.user}`).emit("user:presence", {
          userId: String(userId),
          isOnline,
        });
      }
    }
  } catch (error) {
    console.error("Partner presence broadcast failed:", error);
  }
};

export default function registerSockets(io) {
  const getListenerCount = () =>
    [...io.sockets.sockets.values()].filter(
      (connectedSocket) => connectedSocket.userRole === "listener",
    ).length;

  const broadcastListenerCount = () => {
    io.emit("online_count", getListenerCount());
  };

  io.on("connection", async (socket) => {
    try {
      if (!socket.userId) {
        console.log("Guest socket connected:", socket.id);
        socket.disconnect(true);
        return;
      }

      const user = await userModel
        .findById(socket.userId)
        .select("_id role isBanned")
        .lean();

      if (!user) {
        console.log("Socket user not found:", socket.id);
        socket.disconnect(true);
        return;
      }

      if (user.isBanned) {
        console.log("Banned user socket rejected:", socket.id);
        socket.disconnect(true);
        return;
      }

      if (!socket.connected) return;

      socket.userRole = user.role;

      const userId = String(user._id);

      const previousCount = addOnlineUser(userId);

      console.log("User online:", userId);

      const userRoom = `user:${user._id}`;

      socket.join(userRoom);

      console.log(
        "Socket authenticated:",
        socket.id,
        "User:",
        user._id.toString(),
        "Role:",
        user.role,
        "Room:",
        userRoom,
      );

      socket.on("disconnect", async () => {
        const remainingCount = removeOnlineUser(userId);

        if (remainingCount === 0) {
          await emitPresenceToPartners(io, userId, false);
          console.log("User offline:", userId);
        } else {
          console.log(
            "Socket disconnected:",
            socket.id,
            "Remaining sockets:",
            remainingCount,
          );
        }

        broadcastListenerCount();
      });

      socket.on("get_online_count", () => {
        socket.emit("online_count", getListenerCount());
      });

      if (["listener", "artist"].includes(user.role)) {
        registerChatSocket(io, socket, { isUserOnline });
      }

      broadcastListenerCount();

      if (previousCount === 0) {
        await emitPresenceToPartners(io, userId, true);
      }

      socket.emit("socket:ready");
    } catch (error) {
      console.error("Socket connection setup error:", error);
      socket.disconnect(true);
    }
  });
}
