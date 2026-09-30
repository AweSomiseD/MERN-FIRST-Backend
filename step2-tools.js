// TEMPORARY tool (Step 2). Step 3 (sockets) ke baad delete kar dena.
// Backend root mein rakhein (step1-check.js ki tarah) aur wahin se chalayen:
//
//   node step2-tools.js send <conversationId> <senderUserId> "message text"
//   node step2-tools.js read <conversationId> <userId>
//
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "./src/db/db.js";
import {
  sendMessage,
  markConversationRead,
} from "./src/services/message.service.js";

const [command, conversationId, userId, ...rest] = process.argv.slice(2);

const usage = () => {
  console.log(
    'Usage:\n  node step2-tools.js send <conversationId> <senderUserId> "text"',
  );
  console.log("  node step2-tools.js read <conversationId> <userId>");
  process.exit(1);
};

if (!["send", "read"].includes(command) || !conversationId || !userId) usage();

const run = async () => {
  await connectDB();

  try {
    if (command === "send") {
      const result = await sendMessage({
        conversationId,
        senderId: userId,
        content: rest.join(" "),
        clientMessageId: `tool-${Date.now()}`,
      });

      console.log("Message saved:", result.message);
      console.log(
        "Participants now:",
        result.conversation.participants.map((p) => ({
          user: String(p.user),
          unreadCount: p.unreadCount,
        })),
      );
    }

    if (command === "read") {
      const result = await markConversationRead({ conversationId, userId });
      console.log("Marked read:", result);
    }
  } catch (error) {
    console.error("Failed:", error.code || "", error.message);
  } finally {
    await mongoose.disconnect();
  }
};

run();
