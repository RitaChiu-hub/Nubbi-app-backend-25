const redis = require("../redis");
const pool = require("../db");
const { recordActivity, syncStatsToPostgres } = require("../services/statsUpdateService");

/**
 * Redis Stats & Background Sync Tests
 * 
 * Verifies the "Write-Behind" flow:
 * recordActivity (Redis) -> syncStatsToPostgres (DB)
 */

describe("Redis Analytics & Sync Flow", () => {
  const testUserId = "test-user-999";
  let testGroupId;
  const testDate = "2026-03-23";
  let redisKey;

  beforeAll(async () => {
    // 1. Ensure the test user exists
    await pool.query(
      "INSERT INTO users (id, email, username, passhash) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
      [testUserId, "test-redis@nuubi.com", "RedisTester", "noop"]
    );

    // 2. Ensure a valid group exists to satisfy foreign key constraints
    const groupRes = await pool.query(
      "INSERT INTO groups (name, description, is_public) VALUES ($1, $2, $3) RETURNING id",
      ["Redis Test Group", "Temporary group for Redis flow testing", true]
    );
    testGroupId = groupRes.rows[0].id;
    redisKey = `nuubi:daily_stats:${testGroupId}:${testUserId}:${testDate}`;

    // Clean up any leftovers
    await redis.del(redisKey);
  });

  afterAll(async () => {
    // Final cleanup
    await redis.del(redisKey);
    if (testGroupId) {
      await pool.query("DELETE FROM user_group_daily_stats WHERE group_id = $1", [testGroupId]);
      await pool.query("DELETE FROM groups WHERE id = $1", [testGroupId]);
    }
    await pool.query("DELETE FROM users WHERE id = $1", [testUserId]);
  });

  it("should record activity in Redis hashes correctly", async () => {
    // 1. Record 2 posts and 5 points
    await recordActivity({
      userId: testUserId,
      groupId: testGroupId,
      statDate: testDate,
      increments: { posts: 2, points: 5 }
    });

    // 2. Fetch from Redis to verify
    const stats = await redis.hgetall(redisKey);
    expect(parseInt(stats.posts_count)).toBe(2);
    expect(parseInt(stats.points_earned)).toBe(5);
    expect(stats).toHaveProperty("posts_count");
  });

  it("should accumulate increments in Redis", async () => {
    // 1. Record 3 more posts (total should be 2 + 3 = 5)
    await recordActivity({
      userId: testUserId,
      groupId: testGroupId,
      statDate: testDate,
      increments: { posts: 3 }
    });

    const stats = await redis.hgetall(redisKey);
    expect(parseInt(stats.posts_count)).toBe(5);
  });

  it("should sync Redis stats to Postgres and delete the Redis key", async () => {
    // 1. Trigger manual sync
    await syncStatsToPostgres();

    // 2. Verify Redis key is deleted
    const exists = await redis.exists(redisKey);
    expect(exists).toBe(0);

    // 3. Verify PostgreSQL has the data
    const dbRes = await pool.query(
      "SELECT posts_count, points_earned FROM user_group_daily_stats WHERE user_id = $1 AND group_id = $2 AND stat_date = $3",
      [testUserId, testGroupId, testDate]
    );

    expect(dbRes.rows.length).toBe(1);
    expect(dbRes.rows[0].posts_count).toBe(5);
    expect(dbRes.rows[0].points_earned).toBe(5);
  });

  it("should handle second sync (incremental update) correctly", async () => {
    // 1. Record new activity after the first sync
    await recordActivity({
      userId: testUserId,
      groupId: testGroupId,
      statDate: testDate,
      increments: { messages: 10 }
    });

    // 2. Sync again
    await syncStatsToPostgres();

    // 3. Verify PostgreSQL has merged the data (5 posts still there, 10 messages added)
    const dbRes = await pool.query(
      "SELECT posts_count, messages_count FROM user_group_daily_stats WHERE user_id = $1 AND group_id = $2 AND stat_date = $3",
      [testUserId, testGroupId, testDate]
    );

    expect(dbRes.rows[0].posts_count).toBe(5);
    expect(dbRes.rows[0].messages_count).toBe(10);
  });
});
