import userModel from "../models/user.model.js";
import registerChatSocket from "./chat.socket.js";

export default function registerSockets(io) {
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

      socket.userRole = user.role;

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

      registerChatSocket(io, socket);
      socket.emit("socket:ready");
    } catch (error) {
      console.error("Socket connection setup error:", error);
      socket.disconnect(true);
    }
  });
}
