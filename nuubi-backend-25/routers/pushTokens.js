const express = require("express");
const router = express.Router();
const pushTokenService = require("../utils/pushTokenService");

// Save push token
router.post("/push-token", async (req, res) => {
  const { userId, token } = req.body;

  if (!userId || !token) {
    return res.status(400).json({ error: "Missing userId or token" });
  }

  try {
    await pushTokenService.addPushToken(userId, token);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to save push token:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get push tokens for a user
router.get("/push-token/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const tokens = await pushTokenService.getPushTokens(userId);
    res.json({ tokens });
  } catch (err) {
    console.error("Failed to get push tokens:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Remove push token
router.delete("/push-token", async (req, res) => {
  const { token } = req.body;

  if (!token) return res.status(400).json({ error: "Missing token" });

  try {
    await pushTokenService.removePushToken(token);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to remove push token:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
