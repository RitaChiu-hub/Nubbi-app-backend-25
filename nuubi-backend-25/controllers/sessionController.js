const pool = require("../db");
const { v4: uuidv4 } = require("uuid");

// Use shared database connection from config
const { sequelize, DataTypes } = require("../config/database");

const {
  users,
  user_sessions,
  user_session_totals,
} = require("../models/init-models")(sequelize, DataTypes);

/**
 * Extract device and platform information from request
 */
function extractDeviceInfo(req) {
  const userAgent = req.headers["user-agent"] || "";
  let deviceType = "unknown";
  let platform = "unknown";

  // Detect Expo/React Native apps first (they have specific user agents)
  const isExpo = /Expo/i.test(userAgent);
  const isCFNetwork = /CFNetwork/i.test(userAgent); // iOS networking library
  const isDarwin = /Darwin/i.test(userAgent); // iOS/macOS kernel
  
  // Platform detection (do this first as it helps with device type)
  if (/android/i.test(userAgent)) {
    platform = "android";
    deviceType = "mobile"; // Android in user agent usually means mobile
  } else if (/iphone|ipad|ipod/i.test(userAgent)) {
    platform = "ios";
    deviceType = /ipad/i.test(userAgent) ? "tablet" : "mobile";
  } else if (isExpo || isCFNetwork || isDarwin) {
    // Expo apps or iOS networking - likely mobile
    platform = isDarwin ? "ios" : "unknown";
    deviceType = "mobile";
  } else if (/tablet/i.test(userAgent)) {
    deviceType = "tablet";
  } else if (/mobile/i.test(userAgent)) {
    deviceType = "mobile";
  } else {
    deviceType = "desktop";
  }

  // Additional platform detection if not set
  if (platform === "unknown") {
    if (/windows/i.test(userAgent)) {
      platform = "windows";
    } else if (/mac/i.test(userAgent)) {
      platform = "macos";
    } else if (/linux/i.test(userAgent)) {
      platform = "linux";
    }
  }

  return { deviceType, platform };
}

/**
 * Get IP address from request
 */
function getIpAddress(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null
  );
}

/**
 * Start a new session
 * @param {string} userId - User ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} Session object
 */
module.exports.startSession = async (userId, req) => {
  try {
    const { deviceType, platform } = extractDeviceInfo(req);
    const ipAddress = getIpAddress(req);
    
    console.log("🔍 Session creation:", {
      userId,
      deviceType,
      platform,
      ipAddress,
      userAgent: req.headers["user-agent"]?.substring(0, 50),
    });

    // Create new session
    const session = await user_sessions.create({
      session_id: uuidv4(),
      user_id: userId,
      started_at: new Date(),
      device_type: deviceType,
      platform: platform,
      ip_address: ipAddress,
      country_code: null, // Can be populated with GeoIP service
      active_seconds: 0,
      pages_viewed: 0,
      posts_viewed_count: 0,
      actions_count: 0,
      errors_encountered: 0,
      connection_drops: 0,
    });

    // Initialize session totals if they don't exist
    const [totals, created] = await user_session_totals.findOrCreate({
      where: { user_id: userId },
      defaults: {
        user_id: userId,
        total_active_seconds: 0,
        total_pages_viewed: 0,
        total_posts_viewed: 0,
        total_actions: 0,
        total_sessions: 0,
        total_errors: 0,
        total_connection_drops: 0,
        last_active_at: new Date(),
      },
    });

    // Increment total sessions count
    await totals.increment("total_sessions");

    return session;
  } catch (error) {
    console.error("Error starting session:", error);
    throw error;
  }
};

/**
 * End a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Updated session object
 */
