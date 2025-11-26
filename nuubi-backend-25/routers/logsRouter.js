const express = require("express");
const router = express.Router();
const pool = require("../db");
const { jwtVerifyMiddleware } = require("../controllers/jwt/jwtAuth"); 

// log viewing of a message or post
router.post("/view", jwtVerifyMiddleware, async (req, res) => {
  try {
    const userId = req.auth.id; 
    const { contentType, contentId, groupId, deviceType } = req.body;

    let actualGroupId = groupId;
    
    if (contentType === "message") {
        const result = await pool.query(
            "SELECT group_id FROM messages WHERE id = $1",
            [contentId]
        );

        // if message exists, override groupId with the one from the message
        if (result.rows[0]) 
            actualGroupId = result.rows[0].group_id;

        } 
    else if (contentType === "post") {

        const result = await pool.query(
            "SELECT group_id FROM posts WHERE id = $1",
            [contentId]
        );

        // if post exists, override groupId with the one from the post
        if (result.rows[0]) 
             actualGroupId = result.rows[0].group_id;
        }

    // Insert the view log into the database
    await pool.query(
        "INSERT INTO view_logs (user_id, content_type, content_id, group_id, device_type) VALUES ($1, $2, $3, $4, $5)",
        [userId, contentType, contentId, actualGroupId, deviceType]
    );

    res.status(200).json({ success: true });
    } catch (err) {
        console.error("Error logging view:", err);
        res.status(500).json({ error: "Failed to log view" });
    }
});

module.exports = router;