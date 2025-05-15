const Sequelize = require("sequelize"); // alias for clarity

var config = {
    define: {
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  };

  
const sequelize = new Sequelize({
    dialect: "postgres",
    database: process.env.DATABASE_NAME,
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    dialectOptions: {
      ssl: {
        rejectUnauthorized: false, // Disable SSL certificate verification
      },
    },
    ...config
  });

  

const db = sequelize;
const { QueryTypes } = Sequelize;



const DataTypes = require("sequelize").DataTypes;

const {
  participants,
  groups,
  messages,
  points,
  post_comments,
  posts,
  users,
  notifications,
  awards,
  user_awards,
} = require("../models/init-models")(sequelize, DataTypes);

async function evaluateLeadershipAward(userId, groupId) {
  // Create 3 posts that each receive at least 1 comment from another user
  const result = await db.query(
    `
      SELECT COUNT(DISTINCT p.id) AS qualified_posts
      FROM posts p
      JOIN post_comments c
        ON c.post_id = p.id
      WHERE
        p.sender_id = :userId
        AND p.group_id = :groupId
        AND c.sender_id != :userId
      `,
    {
      replacements: { userId, groupId },
      type: QueryTypes.SELECT,
    }
  );
  return parseInt(result[0].qualified_posts, 10) >= 3;
}

async function evaluateTeamworkAward(userId, groupId) {
  // Comment on 10 different posts AND earn at least 15 points
  const [commentStats, pointStats] = await Promise.all([
    db.query(
      `
        SELECT COUNT(DISTINCT pc.post_id) AS comment_count
        FROM post_comments pc
        JOIN posts p
          ON pc.post_id = p.id
        WHERE
          pc.sender_id = :userId
          AND p.group_id = :groupId
        `,
      {
        replacements: { userId, groupId },
        type: QueryTypes.SELECT,
      }
    ),
    db.query(
      `
        SELECT COALESCE(SUM(point_value), 0) AS total_points
        FROM points
        WHERE
          recipient_id = :userId
          AND group_id = :groupId
        `,
      {
        replacements: { userId, groupId },
        type: QueryTypes.SELECT,
      }
    ),
  ]);

  return (
    parseInt(commentStats[0].comment_count, 10) >= 10 &&
    parseInt(pointStats[0].total_points, 10) >= 15
  );
}

async function evaluateCommunicationAward(userId, groupId) {
  // Send at least one message on 10 separate days
  const result = await db.query(
    `
      SELECT COUNT(DISTINCT DATE_TRUNC('day', m.created_at)) AS days_messaged
      FROM messages m
      WHERE
        m.sender_id = :userId
        AND m.group_id = :groupId
      `,
    {
      replacements: { userId, groupId },
      type: QueryTypes.SELECT,
    }
  );
  return parseInt(result[0].days_messaged, 10) >= 10;
}

async function evaluateReliabilityAward(userId, groupId) {
  // Send a post comment or message each week in 4 consecutive weeks
  // 1. Gather all weeks with activity
  const weeks = await db.query(
    `
      SELECT DISTINCT DATE_TRUNC('week', activity_date) AS wk
      FROM (
        SELECT created_at AS activity_date
        FROM messages
        WHERE sender_id = :userId AND group_id = :groupId
        UNION ALL
        SELECT pc.created_at
        FROM post_comments pc
        JOIN posts p ON pc.post_id = p.id
        WHERE pc.sender_id = :userId AND p.group_id = :groupId
      ) a
      ORDER BY wk DESC
      `,
    {
      replacements: { userId, groupId },
      type: QueryTypes.SELECT,
    }
  );

  // 2. Check for any sequence of 4 consecutive weekly buckets
  if (weeks.length < 4) return false;

  // convert to timestamps
  const weekTimestamps = weeks.map((r) => new Date(r.wk).getTime());
  // sliding window of size 4
  for (let i = 0; i <= weekTimestamps.length - 4; i++) {
    const first = weekTimestamps[i];
    const second = weekTimestamps[i + 1];
    const third = weekTimestamps[i + 2];
    const fourth = weekTimestamps[i + 3];
    // each week is exactly 7*24*60*60*1000 ms apart
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    if (
      first - second === weekMs &&
      second - third === weekMs &&
      third - fourth === weekMs
    ) {
      return true;
    }
  }

  return false;
}
async function evaluateCriteria(userId, groupId, awardId) {
  switch (awardId) {
    case 1:
      return evaluateLeadershipAward(userId, groupId);
    case 2:
      return evaluateTeamworkAward(userId, groupId);
    case 3:
      return evaluateCommunicationAward(userId, groupId);
    case 4:
      return evaluateReliabilityAward(userId, groupId);
    default:
      return false;
  }
}

async function checkAwardsForUser(userId, groupId) {
  const awards = await db.awards.findAll();
  for (const award of awards) {
    const already = await db.user_awards.findOne({
      where: { user_id: userId, group_id: groupId, award_id: award.id },
    });
    if (already) continue;

    const earned = await evaluateCriteria(userId, groupId, award.id);
    if (earned) {
      await db.user_awards.create({
        user_id: userId,
        group_id: groupId,
        award_id: award.id,
      });
      // later: trigger notification
    }
  }
}

module.exports = {
  evaluateLeadershipAward,
  evaluateTeamworkAward,
  evaluateCommunicationAward,
  evaluateReliabilityAward,
  evaluateCriteria,
  checkAwardsForUser,
};
