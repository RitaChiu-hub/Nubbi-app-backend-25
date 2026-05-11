const express = require("express");
const router = express.Router();
const pool = require("../db.js");
const { jwtVerifyMiddleware } = require("../controllers/jwt/jwtAuth");
const sessionController = require("../controllers/sessionController");

// Apply JWT middleware to all routes
router.use(jwtVerifyMiddleware);

/**
 * POST /activity/session/start
 * Start a new session
 */
router.post("/session/start", async (req, res) => {
  try {
    const userId = req.user.id; // Set by jwtVerifyMiddleware

    // Check if user already has an active session
    let session = await sessionController.getActiveSession(userId);

    if (session) {
      // Return existing active session
      return res.json({
        success: true,
        session: {
          session_id: session.session_id,
          started_at: session.started_at,
          active_seconds: session.active_seconds,
        },
        message: "Active session already exists",
      });
    }

    // Start new session
    session = await sessionController.startSession(userId, req);

    res.json({
      success: true,
      session: {
        session_id: session.session_id,
        started_at: session.started_at,
        active_seconds: session.active_seconds,
      },
      message: "Session started successfully",
    });
  } catch (error) {
    console.error("Error starting session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start session",
      message: error.message,
    });
  }
});

/**
 * POST /activity/session/end
 * End current session
 */
router.post("/session/end", async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.body;

    if (!session_id) {
      // If no session_id provided, find and end active session
      const activeSession = await sessionController.getActiveSession(userId);
      if (activeSession) {
        await sessionController.endSession(activeSession.session_id);
        return res.json({
          success: true,
          message: "Session ended successfully",
        });
      } else {
        return res.status(404).json({
          success: false,
          error: "No active session found",
        });
      }
    }

    // End specified session
    await sessionController.endSession(session_id);

    res.json({
      success: true,
      message: "Session ended successfully",
    });
  } catch (error) {
    console.error("Error ending session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to end session",
      message: error.message,
    });
  }
});

/**
 * POST /activity/heartbeat
 * Update active seconds for current session
 */
router.post("/heartbeat", async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id, page_name, groupId, currentGroup } = req.body;

    let sessionId = session_id;
    const gid = groupId || currentGroup;

    // If no session_id provided, get or create active session
    if (!sessionId) {
      const session = await sessionController.getOrCreateSession(userId, req, gid);
      sessionId = session.session_id;
    }

    // Update heartbeat with optional groupId
    await sessionController.updateHeartbeat(sessionId, active_seconds, gid);

    res.json({
      success: true,
      message: "Heartbeat updated",
      session_id: sessionId,
    });
  } catch (error) {
    console.error("Error updating heartbeat:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update heartbeat",
      message: error.message,
    });
  }
});

/**
 * POST /activity/page-view
 * Track page navigation
 */
router.post("/page-view", async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id, page_name, currentGroup, groupId } = req.body;

    let sessionId = session_id;
    const gid = groupId || currentGroup;

    // If no session_id provided, get or create active session
    if (!sessionId) {
      const session = await sessionController.getOrCreateSession(userId, req, gid);
      sessionId = session.session_id;
    }

    // Increment page view
    await sessionController.incrementPageView(sessionId);

    res.json({
      success: true,
      message: "Page view tracked",
      session_id: sessionId,
      page_name,
    });
  } catch (error) {
    console.error("Error tracking page view:", error);
    // Don't fail the request if tracking fails
    res.json({
      success: false,
      error: "Failed to track page view",
      message: error.message,
    });
  }
});

/**
 * POST /activity/action
 * Track user actions
 */
router.post("/action", async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id, action_type } = req.body;

    let sessionId = session_id;

    // If no session_id provided, get or create active session
    if (!sessionId) {
      const session = await sessionController.getOrCreateSession(userId, req, groupId);
      sessionId = session.session_id;
    }

    // Increment action count
    await sessionController.incrementAction(sessionId);

    res.json({
      success: true,
      message: "Action tracked",
      session_id: sessionId,
      action_type,
    });
  } catch (error) {
    console.error("Error tracking action:", error);
    // Don't fail the request if tracking fails
    res.json({
      success: false,
      error: "Failed to track action",
      message: error.message,
    });
  }
});

/**
 * POST /activity/error
 * Track errors encountered
 */
router.post("/error", async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id, error_message } = req.body;

    let sessionId = session_id;

    // If no session_id provided, get or create active session
    if (!sessionId) {
      const session = await sessionController.getOrCreateSession(userId, req, groupId);
      sessionId = session.session_id;
    }

    // Increment error count
    await sessionController.incrementError(sessionId);

    res.json({
      success: true,
      message: "Error tracked",
      session_id: sessionId,
    });
  } catch (error) {
    console.error("Error tracking error:", error);
    // Don't fail the request if tracking fails
    res.json({
      success: false,
      error: "Failed to track error",
    });
  }
});

/**
 * POST /activity/posts/:id/view
 * Track post view
 */
router.post("/posts/:id/view", async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;
    const { session_id } = req.body;

    let sessionId = session_id;

    // If no session_id provided, get or create active session
    if (!sessionId) {
      const session = await sessionController.getOrCreateSession(userId, req, groupId);
      sessionId = session.session_id;
    }

    // Check if this user has already viewed this post in this session
    const existingView = await pool.query(
      `SELECT 1 FROM user_sessions us
       WHERE us.session_id = $1
       AND EXISTS (
         SELECT 1 FROM posts p
         WHERE p.id = $2
       )`,
      [sessionId, postId]
    );

    // Atomically increment post view_count
    const result = await pool.query(
      `UPDATE posts 
       SET view_count = view_count + 1 
       WHERE id = $1 
       RETURNING view_count`,
      [postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    // Increment session's posts_viewed_count
    await sessionController.incrementPostView(sessionId);

    res.json({
      success: true,
      message: "Post view tracked",
      session_id: sessionId,
      post_id: postId,
      view_count: result.rows[0].view_count,
    });
  } catch (error) {
    console.error("Error tracking post view:", error);
    // Don't fail the request if tracking fails
    res.json({
      success: false,
      error: "Failed to track post view",
      message: error.message,
    });
  }
});

/**
 * GET /activity/session/current
 * Get current active session
 */
router.get("/session/current", async (req, res) => {
  try {
    const userId = req.user.id;

    const session = await sessionController.getActiveSession(userId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "No active session found",
      });
    }

    res.json({
      success: true,
      session: {
        session_id: session.session_id,
        started_at: session.started_at,
        active_seconds: session.active_seconds,
        pages_viewed: session.pages_viewed,
        posts_viewed_count: session.posts_viewed_count,
        actions_count: session.actions_count,
      },
    });
  } catch (error) {
    console.error("Error getting current session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get current session",
      message: error.message,
    });
  }
});

module.exports = router;


