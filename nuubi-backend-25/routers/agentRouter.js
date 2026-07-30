const express = require("express");
const router = express.Router({ mergeParams: true });
const agentController = require("../controllers/agentController");
const { jwtVerifyMiddleware } = require("../controllers/jwt/jwtAuth");
const { loadGroupRole } = require("../middlewares/loadGroupRole");

// All agent routes require authentication and group membership
router.use(jwtVerifyMiddleware);
router.use(loadGroupRole);

/**
 * @route POST /:groupId/agent/chat
 * @desc Direct chat with the RAG agent
 */
router.post("/chat", agentController.chat);

module.exports = router;
