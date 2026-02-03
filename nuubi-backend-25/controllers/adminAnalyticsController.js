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

module.exports = {
  overview,
  students,
  posts,
  topicDistribution,
  activityTimeline,
  contentStats,
  exportAnalytics,
};

