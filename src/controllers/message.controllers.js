import { getMessages } from "../services/message.service.js";
import { sendError } from "../utils/AppError.js";

// GET /api/messages/conversations/:conversationId/messages?before=&limit=
async function getConversationMessages(req, res) {
  try {
    const { messages, nextCursor } = await getMessages(
      req.params.conversationId,
      req.user.id,
      { before: req.query.before, limit: req.query.limit },
    );

    return res.status(200).json({ messages, nextCursor });
  } catch (error) {
    return sendError(res, error, "Get Messages Error");
  }
}

export default {
  getConversationMessages,
};
