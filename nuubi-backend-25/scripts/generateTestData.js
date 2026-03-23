/**
 * Nuubi Data Seeding Script (Big Data Testing)
 * 
 * Generates:
 * - 1 Admin User + 100 Students
 * - 1 Course Group
 * - 5,000+ Session records (randomly distributed over 3 months)
 * - 1,000+ Posts, Comments, and Messages
 * - 10,000+ Point records
 */

const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const pool = new Pool({
  database: process.env.DATABASE_NAME,
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  port: process.env.DATABASE_PORT,
  password: process.env.DATABASE_PASSWORD,
  ssl: false, // Local DB usually no SSL
});

async function seed() {
  console.log("🚀 Starting data seeding for " + process.env.DATABASE_NAME + "...");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Create Users
    console.log("👥 Creating users (1 Admin + 100 Students)...");
    const passhash = await bcrypt.hash("password123", 10);
    
    // Create Admin
    const adminId = "admin-1";
    await client.query(
      "INSERT INTO users (id, email, username, passhash) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
      [adminId, "admin@nuubi.com", "Professor_Zou", passhash]
    );

    // Create 100 Students
    const studentIds = [];
    for (let i = 1; i <= 100; i++) {
      const sid = `student-${i}`;
      await client.query(
        "INSERT INTO users (id, email, username, passhash) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [sid, `student${i}@nuubi.com`, `Student_${i}`, passhash]
      );
      studentIds.push(sid);
    }

    // 2. Create Group
    console.log("🏫 Creating course group...");
    const groupRes = await client.query(
      "INSERT INTO groups (name, description, is_public) VALUES ($1, $2, $3) RETURNING id",
      ["Data Science 101", "Advanced analytics and big data concepts.", true]
    );
    const groupId = groupRes.rows[0].id;

    // 3. Add Participants
    console.log("🔗 Joining users to group...");
    await client.query(
      "INSERT INTO participants (user_id, group_id, is_admin) VALUES ($1, $2, $3)",
      [adminId, groupId, true]
    );
    for (const sid of studentIds) {
      await client.query(
        "INSERT INTO participants (user_id, group_id, is_admin) VALUES ($1, $2, $3)",
        [sid, groupId, false]
      );
    }

    // 4. Generate Sessions (The Bulk Data)
    console.log("📊 Generating 5000+ session logs (over last 3 months)...");
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const devices = ["mobile", "desktop", "tablet"];
    const platforms = ["ios", "android", "windows", "macos", "web"];

    for (let i = 0; i < 5000; i++) {
      const studentId = studentIds[Math.floor(Math.random() * studentIds.length)];
      const startTime = new Date(threeMonthsAgo.getTime() + Math.random() * (now.getTime() - threeMonthsAgo.getTime()));
      const duration = Math.floor(Math.random() * 3600 * 2); // Up to 2 hours
      const endTime = new Date(startTime.getTime() + duration * 1000);
      
      const pages = Math.floor(Math.random() * 20);
      const postsViewed = Math.floor(Math.random() * 10);
      const actions = pages + postsViewed + Math.floor(Math.random() * 10);
      const errors = Math.random() > 0.95 ? 1 : 0;

      await client.query(
        `INSERT INTO user_sessions (
          session_id, user_id, started_at, ended_at, active_seconds, 
          device_type, platform, pages_viewed, posts_viewed_count, actions_count, errors_encountered
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          uuidv4(), studentId, startTime, endTime, duration,
          devices[Math.floor(Math.random() * devices.length)],
          platforms[Math.floor(Math.random() * platforms.length)],
          pages, postsViewed, actions, errors
        ]
      );
    }

    // 5. Generate Interactions (Posts, Comments, Points)
    console.log("✍️ Generating 2000+ posts, comments, and points...");
    for (let i = 0; i < 300; i++) {
      const studentId = studentIds[Math.floor(Math.random() * studentIds.length)];
      const postRes = await client.query(
        "INSERT INTO posts (sender_id, group_id, title, body_text) VALUES ($1, $2, $3, $4) RETURNING id",
        [studentId, groupId, `Question about Module ${i}`, `Could someone explain how to handle dataset ${i}?`]
      );
      const postId = postRes.rows[0].id;

      // Add comments to this post
      const numComments = Math.floor(Math.random() * 5);
      for (let j = 0; j < numComments; j++) {
        const commenterId = studentIds[Math.floor(Math.random() * studentIds.length)];
        const commentRes = await client.query(
          "INSERT INTO post_comments (sender_id, post_id, comment_text) VALUES ($1, $2, $3) RETURNING id",
          [commenterId, postId, `I think you should look at the ${j}th parameter.`]
        );
        const commentId = commentRes.rows[0].id;

        // Reward the commenter with points
        await client.query(
          "INSERT INTO points (giver_id, recipient_id, group_id, point_value, comment_id) VALUES ($1, $2, $3, $4, $5)",
          [adminId, commenterId, groupId, 2, commentId]
        );
      }
    }

    // 6. Update user_session_totals (The Cache)
    console.log("🔄 Calculating session totals for all users...");
    await client.query(`
      INSERT INTO user_session_totals (
        user_id, total_active_seconds, total_pages_viewed, total_posts_viewed, 
        total_actions, total_sessions, total_errors, last_active_at
      )
      SELECT 
        user_id, 
        SUM(active_seconds), 
        SUM(pages_viewed), 
        SUM(posts_viewed_count), 
        SUM(actions_count), 
        COUNT(*), 
        SUM(errors_encountered), 
        MAX(started_at)
      FROM user_sessions
      GROUP BY user_id
      ON CONFLICT (user_id) DO UPDATE SET
        total_active_seconds = EXCLUDED.total_active_seconds,
        total_pages_viewed = EXCLUDED.total_pages_viewed,
        total_posts_viewed = EXCLUDED.total_posts_viewed,
        total_actions = EXCLUDED.total_actions,
        total_sessions = EXCLUDED.total_sessions,
        total_errors = EXCLUDED.total_errors,
        last_active_at = EXCLUDED.last_active_at;
    `);

    // 7. NEW: Update user_group_daily_stats (Performance Cache)
    console.log("📈 Refreshing high-performance daily analytics cache...");
    await client.query(`
      INSERT INTO user_group_daily_stats (
          user_id, group_id, stat_date, 
          posts_count, comments_count, messages_count, 
          points_earned, active_seconds, sessions_count
      )
      WITH all_activities AS (
          SELECT sender_id as user_id, group_id, created_at::date as s_date, 1 as posts, 0 as comments, 0 as msgs, 0 as pts, 0 as secs, 0 as sess FROM posts
          UNION ALL
          SELECT pc.sender_id, p.group_id, pc.created_at::date, 0, 1, 0, 0, 0, 0 FROM post_comments pc JOIN posts p ON pc.post_id = p.id
          UNION ALL
          SELECT sender_id, group_id, created_at::date, 0, 0, 1, 0, 0, 0 FROM messages
          UNION ALL
          SELECT recipient_id, group_id, created_at::date, 0, 0, 0, point_value, 0, 0 FROM points
          UNION ALL
          -- For sessions in test data, we assume they belong to the specific group being tested
          SELECT user_id, $1 as group_id, started_at::date, 0, 0, 0, 0, active_seconds, 1 FROM user_sessions
      )
      SELECT 
          user_id, group_id, s_date,
          SUM(posts)::int, SUM(comments)::int, SUM(msgs)::int, 
          SUM(pts)::int, SUM(secs)::int, SUM(sess)::int
      FROM all_activities
      WHERE user_id IS NOT NULL AND group_id IS NOT NULL AND s_date IS NOT NULL
      GROUP BY user_id, group_id, s_date
      ON CONFLICT (user_id, group_id, stat_date) DO UPDATE SET
          posts_count = EXCLUDED.posts_count,
          comments_count = EXCLUDED.comments_count,
          messages_count = EXCLUDED.messages_count,
          points_earned = EXCLUDED.points_earned,
          active_seconds = EXCLUDED.active_seconds,
          sessions_count = EXCLUDED.sessions_count;
    `, [groupId]);

    await client.query("COMMIT");
    console.log("✅ Seeding completed! Database is ready for Analytics testing.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ Seeding failed:", e);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
