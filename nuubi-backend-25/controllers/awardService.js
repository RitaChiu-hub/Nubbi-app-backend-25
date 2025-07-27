const Sequelize = require("sequelize"); // alias for clarity
const { isExpoPushToken, sendExpoPush } = require("../utils/expoPush");

var config = {
  define: {
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
};

const sequelize = new Sequelize({
  dialect: "postgres",
  logging: false,
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
  config: config,
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
  try {
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
  } catch (err) {
    console.error(
      `Error evaluating Leadership Award for user=${userId}, group=${groupId}:`,
      err
    );
    return false;
  }
}

async function evaluateTeamworkAward(userId, groupId) {
  try {
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
        { replacements: { userId, groupId }, type: QueryTypes.SELECT }
      ),
      db.query(
        `
          SELECT COALESCE(SUM(point_value), 0) AS total_points
          FROM points
          WHERE
            recipient_id = :userId
            AND group_id = :groupId
        `,
        { replacements: { userId, groupId }, type: QueryTypes.SELECT }
      ),
    ]);

    return (
      parseInt(commentStats[0].comment_count, 10) >= 10 &&
      parseInt(pointStats[0].total_points, 10) >= 15
    );
  } catch (err) {
    console.error(
      `Error evaluating Teamwork Award for user=${userId}, group=${groupId}:`,
      err
    );
    return false;
  }
}

async function evaluateCommunicationAward(userId, groupId) {
  try {
    const result = await db.query(
      `
        SELECT COUNT(DISTINCT DATE_TRUNC('day', m.created_at)) AS days_messaged
        FROM messages m
        WHERE
          m.sender_id = :userId
          AND m.group_id = :groupId
      `,
      { replacements: { userId, groupId }, type: QueryTypes.SELECT }
    );
    return parseInt(result[0].days_messaged, 10) >= 10;
  } catch (err) {
    console.error(
      `Error evaluating Communication Award for user=${userId}, group=${groupId}:`,
      err
    );
    return false;
  }
}

async function evaluateReliabilityAward(userId, groupId) {
  try {
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
      { replacements: { userId, groupId }, type: QueryTypes.SELECT }
    );

    if (weeks.length < 4) return false;

    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const weekTimestamps = weeks.map((r) => new Date(r.wk).getTime());

    for (let i = 0; i <= weekTimestamps.length - 4; i++) {
      if (
        weekTimestamps[i] - weekTimestamps[i + 1] === weekMs &&
        weekTimestamps[i + 1] - weekTimestamps[i + 2] === weekMs &&
        weekTimestamps[i + 2] - weekTimestamps[i + 3] === weekMs
      ) {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error(
      `Error evaluating Reliability Award for user=${userId}, group=${groupId}:`,
      err
    );
    return false;
  }
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
  // load all awards and the group name once
  const awardsList = await awards.findAll();
  const group = await groups.findByPk(groupId);

  for (const award of awardsList) {
    // skip if already earned
    const already = await user_awards.findOne({
      where: { user_id: userId, group_id: groupId, award_id: award.id },
    });
    if (already) continue;

    // check criteria
    const earned = await evaluateCriteria(userId, groupId, award.id);
    if (!earned) continue;

    // record the new award
    await user_awards.create({
      user_id: userId,
      group_id: groupId,
      award_id: award.id,
    });

    // send a congratulations notification
    const message = `Congratulations, you just won the ${award.title} in ${group.name}!`;
    await notifications.create({
      user_id: userId,
      message,
    });

    // Push notification
    try {
      const recipient = await users.findOne({
        where: { id: userId },
        attributes: ["push_notification_token"],
      });

      const pushToken = recipient?.push_notification_token;

      if (!pushToken) {
        console.warn(`[push] no push token for user`);
      } else if (!isExpoPushToken(pushToken)) {
        console.warn(
          `[push] invalid Expo token for user`
        );
      } else {
        await sendExpoPush({
          to: pushToken,
          sound: "default",
          title: "You earned an Award! 🎉",
          body: `Congratulations, you just won the ${award.title} in ${group.name}!`,
          data: {
            type: "award_received",
            groupId: groupId,
          },
          channelId: "default",
        });
      }
    } catch (e) {
      console.error(`[push] send failed for ${userId}:`, e);
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
