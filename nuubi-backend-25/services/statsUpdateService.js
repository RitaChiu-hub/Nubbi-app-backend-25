const redis = require("../redis");
const pool = require("../db");

/**
 * Service to handle high-frequency activity recording in Redis 
 * and batch-syncing to PostgreSQL (Write-Behind Cache).
 */

const STATS_KEY_PREFIX = "nuubi:daily_stats:"; // nuubi:daily_stats:groupId:userId:YYYY-MM-DD

/**
 * Record activity in Redis
 * @param {Object} params
 * @param {string} params.userId
 * @param {number} params.groupId
 * @param {string} params.statDate - YYYY-MM-DD
 * @param {Object} params.increments - { posts: 1, comments: 1, ... }
 */
async function recordActivity({ userId, groupId, statDate, increments = {} }) {
  const key = `${STATS_KEY_PREFIX}${groupId}:${userId}:${statDate}`;
  
  // Use Redis Hash to store different metrics for the same user/group/day
  const pipeline = redis.pipeline();
  
  if (increments.posts) pipeline.hincrby(key, "posts_count", increments.posts);
  if (increments.comments) pipeline.hincrby(key, "comments_count", increments.comments);
  if (increments.messages) pipeline.hincrby(key, "messages_count", increments.messages);
  if (increments.points) pipeline.hincrby(key, "points_earned", increments.points);
  if (increments.active_seconds) pipeline.hincrby(key, "active_seconds", increments.active_seconds);
  if (increments.sessions) pipeline.hincrby(key, "sessions_count", increments.sessions);
  
  // Set expiration to 2 days to keep memory clean after syncing
  pipeline.expire(key, 172800); 
  
  await pipeline.exec();
}

/**
 * Worker Function: Sync all pending stats from Redis to PostgreSQL
 * This should be called by a cron job or a background worker process.
 */
async function syncStatsToPostgres() {
  console.log("🔄 Starting Redis to Postgres stats synchronization...");
  
  // 1. Find all keys that match our stats prefix
  const keys = await redis.keys(`${STATS_KEY_PREFIX}*`);
  if (keys.length === 0) {
    console.log("ℹ️ No pending stats in Redis.");
    return;
  }

  let syncCount = 0;

  for (const key of keys) {
    try {
      // 2. Extract groupId, userId, and date from key
      const parts = key.split(":");
      const groupId = parts[2];
      const userId = parts[3];
      const statDate = parts[4];

      // 3. Get all increments from Redis
      const stats = await redis.hgetall(key);
      if (!stats || Object.keys(stats).length === 0) continue;

      // 4. Update PostgreSQL using UPSERT (Atomic increment)
      const query = `
        INSERT INTO user_group_daily_stats (
          user_id, group_id, stat_date, 
          posts_count, comments_count, messages_count, 
          points_earned, active_seconds, sessions_count
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id, group_id, stat_date) 
        DO UPDATE SET
          posts_count = user_group_daily_stats.posts_count + EXCLUDED.posts_count,
          comments_count = user_group_daily_stats.comments_count + EXCLUDED.comments_count,
          messages_count = user_group_daily_stats.messages_count + EXCLUDED.messages_count,
          points_earned = user_group_daily_stats.points_earned + EXCLUDED.points_earned,
          active_seconds = user_group_daily_stats.active_seconds + EXCLUDED.active_seconds,
          sessions_count = user_group_daily_stats.sessions_count + EXCLUDED.sessions_count;
      `;

      await pool.query(query, [
        userId,
        parseInt(groupId),
        statDate,
        parseInt(stats.posts_count || 0),
        parseInt(stats.comments_count || 0),
        parseInt(stats.messages_count || 0),
        parseInt(stats.points_earned || 0),
        parseInt(stats.active_seconds || 0),
        parseInt(stats.sessions_count || 0)
      ]);

      // 5. IMPORTANT: Delete from Redis after successful sync to avoid double counting
      await redis.del(key);
      syncCount++;

    } catch (err) {
      console.error(`❌ Failed to sync Redis key ${key}:`, err);
    }
  }

  console.log(`✅ Successfully synced ${syncCount} user-day records to Postgres.`);
}

module.exports = {
  recordActivity,
  syncStatsToPostgres
};
