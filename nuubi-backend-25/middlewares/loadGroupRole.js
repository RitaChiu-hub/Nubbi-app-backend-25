const pool = require("../db");

/**
 * Load group role for the current request (per-request DB lookup).
 *
 * Sets:
 * - req.groupId
 * - req.isGroupMember
 * - req.isGroupAdmin
 *
 * Expects:
 * - req.user.id (set by jwtVerifyMiddleware)
 * - groupId from req.params.groupId OR req.body.currentGroup
 */
async function loadGroupRole(req, res, next) {
  try {
    const groupId = req.params.groupId || req.body?.currentGroup;
    if (!groupId) {
      return res.status(400).json({ error: "groupId is required" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const result = await pool.query(
      `SELECT is_admin
         FROM participants
        WHERE user_id = $1
          AND group_id = $2
        LIMIT 1`,
      [userId, groupId]
    );

    req.groupId = groupId;
    req.isGroupMember = result.rowCount > 0;
    req.isGroupAdmin = result.rowCount > 0 && result.rows[0]?.is_admin === true;

    return next();
  } catch (err) {
    console.error("loadGroupRole error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { loadGroupRole };

