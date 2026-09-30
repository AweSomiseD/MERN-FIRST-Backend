// TEMPORARY test script (Step 1). Test ke baad delete kar dena.
// Run (backend root se):  node scripts/step1-check.js
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "./src/db/db.js";
import conversationModel from "./src/models/conversation.model.js";
import messageModel from "./src/models/message.model.js";

let passed = 0;
let failed = 0;

const check = (name, condition) => {
  if (condition) {
    passed++;
    console.log("PASS:", name);
  } else {
    failed++;
    console.log("FAIL:", name);
  }
};

// Ek async function chalata hai aur batata hai ke error aaya ya nahi
const errorOf = async (fn) => {
  try {
    await fn();
    return null;
  } catch (error) {
    return error;
  }
};

const run = async () => {
  await connectDB();

  // Indexes ban jane tak ruko (unique index test ke liye zaroori)
  await conversationModel.init();
  await messageModel.init();

  // Fake ids (refs validate nahi hote, is liye real users ki zaroorat nahi)
  const listenerId = new mongoose.Types.ObjectId();
  const artistId = new mongoose.Types.ObjectId();
  const pairKey = conversationModel.buildPairKey(listenerId, artistId);

  const createdConversationIds = [];

  try {
    // 1. pairKey dono taraf se same
    check(
      "pairKey is same in both directions",
      pairKey === conversationModel.buildPairKey(artistId, listenerId),
    );

    // 2. conversation ban jati hai
    const conversation = await conversationModel.create({
      pairKey,
      participants: [
        { user: listenerId, role: "listener" },
        { user: artistId, role: "artist" },
      ],
    });
    createdConversationIds.push(conversation._id);
    check(
      "conversation created with unreadCount 0 and no lastMessage",
      conversation.participants[0].unreadCount === 0 &&
        conversation.lastMessage === null,
    );

    // 3. same pairKey dobara -> duplicate error (11000)
    const duplicateError = await errorOf(() =>
      conversationModel.create({
        pairKey,
        participants: [
          { user: artistId, role: "artist" },
          { user: listenerId, role: "listener" },
        ],
      }),
    );
    check(
      "duplicate conversation is rejected (E11000)",
      duplicateError?.code === 11000,
    );

    // 4. galat participants reject hon
    const sameUserError = await errorOf(() =>
      conversationModel.create({
        pairKey: "direct:test:same",
        participants: [
          { user: listenerId, role: "listener" },
          { user: listenerId, role: "listener" },
        ],
      }),
    );
    check("same user twice is rejected", !!sameUserError);

    const oneUserError = await errorOf(() =>
      conversationModel.create({
        pairKey: "direct:test:one",
        participants: [{ user: listenerId, role: "listener" }],
      }),
    );
    check("only one participant is rejected", !!oneUserError);

    // 5. message save hota hai
    const message = await messageModel.create({
      conversation: conversation._id,
      sender: listenerId,
      content: "  Hello artist!  ",
      clientMessageId: "client-1",
    });
    check(
      "message saved and content trimmed",
      message.content === "Hello artist!",
    );

    // 6. same clientMessageId dobara -> duplicate error
    const duplicateMessageError = await errorOf(() =>
      messageModel.create({
        conversation: conversation._id,
        sender: listenerId,
        content: "Hello artist!",
        clientMessageId: "client-1",
      }),
    );
    check(
      "duplicate clientMessageId is rejected (E11000)",
      duplicateMessageError?.code === 11000,
    );

    // 7. clientMessageId ke baghair do messages allowed hain
    const noIdOne = await errorOf(() =>
      messageModel.create({
        conversation: conversation._id,
        sender: listenerId,
        content: "One",
      }),
    );
    const noIdTwo = await errorOf(() =>
      messageModel.create({
        conversation: conversation._id,
        sender: listenerId,
        content: "Two",
      }),
    );
    check(
      "two messages without clientMessageId are allowed",
      !noIdOne && !noIdTwo,
    );

    // 8. content validation
    const emptyError = await errorOf(() =>
      messageModel.create({
        conversation: conversation._id,
        sender: listenerId,
        content: "   ",
      }),
    );
    check("empty/whitespace content is rejected", !!emptyError);

    const longError = await errorOf(() =>
      messageModel.create({
        conversation: conversation._id,
        sender: listenerId,
        content: "a".repeat(2001),
      }),
    );
    check("content over 2000 chars is rejected", !!longError);
  } finally {
    // Test ka data saaf karo
    await messageModel.deleteMany({
      conversation: { $in: createdConversationIds },
    });
    await conversationModel.deleteMany({
      _id: { $in: createdConversationIds },
    });
    await mongoose.disconnect();
  }

  console.log(`\nDone: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error("Script error:", error);
  process.exit(1);
});
