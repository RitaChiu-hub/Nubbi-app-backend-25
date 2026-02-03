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

/**
 * Try to parse a date-like input into a JS Date.
 *
 * @param {string|number|Date|undefined|null} value - ISO string / timestamp / Date
 * @returns {Date|undefined} - undefined if input is falsy or invalid
 */
function toDateOrUndefined(value) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

/**
 * Normalize a time window for analytics queries.
 *
 * Rules:
 * - If endDate is missing, use "now"
 * - If startDate is missing, default to (endDate - defaultDays)
 * - If start > end, swap to keep window valid
 *
 * @param {object} params
 * @param {string|undefined} params.startDate - ISO string
 * @param {string|undefined} params.endDate - ISO string
 * @param {number|undefined} params.defaultDays - default lookback days (default: 7)
 * @returns {{startDate: string, endDate: string}} - ISO strings
 */
function normalizeWindow({ startDate, endDate, defaultDays = 7 } = {}) {
  const end = toDateOrUndefined(endDate) || new Date();
  const start = toDateOrUndefined(startDate) || new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  // Ensure order
  if (start.getTime() > end.getTime()) {
    return { startDate: end.toISOString(), endDate: start.toISOString() };
  }
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/**
 * Validate and normalize groupId.
 *
 * Note:
 * - In DB schema, group_id is INTEGER.
 * - We enforce positive integer here to avoid unexpected SQL behavior.
 *
 * @param {string|number} groupId
 * @throws {Error & {statusCode?: number}} - statusCode=400 when invalid
 * @returns {number} - normalized positive integer group id
 */
function normalizeGroupId(groupId) {
  const n = Number(groupId);
  if (!Number.isInteger(n) || n <= 0) {
    const err = new Error("Invalid groupId");
    err.statusCode = 400;
    throw err;
  }
  return n;
}

/**
 * Content stats for a group within a time window.
 *
 * What it returns:
 * - counts: total posts/comments/messages created in the window
 * - uniques: unique author counts for each content type (counts only, NOT user lists)
 *
 * Important join:
 * - post_comments does not store group_id directly; we JOIN posts to filter by group.
 *
 * @param {object} params
 * @param {string|number} params.groupId
 * @param {string|undefined} params.startDate - ISO string
 * @param {string|undefined} params.endDate - ISO string
 * @returns {Promise<{window:{startDate:string,endDate:string},counts:{posts:number,comments:number,messages:number},uniques:{postAuthors:number,commentAuthors:number,messageAuthors:number}}>}
 */
async function getContentStats({ groupId, startDate, endDate }) {
  const gid = normalizeGroupId(groupId);
  const window = normalizeWindow({ startDate, endDate });

  const postsQ = pool.query(
    `SELECT
       COUNT(*)::int AS posts,
       COUNT(DISTINCT sender_id::text)::int AS post_authors
     FROM posts
     WHERE group_id = $1
       AND created_at >= $2
       AND created_at <= $3`,
    [gid, window.startDate, window.endDate]
  );

  const commentsQ = pool.query(
    `SELECT
       COUNT(*)::int AS comments,
       COUNT(DISTINCT pc.sender_id::text)::int AS comment_authors
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
       COUNT(DISTINCT sender_id::text)::int AS message_authors
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

/**
 * Overview KPI payload for teacher/admin dashboard (group-scoped).
 *
 * KPI definitions:
 * - participantsTotal/adminsTotal: from participants table (no time window)
 * - posts/comments/messages: from getContentStats within window
 * - activeUsers: unique users who created at least one post/comment/message within window
 *   (proxy for engagement; does NOT include passive viewers)
 *
 * @param {object} params
 * @param {string|number} params.groupId
 * @param {string|undefined} params.startDate - ISO string
 * @param {string|undefined} params.endDate - ISO string
 * @returns {Promise<{window:{startDate:string,endDate:string},kpis:{participantsTotal:number,adminsTotal:number,activeUsers:number,posts:number,comments:number,messages:number}}>}
 */
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
       SELECT sender_id::text AS user_id
       FROM posts
       WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3
       UNION
       SELECT pc.sender_id::text AS user_id
       FROM post_comments pc
       JOIN posts p ON p.id = pc.post_id
       WHERE p.group_id = $1 AND pc.created_at >= $2 AND pc.created_at <= $3
       UNION
       SELECT sender_id::text AS user_id
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

/**
 * Normalize sort direction.
 *
 * @param {string|undefined} sortDir - "asc" | "desc" (case-insensitive)
 * @returns {"ASC"|"DESC"}
 */
function normalizeSortDir(sortDir) {
  return String(sortDir || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
}

/**
 * Normalize pagination parameters.
 *
 * @param {object} params
 * @param {number|string|undefined} params.limit
 * @param {number|string|undefined} params.offset
 * @param {number|undefined} params.defaultLimit
 * @param {number|undefined} params.maxLimit
 * @returns {{limit:number, offset:number}}
 */
function normalizeLimitOffset({ limit, offset, defaultLimit = 50, maxLimit = 200 } = {}) {
  const lim = Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : defaultLimit;
  const off = Number.isFinite(Number(offset)) ? Math.floor(Number(offset)) : 0;
  return {
    limit: Math.max(1, Math.min(maxLimit, lim)),
    offset: Math.max(0, off),
  };
}

/**
 * Per-student analytics table (CSV-friendly).
 *
 * Rows come from participants + users, then LEFT JOIN windowed aggregates:
 * - posts: count(posts) by sender_id
 * - replies: count(post_comments) by sender_id (within group's posts)
 * - messages: count(messages) by sender_id
 * - lastActiveAt: max(last_post_at, last_comment_at, last_message_at)
 *
 * Sorting:
 * - sortBy maps to an ORDER BY-able column alias, see sortMap inside function.
 *
 * Defaults:
 * - includeAdmins=false: by default return "students only" (exclude teachers/TAs)
 * - limit=50, offset=0
 *
 * @param {object} params
 * @param {string|number} params.groupId
 * @param {string|undefined} params.startDate
 * @param {string|undefined} params.endDate
 * @param {string|undefined} params.sortBy - "posts" | "replies" | "comments" | "messages" | "lastActiveAt" | "username"
 * @param {string|undefined} params.sortDir - "asc" | "desc"
 * @param {number|undefined} params.limit
 * @param {number|undefined} params.offset
 * @param {boolean|undefined} params.includeAdmins
 * @returns {Promise<{window:{startDate:string,endDate:string},students:Array, pagination:{limit:number,offset:number,total:number}}>}
 */
async function getStudentsAnalytics({
  groupId,
  startDate,
  endDate,
  sortBy,
  sortDir,
  limit,
  offset,
  includeAdmins = false,
}) {
  const gid = normalizeGroupId(groupId);
  const window = normalizeWindow({ startDate, endDate });
  const dir = normalizeSortDir(sortDir);
  const page = normalizeLimitOffset({ limit, offset });

  const sortMap = {
    posts: "posts",
    replies: "replies",
    comments: "replies",
    messages: "messages",
    lastActiveAt: "last_active_at",
    username: "username",
  };
  const sortCol = sortMap[sortBy] || "last_active_at";
  const includeAdminsClause = includeAdmins ? "" : "AND pr.is_admin = false";

  const query = `
    WITH base AS (
      SELECT
        u.id::text AS user_id,
        u.username AS username,
        pr.is_admin AS is_admin
      FROM participants pr
      JOIN users u ON u.id::text = pr.user_id::text
      WHERE pr.group_id = $1
        ${includeAdminsClause}
    ),
    post_stats AS (
      SELECT
        sender_id::text AS user_id,
        COUNT(*)::int AS posts,
        MAX(created_at) AS last_post_at
      FROM posts
      WHERE group_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY sender_id::text
    ),
    message_stats AS (
      SELECT
        sender_id::text AS user_id,
        COUNT(*)::int AS messages,
        MAX(created_at) AS last_message_at
      FROM messages
      WHERE group_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY sender_id::text
    ),
    comment_stats AS (
      SELECT
        pc.sender_id::text AS user_id,
        COUNT(*)::int AS replies,
        MAX(pc.created_at) AS last_comment_at
      FROM post_comments pc
      JOIN posts p ON p.id = pc.post_id
      WHERE p.group_id = $1
        AND pc.created_at >= $2
        AND pc.created_at <= $3
      GROUP BY pc.sender_id::text
    )
    SELECT
      b.user_id AS "userId",
      b.username AS "username",
      COALESCE(ps.posts, 0)::int AS "posts",
      COALESCE(cs.replies, 0)::int AS "replies",
      COALESCE(ms.messages, 0)::int AS "messages",
      GREATEST(
        COALESCE(ps.last_post_at, 'epoch'::timestamp),
        COALESCE(cs.last_comment_at, 'epoch'::timestamp),
        COALESCE(ms.last_message_at, 'epoch'::timestamp)
      ) AS "lastActiveAt",
      COUNT(*) OVER()::int AS "total"
    FROM base b
    LEFT JOIN post_stats ps ON ps.user_id = b.user_id
    LEFT JOIN comment_stats cs ON cs.user_id = b.user_id
    LEFT JOIN message_stats ms ON ms.user_id = b.user_id
    ORDER BY ${sortCol} ${dir}, "userId" ASC
    LIMIT $4 OFFSET $5
  `;

  const r = await pool.query(query, [gid, window.startDate, window.endDate, page.limit, page.offset]);
  const total = r.rows[0]?.total ?? 0;
  const students = r.rows.map(({ total: _t, ...row }) => row);

  return {
    window,
    students,
    pagination: { limit: page.limit, offset: page.offset, total },
  };
}

/**
 * Post health analytics for teachers/admins.
 *
 * Modes:
 * - "hot": rank posts by replies/views (default sorting favors replies)
 * - "unanswered": posts with 0 replies and older than unansweredOlderThanHours
 * - "mixed": default list (currently same query, just different defaults)
 *
 * Reply count source:
 * - Derived from post_comments grouped by post_id
 *
 * View count source:
 * - posts.view_count (if present; otherwise will be 0)
 *
 * @param {object} params
 * @param {string|number} params.groupId
 * @param {string|undefined} params.startDate
 * @param {string|undefined} params.endDate
 * @param {string|undefined} params.mode - "hot" | "unanswered" | "mixed"
 * @param {string|undefined} params.sortBy - "replies" | "views" | "createdAt"
 * @param {string|undefined} params.sortDir - "asc" | "desc"
 * @param {number|undefined} params.unansweredOlderThanHours - threshold used only for unanswered mode (default 24)
 * @param {number|undefined} params.limit
 * @param {number|undefined} params.offset
 * @returns {Promise<{window:{startDate:string,endDate:string},mode:string,posts:Array,pagination:{limit:number,offset:number,total:number}}>}
 */
async function getPostHealth({
  groupId,
  startDate,
  endDate,
  mode = "mixed",
  sortBy,
  sortDir,
  unansweredOlderThanHours = 24,
  limit,
  offset,
}) {
  const gid = normalizeGroupId(groupId);
  const window = normalizeWindow({ startDate, endDate });
  const dir = normalizeSortDir(sortDir);
  const page = normalizeLimitOffset({ limit, offset });

  const safeMode = ["hot", "unanswered", "mixed"].includes(mode) ? mode : "mixed";
  const safeHours = Number.isFinite(Number(unansweredOlderThanHours))
    ? Math.max(0, Math.floor(Number(unansweredOlderThanHours)))
    : 24;

  const sortMap = {
    replies: "reply_count",
    views: "view_count",
    createdAt: "created_at",
  };
  const defaultSort = safeMode === "unanswered" ? "created_at" : "reply_count";
  const sortCol = sortMap[sortBy] || defaultSort;

  // For unanswered mode we typically want oldest first (ASC) to highlight neglected posts.
  const effectiveDir = sortBy ? dir : safeMode === "unanswered" ? "ASC" : "DESC";

  const filters = [];
  const params = [gid, window.startDate, window.endDate, safeHours, page.limit, page.offset];

  if (safeMode === "unanswered") {
    filters.push(`COALESCE(rc.reply_count, 0) = 0`);
    filters.push(`p.created_at <= ($3::timestamptz - make_interval(hours => $4))`);
  }

  const whereExtra = filters.length ? `AND ${filters.join(" AND ")}` : "";

  const query = `
    WITH reply_counts AS (
      SELECT post_id, COUNT(*)::int AS reply_count
      FROM post_comments
      GROUP BY post_id
    )
    SELECT
      p.id AS "postId",
      p.title AS "title",
      p.sender_id::text AS "authorId",
      p.created_at AS "createdAt",
      COALESCE(rc.reply_count, 0)::int AS "replyCount",
      COALESCE(p.view_count, 0)::int AS "viewCount",
      COUNT(*) OVER()::int AS "total"
    FROM posts p
    LEFT JOIN reply_counts rc ON rc.post_id = p.id
    WHERE p.group_id = $1
      AND p.created_at >= $2
      AND p.created_at <= $3
      ${whereExtra}
    ORDER BY ${sortCol} ${effectiveDir}, p.id DESC
    LIMIT $5 OFFSET $6
  `;

  const r = await pool.query(query, params);
  const total = r.rows[0]?.total ?? 0;
  const posts = r.rows.map(({ total: _t, ...row }) => row);

  return {
    window,
    mode: safeMode,
    posts,
    pagination: { limit: page.limit, offset: page.offset, total },
  };
}

/**
 * Activity timeline time-series (daily/weekly buckets).
 *
 * Output buckets are continuous (includes 0-activity buckets) via generate_series.
 *
 * Bucket metrics:
 * - posts/comments/messages: counts per bucket
 * - activeUsers: unique users who created at least one post/comment/message in the bucket
 *
 * @param {object} params
 * @param {string|number} params.groupId
 * @param {string|undefined} params.startDate
 * @param {string|undefined} params.endDate
 * @param {"day"|"week"|undefined} params.bucket
 * @returns {Promise<{window:{startDate:string,endDate:string,bucket:"day"|"week"},points:Array<{bucketStart:string,posts:number,comments:number,messages:number,activeUsers:number}>}>}
 */
async function getActivityTimeline({ groupId, startDate, endDate, bucket = "day" }) {
  const gid = normalizeGroupId(groupId);
  const window = normalizeWindow({ startDate, endDate });

  const safeBucket = bucket === "week" ? "week" : "day";
  const step = safeBucket === "week" ? "1 week" : "1 day";

  const query = `
    WITH series AS (
      SELECT generate_series(
        date_trunc('${safeBucket}', $2::timestamptz),
        date_trunc('${safeBucket}', $3::timestamptz),
        '${step}'::interval
      ) AS bucket_start
    ),
    posts_agg AS (
      SELECT date_trunc('${safeBucket}', created_at)::timestamptz AS bucket_start, COUNT(*)::int AS posts
      FROM posts
      WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY 1
    ),
    comments_agg AS (
      SELECT date_trunc('${safeBucket}', pc.created_at)::timestamptz AS bucket_start, COUNT(*)::int AS comments
      FROM post_comments pc
      JOIN posts p ON p.id = pc.post_id
      WHERE p.group_id = $1 AND pc.created_at >= $2 AND pc.created_at <= $3
      GROUP BY 1
    ),
    messages_agg AS (
      SELECT date_trunc('${safeBucket}', created_at)::timestamptz AS bucket_start, COUNT(*)::int AS messages
      FROM messages
      WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY 1
    ),
    active_agg AS (
      WITH activity AS (
        SELECT date_trunc('${safeBucket}', created_at)::timestamptz AS bucket_start, sender_id::text AS user_id
        FROM posts
        WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3
        UNION
        SELECT date_trunc('${safeBucket}', pc.created_at)::timestamptz AS bucket_start, pc.sender_id::text AS user_id
        FROM post_comments pc
        JOIN posts p ON p.id = pc.post_id
        WHERE p.group_id = $1 AND pc.created_at >= $2 AND pc.created_at <= $3
        UNION
        SELECT date_trunc('${safeBucket}', created_at)::timestamptz AS bucket_start, sender_id::text AS user_id
        FROM messages
        WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3
      )
      SELECT bucket_start, COUNT(DISTINCT user_id)::int AS active_users
      FROM activity
      GROUP BY 1
    )
    SELECT
      s.bucket_start AS "bucketStart",
      COALESCE(p.posts, 0)::int AS "posts",
      COALESCE(c.comments, 0)::int AS "comments",
      COALESCE(m.messages, 0)::int AS "messages",
      COALESCE(a.active_users, 0)::int AS "activeUsers"
    FROM series s
    LEFT JOIN posts_agg p ON p.bucket_start = s.bucket_start
    LEFT JOIN comments_agg c ON c.bucket_start = s.bucket_start
    LEFT JOIN messages_agg m ON m.bucket_start = s.bucket_start
    LEFT JOIN active_agg a ON a.bucket_start = s.bucket_start
    ORDER BY s.bucket_start ASC
  `;

  const r = await pool.query(query, [gid, window.startDate, window.endDate]);

  return {
    window: { ...window, bucket: safeBucket },
    points: r.rows,
  };
}

/**
 * Build a combined export payload.
 *
 * Purpose:
 * - One request to gather multiple analytics blocks with a shared time window,
 *   used for "export report" or offline reporting workflows.
 *
 * include semantics:
 * - If include is empty/undefined, default to ["overview"]
 * - Valid include values currently handled:
 *   - "overview" | "content" | "students" | "posts" | "timeline"
 *
 * format:
 * - Currently only shapes JSON payload; "csv" is accepted but still returns JSON
 *   (CSV streaming can be added later at controller/router layer).
 *
 * @param {object} params
 * @param {string|number} params.groupId
 * @param {string|undefined} params.startDate
 * @param {string|undefined} params.endDate
 * @param {string[]|undefined} params.include
 * @param {"json"|"csv"|undefined} params.format
 * @returns {Promise<{window:{startDate:string,endDate:string},format:"json"|"csv",include:string[],data:Record<string,any>}>}
 */
async function buildExportPayload({ groupId, startDate, endDate, include, format = "json" }) {
  const gid = normalizeGroupId(groupId);
  const window = normalizeWindow({ startDate, endDate });
  const safeFormat = format === "csv" ? "csv" : "json";

  const includeList = Array.isArray(include) && include.length ? include : ["overview"];
  const uniqueInclude = Array.from(new Set(includeList.map(String)));

  const tasks = {};

  if (uniqueInclude.includes("overview")) {
    tasks.overview = getOverview({ groupId: gid, startDate: window.startDate, endDate: window.endDate });
  }
  if (uniqueInclude.includes("content")) {
    tasks.content = getContentStats({ groupId: gid, startDate: window.startDate, endDate: window.endDate });
  }
  if (uniqueInclude.includes("students")) {
    tasks.students = getStudentsAnalytics({ groupId: gid, startDate: window.startDate, endDate: window.endDate });
  }
  if (uniqueInclude.includes("posts")) {
    tasks.posts = getPostHealth({ groupId: gid, startDate: window.startDate, endDate: window.endDate });
  }
  if (uniqueInclude.includes("timeline")) {
    tasks.timeline = getActivityTimeline({ groupId: gid, startDate: window.startDate, endDate: window.endDate });
  }

  const entries = await Promise.all(
    Object.entries(tasks).map(async ([k, p]) => [k, await p])
  );

  return {
    window,
    format: safeFormat,
    include: uniqueInclude,
    data: Object.fromEntries(entries),
  };
}

module.exports = {
  normalizeWindow,
  getOverview,
  getContentStats,
  getStudentsAnalytics,
  getPostHealth,
  getActivityTimeline,
  buildExportPayload,
};

