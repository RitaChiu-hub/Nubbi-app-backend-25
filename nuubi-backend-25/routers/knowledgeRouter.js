const express = require("express");
const router = express.Router();
const { jwtVerifyMiddleware } = require("../controllers/jwt/jwtAuth");
const { loadGroupRole } = require("../middlewares/loadGroupRole");
const { requireGroupAdmin } = require("../middlewares/requireGroupAdmin");
const knowledgeController = require("../controllers/knowledgeController");

/**
 * Group Knowledge Base Router (RAG)
 * 
 * Mount path: /groups
 */

// All routes require authentication and group role loading
// We use /:groupId/knowledge as the base for these routes
router.use("/:groupId/knowledge", jwtVerifyMiddleware, loadGroupRole);

/**
 * GET /groups/:groupId/knowledge
 * List all knowledge base items
 */
router.get("/:groupId/knowledge", knowledgeController.list);

/**
 * POST /groups/:groupId/knowledge/presigned-url
 * Get S3 URL for uploading a file (Admin only)
 */
router.post("/:groupId/knowledge/presigned-url", requireGroupAdmin, knowledgeController.getPresignedUrl);

/**
 * POST /groups/:groupId/knowledge/confirm
 * Confirm upload and create record (Admin only)
 */
router.post("/:groupId/knowledge/confirm", requireGroupAdmin, knowledgeController.confirmUpload);

/**
 * DELETE /groups/:groupId/knowledge/:id
 * Delete a knowledge base item (Admin only)
 */
router.delete("/:groupId/knowledge/:id", requireGroupAdmin, knowledgeController.delete);

module.exports = router;
