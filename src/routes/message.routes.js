import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import conversationControllers from "../controllers/conversation.controllers.js";
import messageControllers from "../controllers/message.controllers.js";

const router = Router();

// Har messaging route: pehle login (cookie JWT), phir sirf listener/artist.
// Admin messaging baad mein aayegi: bas yahan "admin" add karna hoga.
router.use(authMiddleware.authUser);
router.use(roleMiddleware(["listener", "artist"]));

// Conversation shuru karna: sirf listener
router.post(
  "/conversations",
  roleMiddleware(["listener"]),
  conversationControllers.startConversation,
);

router.get("/conversations", conversationControllers.getMyConversations);

router.get(
  "/conversations/:conversationId",
  conversationControllers.getConversation,
);

router.get(
  "/conversations/:conversationId/messages",
  messageControllers.getConversationMessages,
);

router.get("/unread-summary", conversationControllers.getUnreadCounts);

export default router;
