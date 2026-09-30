import {
  findOrCreateConversation,
  listConversations,
  getConversationForUser,
  getUnreadSummary,
} from "../services/conversation.service.js";
import { sendError } from "../utils/AppError.js";

// POST /api/messages/conversations   body: { artistId }   (sirf listener)
async function startConversation(req, res) {
  try {
    const { artistId } = req.body;

    if (typeof artistId !== "string") {
      return res
        .status(400)
        .json({ message: "artistId is required", code: "INVALID_ID" });
    }

    const { conversation, created } = await findOrCreateConversation(
      req.user.id,
      artistId,
    );

    return res.status(created ? 201 : 200).json({
      message: created ? "Conversation created" : "Conversation already exists",
      created,
      conversation,
    });
  } catch (error) {
    return sendError(res, error, "Start Conversation Error");
  }
}

// GET /api/messages/conversations?limit=&cursor=
async function getMyConversations(req, res) {
  try {
    const { conversations, nextCursor } = await listConversations(req.user.id, {
      limit: req.query.limit,
      cursor: req.query.cursor,
    });

    return res.status(200).json({ conversations, nextCursor });
  } catch (error) {
    return sendError(res, error, "Get Conversations Error");
  }
}

// GET /api/messages/conversations/:conversationId
async function getConversation(req, res) {
  try {
    const conversation = await getConversationForUser(
      req.params.conversationId,
      req.user.id,
    );

    return res.status(200).json({ conversation });
  } catch (error) {
    return sendError(res, error, "Get Conversation Error");
  }
}

// GET /api/messages/unread-summary
async function getUnreadCounts(req, res) {
  try {
    const summary = await getUnreadSummary(req.user.id);
    return res.status(200).json(summary);
  } catch (error) {
    return sendError(res, error, "Get Unread Summary Error");
  }
}

export default {
  startConversation,
  getMyConversations,
  getConversation,
  getUnreadCounts,
};
