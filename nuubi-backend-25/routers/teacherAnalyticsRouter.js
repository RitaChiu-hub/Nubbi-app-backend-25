const express = require("express");
const router = express.Router();
const { jwtVerifyMiddleware } = require("../controllers/jwt/jwtAuth");
const { loadGroupRole } = require("../middlewares/loadGroupRole");
const { requireGroupAdmin } = require("../middlewares/requireGroupAdmin");


// Placeholder health endpoint so we can verify mount works without touching legacy analytics.
router.get("/health", (req, res) => {
  res.json({ ok: true, service: "admin-analytics" });
});

// AuthN: all admin analytics endpoints require a valid JWT
router.use(jwtVerifyMiddleware);

/**
 * Teacher/TA: per-student analytics table (CSV-friendly)
 * body: { startDate?, endDate?, granularity? ... }
 */
router.post("/groups/:groupId/students", loadGroupRole, requireGroupAdmin, (req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

/**
 * Teacher/TA: post health analytics (hot posts / unanswered posts)
 * body: { startDate?, endDate?, sortBy?, unansweredOlderThanHours? ... }
 */
router.post("/groups/:groupId/posts", loadGroupRole, requireGroupAdmin, (req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

module.exports = router;