module.exports.endSession = async (sessionId) => {
  try {
    const session = await user_sessions.findByPk(sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    // Update session end time
    await session.update({
      ended_at: new Date(),
    });

    // Update session totals
    await module.exports.updateSessionTotals(session.user_id);

    return session;
  } catch (error) {
    console.error("Error ending session:", error);
    throw error;
  }
};

/**
 * Update heartbeat - increment active seconds
 * @param {string} sessionId - Session ID
 * @param {number} activeSeconds - Seconds to add
 * @returns {Promise<Object>} Updated session object
 */
module.exports.updateHeartbeat = async (sessionId, activeSeconds = 60) => {
  try {
    const session = await user_sessions.findByPk(sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    // Increment active seconds
    await session.increment("active_seconds", { by: activeSeconds });

    // Update last_active_at in totals
    await user_session_totals.update(
      { last_active_at: new Date() },
      { where: { user_id: session.user_id } }
    );

    return session;
  } catch (error) {
    console.error("Error updating heartbeat:", error);
    throw error;
  }
};

/**
 * Increment page view count
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Updated session object
 */
module.exports.incrementPageView = async (sessionId) => {
  try {
    const session = await user_sessions.findByPk(sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    await session.increment("pages_viewed");

    return session;
  } catch (error) {
    console.error("Error incrementing page view:", error);
    throw error;
  }
};

/**
 * Increment post view count
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Updated session object
 */
module.exports.incrementPostView = async (sessionId) => {
  try {
    const session = await user_sessions.findByPk(sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    await session.increment("posts_viewed_count");

    return session;
  } catch (error) {
    console.error("Error incrementing post view:", error);
    throw error;
  }
};

/**
 * Increment action count
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Updated session object
 */
module.exports.incrementAction = async (sessionId) => {
  try {
    const session = await user_sessions.findByPk(sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    await session.increment("actions_count");

    return session;
  } catch (error) {
    console.error("Error incrementing action:", error);
    throw error;
  }
};

/**
 * Increment error count
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Updated session object
 */
module.exports.incrementError = async (sessionId) => {
  try {
    const session = await user_sessions.findByPk(sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    await session.increment("errors_encountered");

    return session;
  } catch (error) {
    console.error("Error incrementing error count:", error);
    throw error;
  }
};

/**
 * Update session totals by aggregating all sessions for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated session totals
 */
module.exports.updateSessionTotals = async (userId) => {
  try {
    // Aggregate all session data for this user
    const result = await pool.query(
      `SELECT 
        COALESCE(SUM(active_seconds), 0) as total_active_seconds,
        COALESCE(SUM(pages_viewed), 0) as total_pages_viewed,
        COALESCE(SUM(posts_viewed_count), 0) as total_posts_viewed,
        COALESCE(SUM(actions_count), 0) as total_actions,
        COALESCE(COUNT(*), 0) as total_sessions,
        COALESCE(SUM(errors_encountered), 0) as total_errors,
        COALESCE(SUM(connection_drops), 0) as total_connection_drops,
        MAX(started_at) as last_active_at
      FROM user_sessions
      WHERE user_id = $1`,
      [userId]
    );

    const totals = result.rows[0];

    // Update or create session totals
    await user_session_totals.upsert({
      user_id: userId,
      total_active_seconds: parseInt(totals.total_active_seconds),
      total_pages_viewed: parseInt(totals.total_pages_viewed),
      total_posts_viewed: parseInt(totals.total_posts_viewed),
      total_actions: parseInt(totals.total_actions),
      total_sessions: parseInt(totals.total_sessions),
      total_errors: parseInt(totals.total_errors),
      total_connection_drops: parseInt(totals.total_connection_drops),
      last_active_at: totals.last_active_at || new Date(),
    });

    return totals;
  } catch (error) {
    console.error("Error updating session totals:", error);
    throw error;
  }
};

/**
 * Get active session for a user (not ended)
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Active session or null
 */
module.exports.getActiveSession = async (userId) => {
  try {
    const session = await user_sessions.findOne({
      where: {
        user_id: userId,
        ended_at: null,
      },
      order: [["started_at", "DESC"]],
    });

    return session;
  } catch (error) {
    console.error("Error getting active session:", error);
    throw error;
  }
};

/**
 * Get or create active session for a user
 * @param {string} userId - User ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} Active session
 */
module.exports.getOrCreateSession = async (userId, req) => {
  try {
    let session = await module.exports.getActiveSession(userId);

    if (!session) {
      session = await module.exports.startSession(userId, req);
    }

    return session;
  } catch (error) {
    console.error("Error getting or creating session:", error);
    throw error;
  }
};

