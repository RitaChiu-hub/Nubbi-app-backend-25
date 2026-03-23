/**
 * Admin Analytics Controller
 *
 * Controller responsibilities (strict):
 * - Parse/validate request params (groupId, time window, pagination, etc.)
 * - Call service layer (to be added next)
 * - Shape response payloads and error handling
 *
 * NOTE: Business aggregation (SQL) will live in service layer, not here.
 */

const adminAnalyticsService = require("../services/adminAnalyticsService");

function parseIsoDateOrUndefined(value) {
  if (value == null || value === "") return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function parseTimeWindow(body) {
  // Controller-level parsing only; defaults/logic will be finalized in service step.
  const startDate = parseIsoDateOrUndefined(body?.startDate);
  const endDate = parseIsoDateOrUndefined(body?.endDate);
  return { startDate, endDate };
}

function notImplemented(res, feature) {
  return res.status(501).json({
    error: "Not implemented yet",
    feature,
  });
}

async function overview(req, res) {
  try {
    const groupId = req.groupId || req.params.groupId;
    const window = parseTimeWindow(req.body);
    const result = await adminAnalyticsService.getOverview({ groupId, ...window });
    return res.json(result);
  } catch (err) {
    console.error("adminAnalyticsController.overview error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  }
}

async function students(req, res) {
  try {
    const groupId = req.groupId || req.params.groupId;
    const window = parseTimeWindow(req.body);
    const result = await adminAnalyticsService.getStudentsAnalytics({
      groupId,
      ...window,
      sortBy: req.body?.sortBy,
      sortDir: req.body?.sortDir,
      limit: req.body?.limit,
      offset: req.body?.offset,
      includeAdmins: req.body?.includeAdmins,
    });
    return res.json(result);
  } catch (err) {
    console.error("adminAnalyticsController.students error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  }
}

async function posts(req, res) {
  try {
    const groupId = req.groupId || req.params.groupId;
    const window = parseTimeWindow(req.body);
    const result = await adminAnalyticsService.getPostHealth({
      groupId,
      ...window,
      mode: req.body?.mode,
      sortBy: req.body?.sortBy,
      sortDir: req.body?.sortDir,
      unansweredOlderThanHours: req.body?.unansweredOlderThanHours,
      limit: req.body?.limit,
      offset: req.body?.offset,
    });
    return res.json(result);
  } catch (err) {
    console.error("adminAnalyticsController.posts error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  }
}

async function topicDistribution(req, res) {
  const groupId = req.groupId || req.params.groupId;
  const window = parseTimeWindow(req.body);
  return notImplemented(res, { route: "topics/distribution", groupId, window });
}

async function activityTimeline(req, res) {
  try {
    const groupId = req.groupId || req.params.groupId;
    const window = parseTimeWindow(req.body);
    const bucket = req.body?.bucket;
    const result = await adminAnalyticsService.getActivityTimeline({ groupId, ...window, bucket });
    return res.json(result);
  } catch (err) {
    console.error("adminAnalyticsController.activityTimeline error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  }
}

async function contentStats(req, res) {
  try {
    const groupId = req.groupId || req.params.groupId;
    const window = parseTimeWindow(req.body);
    const result = await adminAnalyticsService.getContentStats({ groupId, ...window });
    return res.json(result);
  } catch (err) {
    console.error("adminAnalyticsController.contentStats error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  }
}

async function exportAnalytics(req, res) {
  try {
    const groupId = req.groupId || req.params.groupId;
    const window = parseTimeWindow(req.body);
    const format = req.body?.format;
    const include = req.body?.include;
    const result = await adminAnalyticsService.buildExportPayload({ groupId, ...window, format, include });
    return res.json(result);
  } catch (err) {
    console.error("adminAnalyticsController.exportAnalytics error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  }
}

/**
 * Migration: deep participation analytics (all-in-one)
 */
async function getDeepParticipation(req, res) {
  try {
    const groupId = req.groupId || req.params.groupId || req.body.currentGroup;
    const window = parseTimeWindow(req.body);
    const result = await adminAnalyticsService.getDeepParticipation({ 
      groupId, 
      startDate: window.startDate, 
      endDate: window.endDate,
      sortBy: req.body?.sortBy,
      sortOrder: req.body?.sortOrder,
      limit: req.body?.limit,
      offset: req.body?.offset
    });
    return res.json({
      success: true,
      ...result,
      group_id: groupId
    });
  } catch (err) {
    console.error("adminAnalyticsController.getDeepParticipation error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  }
}

/**
 * Migration: weekly trend analytics
 */
async function getWeeklyTrend(req, res) {
  try {
    const groupId = req.groupId || req.params.groupId || req.body.currentGroup;
    const window = parseTimeWindow(req.body);
    // Note: for this migrated endpoint, we check if user is admin via middleware loadGroupRole
    const isAdmin = req.isGroupAdmin === true;
    const userId = req.user?.id;

    const result = await adminAnalyticsService.getWeeklyTrend({ 
      groupId, 
      startDate: window.startDate, 
      endDate: window.endDate,
      userId,
      isAdmin
    });
    return res.json(result.students); // Migrated format expects the array directly
  } catch (err) {
    console.error("adminAnalyticsController.getWeeklyTrend error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  }
}

/**
 * Migration: simple leaderboard for a group
 */
async function getLeaderboard(req, res) {
  try {
    const groupId = req.groupId || req.params.groupId || req.body.currentGroup;
    const result = await adminAnalyticsService.getLeaderboard({ groupId });
    return res.json(result);
  } catch (err) {
    console.error("adminAnalyticsController.getLeaderboard error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  }
}

/**
 * Migration: leaderboards for all groups a user is in (Student-facing)
 */
async function getMyLeaderboards(req, res) {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: "User ID not found in token" });
    }
    const result = await adminAnalyticsService.getMyLeaderboards({ userId });
    return res.json(result);
  } catch (err) {
    console.error("adminAnalyticsController.getMyLeaderboards error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  }
}

/**
 * Migration: analytics for the current user in a group (Student-facing)
 */
async function getMyGroupAnalytics(req, res) {
  try {
    const userId = req.user?.id || req.body.userId;
    const groupId = req.groupId || req.params.groupId || req.body.currentGroup;
    const window = parseTimeWindow(req.body);

    if (!userId) {
      return res.status(401).json({ error: "User ID not found in token" });
    }

    const result = await adminAnalyticsService.getUserGroupAnalytics({ 
      groupId, 
      userId, 
      startDate: window.startDate, 
      endDate: window.endDate 
    });
    return res.json(result);
  } catch (err) {
    console.error("adminAnalyticsController.getMyGroupAnalytics error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  }
}

module.exports = {
  overview,
  students,
  posts,
  topicDistribution,
  activityTimeline,
  contentStats,
  exportAnalytics,
  getDeepParticipation,
  getWeeklyTrend,
  getLeaderboard,
  getMyLeaderboards,
  getMyGroupAnalytics,
};

