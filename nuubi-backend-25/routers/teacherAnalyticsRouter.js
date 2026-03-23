const express = require("express");
const router = express.Router();
const { jwtVerifyMiddleware } = require("../controllers/jwt/jwtAuth");
const { loadGroupRole } = require("../middlewares/loadGroupRole");
const { requireGroupAdmin } = require("../middlewares/requireGroupAdmin");
const adminAnalyticsController = require("../controllers/adminAnalyticsController");


/**
 * Admin Analytics Router (NEW, isolated from legacy analytics in groupController)
 *
 * Mount path (index.js):
 * - /analytics/admin
 *
 * Security model:
 * - /health: public (no JWT) for deploy smoke-test
 * - all other routes:
 *   - AuthN: jwtVerifyMiddleware (sets req.user)
 *   - Role preload: loadGroupRole (per-request DB lookup on participants)
 *   - AuthZ: requireGroupAdmin (teacher/TA only, group-scoped)
 *
 * Time window convention (controller/service will enforce later):
 * - body.startDate / body.endDate are optional ISO strings (e.g. "2026-02-01T00:00:00Z")
 * - if omitted: default window (e.g. last 7 days) decided by controller
 * - for bucketed endpoints: body.bucket ∈ {"day","week"} with sensible default
 */

// Health check: verify router mount without touching legacy analytics.
router.get("/health", (req, res) => {
  res.json({ ok: true, service: "admin-analytics" });
});

// AuthN: all admin analytics endpoints (except /health) require a valid JWT.
router.use(jwtVerifyMiddleware);

/**
 * POST /groups/:groupId/overview
 *
 * Purpose:
 * - Provide a compact "teacher dashboard" summary for a single group in a time window.
 *
 * Auth:
 * - JWT required
 * - Group admin required (teacher/TA)
 *
 * Request body (planned):
 * - startDate?: string (ISO)
 * - endDate?: string (ISO)
 *
 * Response (planned, high-level):
 * - { window: { startDate, endDate }, kpis: { ... }, breakdowns?: { ... } }
 *
 * Notes:
 * - This endpoint should be fast and cache-friendly (one payload used to render the top of the page).
 */
router.post(
  "/groups/:groupId/overview",
  loadGroupRole,
  requireGroupAdmin,
  adminAnalyticsController.overview
);

/**
 * POST /groups/:groupId/students
 *
 * Purpose:
 * - Return a per-student analytics table (CSV-friendly) for teacher/TA to understand engagement.
 *
 * Auth:
 * - JWT required
 * - Group admin required (teacher/TA)
 *
 * Request body (planned):
 * - startDate?: string (ISO)
 * - endDate?: string (ISO)
 * - sortBy?: "pagesViewed" | "postsViewed" | "replies" | "activeMinutes" | "lastActiveAt"
 * - sortDir?: "asc" | "desc"
 * - limit?: number
 * - offset?: number
 *
 * Response (planned, high-level):
 * - {
 *     window: { startDate, endDate },
 *     students: Array<{
 *       userId, username,
 *       pagesViewed, postsViewed, replies, activeMinutes,
 *       firstSeenAt, lastSeenAt
 *     }>,
 *     pagination?: { limit, offset, total }
 *   }
 *
 * Notes:
 * - "activeMinutes" should come from sessions/heartbeat if available; otherwise fallback to proxy metrics.
 */
router.post(
  "/groups/:groupId/students",
  loadGroupRole,
  requireGroupAdmin,
  adminAnalyticsController.students
);

/**
 * POST /groups/:groupId/posts
 *
 * Purpose:
 * - Post health analytics to help teachers spot:
 *   - Hot posts (high replies/views)
 *   - Unanswered posts (0 replies) beyond a threshold
 *
 * Auth:
 * - JWT required
 * - Group admin required (teacher/TA)
 *
 * Request body (planned):
 * - startDate?: string (ISO)
 * - endDate?: string (ISO)
 * - mode?: "hot" | "unanswered" | "mixed"   (default: "mixed")
 * - sortBy?: "replies" | "views" | "createdAt"
 * - sortDir?: "asc" | "desc"
 * - unansweredOlderThanHours?: number (default: 24)
 * - limit?: number
 *
 * Response (planned, high-level):
 * - {
 *     window: { startDate, endDate },
 *     posts: Array<{
 *       postId, title, authorId, createdAt,
 *       replyCount, viewCount,
 *       topicId?, topicName?
 *     }>
 *   }
 *
 * Notes:
 * - viewCount may come from existing post view tracking / rollups; if unavailable, omit initially.
 */
