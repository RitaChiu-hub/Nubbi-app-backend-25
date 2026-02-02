const pool = require("../db");

/**
 * Admin Analytics Service (NEW)
 *
 * Service responsibilities (strict):
 * - Own the business logic + SQL aggregation
 * - Return plain JS objects (no res.json here)
 *
 * Conventions:
 * - Window filtering uses created_at timestamps.
 * - If start/end are not provided, default to last 7 days ending "now".
 */

function toDateOrUndefined(value) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function normalizeWindow({ startDate, endDate, defaultDays = 7 } = {}) {
  const end = toDateOrUndefined(endDate) || new Date();
  const start = toDateOrUndefined(startDate) || new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  // Ensure order
  if (start.getTime() > end.getTime()) {
    return { startDate: end.toISOString(), endDate: start.toISOString() };
  }
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function normalizeGroupId(groupId) {
  const n = Number(groupId);
  if (!Number.isInteger(n) || n <= 0) {
    const err = new Error("Invalid groupId");
    err.statusCode = 400;
    throw err;
  }
  return n;
}

async function getContentStats({ groupId, startDate, endDate }) {
  const gid = normalizeGroupId(groupId);
  const window = normalizeWindow({ startDate, endDate });

  const postsQ = pool.query(
    `SELECT
       COUNT(*)::int AS posts,
       COUNT(DISTINCT sender_id)::int AS post_authors
     FROM posts
     WHERE group_id = $1
       AND created_at >= $2
       AND created_at <= $3`,
    [gid, window.startDate, window.endDate]
  );

  const commentsQ = pool.query(
    `SELECT
       COUNT(*)::int AS comments,
       COUNT(DISTINCT pc.sender_id)::int AS comment_authors
     FROM post_comments pc
     JOIN posts p ON p.id = pc.post_id
     WHERE p.group_id = $1
       AND pc.created_at >= $2
       AND pc.created_at <= $3`,
    [gid, window.startDate, window.endDate]
  );

  const messagesQ = pool.query(
    `SELECT
       COUNT(*)::int AS messages,
       COUNT(DISTINCT sender_id)::int AS message_authors
     FROM messages
     WHERE group_id = $1
       AND created_at >= $2
       AND created_at <= $3`,
    [gid, window.startDate, window.endDate]
  );

  const [postsR, commentsR, messagesR] = await Promise.all([postsQ, commentsQ, messagesQ]);

  return {
    window,
    counts: {
      posts: postsR.rows[0]?.posts ?? 0,
      comments: commentsR.rows[0]?.comments ?? 0,
      messages: messagesR.rows[0]?.messages ?? 0,
    },
    uniques: {
      postAuthors: postsR.rows[0]?.post_authors ?? 0,
      commentAuthors: commentsR.rows[0]?.comment_authors ?? 0,
      messageAuthors: messagesR.rows[0]?.message_authors ?? 0,
    },
  };
}

async function getOverview({ groupId, startDate, endDate }) {
  const gid = normalizeGroupId(groupId);
  const window = normalizeWindow({ startDate, endDate });

  const participantsQ = pool.query(
    `SELECT
       COUNT(*)::int AS participants_total,
       COUNT(*) FILTER (WHERE is_admin = true)::int AS admins_total
     FROM participants
     WHERE group_id = $1`,
    [gid]
  );

  const contentStatsQ = getContentStats({ groupId: gid, startDate: window.startDate, endDate: window.endDate });

  // "activeUsers" here means: posted/commented/messaged in window (proxy for engagement).
  const activeUsersQ = pool.query(
    `WITH activity_users AS (
       SELECT sender_id AS user_id
       FROM posts
       WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3
       UNION
       SELECT pc.sender_id AS user_id
       FROM post_comments pc
       JOIN posts p ON p.id = pc.post_id
       WHERE p.group_id = $1 AND pc.created_at >= $2 AND pc.created_at <= $3
       UNION
       SELECT sender_id AS user_id
       FROM messages
       WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3
     )
     SELECT COUNT(DISTINCT user_id)::int AS active_users
     FROM activity_users`,
    [gid, window.startDate, window.endDate]
  );

  const [participantsR, contentStats, activeUsersR] = await Promise.all([
    participantsQ,
    contentStatsQ,
    activeUsersQ,
  ]);

  return {
    window,
    kpis: {
      participantsTotal: participantsR.rows[0]?.participants_total ?? 0,
      adminsTotal: participantsR.rows[0]?.admins_total ?? 0,
      activeUsers: activeUsersR.rows[0]?.active_users ?? 0,
      posts: contentStats.counts.posts,
      comments: contentStats.counts.comments,
      messages: contentStats.counts.messages,
    },
  };
}

module.exports = {
  normalizeWindow,
  getOverview,
  getContentStats,
};

