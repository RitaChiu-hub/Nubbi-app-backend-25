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
  // groupId is guaranteed by router path + loadGroupRole
  const groupId = req.groupId || req.params.groupId;
  const window = parseTimeWindow(req.body);
  // service.getOverview(...) will be added in next step
  return notImplemented(res, { route: "overview", groupId, window });
}

async function students(req, res) {
  const groupId = req.groupId || req.params.groupId;
  const window = parseTimeWindow(req.body);
  return notImplemented(res, { route: "students", groupId, window });
}

async function posts(req, res) {
  const groupId = req.groupId || req.params.groupId;
  const window = parseTimeWindow(req.body);
  return notImplemented(res, { route: "posts", groupId, window });
}

async function topicDistribution(req, res) {
  const groupId = req.groupId || req.params.groupId;
  const window = parseTimeWindow(req.body);
  return notImplemented(res, { route: "topics/distribution", groupId, window });
}

async function activityTimeline(req, res) {
  const groupId = req.groupId || req.params.groupId;
  const window = parseTimeWindow(req.body);
  const bucket = req.body?.bucket;
  return notImplemented(res, { route: "activity/timeline", groupId, window, bucket });
}

async function contentStats(req, res) {
  const groupId = req.groupId || req.params.groupId;
  const window = parseTimeWindow(req.body);
  return notImplemented(res, { route: "content/stats", groupId, window });
}

async function exportAnalytics(req, res) {
  const groupId = req.groupId || req.params.groupId;
  const window = parseTimeWindow(req.body);
  const format = req.body?.format;
  const include = req.body?.include;
  return notImplemented(res, { route: "export", groupId, window, format, include });
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