router.post(
  "/groups/:groupId/posts",
  loadGroupRole,
  requireGroupAdmin,
  adminAnalyticsController.posts
);

/**
 * POST /groups/:groupId/topics/distribution
 *
 * Purpose:
 * - Topic distribution for posts in a window (used for "what are students talking about").
 *
 * Auth:
 * - JWT required
 * - Group admin required (teacher/TA)
 *
 * Request body (planned):
 * - startDate?: string (ISO)
 * - endDate?: string (ISO)
 * - source?: "post_topic_map" | "llm" | "static"  (future; default decided by service)
 *
 * Response (planned, high-level):
 * - {
 *     window: { startDate, endDate },
 *     topics: Array<{ topicId, topicName, postCount, replyCount? }>
 *   }
 *
 * Notes:
 * - We can start with a simple mapping/table when you们 topic 方案落地后再接入。
 */
router.post(
  "/groups/:groupId/topics/distribution",
  loadGroupRole,
  requireGroupAdmin,
  adminAnalyticsController.topicDistribution
);

/**
 * POST /groups/:groupId/activity/timeline
 *
 * Purpose:
 * - A time series for activity/engagement to render charts (daily/weekly buckets).
 *
 * Auth:
 * - JWT required
 * - Group admin required (teacher/TA)
 *
 * Request body (planned):
 * - startDate?: string (ISO)
 * - endDate?: string (ISO)
 * - bucket?: "day" | "week"
 *
 * Response (planned, high-level):
 * - {
 *     window: { startDate, endDate, bucket },
 *     points: Array<{ bucketStart: string, posts: number, comments: number, messages: number, activeUsers?: number }>
 *   }
 *
 * Notes:
 * - Prefer date_trunc + generate_series for consistent buckets, including zero-activity days.
 */
router.post(
  "/groups/:groupId/activity/timeline",
  loadGroupRole,
  requireGroupAdmin,
  adminAnalyticsController.activityTimeline
);

/**
 * POST /groups/:groupId/content/stats
 *
 * Purpose:
 * - Content creation stats for the group in a window (counts + optional unique authors).
 *
 * Auth:
 * - JWT required
 * - Group admin required (teacher/TA)
 *
 * Request body (planned):
 * - startDate?: string (ISO)
 * - endDate?: string (ISO)
 *
 * Response (planned, high-level):
 * - {
 *     window: { startDate, endDate },
 *     counts: { posts, comments, messages },
 *     uniques?: { postAuthors, commentAuthors, messageAuthors }
 *   }
 */
router.post(
  "/groups/:groupId/content/stats",
  loadGroupRole,
  requireGroupAdmin,
  adminAnalyticsController.contentStats
);

/**
 * POST /groups/:groupId/export
 *
 * Purpose:
 * - Export analytics data for reporting (initially JSON; CSV can be added later).
 *
 * Auth:
 * - JWT required
 * - Group admin required (teacher/TA)
 *
 * Request body (planned):
 * - startDate?: string (ISO)
 * - endDate?: string (ISO)
 * - format?: "json" | "csv" (default: "json")
 * - include?: Array<"overview"|"students"|"posts"|"topics"|"timeline"|"content">
 *
 * Response (planned, high-level):
 * - JSON: { ... combined payload ... }
 * - CSV: (future) streaming download
 *
 * Notes:
 * - Keep exports stable/versioned to avoid breaking teacher dashboards and downstream tooling.
 */
router.post(
  "/groups/:groupId/export",
  loadGroupRole,
  requireGroupAdmin,
  adminAnalyticsController.exportAnalytics
);

/**
 * Migration: deep participation analytics (all-in-one)
 */
router.post(
  "/groups/:groupId/participation/deep",
  loadGroupRole,
  requireGroupAdmin,
  adminAnalyticsController.getDeepParticipation
);

/**
 * Migration: weekly trend analytics
 */
router.post(
  "/groups/:groupId/trends/weekly",
  loadGroupRole,
  // This one can be admin or self, so we use loadGroupRole but maybe not strictly requireGroupAdmin
  // But for the TEACHER dashboard, it is admin-only.
  requireGroupAdmin,
  adminAnalyticsController.getWeeklyTrend
);

module.exports = router;

