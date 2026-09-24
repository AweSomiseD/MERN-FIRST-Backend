import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./src/app.js";
import connectDB from "./src/db/db.js";
import jwt from "jsonwebtoken";

connectDB();

const httpServer = http.createServer(app); // Express ko HTTP server mein wrap kiya

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // React frontend
    credentials: true,
  },
});

// ========================================
// Chhota helper: raw cookie string ko object mein todta hai
// Example: "accessToken=abc123; refreshToken=xyz" → { accessToken: "abc123", refreshToken: "xyz" }
// ========================================
function parseCookies(rawCookies) {
  const result = {};
  if (!rawCookies) return result;

  rawCookies.split(";").forEach((pair) => {
    const [key, ...valueParts] = pair.trim().split("=");
    result[key] = decodeURIComponent(valueParts.join("="));
  });

  return result;
}

// ========================================
// Socket Authentication Middleware
// (connection allow hone se PEHLE chalta hai)
// ========================================
io.use((socket, next) => {
  try {
    const rawCookies = socket.handshake.headers.cookie;

    socket.userId = null;
    socket.userRole = "guest";

    if (rawCookies) {
      const parsedCookies = parseCookies(rawCookies);
      const token = parsedCookies.accessToken;

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
      }
    }

    next(); // sab theek hai, connection allow karo
  } catch (error) {
    socket.userId = null;
    socket.userRole = "guest";
    next();
  }
});

function getListenerCount() {
  return [...io.sockets.sockets.values()].filter(
    (connectedSocket) => connectedSocket.userRole === "listener",
  ).length;
}

function broadcastListenerCount() {
  io.emit("online_count", getListenerCount());
}

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id, "Role:", socket.userRole);

  broadcastListenerCount();

  socket.on("get_online_count", () => {
    socket.emit("online_count", getListenerCount());
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    broadcastListenerCount();
  });
});

httpServer.listen(3000, () => {
  console.log("Server Is Running On 3000 Port");
});
