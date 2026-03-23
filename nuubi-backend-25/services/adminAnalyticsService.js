const pool = require("../db");
const Sequelize = require("sequelize");
const { Op } = require("sequelize");
require("dotenv").config();

// Initialize Sequelize for deep analytics that use models
const sequelize = new Sequelize({
  dialect: "postgres",
  logging: false,
  database: process.env.DATABASE_NAME,
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  dialectOptions: {
    ssl: process.env.DATABASE_HOST === "localhost" ? false : {
      rejectUnauthorized: false,
    },
  },
});

const DataTypes = require("sequelize").DataTypes;
const {
  participants,
  users,
  user_sessions,
  user_session_totals,
} = require("../models/init-models")(sequelize, DataTypes);

/**
 * Admin Analytics Service
 */

function toDateOrUndefined(value) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function normalizeWindow({ startDate, endDate, defaultDays = 7 } = {}) {
  const end = toDateOrUndefined(endDate) ? new Date(toDateOrUndefined(endDate)) : new Date();
  const start = toDateOrUndefined(startDate) ? new Date(toDateOrUndefined(startDate)) : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  
  const endIso = end.toISOString();
  const startIso = start.toISOString();

  if (start.getTime() > end.getTime()) {
    return { startDate: endIso, endDate: startIso };
  }
  return { startDate: startIso, endDate: endIso };
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

function normalizeSortDir(sortDir) {
  return String(sortDir || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
}

function normalizeLimitOffset({ limit, offset, defaultLimit = 50, maxLimit = 200 } = {}) {
  const lim = Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : defaultLimit;
  const off = Number.isFinite(Number(offset)) ? Math.floor(Number(offset)) : 0;
  return {
    limit: Math.max(1, Math.min(maxLimit, lim)),
    offset: Math.max(0, off),
  };
}

async function getContentStats({ groupId, startDate, endDate }) {
  const gid = normalizeGroupId(groupId);
  const window = normalizeWindow({ startDate, endDate });

  const postsQ = pool.query(
    `SELECT COUNT(*)::int AS posts, COUNT(DISTINCT sender_id::text)::int AS post_authors FROM posts WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3`,
    [gid, window.startDate, window.endDate]
  );

  const commentsQ = pool.query(
    `SELECT COUNT(*)::int AS comments, COUNT(DISTINCT pc.sender_id::text)::int AS comment_authors FROM post_comments pc JOIN posts p ON p.id = pc.post_id WHERE p.group_id = $1 AND pc.created_at >= $2 AND pc.created_at <= $3`,
    [gid, window.startDate, window.endDate]
  );

  const messagesQ = pool.query(
    `SELECT COUNT(*)::int AS messages, COUNT(DISTINCT sender_id::text)::int AS message_authors FROM messages WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3`,
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
    `SELECT COUNT(*)::int AS participants_total, COUNT(*) FILTER (WHERE is_admin = true)::int AS admins_total FROM participants WHERE group_id = $1`,
    [gid]
  );

  const contentStatsQ = getContentStats({ groupId: gid, startDate: window.startDate, endDate: window.endDate });

  const activeUsersQ = pool.query(
    `WITH activity_users AS (
       SELECT sender_id::text AS user_id FROM posts WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3
       UNION
       SELECT pc.sender_id::text AS user_id FROM post_comments pc JOIN posts p ON p.id = pc.post_id WHERE p.group_id = $1 AND pc.created_at >= $2 AND pc.created_at <= $3
       UNION
       SELECT sender_id::text AS user_id FROM messages WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3
     )
     SELECT COUNT(DISTINCT user_id)::int AS active_users FROM activity_users`,
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
      SELECT u.id::text AS user_id, u.username AS username, pr.is_admin AS is_admin
      FROM participants pr
      JOIN users u ON u.id::text = pr.user_id::text
      WHERE pr.group_id = $1
        ${includeAdminsClause}
    ),
    post_stats AS (
      SELECT sender_id::text AS user_id, COUNT(*)::int AS posts, MAX(created_at) AS last_post_at
      FROM posts WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY sender_id::text
    ),
    message_stats AS (
      SELECT sender_id::text AS user_id, COUNT(*)::int AS messages, MAX(created_at) AS last_message_at
      FROM messages WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY sender_id::text
    ),
    comment_stats AS (
      SELECT pc.sender_id::text AS user_id, COUNT(*)::int AS replies, MAX(pc.created_at) AS last_comment_at
      FROM post_comments pc JOIN posts p ON p.id = pc.post_id
      WHERE p.group_id = $1 AND pc.created_at >= $2 AND pc.created_at <= $3
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
  const safeHours = Number.isFinite(Number(unansweredOlderThanHours)) ? Math.max(0, Math.floor(Number(unansweredOlderThanHours))) : 24;

  const sortMap = {
    replies: "reply_count",
    views: "view_count",
    createdAt: "created_at",
  };
  const defaultSort = safeMode === "unanswered" ? "created_at" : "reply_count";
  const sortCol = sortMap[sortBy] || defaultSort;
  const effectiveDir = sortBy ? dir : safeMode === "unanswered" ? "ASC" : "DESC";

  const filters = [];
  const params = [gid, window.startDate, window.endDate, safeHours, page.limit, page.offset];

  if (safeMode === "unanswered") {
    filters.push(`COALESCE(rc.reply_count, 0) = 0`);
    filters.push(`p.created_at <= ($3::timestamptz - make_interval(hours => $4))`);
  }

  const query = `
    WITH reply_counts AS (
      SELECT post_id, COUNT(*)::int AS reply_count FROM post_comments GROUP BY post_id
    )
    SELECT
      p.id AS "postId", p.title AS "title", p.sender_id::text AS "authorId", p.created_at AS "createdAt",
      COALESCE(rc.reply_count, 0)::int AS "replyCount", COALESCE(p.view_count, 0)::int AS "viewCount",
      COUNT(*) OVER()::int AS "total"
    FROM posts p
    LEFT JOIN reply_counts rc ON rc.post_id = p.id
    WHERE p.group_id = $1 AND p.created_at >= $2 AND p.created_at <= $3
      ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
    ORDER BY ${sortCol} ${effectiveDir}, p.id DESC
    LIMIT $5 OFFSET $6
  `;

  const r = await pool.query(query, params);
  const total = r.rows[0]?.total ?? 0;
  const posts = r.rows.map(({ total: _t, ...row }) => row);

  return { window, mode: safeMode, posts, pagination: { limit: page.limit, offset: page.offset, total } };
}

async function getActivityTimeline({ groupId, startDate, endDate, bucket = "day" }) {
  const gid = normalizeGroupId(groupId);
  const window = normalizeWindow({ startDate, endDate });
  const safeBucket = bucket === "week" ? "week" : "day";
  const step = safeBucket === "week" ? "1 week" : "1 day";

  const query = `
    WITH series AS (
      SELECT generate_series(date_trunc('${safeBucket}', $2::timestamptz), date_trunc('${safeBucket}', $3::timestamptz), '${step}'::interval) AS bucket_start
    ),
    posts_agg AS (
      SELECT date_trunc('${safeBucket}', created_at)::timestamptz AS bucket_start, COUNT(*)::int AS posts
      FROM posts WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3 GROUP BY 1
    ),
    comments_agg AS (
      SELECT date_trunc('${safeBucket}', pc.created_at)::timestamptz AS bucket_start, COUNT(*)::int AS comments
      FROM post_comments pc JOIN posts p ON p.id = pc.post_id WHERE p.group_id = $1 AND pc.created_at >= $2 AND pc.created_at <= $3 GROUP BY 1
    ),
    messages_agg AS (
      SELECT date_trunc('${safeBucket}', created_at)::timestamptz AS bucket_start, COUNT(*)::int AS messages
      FROM messages WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3 GROUP BY 1
    ),
    active_agg AS (
      WITH activity AS (
        SELECT date_trunc('${safeBucket}', created_at)::timestamptz AS bucket_start, sender_id::text AS user_id FROM posts WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3
        UNION
        SELECT date_trunc('${safeBucket}', pc.created_at)::timestamptz AS bucket_start, pc.sender_id::text AS user_id FROM post_comments pc JOIN posts p ON p.id = pc.post_id WHERE p.group_id = $1 AND pc.created_at >= $2 AND pc.created_at <= $3
        UNION
        SELECT date_trunc('${safeBucket}', created_at)::timestamptz AS bucket_start, sender_id::text AS user_id FROM messages WHERE group_id = $1 AND created_at >= $2 AND created_at <= $3
      )
      SELECT bucket_start, COUNT(DISTINCT user_id)::int AS active_users FROM activity GROUP BY 1
    )
    SELECT
      s.bucket_start AS "bucketStart", COALESCE(p.posts, 0)::int AS "posts", COALESCE(c.comments, 0)::int AS "comments",
      COALESCE(m.messages, 0)::int AS "messages", COALESCE(a.active_users, 0)::int AS "activeUsers"
    FROM series s
    LEFT JOIN posts_agg p ON p.bucket_start = s.bucket_start
    LEFT JOIN comments_agg c ON c.bucket_start = s.bucket_start
    LEFT JOIN messages_agg m ON m.bucket_start = s.bucket_start
    LEFT JOIN active_agg a ON a.bucket_start = s.bucket_start
    ORDER BY s.bucket_start ASC
  `;

  const r = await pool.query(query, [gid, window.startDate, window.endDate]);
  return { window: { ...window, bucket: safeBucket }, points: r.rows };
}

async function buildExportPayload({ groupId, startDate, endDate, include, format = "json" }) {
  const gid = normalizeGroupId(groupId);
  const window = normalizeWindow({ startDate, endDate });
  const safeFormat = format === "csv" ? "csv" : "json";
  const includeList = Array.isArray(include) && include.length ? include : ["overview"];
  const uniqueInclude = Array.from(new Set(includeList.map(String)));
  const tasks = {};

  if (uniqueInclude.includes("overview")) tasks.overview = getOverview({ groupId: gid, startDate: window.startDate, endDate: window.endDate });
  if (uniqueInclude.includes("content")) tasks.content = getContentStats({ groupId: gid, startDate: window.startDate, endDate: window.endDate });
  if (uniqueInclude.includes("students")) tasks.students = getStudentsAnalytics({ groupId: gid, startDate: window.startDate, endDate: window.endDate });
  if (uniqueInclude.includes("posts")) tasks.posts = getPostHealth({ groupId: gid, startDate: window.startDate, endDate: window.endDate });
  if (uniqueInclude.includes("timeline")) tasks.timeline = getActivityTimeline({ groupId: gid, startDate: window.startDate, endDate: window.endDate });

  const entries = await Promise.all(Object.entries(tasks).map(async ([k, p]) => [k, await p]));
  return { window, format: safeFormat, include: uniqueInclude, data: Object.fromEntries(entries) };
}

/**
 * Deep Participation Analytics for a group (High Performance Version)
 *
 * This version uses the user_group_daily_stats cache table to aggregate data
 * in a single SQL query, supporting backend sorting and pagination.
 */
async function getDeepParticipation({ 
  groupId, 
  startDate, 
  endDate, 
  sortBy = 'engagement_score', 
  sortOrder = 'desc',
  limit = 20,
  offset = 0
}) {
  const gid = normalizeGroupId(groupId);
  const window = normalizeWindow({ startDate, endDate, defaultDays: 365 }); 
  const dir = normalizeSortDir(sortOrder);
  const page = normalizeLimitOffset({ limit, offset });

  const sortMap = {
    points: "total_points",
    posts: "total_posts",
    active_time: "total_active_seconds",
    sessions: "total_sessions",
    engagement_score: "engagement_score"
  };
  const sortCol = sortMap[sortBy] || "engagement_score";

  const query = `
    WITH user_metrics AS (
      SELECT 
        user_id,
        SUM(posts_count)::int as total_posts,
        SUM(comments_count)::int as total_comments,
        SUM(messages_count)::int as total_messages,
        SUM(points_earned)::int as total_points,
        SUM(active_seconds)::int as total_active_seconds,
        SUM(sessions_count)::int as total_sessions,
        (SUM(points_earned) + SUM(posts_count)*5 + SUM(comments_count)*3 + SUM(messages_count)*2)::int as engagement_score
      FROM user_group_daily_stats
      WHERE group_id = $1
        AND stat_date >= $2::date
        AND stat_date <= $3::date
      GROUP BY user_id
    ),
    class_stats AS (
      SELECT 
        AVG(total_sessions) as avg_sessions,
        AVG(total_active_seconds) as avg_active_seconds,
        AVG(total_posts) as avg_posts,
        AVG(total_points) as avg_points,
        AVG(total_comments) as avg_comments,
        COUNT(*)::int as total_students
      FROM user_metrics
    ),
    ranked_users AS (
      SELECT 
        m.*,
        u.username,
        u.email,
        PERCENT_RANK() OVER (ORDER BY m.total_points) as points_percentile,
        PERCENT_RANK() OVER (ORDER BY m.total_sessions) as sessions_percentile,
        PERCENT_RANK() OVER (ORDER BY m.total_posts) as posts_percentile,
        RANK() OVER (ORDER BY m.engagement_score DESC) as overall_rank,
        COUNT(*) OVER() AS full_count
      FROM user_metrics m
      JOIN users u ON u.id = m.user_id
    )
    SELECT 
      r.*,
      cs.*,
      (
        SELECT json_agg(top_sub) FROM (
          SELECT * 
          FROM ranked_users 
          ORDER BY engagement_score DESC 
          LIMIT 10
        ) top_sub
      ) as top_performers,
      (
        SELECT json_agg(attn_sub) FROM (
          SELECT *
          FROM ranked_users 
          WHERE engagement_score < 10 OR total_posts = 0 OR total_sessions < 2
          ORDER BY engagement_score ASC 
          LIMIT 15
        ) attn_sub
      ) as needs_attention
    FROM ranked_users r
    CROSS JOIN class_stats cs
    ORDER BY ${sortCol} ${dir}
    LIMIT $4 OFFSET $5;
  `;

  const r = await pool.query(query, [gid, window.startDate, window.endDate, page.limit, page.offset]);
  
  if (r.rows.length === 0) {
    return { analytics: [], class_statistics: null };
  }

  const firstRow = r.rows[0];

  const mapUserRow = (row) => ({
    user_id: row.user_id,
    username: row.username,
    email: row.email,
    is_admin: false,
    engagement_score: row.engagement_score,
    session_analytics: {
      total_sessions: row.total_sessions,
      total_active_seconds: row.total_active_seconds,
      total_active_hours: Math.round(row.total_active_seconds / 3600 * 10) / 10,
    },
    participation: {
      total_posts: row.total_posts,
      total_comments: row.total_comments,
      total_messages: row.total_messages,
      total_points: row.total_points,
    },
    rankings: {
      points_percentile: Math.round(row.points_percentile * 100),
      sessions_percentile: Math.round(row.sessions_percentile * 100),
      posts_percentile: Math.round(row.posts_percentile * 100),
      overall_rank: parseInt(row.overall_rank),
      total_students: parseInt(firstRow.total_students)
    }
  });

  const classStats = {
    total_students: parseInt(firstRow.total_students),
    avg_sessions: Math.round(parseFloat(firstRow.avg_sessions)),
    avg_active_hours: Math.round(parseFloat(firstRow.avg_active_seconds) / 3600 * 10) / 10,
    avg_posts: Math.round(parseFloat(firstRow.avg_posts)),
    avg_points: Math.round(parseFloat(firstRow.avg_points)),
    avg_comments: Math.round(parseFloat(firstRow.avg_comments || 0)),
  };

  classStats.top_students = (firstRow.top_performers || []).map(mapUserRow);
  classStats.needs_attention = (firstRow.needs_attention || []).map(s => {
    const issues = [];
    if (s.engagement_score === 0) issues.push("No activity recorded");
    else if (s.engagement_score < 10) issues.push("Very low engagement score");
    if (s.total_posts === 0) issues.push("Zero posts shared");
    if (s.total_sessions < 2) issues.push("Rarely logs in");
    return { ...mapUserRow(s), issues };
  });

  const analytics = r.rows.map(mapUserRow);

  return {
    window,
    analytics,
    class_statistics: classStats,
    pagination: {
      total: parseInt(firstRow.full_count),
      limit: page.limit,
      offset: page.offset
    }
  };
}

async function getWeeklyTrend({ groupId, startDate, endDate, userId, isAdmin }) {
  const gid = normalizeGroupId(groupId);
  const window = normalizeWindow({ startDate, endDate });

  const dateDiff = await pool.query(`SELECT FLOOR(DATE_PART('day', $2::timestamp - $1::timestamp) / 7) + 1 AS weeks`, [window.startDate, window.endDate]);
  const numberOfWeeks = Math.max(1, parseInt(dateDiff.rows[0]?.weeks || 1));

  const generateSelectColumns = () => {
    const cols = [];
    for (let i = 1; i <= numberOfWeeks; i++) {
      cols.push(`
        COALESCE(MAX(CASE WHEN aw.week_number = ${i} THEN aw.weekly_points END), 0) AS week_${i}_points,
        COALESCE(MAX(CASE WHEN aw.week_number = ${i} THEN aw.weekly_posts END), 0) AS week_${i}_posts,
        COALESCE(MAX(CASE WHEN aw.week_number = ${i} THEN aw.weekly_comments END), 0) AS week_${i}_comments,
        COALESCE(MAX(CASE WHEN aw.week_number = ${i} THEN aw.weekly_messages END), 0) AS week_${i}_messages
      `);
    }
    return cols.join(",\n");
  };

  const baseQuery = `
    WITH WeeklyIntervals AS (
      SELECT generate_series(0, ${numberOfWeeks - 1}) AS week_index, ($1::date + (generate_series(0, ${numberOfWeeks - 1}) * interval '1 week')) AS week_start
    ),
    UserDetails AS (
      SELECT u.id AS user_id, u.username, u.email, COALESCE(COUNT(DISTINCT po.id), 0) AS total_posts,
        COALESCE(COUNT(DISTINCT CASE WHEN parent_post.group_id = $2 THEN pc.id END), 0) AS total_comments,
        COALESCE(COUNT(DISTINCT m.id), 0) AS total_messages
      FROM users u JOIN participants p ON u.id = p.user_id AND p.group_id = $2
      LEFT JOIN posts po ON po.sender_id = u.id AND po.group_id = $2
      LEFT JOIN post_comments pc ON pc.sender_id = u.id LEFT JOIN posts parent_post ON pc.post_id = parent_post.id
      LEFT JOIN messages m ON m.sender_id = u.id AND m.group_id = $2
      ${!isAdmin ? `WHERE u.id = $3` : ""}
      GROUP BY u.id, u.username, u.email
    ),
    ActivityByWeek AS (
      SELECT user_id, week_number, SUM(points) AS weekly_points, SUM(posts) AS weekly_posts, SUM(comments) AS weekly_comments, SUM(messages) AS weekly_messages
      FROM (
        SELECT p.recipient_id AS user_id, wi.week_index + 1 AS week_number, SUM(p.point_value) AS points, 0 AS posts, 0 AS comments, 0 AS messages
        FROM points p JOIN WeeklyIntervals wi ON p.created_at >= wi.week_start AND p.created_at < (wi.week_start + interval '1 week')
        WHERE p.group_id = $2 ${!isAdmin ? `AND p.recipient_id = $3` : ""} GROUP BY p.recipient_id, wi.week_index
        UNION ALL
        SELECT po.sender_id AS user_id, wi.week_index + 1 AS week_number, 0 AS points, COUNT(*) AS posts, 0 AS comments, 0 AS messages
        FROM posts po JOIN WeeklyIntervals wi ON po.created_at >= wi.week_start AND po.created_at < (wi.week_start + interval '1 week')
        WHERE po.group_id = $2 ${!isAdmin ? `AND po.sender_id = $3` : ""} GROUP BY po.sender_id, wi.week_index
        UNION ALL
        SELECT pc.sender_id AS user_id, wi.week_index + 1 AS week_number, 0 AS points, 0 AS posts, COUNT(*) AS comments, 0 AS messages
        FROM post_comments pc JOIN posts p ON pc.post_id = p.id JOIN WeeklyIntervals wi ON pc.created_at >= wi.week_start AND pc.created_at < (wi.week_start + interval '1 week')
        WHERE p.group_id = $2 ${!isAdmin ? `AND pc.sender_id = $3` : ""} GROUP BY pc.sender_id, wi.week_index
        UNION ALL
        SELECT m.sender_id AS user_id, wi.week_index + 1 AS week_number, 0 AS points, 0 AS posts, 0 AS comments, COUNT(*) AS messages
        FROM messages m JOIN WeeklyIntervals wi ON m.created_at >= wi.week_start AND m.created_at < (wi.week_start + interval '1 week')
        WHERE m.group_id = $2 ${!isAdmin ? `AND m.sender_id = $3` : ""} GROUP BY m.sender_id, wi.week_index
      ) AS combined
      GROUP BY user_id, week_number
    )
    SELECT ud.user_id, ud.username, ud.email, COALESCE(SUM(aw.weekly_points), 0) AS total_points, ud.total_posts, ud.total_comments, ud.total_messages, ${generateSelectColumns()}
    FROM UserDetails ud LEFT JOIN ActivityByWeek aw ON aw.user_id = ud.user_id
    GROUP BY ud.user_id, ud.username, ud.email, ud.total_posts, ud.total_comments, ud.total_messages ORDER BY ud.username;
  `;

  const params = isAdmin ? [window.startDate, gid] : [window.startDate, gid, userId];
  const r = await pool.query(baseQuery, params);

  const students = r.rows.map((user) => {
    const formatted = { user_id: user.user_id, username: user.username, email: user.email, total: { points: user.total_points || "0", posts: user.total_posts || "0", comments: user.total_comments || "0", messages: user.total_messages || "0" } };
    for (let i = 1; i <= numberOfWeeks; i++) {
      formatted[`week_${i}`] = { points: user[`week_${i}_points`] || "0", posts: user[`week_${i}_posts`] || "0", comments: user[`week_${i}_comments`] || "0", messages: user[`week_${i}_messages`] || "0" };
    }
    return formatted;
  });

  return { window, numberOfWeeks, students };
}

async function getLeaderboard({ groupId }) {
  const gid = normalizeGroupId(groupId);
  const query = `
    SELECT c.user_id as user_id, username, email, is_admin, COALESCE(group_total_points, 0) as group_total_points 
    FROM (SELECT users.id user_id, users.username username, users.email email, participants.is_admin is_admin FROM participants INNER JOIN users ON participants.user_id = users.id WHERE participants.group_id = $1) c 
    FULL OUTER JOIN (SELECT user_id, recipient_id, sum as group_total_points FROM (SELECT DISTINCT participants.user_id FROM participants INNER JOIN points ON participants.user_id = points.recipient_id WHERE participants.group_id = $1) a LEFT JOIN (SELECT recipient_id, SUM(point_value) FROM points WHERE group_id = $1 GROUP BY recipient_id) b ON a.user_id = b.recipient_id) d ON c.user_id = d.user_id 
    ORDER BY group_total_points DESC;
  `;
  const r = await pool.query(query, [gid]);
  return r.rows;
}

async function getMyLeaderboards({ userId }) {
  const query = `
    SELECT className, group_id, json_agg(json_build_object('name', username, 'placement', placement, 'profilePicture', avatar_url)) AS leaders 
    FROM (SELECT className, group_id, username, avatar_url, ROW_NUMBER() OVER (PARTITION BY className ORDER BY COALESCE(total_points, 0) DESC) AS placement FROM (SELECT g.id AS group_id, g.name AS className, u.username, u.avatar_url, SUM(p.point_value) AS total_points FROM participants pa JOIN groups g ON pa.group_id = g.id LEFT JOIN points p ON pa.group_id = p.group_id JOIN users u ON p.recipient_id = u.id WHERE pa.user_id = $1 GROUP BY g.id, g.name, u.username, u.avatar_url) AS subquery) AS ranked_leaders 
    WHERE placement <= 3 GROUP BY className, group_id;
  `;
  const r = await pool.query(query, [userId]);
  return r.rows;
}

async function getUserGroupAnalytics({ groupId, userId, startDate, endDate }) {
  const gid = normalizeGroupId(groupId);
  const window = normalizeWindow({ startDate, endDate, defaultDays: 90 });

  const query = `
    WITH WeeklyIntervals AS (SELECT generate_series($2::date, $3::date, interval '1 week') AS week_start),
    UserDetails AS (SELECT u.id AS user_id, u.username, u.email FROM users u JOIN participants p ON u.id = p.user_id AND p.group_id = $1 WHERE u.id = $4)
    SELECT u.user_id, u.username, u.email,
      ARRAY(SELECT (SELECT COUNT(*)::int FROM posts po WHERE po.group_id = $1 AND po.sender_id = u.user_id AND po.updated_at >= wi.week_start AND po.updated_at < wi.week_start + interval '1 week') FROM WeeklyIntervals wi ORDER BY wi.week_start) AS weekly_posts,
      ARRAY(SELECT (SELECT COUNT(*)::int FROM post_comments pc JOIN posts p ON pc.post_id = p.id WHERE p.group_id = $1 AND pc.sender_id = u.user_id AND pc.updated_at >= wi.week_start AND pc.updated_at < wi.week_start + interval '1 week') FROM WeeklyIntervals wi ORDER BY wi.week_start) AS weekly_comments,
      ARRAY(SELECT (SELECT COUNT(*)::int FROM messages m WHERE m.group_id = $1 AND m.sender_id = u.user_id AND m.updated_at >= wi.week_start AND m.updated_at < wi.week_start + interval '1 week') FROM WeeklyIntervals wi ORDER BY wi.week_start) AS weekly_messages,
      ARRAY(SELECT (SELECT COALESCE(SUM(p.point_value), 0)::int FROM points p WHERE p.group_id = $1 AND p.recipient_id = u.user_id AND p.updated_at >= wi.week_start AND p.updated_at < wi.week_start + interval '1 week') FROM WeeklyIntervals wi ORDER BY wi.week_start) AS weekly_points
    FROM UserDetails u;
  `;
  const r = await pool.query(query, [gid, window.startDate, window.endDate, userId]);
  return r.rows;
}

module.exports = {
  normalizeWindow,
  getOverview,
  getContentStats,
  getStudentsAnalytics,
  getPostHealth,
  getActivityTimeline,
  buildExportPayload,
  getDeepParticipation,
  getWeeklyTrend,
  getLeaderboard,
  getMyLeaderboards,
  getUserGroupAnalytics,
};
