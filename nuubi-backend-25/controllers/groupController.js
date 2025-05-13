const pool = require("../db");
const { jwtVerify, getJwt } = require("./jwt/jwtAuth");
const cloudinary = require("cloudinary").v2;

const Sequelize = require("sequelize");

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
  config: config,
});

const DataTypes = require("sequelize").DataTypes;

const {
  participants,
  groups,
  messages,
  points,
  post_comments,
  posts,
  users,
  badges,
  user_badges,
  tasks,
  user_tasks,
  notifications,
} = require("../models/init-models")(sequelize, DataTypes);

const bcrypt = require("bcrypt");
const currentDate = new Date();
require("dotenv").config();

module.exports.handleCreateGroup = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        var isPublic =
          req.body.privacySelection === "Public" ? "true" : "false";
        var invitePasscode = Math.random().toString(10).substring(2, 8);

        const newGroup = await groups.create({
          name: req.body.groupname,
          description: req.body.description,
          is_public: isPublic,
          invite_passcode: invitePasscode,
          created_at: currentDate.getTime(),
          updated_at: currentDate.getTime(),
        });

        const newParticipant = await participants.create({
          user_id: userID,
          group_id: newGroup.id,
          is_admin: true,
          created_at: currentDate.getTime(),
          updated_at: currentDate.getTime(),
        });

        res.json({
          ...req.body,
          status:
            "Group successfully created & you are the admin of this group",
        });
      } catch (error) {
        console.error("Error creating group: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleInviteLink = async (req, res) => {
  let token = req.cookies.token || req.headers.authorization?.split(" ")[1]; // Bearer token

  jwtVerify(token, process.env.JWT_SECRET).then(async (decoded) => {
    const userID = decoded.id;
    try {
      const { token } = req.params;

      const groupQuery = await pool.query(
        "SELECT id, name, invite_passcode FROM groups WHERE invite_token = $1",
        [token]
      );
      const {
        id: groupId,
        name,
        invite_passcode: invitePasscode,
      } = groupQuery.rows[0];

      if (groupQuery.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Invalid or expired invite token." });
      }
      // Check if the user is already a participant in the group
      const participantCheckQuery = await pool.query(
        "SELECT id FROM participants WHERE user_id = $1 AND group_id = $2",
        [userID, groupId]
      );

      if (participantCheckQuery.rows.length > 0) {
        // User is already a participant
        return res.json({
          success: true,
          groupId,
          groupName: name,
          invitePasscode,
          message: "User is already a participant in the group.",
        });
      }

      // Add the user to the group
      const joinGroupQuery = await pool.query(
        "INSERT INTO participants (user_id, group_id, is_admin) VALUES ($1, $2, false) RETURNING id, user_id, group_id",
        [userID, groupId]
      );

      return res.json({
        success: true,
        groupId,
        message: "User successfully added to the group.",
      });

      // const joinNuubiGroupQuery = await pool.query(
      //   "INSERT INTO participants(user_id, group_id, is_admin) values ($1, 3, false) RETURNING id, user_id, group_id",
      //   [newUserQuery.id]
      // );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "An error occurred during group invite" });
    }
  });
  // try {
  //   const group = await db.query(
  //     "SELECT * FROM groups WHERE invite_token = $1",
  //     [token]
  //   );

  //   if (group.rows.length === 0) {
  //     return res.status(404).json({ error: "Invalid or expired invite link." });
  //   }

  //   const groupId = group.rows[0].id;
  //   res.json({ groupId, isAuthenticated });
  // } catch (error) {
  //   console.error("Error processing invite link:", error);
  //   res.status(500).json({ error: "Server error processing invite link." });
  // }
};

module.exports.handleCreateTask = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET).then(async (decoded) => {
    //  const { task, pointValue, currentGroup } = req.body;
    const {
      task,
      pointValue,
      currentGroup,
      assignToAdmin,
      assignToParticipants,
    } = req.body;

    const userID = decoded.id;

    try {
      // Insert into the tasks table
      const result = await pool.query(
        "INSERT INTO tasks (task, point_value) VALUES ($1, $2) RETURNING id",
        [task, pointValue]
      );
      const taskId = result.rows[0].id;

      if (assignToAdmin) {
        // Insert into the user_tasks table for admin
        await pool.query(
          "INSERT INTO user_tasks (user_id, task_id, group_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())",
          [userID, taskId, currentGroup]
        );
      }

      // // If task should be assigned to participants
      // if (assignToParticipants) {

      //   // Fetch all participant IDs for the given group where is_admin is false
      //   const participantsResult = await pool.query(
      //     "SELECT user_id FROM participants WHERE group_id = $1 AND is_admin = false",
      //     [currentGroup]
      //   );
      //   const participantIds = participantsResult.rows.map(
      //     (row) => row.user_id
      //   );

      //   // Insert into the user_tasks table for each participant
      //   const userTasksPromises = participantIds.map((userId) => {
      //     return pool.query(
      //       "INSERT INTO user_tasks (user_id, task_id, group_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())",
      //       [userId, taskId, currentGroup]
      //     );
      //   });

      //   await Promise.all(userTasksPromises);
      // }

      if (assignToParticipants) {
        // Fetch all participant IDs for the given group where is_admin is false
        const participantsResult = await pool.query(
          "SELECT user_id FROM participants WHERE group_id = $1 AND is_admin = false",
          [currentGroup]
        );
        const participantIds = participantsResult.rows.map(
          (row) => row.user_id
        );

        if (participantIds.length > 0) {
          // Insert into the user_tasks table for each participant
          const userTasksPromises = participantIds.map((userId) => {
            return pool.query(
              "INSERT INTO user_tasks (user_id, task_id, group_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())",
              [userId, taskId, currentGroup]
            );
          });

          await Promise.all(userTasksPromises);
        } else {
          console.log("No participants found for the group.");
        }
      }

      res.status(201).json({
        ...req.body,
        status: "Task created and assigned to selected member(s) successfully",
      });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "An error occurred while creating the task" });
    }
  });
};

module.exports.handleGetMyGroupTasks = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET).then(async (decoded) => {
    const { currentGroup } = req.body;
    const userId = decoded.id;

    try {
      const myTasks = await user_tasks.findAll({
        where: { user_id: userId, group_id: currentGroup },
        attributes: ["is_completed", "is_approved", "id"],
        include: [
          {
            model: tasks,
            attributes: ["task", "point_value"],
          },
        ],
        order: [
          // Sort by is_completed in ascending order (uncompleted tasks first)
          ["is_completed", "ASC"],
        ],
      });

      // Flatten the tasks into a single object
      const flattenedTasks = myTasks.map((task) => ({
        id: task.id,
        is_completed: task.is_completed,
        is_approved: task.is_approved,
        task: task.task.task, // Access nested task property
        point_value: task.task.point_value, // Access nested point_value property
      }));

      res.json(flattenedTasks);
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "An error occurred while creating the task" });
    }
  });
};

module.exports.handleGetMyTasks = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userId = decoded.id;

      try {
        const myTasks = await user_tasks.findAll({
          where: { user_id: userId },
          attributes: ["is_completed", "is_approved", "id"],
          include: [
            {
              model: tasks,
              attributes: ["task", "point_value"],
            },
            {
              model: groups,
              attributes: ["name", "id", "invite_passcode"],
            },
          ],
        });

        // Flatten the tasks into a single object and include group names
        const flattenedTasks = myTasks.map((task) => ({
          id: task.id,
          is_completed: task.is_completed,
          is_approved: task.is_approved,
          task: task.task.task, // Access nested task property
          point_value: task.task.point_value, // Access nested point_value property
          group_name: task.group.name, // Access nested group name property
          group_id: task.group.id, // Access nested group name property
          invite_passcode: task.group.invite_passcode, // Access nested group name property
        }));

        // Sort the tasks so that uncompleted tasks come first
        const sortedTasks = flattenedTasks.sort(
          (a, b) => a.is_completed - b.is_completed
        );

        res.json(sortedTasks);

        // res.json(flattenedTasks);
      } catch (err) {
        console.error(err);
        res
          .status(500)
          .json({ error: "An error occurred while retrieving the tasks" });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(401).json({ error: "Invalid token" });
    });
};

module.exports.handleGetAllGroupTasks = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET).then(async (decoded) => {
    const { currentGroup } = req.body;
    const userId = decoded.id;

    try {
      const allTasks = await user_tasks.findAll({
        where: { group_id: currentGroup },
        attributes: ["is_completed", "is_approved", "id"],
        include: [
          {
            model: tasks,
            attributes: ["task", "point_value"],
          },
          {
            model: users,
            attributes: ["username"],
          },
        ],
      });

      // Flatten the tasks into a single object
      const flattenedTasks = allTasks.map((task) => ({
        id: task.id,
        is_completed: task.is_completed,
        is_approved: task.is_approved,
        task: task.task.task, // Access nested task property
        point_value: task.task.point_value, // Access nested point_value property
        username: task.user.username, // Access nested username property
      }));

      res.json(flattenedTasks);
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "An error occurred while creating the task" });
    }
  });
};

module.exports.handleTaskCompleted = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET).then(async (decoded) => {
    const { taskId } = req.body;
    const userId = decoded.id;

    try {
      const task = await user_tasks.findOne({
        where: {
          user_id: userId,
          id: taskId,
        },
      });

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      task.is_completed = true;
      await task.save();

      res.json({ user: req.body, status: "success" });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "An error occurred while creating the task" });
    }
  });
};

module.exports.handleTaskApproved = async (req, res) => {
  try {
    const fetch = (await import("node-fetch")).default;

    // Verify the JWT token

    const decoded = await jwtVerify(req.body.token, process.env.JWT_SECRET);

    // Extract taskId from the request body
    const { taskId } = req.body;

    await user_tasks.update({ is_approved: true }, { where: { id: taskId } });

    const task = await user_tasks.findOne({
      where: {
        id: taskId,
      },
    });

    const taskPoints = await tasks.findOne({
      where: {
        id: task.task_id,
      },
    });

    // Create a new row in the points table
    await points.create({
      recipient_id: task.user_id,
      task_id: taskId, // the id of the user_tasks table
      point_value: taskPoints.point_value,
      created_at: currentDate.getTime(),
      updated_at: currentDate.getTime(),
      group_id: task.group_id,
    });

    // Fetch the group details to get the group name
    const group = await groups.findOne({
      where: { id: task.group_id },
    });

    // Create a notification for the user
    await notifications.create({
      message: `Congratulations! Your task has been approved in the group "${group.name}" and you've been awarded "${taskPoints.point_value}" points.`,
      user_id: task.user_id,
      is_read: false,
      created_at: currentDate.getTime(),
      updated_at: currentDate.getTime(),
    });

    // Fetch the user's push token from your database (assuming you have a users table with expo_push_token)
    const user = await users.findOne({
      where: { id: task.user_id },
    });

    if (user.push_notification_token) {
      //if (req.body.expoPushToken) {
      // Send a push notification
      const message = {
        // to: req.body.expoPushToken,
        to: user.push_notification_token,
        sound: "default",
        title: "Task Approved!",
        body: `Your task in the group "${group.name}" has been approved. You've been awarded "${taskPoints.point_value}" points.`,
        data: { someData: "goes here" },
      };

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
    }

    res.json({ user: req.body, status: "success" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "An error occurred while creating the task" });
  }
};

module.exports.getAllGroups = async (req, res) => {
  const getAllGroups = await groups.findAll({
    attributes: ["name", "description", "id"],
  });
  res.send(getAllGroups);
};

module.exports.getNotifications = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;

      try {
        const getNotifications = await notifications.findAll({
          where: { user_id: userID },
          order: [["created_at", "DESC"]],
        });
        res.send(getNotifications);
      } catch (error) {
        console.error("Error fetching notifications: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
};

module.exports.getWonBadges = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;

      try {
        const userBadges = await user_badges.findAll({
          where: { user_id: userID },
          include: [
            {
              model: badges,
              attributes: [
                "id",
                "title",
                "description",
                "criteria",
                "point_value",
              ],
            },
          ],
          order: [["created_at", "DESC"]],
        });
        res.send(userBadges);
      } catch (error) {
        console.error("Error fetching won badges: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch((err) => {
      console.error("JWT verification failed:", err);
      res.status(403).json({ error: "Invalid or expired token" });
    });
};

// module.exports.getWonBadges = async (req, res) => {
//   jwtVerify(req.body.token, process.env.JWT_SECRET).then(async (decoded) => {
//     const userID = decoded.id;

//     try {
//       const userBadges = await user_badges.findAll({
//         where: { user_id: userID },
//         include: [
//           {
//             model: badges,
//             attributes: [
//               "id",
//               "title",
//               "description",
//               "criteria",
//               "point_value",
//             ],
//           },
//         ],
//         order: [["created_at", "DESC"]],
//       });
//       res.send(userBadges);
//     } catch (error) {
//       console.error("Error fetching won badges: ", error);
//       res.status(500).json({ error: "Internal server error" });
//     }
//   });
// };

module.exports.getAllPublicGroups = async (req, res) => {
  const allPubGroups = await groups.findAll({
    where: { is_public: true },
    attributes: ["name", "description", "id"],
  });
  res.json(allPubGroups);
};

module.exports.getMemberCount = async (req, res) => {
  const memberCountQuery = await pool.query(
    "SELECT COUNT(id) FROM participants WHERE group_id = $1;",
    [req.body.currentGroup]
  );

  const memberCount = memberCountQuery.rows[0].count;

  res.send(memberCount);
};

module.exports.getMyGroups = async (req, res) => {
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const myGroups = await groups.findAll({
          attributes: [
            "invite_passcode",
            ["id", "group_id"],
            "name",
            "description",
          ],
          include: [
            {
              model: participants,
              where: { user_id: userID },
              attributes: ["user_id"],
              required: true,
            },
          ],
          order: [[Sequelize.literal("participants.created_at"), "DESC"]],
        });

        res.json(myGroups);
      } catch (error) {
        console.error("Error fetching user groups:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.getGroupMembers = async (req, res) => {
  const groupMembersQuery = await pool.query(
    "WITH RankedMonths AS (SELECT EXTRACT(YEAR FROM p.updated_at) AS year, EXTRACT(MONTH FROM p.updated_at) AS month, DENSE_RANK() OVER (ORDER BY EXTRACT(YEAR FROM p.updated_at), EXTRACT(MONTH FROM p.updated_at)) AS month_rank FROM points p WHERE p.group_id = $1 GROUP BY EXTRACT(YEAR FROM p.updated_at), EXTRACT(MONTH FROM p.updated_at)), MonthlyPoints AS (SELECT EXTRACT(YEAR FROM p.updated_at) AS year, EXTRACT(MONTH FROM p.updated_at) AS month, p.recipient_id, SUM(p.point_value) AS group_total_points FROM points p WHERE p.group_id = $1 GROUP BY EXTRACT(YEAR FROM p.updated_at), EXTRACT(MONTH FROM p.updated_at), p.recipient_id), UserDetails AS (SELECT u.id AS user_id, u.username, u.email FROM users u JOIN participants p ON u.id = p.user_id WHERE p.group_id = $1) SELECT ud.user_id, ud.username, ud.email, MAX(CASE WHEN rm.month_rank = 1 THEN mp.group_total_points ELSE 0 END) AS Unit_1, MAX(CASE WHEN rm.month_rank = 2 THEN mp.group_total_points ELSE 0 END) AS Unit_2, MAX(CASE WHEN rm.month_rank = 3 THEN mp.group_total_points ELSE 0 END) AS Unit_3, MAX(CASE WHEN rm.month_rank = 4 THEN mp.group_total_points ELSE 0 END) AS Unit_4, MAX(CASE WHEN rm.month_rank = 5 THEN mp.group_total_points ELSE 0 END) AS Unit_5, MAX(CASE WHEN rm.month_rank = 6 THEN mp.group_total_points ELSE 0 END) AS Unit_6, MAX(CASE WHEN rm.month_rank = 7 THEN mp.group_total_points ELSE 0 END) AS Unit_7, MAX(CASE WHEN rm.month_rank = 8 THEN mp.group_total_points ELSE 0 END) AS Unit_8, COALESCE(SUM(mp.group_total_points), 0) AS group_total_points FROM RankedMonths rm CROSS JOIN UserDetails ud LEFT JOIN MonthlyPoints mp ON mp.year = rm.year AND mp.month = rm.month AND mp.recipient_id = ud.user_id GROUP BY ud.user_id, ud.username, ud.email ORDER BY ud.username;  ",
    //  "SELECT c.user_id as user_id, username, email, is_admin, coalesce(group_total_points,0) group_total_points FROM (  SELECT users.id user_id, users.username username, users.email email, participants.is_admin is_admin FROM participants INNER JOIN users ON participants.user_id = users.id WHERE participants.group_id = $1) c FULL OUTER JOIN ( SELECT user_id, recipient_id, count as group_total_points FROM (SELECT DISTINCT participants.user_id FROM participants INNER JOIN points ON participants.user_id = points.recipient_id WHERE participants.group_id = $1) a LEFT JOIN (SELECT recipient_id, count(point_value) FROM points WHERE group_id = $1 GROUP BY recipient_id) b ON a.user_id = b.recipient_id) d ON c.user_id = d.user_id ORDER BY group_total_points DESC;",
    [req.body.currentGroup]
  );

  res.send(groupMembersQuery.rows);
};

// latest before texting new group amnalytics

// module.exports.getWeeklyGroupInfo = async (req, res) => {
//   const { currentGroup, startDate } = req.body; // userId will be derived from the JWT

//   // Use getJwt to get the token from either cookies or the Authorization header
//   const token = getJwt(req);

//   // Check if token is available
//   if (!token) {
//     return res.status(401).json({ error: "JWT token is required" });
//   }

//   const formatUserData = (rows) => {
//     // Ensure that rows is always an array and return an empty array if no data
//     if (!Array.isArray(rows)) {
//       return [];
//     }

//     return rows.map((user) => ({
//       user_id: user.user_id,
//       username: user.username,
//       email: user.email,
//       total: {
//         points: user.total?.points || "0",
//         posts: user.total?.posts || "0",
//         comments: user.total?.comments || "0",
//         messages: user.total?.messages || "0",
//       },
//       week_1: {
//         points: user.week_1?.points || "0",
//         posts: user.week_1?.posts || "0",
//         comments: user.week_1?.comments || "0",
//         messages: user.week_1?.messages || "0",
//       },
//       week_2: {
//         points: user.week_2?.points || "0",
//         posts: user.week_2?.posts || "0",
//         comments: user.week_2?.comments || "0",
//         messages: user.week_2?.messages || "0",
//       },
//       week_3: {
//         points: user.week_3?.points || "0",
//         posts: user.week_3?.posts || "0",
//         comments: user.week_3?.comments || "0",
//         messages: user.week_3?.messages || "0",
//       },
//       week_4: {
//         points: user.week_4?.points || "0",
//         posts: user.week_4?.posts || "0",
//         comments: user.week_4?.comments || "0",
//         messages: user.week_4?.messages || "0",
//       },
//       week_5: {
//         points: user.week_5?.points || "0",
//         posts: user.week_5?.posts || "0",
//         comments: user.week_5?.comments || "0",
//         messages: user.week_5?.messages || "0",
//       },
//       week_6: {
//         points: user.week_6?.points || "0",
//         posts: user.week_6?.posts || "0",
//         comments: user.week_6?.comments || "0",
//         messages: user.week_6?.messages || "0",
//       },
//       week_7: {
//         points: user.week_7?.points || "0",
//         posts: user.week_7?.posts || "0",
//         comments: user.week_7?.comments || "0",
//         messages: user.week_7?.messages || "0",
//       },
//       week_8: {
//         points: user.week_8?.points || "0",
//         posts: user.week_8?.posts || "0",
//         comments: user.week_8?.comments || "0",
//         messages: user.week_8?.messages || "0",
//       },
//     }));
//   };

//   try {
//     // Verify the token and extract the userId
//     const decoded = await jwtVerify(token, process.env.JWT_SECRET);
//     const userId = decoded.id;

//     // Check if the user is an admin of the group
//     const isAdminQuery = await pool.query(
//       `SELECT is_admin FROM participants WHERE user_id = $1 AND group_id = $2`,
//       [userId, currentGroup]
//     );

//     const isAdmin = isAdminQuery.rows[0]?.is_admin;

//     let groupMembersQuery;

//     if (isAdmin) {
//       // If the user is an admin, return all group members' data
//       groupMembersQuery = await pool.query(
//         `
//         WITH WeeklyIntervals AS (
//           SELECT generate_series(0, 7) AS week_index,
//                  ($2::date + (generate_series(0, 7) * interval '1 week')) AS week_start
//         ),
//         UserDetails AS (
//           SELECT
//             u.id AS user_id,
//             u.username,
//             u.email,
//             COALESCE(COUNT(DISTINCT po.id), 0) AS total_posts,
//             COALESCE(COUNT(DISTINCT pc.id), 0) AS total_comments,
//             COALESCE(COUNT(DISTINCT m.id), 0) AS total_messages
//           FROM
//             users u
//           JOIN
//             participants p ON u.id = p.user_id AND p.group_id = $1
//           LEFT JOIN
//             posts po ON po.sender_id = u.id AND po.group_id = $1
//           LEFT JOIN
//             post_comments pc ON pc.sender_id = u.id
//           LEFT JOIN
//             messages m ON m.sender_id = u.id AND m.group_id = $1
//           GROUP BY
//             u.id, u.username, u.email
//         ),
//         PointsByWeek AS (
//           SELECT
//             p.recipient_id AS user_id,
//             wi.week_index + 1 AS week_number,
//             SUM(p.point_value) AS weekly_points,
//             COUNT(DISTINCT po.id) AS weekly_posts,
//             COUNT(DISTINCT pc.id) AS weekly_comments,
//             COUNT(DISTINCT m.id) AS weekly_messages
//           FROM
//             points p
//           JOIN
//             WeeklyIntervals wi ON p.updated_at >= wi.week_start
//                               AND p.updated_at < (wi.week_start + interval '1 week')
//           LEFT JOIN
//             posts po ON po.sender_id = p.recipient_id AND p.group_id = $1 AND p.updated_at >= wi.week_start AND p.updated_at < (wi.week_start + interval '1 week')
//           LEFT JOIN
//             post_comments pc ON pc.sender_id = p.recipient_id AND pc.updated_at >= wi.week_start AND pc.updated_at < (wi.week_start + interval '1 week')
//           LEFT JOIN
//             messages m ON m.sender_id = p.recipient_id AND m.group_id = $1 AND m.updated_at >= wi.week_start AND m.updated_at < (wi.week_start + interval '1 week')
//           WHERE
//             p.group_id = $1
//           GROUP BY
//             p.recipient_id, wi.week_index
//         )
//         SELECT
//           ud.user_id,
//           ud.username,
//           ud.email,
//           COALESCE(SUM(pb.weekly_points), 0) AS total_points,
//           ud.total_posts AS total_posts,
//           ud.total_comments AS total_comments,
//           ud.total_messages AS total_messages,
//           COALESCE(MAX(CASE WHEN pb.week_number = 1 THEN pb.weekly_points END), 0) AS week_1_points,
//           COALESCE(MAX(CASE WHEN pb.week_number = 1 THEN pb.weekly_posts END), 0) AS week_1_posts,
//           COALESCE(MAX(CASE WHEN pb.week_number = 1 THEN pb.weekly_comments END), 0) AS week_1_comments,
//           COALESCE(MAX(CASE WHEN pb.week_number = 1 THEN pb.weekly_messages END), 0) AS week_1_messages,
//           COALESCE(MAX(CASE WHEN pb.week_number = 2 THEN pb.weekly_points END), 0) AS week_2_points,
//           COALESCE(MAX(CASE WHEN pb.week_number = 2 THEN pb.weekly_posts END), 0) AS week_2_posts,
//           COALESCE(MAX(CASE WHEN pb.week_number = 2 THEN pb.weekly_comments END), 0) AS week_2_comments,
//           COALESCE(MAX(CASE WHEN pb.week_number = 2 THEN pb.weekly_messages END), 0) AS week_2_messages
//         FROM
//           UserDetails ud
//         LEFT JOIN
//           PointsByWeek pb ON pb.user_id = ud.user_id
//         GROUP BY
//           ud.user_id, ud.username, ud.email, ud.total_posts, ud.total_comments, ud.total_messages
//         ORDER BY
//           ud.username;
//         `,
//         [currentGroup, startDate]
//       );
//     } else {
//       // If the user is not an admin, return analytics for only that user
//       groupMembersQuery = await pool.query(
//         `
//         WITH WeeklyIntervals AS (
//           SELECT generate_series(0, 7) AS week_index,
//                  ($2::date + (generate_series(0, 7) * interval '1 week')) AS week_start
//         ),
//         UserDetails AS (
//           SELECT
//             u.id AS user_id,
//             u.username,
//             u.email,
//             COALESCE(COUNT(DISTINCT po.id), 0) AS total_posts,
//             COALESCE(COUNT(DISTINCT pc.id), 0) AS total_comments,
//             COALESCE(COUNT(DISTINCT m.id), 0) AS total_messages
//           FROM
//             users u
//           JOIN
//             participants p ON u.id = p.user_id AND p.group_id = $1
//           LEFT JOIN
//             posts po ON po.sender_id = u.id AND po.group_id = $1
//           LEFT JOIN
//             post_comments pc ON pc.sender_id = u.id
//           LEFT JOIN
//             messages m ON m.sender_id = u.id AND m.group_id = $1
//           WHERE
//             u.id = $3
//           GROUP BY
//             u.id, u.username, u.email
//         ),
//         PointsByWeek AS (
//           SELECT
//             p.recipient_id AS user_id,
//             wi.week_index + 1 AS week_number,
//             SUM(p.point_value) AS weekly_points,
//             COUNT(DISTINCT po.id) AS weekly_posts,
//             COUNT(DISTINCT pc.id) AS weekly_comments,
//             COUNT(DISTINCT m.id) AS weekly_messages
//           FROM
//             points p
//           JOIN
//             WeeklyIntervals wi ON p.updated_at >= wi.week_start
//                               AND p.updated_at < (wi.week_start + interval '1 week')
//           LEFT JOIN
//             posts po ON po.sender_id = p.recipient_id AND p.group_id = $1 AND p.updated_at >= wi.week_start AND p.updated_at < (wi.week_start + interval '1 week')
//           LEFT JOIN
//             post_comments pc ON pc.sender_id = p.recipient_id AND pc.updated_at >= wi.week_start AND pc.updated_at < (wi.week_start + interval '1 week')
//           LEFT JOIN
//             messages m ON m.sender_id = p.recipient_id AND m.group_id = $1 AND m.updated_at >= wi.week_start AND m.updated_at < (wi.week_start + interval '1 week')
//           WHERE
//             p.group_id = $1 AND p.recipient_id = $3
//           GROUP BY
//             p.recipient_id, wi.week_index
//         )
//         SELECT
//           ud.user_id,
//           ud.username,
//           ud.email,
//           COALESCE(SUM(pb.weekly_points), 0) AS total_points,
//           ud.total_posts AS total_posts,
//           ud.total_comments AS total_comments,
//           ud.total_messages AS total_messages,
//           COALESCE(MAX(CASE WHEN pb.week_number = 1 THEN pb.weekly_points END), 0) AS week_1_points,
//           COALESCE(MAX(CASE WHEN pb.week_number = 1 THEN pb.weekly_posts END), 0) AS week_1_posts,
//           COALESCE(MAX(CASE WHEN pb.week_number = 1 THEN pb.weekly_comments END), 0) AS week_1_comments,
//           COALESCE(MAX(CASE WHEN pb.week_number = 1 THEN pb.weekly_messages END), 0) AS week_1_messages,
//           COALESCE(MAX(CASE WHEN pb.week_number = 2 THEN pb.weekly_points END), 0) AS week_2_points,
//           COALESCE(MAX(CASE WHEN pb.week_number = 2 THEN pb.weekly_posts END), 0) AS week_2_posts,
//           COALESCE(MAX(CASE WHEN pb.week_number = 2 THEN pb.weekly_comments END), 0) AS week_2_comments,
//           COALESCE(MAX(CASE WHEN pb.week_number = 2 THEN pb.weekly_messages END), 0) AS week_2_messages
//         FROM
//           UserDetails ud
//         LEFT JOIN
//           PointsByWeek pb ON pb.user_id = ud.user_id
//         WHERE
//           ud.user_id = $3
//         GROUP BY
//           ud.user_id, ud.username, ud.email, ud.total_posts, ud.total_comments, ud.total_messages
//         ORDER BY
//           ud.username;
//         `,
//         [currentGroup, startDate, userId]
//       );
//     }

//     const formattedData = formatUserData(groupMembersQuery.rows);
//     res.send(formattedData);
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ error: "Internal Server Error" });
//   }
// };

module.exports.getWeeklyGroupInfo = async (req, res) => {
  const { currentGroup, startDate, endDate } = req.body;
  const token = getJwt(req);

  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  try {
    const decoded = await jwtVerify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const isAdminQuery = await pool.query(
      `SELECT is_admin FROM participants WHERE user_id = $1 AND group_id = $2`,
      [userId, currentGroup]
    );
    const isAdmin = isAdminQuery.rows[0]?.is_admin;

    const dateDiff = await pool.query(
      `SELECT FLOOR(DATE_PART('day', $2::timestamp - $1::timestamp) / 7) + 1 AS weeks`,
      [startDate, endDate]
    );
    const numberOfWeeks = dateDiff.rows[0]?.weeks || 1;

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
        SELECT generate_series(0, ${numberOfWeeks - 1}) AS week_index,
               ($1::date + (generate_series(0, ${
                 numberOfWeeks - 1
               }) * interval '1 week')) AS week_start
      ),
      UserDetails AS (
        SELECT
          u.id AS user_id,
          u.username,
          u.email,
          COALESCE(COUNT(DISTINCT po.id), 0) AS total_posts,
          COALESCE(COUNT(DISTINCT CASE WHEN parent_post.group_id = $2 THEN pc.id END), 0) AS total_comments,
          COALESCE(COUNT(DISTINCT m.id), 0) AS total_messages
        FROM users u
        JOIN participants p ON u.id = p.user_id AND p.group_id = $2
        LEFT JOIN posts po ON po.sender_id = u.id AND po.group_id = $2
        LEFT JOIN post_comments pc ON pc.sender_id = u.id
        LEFT JOIN posts parent_post ON pc.post_id = parent_post.id
        LEFT JOIN messages m ON m.sender_id = u.id AND m.group_id = $2
        ${!isAdmin ? `WHERE u.id = $3` : ""}
        GROUP BY u.id, u.username, u.email
      ),
      ActivityByWeek AS (
        SELECT user_id, week_number, 
          SUM(points) AS weekly_points,
          SUM(posts) AS weekly_posts,
          SUM(comments) AS weekly_comments,
          SUM(messages) AS weekly_messages
        FROM (
          SELECT p.recipient_id AS user_id,
                 wi.week_index + 1 AS week_number,
                 SUM(p.point_value) AS points,
                 0 AS posts, 0 AS comments, 0 AS messages
          FROM points p
          JOIN WeeklyIntervals wi ON p.updated_at >= wi.week_start AND p.updated_at < (wi.week_start + interval '1 week')
          WHERE p.group_id = $2
          ${!isAdmin ? `AND p.recipient_id = $3` : ""}
          GROUP BY p.recipient_id, wi.week_index

          UNION ALL

          SELECT po.sender_id AS user_id,
                 wi.week_index + 1 AS week_number,
                 0 AS points,
                 COUNT(*) AS posts,
                 0 AS comments,
                 0 AS messages
          FROM posts po
          JOIN WeeklyIntervals wi ON po.updated_at >= wi.week_start AND po.updated_at < (wi.week_start + interval '1 week')
          WHERE po.group_id = $2
          ${!isAdmin ? `AND po.sender_id = $3` : ""}
          GROUP BY po.sender_id, wi.week_index

          UNION ALL

          SELECT pc.sender_id AS user_id,
                 wi.week_index + 1 AS week_number,
                 0 AS points, 0 AS posts,
                 COUNT(*) AS comments,
                 0 AS messages
          FROM post_comments pc
          JOIN posts p ON pc.post_id = p.id
          JOIN WeeklyIntervals wi ON pc.updated_at >= wi.week_start AND pc.updated_at < (wi.week_start + interval '1 week')
          WHERE p.group_id = $2
          ${!isAdmin ? `AND pc.sender_id = $3` : ""}
          GROUP BY pc.sender_id, wi.week_index

          UNION ALL

          SELECT m.sender_id AS user_id,
                 wi.week_index + 1 AS week_number,
                 0 AS points, 0 AS posts, 0 AS comments,
                 COUNT(*) AS messages
          FROM messages m
          JOIN WeeklyIntervals wi ON m.updated_at >= wi.week_start AND m.updated_at < (wi.week_start + interval '1 week')
          WHERE m.group_id = $2
          ${!isAdmin ? `AND m.sender_id = $3` : ""}
          GROUP BY m.sender_id, wi.week_index
        ) AS combined
        GROUP BY user_id, week_number
      )
      SELECT
        ud.user_id,
        ud.username,
        ud.email,
        COALESCE(SUM(aw.weekly_points), 0) AS total_points,
        ud.total_posts,
        ud.total_comments,
        ud.total_messages,
        ${generateSelectColumns()}
      FROM UserDetails ud
      LEFT JOIN ActivityByWeek aw ON aw.user_id = ud.user_id
      GROUP BY ud.user_id, ud.username, ud.email, ud.total_posts, ud.total_comments, ud.total_messages
      ORDER BY ud.username;
    `;

    const params = isAdmin
      ? [startDate, currentGroup]
      : [startDate, currentGroup, userId];

    const groupMembersQuery = await pool.query(baseQuery, params);

    const formatUserData = (rows) => {
      return rows.map((user) => {
        const formatted = {
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          total: {
            points: user.total_points || "0",
            posts: user.total_posts || "0",
            comments: user.total_comments || "0",
            messages: user.total_messages || "0",
          },
        };
        for (let i = 1; i <= numberOfWeeks; i++) {
          formatted[`week_${i}`] = {
            points: user[`week_${i}_points`] || "0",
            posts: user[`week_${i}_posts`] || "0",
            comments: user[`week_${i}_comments`] || "0",
            messages: user[`week_${i}_messages`] || "0",
          };
        }
        return formatted;
      });
    };

    const formattedData = formatUserData(groupMembersQuery.rows);
    res.send(formattedData);
  } catch (error) {
    console.error("getWeeklyGroupInfo error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//// april 22 2025 previous version:
// module.exports.getWeeklyGroupInfo = async (req, res) => {
//   const { currentGroup, startDate, endDate } = req.body;
//   const token = getJwt(req);

//   if (!token) {
//     return res.status(401).json({ error: "JWT token is required" });
//   }

//   try {
//     const decoded = await jwtVerify(token, process.env.JWT_SECRET);
//     const userId = decoded.id;

//     const isAdminQuery = await pool.query(
//       `SELECT is_admin FROM participants WHERE user_id = $1 AND group_id = $2`,
//       [userId, currentGroup]
//     );
//     const isAdmin = isAdminQuery.rows[0]?.is_admin;

//     const dateDiff = await pool.query(
//       `SELECT FLOOR(DATE_PART('day', $2::timestamp - $1::timestamp) / 7) + 1 AS weeks`,
//       [startDate, endDate]
//     );
//     const numberOfWeeks = dateDiff.rows[0]?.weeks || 1;

//     const generateSelectColumns = () => {
//       const cols = [];
//       for (let i = 1; i <= numberOfWeeks; i++) {
//         cols.push(`
//           COALESCE(MAX(CASE WHEN pb.week_number = ${i} THEN pb.weekly_points END), 0) AS week_${i}_points,
//           COALESCE(MAX(CASE WHEN pb.week_number = ${i} THEN pb.weekly_posts END), 0) AS week_${i}_posts,
//           COALESCE(MAX(CASE WHEN pb.week_number = ${i} THEN pb.weekly_comments END), 0) AS week_${i}_comments,
//           COALESCE(MAX(CASE WHEN pb.week_number = ${i} THEN pb.weekly_messages END), 0) AS week_${i}_messages
//         `);
//       }
//       return cols.join(",\n");
//     };

//     const baseQuery = `
//       WITH WeeklyIntervals AS (
//         SELECT generate_series(0, ${numberOfWeeks - 1}) AS week_index,
//                ($1::date + (generate_series(0, ${
//                  numberOfWeeks - 1
//                }) * interval '1 week')) AS week_start
//       ),
//       UserDetails AS (
//         SELECT
//           u.id AS user_id,
//           u.username,
//           u.email,
//           COALESCE(COUNT(DISTINCT po.id), 0) AS total_posts,
//           COALESCE(COUNT(DISTINCT CASE WHEN parent_post.group_id = $2 THEN pc.id END), 0) AS total_comments,
//           COALESCE(COUNT(DISTINCT m.id), 0) AS total_messages
//         FROM users u
//         JOIN participants p ON u.id = p.user_id AND p.group_id = $2
//         LEFT JOIN posts po ON po.sender_id = u.id AND po.group_id = $2
//         LEFT JOIN post_comments pc ON pc.sender_id = u.id
//         LEFT JOIN posts parent_post ON pc.post_id = parent_post.id
//         LEFT JOIN messages m ON m.sender_id = u.id AND m.group_id = $2
//         ${!isAdmin ? `WHERE u.id = $3` : ""}
//         GROUP BY u.id, u.username, u.email
//       ),
//       PointsByWeek AS (
//         SELECT
//           p.recipient_id AS user_id,
//           wi.week_index + 1 AS week_number,
//           SUM(p.point_value) AS weekly_points,
//           COUNT(DISTINCT po.id) AS weekly_posts,
//           COUNT(DISTINCT pc.id) AS weekly_comments,
//           COUNT(DISTINCT m.id) AS weekly_messages
//         FROM points p
//         JOIN WeeklyIntervals wi ON p.updated_at >= wi.week_start AND p.updated_at < (wi.week_start + interval '1 week')
//         LEFT JOIN posts po ON po.sender_id = p.recipient_id AND po.group_id = $2 AND po.updated_at >= wi.week_start AND po.updated_at < (wi.week_start + interval '1 week')
//         LEFT JOIN post_comments pc ON pc.sender_id = p.recipient_id AND pc.updated_at >= wi.week_start AND pc.updated_at < (wi.week_start + interval '1 week')
//         LEFT JOIN messages m ON m.sender_id = p.recipient_id AND m.group_id = $2 AND m.updated_at >= wi.week_start AND m.updated_at < (wi.week_start + interval '1 week')
//         WHERE p.group_id = $2
//         ${!isAdmin ? `AND p.recipient_id = $3` : ""}
//         GROUP BY p.recipient_id, wi.week_index
//       )
//       SELECT
//         ud.user_id,
//         ud.username,
//         ud.email,
//         COALESCE(SUM(pb.weekly_points), 0) AS total_points,
//         ud.total_posts,
//         ud.total_comments,
//         ud.total_messages,
//         ${generateSelectColumns()}
//       FROM UserDetails ud
//       LEFT JOIN PointsByWeek pb ON pb.user_id = ud.user_id
//       GROUP BY ud.user_id, ud.username, ud.email, ud.total_posts, ud.total_comments, ud.total_messages
//       ORDER BY ud.username;
//     `;

//     const params = isAdmin
//       ? [startDate, currentGroup]
//       : [startDate, currentGroup, userId];

//     const groupMembersQuery = await pool.query(baseQuery, params);

//     const formatUserData = (rows) => {
//       return rows.map((user) => {
//         const formatted = {
//           user_id: user.user_id,
//           username: user.username,
//           email: user.email,
//           total: {
//             points: user.total_points || "0",
//             posts: user.total_posts || "0",
//             comments: user.total_comments || "0",
//             messages: user.total_messages || "0",
//           },
//         };
//         for (let i = 1; i <= numberOfWeeks; i++) {
//           formatted[`week_${i}`] = {
//             points: user[`week_${i}_points`] || "0",
//             posts: user[`week_${i}_posts`] || "0",
//             comments: user[`week_${i}_comments`] || "0",
//             messages: user[`week_${i}_messages`] || "0",
//           };
//         }
//         return formatted;
//       });
//     };

//     const formattedData = formatUserData(groupMembersQuery.rows);
//     console.log("formatted data: " + JSON.stringify(formattedData, null, 2));

//     res.send(formattedData);
//   } catch (error) {
//     console.error("getWeeklyGroupInfo error:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// module.exports.getWeeklyGroupInfo = async (req, res) => {
//   const { currentGroup, startDate } = req.body;

//   try {
//     const groupMembersQuery = await pool.query(
//       `
//       WITH WeeklyIntervals AS (
//         SELECT generate_series(0, 7) AS week_index,
//                ($2::date + (generate_series(0, 7) * interval '1 week')) AS week_start
//       ),
//       UserDetails AS (
//         SELECT
//           u.id,
//           u.username,
//           u.email,
//           COALESCE(COUNT(DISTINCT po.id), 0) AS total_posts,
//           COALESCE(COUNT(DISTINCT pc.id), 0) AS total_comments,
//           COALESCE(COUNT(DISTINCT m.id), 0) AS total_messages
//         FROM
//           users u
//         JOIN
//           participants p ON u.id = p.user_id AND p.group_id = $1
//         LEFT JOIN
//           posts po ON po.sender_id = u.id AND po.group_id = $1
//         LEFT JOIN
//           post_comments pc ON pc.sender_id = u.id
//         LEFT JOIN
//           messages m ON m.sender_id = u.id AND m.group_id = $1
//         GROUP BY
//           u.id, u.username, u.email
//       ),
//       PointsByWeek AS (
//         SELECT
//           p.recipient_id AS user_id,
//           wi.week_index + 1 AS week_number,
//           SUM(p.point_value) AS weekly_points,
//           COUNT(DISTINCT po.id) AS weekly_posts,
//           COUNT(DISTINCT pc.id) AS weekly_comments,
//           COUNT(DISTINCT m.id) AS weekly_messages
//         FROM
//           points p
//         JOIN
//           WeeklyIntervals wi ON p.updated_at >= wi.week_start
//                             AND p.updated_at < (wi.week_start + interval '1 week')
//         LEFT JOIN
//           posts po ON po.sender_id = p.recipient_id AND p.group_id = $1 AND p.updated_at >= wi.week_start AND p.updated_at < (wi.week_start + interval '1 week')
//         LEFT JOIN
//           post_comments pc ON pc.sender_id = p.recipient_id AND pc.updated_at >= wi.week_start AND pc.updated_at < (wi.week_start + interval '1 week')
//         LEFT JOIN
//           messages m ON m.sender_id = p.recipient_id AND m.group_id = $1 AND m.updated_at >= wi.week_start AND m.updated_at < (wi.week_start + interval '1 week')
//         WHERE
//           p.group_id = $1
//         GROUP BY
//           p.recipient_id, wi.week_index
//       )
//       SELECT
//         ud.id AS user_id,
//         ud.username,
//         ud.email,
//         COALESCE(SUM(pb.weekly_points), 0) AS total_points,
//         ud.total_posts AS total_posts,
//         ud.total_comments AS total_comments,
//         ud.total_messages AS total_messages,
//         COALESCE(MAX(CASE WHEN pb.week_number = 1 THEN pb.weekly_points END), 0) AS week_1_points,
//         COALESCE(MAX(CASE WHEN pb.week_number = 1 THEN pb.weekly_posts END), 0) AS week_1_posts,
//         COALESCE(MAX(CASE WHEN pb.week_number = 1 THEN pb.weekly_comments END), 0) AS week_1_comments,
//         COALESCE(MAX(CASE WHEN pb.week_number = 1 THEN pb.weekly_messages END), 0) AS week_1_messages,
//         COALESCE(MAX(CASE WHEN pb.week_number = 2 THEN pb.weekly_points END), 0) AS week_2_points,
//         COALESCE(MAX(CASE WHEN pb.week_number = 2 THEN pb.weekly_posts END), 0) AS week_2_posts,
//         COALESCE(MAX(CASE WHEN pb.week_number = 2 THEN pb.weekly_comments END), 0) AS week_2_comments,
//         COALESCE(MAX(CASE WHEN pb.week_number = 2 THEN pb.weekly_messages END), 0) AS week_2_messages,
//         COALESCE(MAX(CASE WHEN pb.week_number = 3 THEN pb.weekly_points END), 0) AS week_3_points,
//         COALESCE(MAX(CASE WHEN pb.week_number = 3 THEN pb.weekly_posts END), 0) AS week_3_posts,
//         COALESCE(MAX(CASE WHEN pb.week_number = 3 THEN pb.weekly_comments END), 0) AS week_3_comments,
//         COALESCE(MAX(CASE WHEN pb.week_number = 3 THEN pb.weekly_messages END), 0) AS week_3_messages,
//         COALESCE(MAX(CASE WHEN pb.week_number = 4 THEN pb.weekly_points END), 0) AS week_4_points,
//         COALESCE(MAX(CASE WHEN pb.week_number = 4 THEN pb.weekly_posts END), 0) AS week_4_posts,
//         COALESCE(MAX(CASE WHEN pb.week_number = 4 THEN pb.weekly_comments END), 0) AS week_4_comments,
//         COALESCE(MAX(CASE WHEN pb.week_number = 4 THEN pb.weekly_messages END), 0) AS week_4_messages,
//         COALESCE(MAX(CASE WHEN pb.week_number = 5 THEN pb.weekly_points END), 0) AS week_5_points,
//         COALESCE(MAX(CASE WHEN pb.week_number = 5 THEN pb.weekly_posts END), 0) AS week_5_posts,
//         COALESCE(MAX(CASE WHEN pb.week_number = 5 THEN pb.weekly_comments END), 0) AS week_5_comments,
//         COALESCE(MAX(CASE WHEN pb.week_number = 5 THEN pb.weekly_messages END), 0) AS week_5_messages,
//         COALESCE(MAX(CASE WHEN pb.week_number = 6 THEN pb.weekly_points END), 0) AS week_6_points,
//         COALESCE(MAX(CASE WHEN pb.week_number = 6 THEN pb.weekly_posts END), 0) AS week_6_posts,
//         COALESCE(MAX(CASE WHEN pb.week_number = 6 THEN pb.weekly_comments END), 0) AS week_6_comments,
//         COALESCE(MAX(CASE WHEN pb.week_number = 6 THEN pb.weekly_messages END), 0) AS week_6_messages,
//         COALESCE(MAX(CASE WHEN pb.week_number = 7 THEN pb.weekly_points END), 0) AS week_7_points,
//         COALESCE(MAX(CASE WHEN pb.week_number = 7 THEN pb.weekly_posts END), 0) AS week_7_posts,
//         COALESCE(MAX(CASE WHEN pb.week_number = 7 THEN pb.weekly_comments END), 0) AS week_7_comments,
//         COALESCE(MAX(CASE WHEN pb.week_number = 7 THEN pb.weekly_messages END), 0) AS week_7_messages,
//         COALESCE(MAX(CASE WHEN pb.week_number = 8 THEN pb.weekly_points END), 0) AS week_8_points,
//         COALESCE(MAX(CASE WHEN pb.week_number = 8 THEN pb.weekly_posts END), 0) AS week_8_posts,
//         COALESCE(MAX(CASE WHEN pb.week_number = 8 THEN pb.weekly_comments END), 0) AS week_8_comments,
//         COALESCE(MAX(CASE WHEN pb.week_number = 8 THEN pb.weekly_messages END), 0) AS week_8_messages
//       FROM
//         UserDetails ud
//       LEFT JOIN
//         PointsByWeek pb ON pb.user_id = ud.id
//       GROUP BY
//         ud.id, ud.username, ud.email,
//         ud.total_posts, ud.total_comments, ud.total_messages
//       ORDER BY
//         ud.username;
//       `,
//       [currentGroup, startDate]
//     );

//     const formattedData = formatUserData(groupMembersQuery.rows);
//     res.send(formattedData);
//   } catch (err) {
//     console.error("Error fetching weekly group info:", err.message);
//     res.status(500).send("Server error");
//   }
// };

// const formatUserData = (rows) => {
//   return rows.map((user) => ({
//     user_id: user.user_id,
//     username: user.username,
//     email: user.email,
//     total: {
//       points: user.total_points,
//       posts: user.total_posts,
//       comments: user.total_comments,
//       messages: user.total_messages,
//     },
//     week_1: {
//       points: user.week_1_points,
//       posts: user.week_1_posts,
//       comments: user.week_1_comments,
//       messages: user.week_1_messages,
//     },
//     week_2: {
//       points: user.week_2_points,
//       posts: user.week_2_posts,
//       comments: user.week_2_comments,
//       messages: user.week_2_messages,
//     },
//     week_3: {
//       points: user.week_3_points,
//       posts: user.week_3_posts,
//       comments: user.week_3_comments,
//       messages: user.week_3_messages,
//     },
//     week_4: {
//       points: user.week_4_points,
//       posts: user.week_4_posts,
//       comments: user.week_4_comments,
//       messages: user.week_4_messages,
//     },
//     week_5: {
//       points: user.week_5_points,
//       posts: user.week_5_posts,
//       comments: user.week_5_comments,
//       messages: user.week_5_messages,
//     },
//     week_6: {
//       points: user.week_6_points,
//       posts: user.week_6_posts,
//       comments: user.week_6_comments,
//       messages: user.week_6_messages,
//     },
//     week_7: {
//       points: user.week_7_points,
//       posts: user.week_7_posts,
//       comments: user.week_7_comments,
//       messages: user.week_7_messages,
//     },
//     week_8: {
//       points: user.week_8_points,
//       posts: user.week_8_posts,
//       comments: user.week_8_comments,
//       messages: user.week_8_messages,
//     },
//   }));
// };

//////// MOST RECENT GET MEMBERS
module.exports.getGroupMembers = async (req, res) => {
  const { currentGroup } = req.body;
  let { startDate, endDate } = req.body;

  // Query to find the earliest and latest dates points were given
  const dateRangeQuery = await pool.query(
    `
    SELECT
      MIN(updated_at) AS start_date,
      MAX(updated_at) AS end_date
    FROM points
    WHERE group_id = $1
    `,
    [currentGroup]
  );

  const dateRange = dateRangeQuery.rows[0];

  // Default start and end dates if not provided
  if (!startDate) {
    if (dateRange.start_date) {
      startDate = dateRange.start_date.toISOString().split("T")[0]; // Convert to YYYY-MM-DD format
    } else {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3); // Default to 3 months ago
      startDate = startDate.toISOString().split("T")[0]; // Convert to YYYY-MM-DD format
    }
  }

  if (!endDate) {
    if (dateRange.end_date) {
      endDate = dateRange.end_date.toISOString().split("T")[0]; // Convert to YYYY-MM-DD format
    } else {
      endDate = new Date().toISOString().split("T")[0]; // Default to today
    }
  }

  const groupMembersQuery = await pool.query(
    `
    WITH WeeklyIntervals AS (
      SELECT generate_series($2::date, $3::date, '1 week') AS week_start
    ),
    UserDetails AS (
      SELECT
        u.id AS user_id,
        u.username,
        u.email,
        COALESCE(COUNT(DISTINCT po.id), 0) AS total_posts,
        COALESCE(COUNT(DISTINCT pc.id), 0) AS total_comments,
        COALESCE(COUNT(DISTINCT m.id), 0) AS total_messages
      FROM
        users u
      JOIN
        participants p ON u.id = p.user_id AND p.group_id = $1
      LEFT JOIN
        posts po ON po.sender_id = u.id AND po.group_id = $1
      LEFT JOIN LATERAL (
        SELECT pc.sender_id, pc.id
        FROM post_comments pc
        JOIN posts p ON pc.post_id = p.id
        WHERE p.group_id = $1 AND pc.sender_id = u.id
      ) pc ON true
      LEFT JOIN LATERAL (
        SELECT m.sender_id, m.id
        FROM messages m
        WHERE m.group_id = $1 AND m.sender_id = u.id
      ) m ON true
      GROUP BY
        u.id, u.username, u.email
    )
    SELECT
      ud.user_id,
      ud.username,
      ud.email,
      ud.total_posts,
      ud.total_comments,
      ud.total_messages,
      COALESCE(SUM(wp.group_total_points), 0) AS group_total_points
    FROM
      UserDetails ud
    CROSS JOIN
      WeeklyIntervals wi
    LEFT JOIN LATERAL (
      SELECT
        p.recipient_id,
        SUM(p.point_value) AS group_total_points
      FROM
        points p
      WHERE
        p.group_id = $1
        AND p.updated_at >= wi.week_start
        AND p.updated_at < (wi.week_start + interval '1 week')
        AND p.recipient_id = ud.user_id
      GROUP BY
        p.recipient_id
    ) wp ON true
    GROUP BY
      ud.user_id, ud.username, ud.email, ud.total_posts, ud.total_comments, ud.total_messages
    ORDER BY
      ud.username;

    `,
    [currentGroup, startDate, endDate]
  );

  res.send(groupMembersQuery.rows);
};

module.exports.getMyGroupAnalytics = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userId = decoded.id;
      const { currentGroup } = req.body;
      let { startDate, endDate } = req.body;

      // Query to find the earliest and latest dates points were given
      const dateRangeQuery = await pool.query(
        `
        SELECT
          MIN(updated_at) AS start_date,
          MAX(updated_at) AS end_date
        FROM points
        WHERE group_id = $1
        `,
        [currentGroup]
      );

      const dateRange = dateRangeQuery.rows[0];

      // Default start and end dates if not provided
      if (!startDate) {
        if (dateRange.start_date) {
          startDate = dateRange.start_date.toISOString().split("T")[0]; // Convert to YYYY-MM-DD format
        } else {
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 3); // Default to 3 months ago
          startDate = startDate.toISOString().split("T")[0]; // Convert to YYYY-MM-DD format
        }
      }

      if (!endDate) {
        if (dateRange.end_date) {
          endDate = dateRange.end_date.toISOString().split("T")[0]; // Convert to YYYY-MM-DD format
        } else {
          endDate = new Date().toISOString().split("T")[0]; // Default to today
        }
      }

      // const userAnalyticsQuery = await pool.query(
      //   `
      //   WITH WeeklyIntervals AS (
      //     SELECT generate_series($2::date, $3::date, '1 week') AS week_start
      //   ),
      //   UserDetails AS (
      //     SELECT
      //       u.id AS user_id,
      //       u.username,
      //       u.email,
      //       COALESCE(COUNT(DISTINCT po.id), 0) AS total_posts,
      //       COALESCE(COUNT(DISTINCT pc.id), 0) AS total_comments,
      //       COALESCE(COUNT(DISTINCT m.id), 0) AS total_messages
      //     FROM
      //       users u
      //     JOIN
      //       participants p ON u.id = p.user_id AND p.group_id = $1
      //     LEFT JOIN
      //       posts po ON po.sender_id = u.id AND po.group_id = $1
      //     LEFT JOIN LATERAL (
      //       SELECT pc.sender_id, pc.id
      //       FROM post_comments pc
      //       JOIN posts p ON pc.post_id = p.id
      //       WHERE p.group_id = $1 AND pc.sender_id = u.id
      //     ) pc ON true
      //     LEFT JOIN LATERAL (
      //       SELECT m.id
      //       FROM messages m
      //       WHERE m.group_id = $1
      //         AND m.sender_id = u.id
      //         AND m.updated_at >= $2
      //         AND m.updated_at < $3::date + interval '1 day'
      //     ) m ON true
      //     WHERE u.id = $4
      //     GROUP BY
      //       u.id, u.username, u.email
      //   )
      //   SELECT
      //     ud.user_id,
      //     ud.username,
      //     ud.email,
      //     ud.total_posts,
      //     ud.total_comments,
      //     ud.total_messages,
      //     COALESCE(SUM(wp.group_total_points), 0) AS group_total_points
      //   FROM
      //     UserDetails ud
      //   CROSS JOIN
      //     WeeklyIntervals wi
      //   LEFT JOIN LATERAL (
      //     SELECT
      //       p.recipient_id,
      //       SUM(p.point_value) AS group_total_points
      //     FROM
      //       points p
      //     WHERE
      //       p.group_id = $1
      //       AND p.updated_at >= wi.week_start
      //       AND p.updated_at < (wi.week_start + interval '1 week')
      //       AND p.recipient_id = ud.user_id
      //     GROUP BY
      //       p.recipient_id
      //   ) wp ON true
      //   WHERE ud.user_id = $4
      //   GROUP BY
      //     ud.user_id, ud.username, ud.email, ud.total_posts, ud.total_comments, ud.total_messages
      //   ORDER BY
      //     ud.username;
      //   `,
      //   [currentGroup, startDate, endDate, userId]
      // );
      const userAnalyticsQuery = await pool.query(
        `
        WITH WeeklyIntervals AS (
          SELECT generate_series($2::date, $3::date, interval '1 week') AS week_start
        ),
        UserDetails AS (
          SELECT u.id AS user_id, u.username, u.email
          FROM users u
          JOIN participants p ON u.id = p.user_id AND p.group_id = $1
          WHERE u.id = $4
        )
        SELECT
          u.user_id,
          u.username,
          u.email,
      
          ARRAY(
            SELECT COUNT(*)
            FROM posts po
            WHERE po.group_id = $1
              AND po.sender_id = u.user_id
              AND po.updated_at >= wi.week_start
              AND po.updated_at < wi.week_start + interval '1 week'
            ORDER BY wi.week_start
          ) AS weekly_posts,
      
          ARRAY(
            SELECT COUNT(*)
            FROM post_comments pc
            JOIN posts p ON pc.post_id = p.id
            WHERE p.group_id = $1
              AND pc.sender_id = u.user_id
              AND pc.updated_at >= wi.week_start
              AND pc.updated_at < wi.week_start + interval '1 week'
            ORDER BY wi.week_start
          ) AS weekly_comments,
      
          ARRAY(
            SELECT COUNT(*)
            FROM messages m
            WHERE m.group_id = $1
              AND m.sender_id = u.user_id
              AND m.updated_at >= wi.week_start
              AND m.updated_at < wi.week_start + interval '1 week'
            ORDER BY wi.week_start
          ) AS weekly_messages,
      
          ARRAY(
            SELECT COALESCE(SUM(p.point_value), 0)
            FROM points p
            WHERE p.group_id = $1
              AND p.recipient_id = u.user_id
              AND p.updated_at >= wi.week_start
              AND p.updated_at < wi.week_start + interval '1 week'
            ORDER BY wi.week_start
          ) AS weekly_points
      
        FROM
          UserDetails u,
          WeeklyIntervals wi
        GROUP BY
          u.user_id, u.username, u.email;
        `,
        [currentGroup, startDate, endDate, userId]
      );

      res.send(userAnalyticsQuery.rows);
    })
    .catch(() => {
      res.json({ message: "Error" });
    });
};

module.exports.getLeaderboard = async (req, res) => {
  const groupLeaderboardQuery = await pool.query(
    //  "WITH RankedMonths AS (SELECT EXTRACT(YEAR FROM p.updated_at) AS year, EXTRACT(MONTH FROM p.updated_at) AS month, DENSE_RANK() OVER (ORDER BY EXTRACT(YEAR FROM p.updated_at), EXTRACT(MONTH FROM p.updated_at)) AS month_rank FROM points p WHERE p.group_id = $1 GROUP BY EXTRACT(YEAR FROM p.updated_at), EXTRACT(MONTH FROM p.updated_at)), MonthlyPoints AS (SELECT EXTRACT(YEAR FROM p.updated_at) AS year, EXTRACT(MONTH FROM p.updated_at) AS month, p.recipient_id, SUM(p.point_value) AS group_total_points FROM points p WHERE p.group_id = $1 GROUP BY EXTRACT(YEAR FROM p.updated_at), EXTRACT(MONTH FROM p.updated_at), p.recipient_id), UserDetails AS (SELECT u.id AS user_id, u.username, u.email FROM users u JOIN participants p ON u.id = p.user_id WHERE p.group_id = $1) SELECT ud.user_id, ud.username, ud.email, MAX(CASE WHEN rm.month_rank = 1 THEN mp.group_total_points ELSE 0 END) AS Unit_1, MAX(CASE WHEN rm.month_rank = 2 THEN mp.group_total_points ELSE 0 END) AS Unit_2, MAX(CASE WHEN rm.month_rank = 3 THEN mp.group_total_points ELSE 0 END) AS Unit_3, MAX(CASE WHEN rm.month_rank = 4 THEN mp.group_total_points ELSE 0 END) AS Unit_4, MAX(CASE WHEN rm.month_rank = 5 THEN mp.group_total_points ELSE 0 END) AS Unit_5, MAX(CASE WHEN rm.month_rank = 6 THEN mp.group_total_points ELSE 0 END) AS Unit_6, MAX(CASE WHEN rm.month_rank = 7 THEN mp.group_total_points ELSE 0 END) AS Unit_7, MAX(CASE WHEN rm.month_rank = 8 THEN mp.group_total_points ELSE 0 END) AS Unit_8, COALESCE(SUM(mp.group_total_points), 0) AS group_total_points FROM RankedMonths rm CROSS JOIN UserDetails ud LEFT JOIN MonthlyPoints mp ON mp.year = rm.year AND mp.month = rm.month AND mp.recipient_id = ud.user_id GROUP BY ud.user_id, ud.username, ud.email ORDER BY ud.username;  ",
    "SELECT c.user_id as user_id, username, email, is_admin, coalesce(group_total_points,0) group_total_points FROM (  SELECT users.id user_id, users.username username, users.email email, participants.is_admin is_admin FROM participants INNER JOIN users ON participants.user_id = users.id WHERE participants.group_id = $1) c FULL OUTER JOIN ( SELECT user_id, recipient_id, sum as group_total_points FROM (SELECT DISTINCT participants.user_id FROM participants INNER JOIN points ON participants.user_id = points.recipient_id WHERE participants.group_id = $1) a LEFT JOIN (SELECT recipient_id, sum(point_value) FROM points WHERE group_id = $1 GROUP BY recipient_id) b ON a.user_id = b.recipient_id) d ON c.user_id = d.user_id ORDER BY group_total_points DESC;",
    [req.body.currentGroup]
  );

  res.send(groupLeaderboardQuery.rows);
};

module.exports.getMyLeaderboards = async (req, res) => {
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userId = decoded.id;

      const myLeaderboardQuery = await pool.query(
        //  "SELECT className,json_agg(json_build_object('name', username, 'placement', placement, 'profilePicture', avatar_url)) AS leaders FROM (SELECT className, username, avatar_url, ROW_NUMBER() OVER (PARTITION BY className ORDER BY COALESCE(total_points, 0) DESC) AS placement FROM (SELECT g.name AS className, u.username, u.avatar_url, SUM(p.point_value) AS total_points FROM participants pa JOIN groups g ON pa.group_id = g.id LEFT JOIN points p ON pa.group_id = p.group_id JOIN users u ON p.recipient_id = u.id WHERE pa.user_id = $1 GROUP BY g.name, u.username, u.avatar_url) AS subquery) AS ranked_leaders WHERE placement <= 3 GROUP BY className;",
        "SELECT className, group_id, json_agg(json_build_object('name', username, 'placement', placement, 'profilePicture', avatar_url)) AS leaders FROM (SELECT className, group_id, username, avatar_url, ROW_NUMBER() OVER (PARTITION BY className ORDER BY COALESCE(total_points, 0) DESC) AS placement FROM (SELECT g.id AS group_id, g.name AS className, u.username, u.avatar_url, SUM(p.point_value) AS total_points FROM participants pa JOIN groups g ON pa.group_id = g.id LEFT JOIN points p ON pa.group_id = p.group_id JOIN users u ON p.recipient_id = u.id WHERE pa.user_id = $1 GROUP BY g.id, g.name, u.username, u.avatar_url) AS subquery) AS ranked_leaders WHERE placement <= 3 GROUP BY className, group_id;",
        [userId]
      );
      res.send(myLeaderboardQuery.rows);
    })
    .catch(() => {
      res.json({ message: "Error" });
    });
};

module.exports.handleJoinGroup = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        try {
          const existingParticipant = await participants.findOne({
            where: {
              user_id: userID,
              group_id: req.body.joinGroupId,
            },
          });

          if (!existingParticipant) {
            await participants.create({
              user_id: userID,
              group_id: req.body.joinGroupId,
              is_admin: false,
              created_at: currentDate.getTime(),
              updated_at: currentDate.getTime(),
            });

            res.json({
              ...req.body,
              status: "Successfully added 😘",
            });
          } else {
            res.json({
              ...req.body,
              status: "You're already in this group 😁",
            });
          }
        } catch (error) {
          console.error("Error joining group: ", error);
          res.status(500).json({ error: "Internal server error" });
        }
      } catch (error) {
        console.error("Error joining group: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleJoinGroupWithPasscode = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const group = await groups.findOne({
          where: {
            invite_passcode: req.body.passcode,
          },
        });

        if (group) {
          const admin = await participants.findOne({
            where: {
              group_id: group.id,
              is_admin: true,
            },
            attributes: ["user_id"],
            include: [
              {
                model: users,
                attributes: ["username"],
              },
            ],
          });

          if (admin.user.username === req.body.admin) {
            const existingParticipant = await participants.findOne({
              where: {
                user_id: userID,
                group_id: group.id,
              },
            });

            if (!existingParticipant) {
              await participants.create({
                user_id: userID,
                group_id: group.id,
                is_admin: false,
                created_at: currentDate.getTime(),
                updated_at: currentDate.getTime(),
              });

              res.json({
                ...req.body,
                status: "Successfully added 😘",
              });
            } else {
              res.json({
                ...req.body,
                status: "You're already in this group 😁",
              });
            }
          } else {
            res.json({
              ...req.body,
              status: "Wrong passcode or admin username", // Wrong admin username
            });
          }
        } else {
          res.json({
            ...req.body,
            status: "Wrong passcode or admin username", // Wrong passcode
          });
        }
      } catch (error) {
        console.error("Error joining group: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleIsAdmin = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const isAdmin = await participants.findOne({
          where: {
            user_id: userID,
            group_id: req.body.currentGroup,
            is_admin: true,
          },
        });

        res.json({
          ...req.body,
          isAdmin: isAdmin ? "true" : "false",
        });
      } catch (error) {
        console.error("Error getting is Admin:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleLeaveGroup = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const isAdmin = await participants.findOne({
          where: {
            user_id: userID,
            group_id: req.body.currentGroup,
            is_admin: true,
          },
        });

        if (isAdmin) {
          res.json({
            ...req.body,
            status: "You can't leave because you're the admin 😁",
          });
        } else {
          await participants.destroy({
            where: {
              user_id: userID,
              group_id: req.body.currentGroup,
            },
          });

          res.json({
            ...req.body,
            status: "Success",
          });
        }
      } catch (error) {
        console.error("Error leaving group: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleDeleteGroup = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const existingUser = await pool.query(
          "SELECT username, passhash from users WHERE id=$1",
          [userID]
        );
        if (existingUser.rowCount != 0) {
          const isSamePass = await bcrypt.compare(
            req.body.passattempt,
            existingUser.rows[0].passhash
          );

          const isAdmin = await pool.query(
            "SELECT * FROM participants WHERE user_id = $1 AND group_id = $2 AND is_admin = true;",
            [userID, req.body.currentGroup]
          );

          if (isAdmin.rowCount != 0) {
            if (isSamePass) {
              const updatePointsQuery = await pool.query(
                "UPDATE points SET group_id=NULL, posts_id=NULL, comment_id=NULL, messages_id=NULL WHERE group_id = $1",
                [req.body.currentGroup]
              );

              const deleteCommentsQuery = await pool.query(
                "DELETE FROM post_comments USING posts WHERE post_comments.post_id = posts.id AND posts.group_id=$1",
                [req.body.currentGroup]
              );

              const deletePostsQuery = await pool.query(
                "DELETE FROM posts WHERE group_id = $1",
                [req.body.currentGroup]
              );

              const deleteMessagesQuery = await pool.query(
                "DELETE FROM messages WHERE group_id = $1",
                [req.body.currentGroup]
              );

              const deleteParticipantsQuery = await pool.query(
                "DELETE FROM participants WHERE group_id = $1",
                [req.body.currentGroup]
              );

              const deleteGroupQuery = await pool.query(
                "DELETE FROM groups WHERE id = $1",
                [req.body.currentGroup]
              );
              res.json({ ...req.body, status: "Success" });
            } else {
              res.json({ ...req.body, status: "Wrong password" });
            }
          } else {
            res.json({ ...req.body, status: "Not admin" });
          }
        } else {
          res.json({ ...req.body, status: "User does not exist" });
        }
      } catch (error) {
        console.error("Error deleting group: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

// module.exports.handleDeleteGroup = async (req, res) => {
//   jwtVerify(req.body.token, process.env.JWT_SECRET)
//     .then(async (decoded) => {
//       const userID = decoded.id;
//       try {
//         const existingUser = await users.findOne({
//           where: {
//             // username: req.body.username,
//             id: userID,
//           },
//         });

//         if (!existingUser) {
//           res.json({
//             ...req.body,
//             status: "User does not exist",
//           });
//           return;
//         }

//         const isSamePass = await bcrypt.compare(
//           req.body.passattempt,
//           existingUser.passhash
//         );

//         const isAdmin = await participants.findOne({
//           where: {
//             user_id: userID,
//             group_id: req.body.currentGroup,
//             is_admin: true,
//           },
//         });

//         if (!isAdmin) {
//           res.json({
//             ...req.body,
//             status: "Not admin",
//           });
//           return;
//         }

//         if (isSamePass) {
//           await sequelize.transaction(async (t) => {
//             await points.destroy({
//               where: {
//                 group_id: req.body.currentGroup,
//               },
//               transaction: t,
//             });

//             await points.destroy({
//               where: {
//                 group_id: req.body.currentGroup,
//               },
//               transaction: t,
//             });

//             await post_comments.destroy({
//               where: {},
//               include: [
//                 {
//                   model: posts,
//                   where: {
//                     group_id: req.body.currentGroup,
//                   },
//                 },
//               ],
//               transaction: t,
//             });

//             await posts.destroy({
//               where: {
//                 group_id: req.body.currentGroup,
//               },
//               transaction: t,
//             });

//             await messages.destroy({
//               where: {
//                 group_id: req.body.currentGroup,
//               },
//               transaction: t,
//             });

//             await participants.destroy({
//               where: {
//                 group_id: req.body.currentGroup,
//               },
//               transaction: t,
//             });

//             await groups.destroy({
//               where: {
//                 id: req.body.currentGroup,
//               },
//               transaction: t,
//             });
//           });

//           res.json({
//             ...req.body,
//             status: "Success",
//           });
//         } else {
//           res.json({
//             ...req.body,
//             status: "Wrong password",
//           });
//         }
//       } catch (error) {
//         console.error("Error deleting group: ", error);
//         res.status(500).json({ error: "Internal server error" });
//       }
//     })
//     .catch(async () => {
//       res.json({ token: null });
//     });
// };

module.exports.handleCreatePost = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      const groupID = req.params.group_id;
      try {
        // Check if the user has already posted in this group
        const existingPosts = await posts.findOne({
          where: {
            sender_id: userID,
            group_id: groupID,
          },
        });

        const newPost = await posts.create({
          title: req.body.title,
          body_text: req.body.body_text,
          image_url: req.body.imageUrl,
          file_url: req.body.fileUrl || null,
          sender_id: userID,
          group_id: req.params.group_id,
          created_at: currentDate.getTime(),
          updated_at: currentDate.getTime(),
        });

        // If it's the user's first post in this group, award the "Composer Badge"
        if (!existingPosts) {
          const composerBadge = await badges.findOne({
            where: { title: "Composer" },
          });

          if (composerBadge) {
            await user_badges.create({
              user_id: userID,
              badge_id: composerBadge.id,
              group_id: groupID,
              created_at: currentDate.getTime(),
              updated_at: currentDate.getTime(),
            });
          }

          // Fetch the group details to get the group name
          const group = await groups.findOne({
            where: { id: groupID },
          });

          // Create a notification for the user
          await notifications.create({
            message: `Great work on publishing your first post in "${group.name}". Keep participating to earn an award!`,
            user_id: userID,
            is_read: false,
            created_at: currentDate.getTime(),
            updated_at: currentDate.getTime(),
            // created_at: currentDate,
            // updated_at: currentDate,
          });
        }

        res.json({
          ...req.body,
          status: "Post successfully created",
        });
      } catch (error) {
        console.error("Error creating post: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.getNotificationsUnread = async (req, res) => {
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        // Query unread notifications for the user
        const unreadNotifications = await notifications.findAll({
          where: {
            user_id: userID,
            is_read: false,
          },
        });

        // Check if there are unread notifications
        const hasUnreadNotifications = unreadNotifications.length > 0;
        res.json({ hasUnreadNotifications });
      } catch (error) {
        console.error("Error checking unread notifications:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
};

module.exports.getNotificationsRead = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        // Update notifications to mark them as read
        await notifications.update(
          { is_read: true },
          { where: { user_id: userID } }
        );

        res.json({
          success: true,
          message: "Notifications marked as read successfully",
        });
      } catch (error) {
        console.error("Error marking notifications as read:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
};

module.exports.handleEditPost = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const [updatedRowCount] = await posts.update(
          {
            title: req.body.title,
            body_text: req.body.body_text,
            image_url: req.body.imageUrl,
          },
          {
            where: {
              sender_id: userID,
              id: req.body.currentPost,
            },
          }
        );

        if (updatedRowCount > 0) {
          res.json({
            ...req.body,
            status: "Post successfully edited",
          });
        } else {
          res.json({
            ...req.body,
            status: "Post not found or you do not have permission to edit",
          });
        }
      } catch (error) {
        console.error("Error editing post: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleEditGroup = async (req, res) => {
  const isPublic = req.body.privacySelection === "Public";

  const updatedGroup = await groups.update(
    {
      name: req.body.groupname,
      description: req.body.description,
      is_public: isPublic,
    },
    {
      where: { id: req.body.currentGroup },
    }
  );

  if (updatedGroup[0] === 1) {
    res.json({
      ...req.body,
      status: "Group successfully updated",
      groupName: req.body.groupname,
    });
  } else {
    res.status(404).json({ error: "Group not found" });
  }
};

module.exports.handleGetPosts = async (req, res) => {
  const getPostsQuery = await pool.query(
    "SELECT c.post_id post_id, sender_id, title, body_text, post_author, created_at, COALESCE(point_total, 0) point_total, COALESCE(number_comments, 0) number_comments FROM (SELECT a.post_id post_id, sender_id, title, body_text, post_author, created_at, point_total FROM (SELECT posts.id post_id, sender_id, title, body_text, username post_author, posts.created_at created_at FROM posts INNER JOIN users ON posts.sender_id = users.id WHERE group_id = $1) a LEFT JOIN (SELECT posts_id post_id, SUM(point_value) point_total FROM points WHERE group_id = $1 GROUP BY posts_id) b ON a.post_id = b.post_id) c LEFT JOIN (SELECT post_id, COUNT(id) number_comments FROM post_comments GROUP BY post_id) d ON c.post_id = d.post_id ORDER BY created_at DESC;",
    [req.body.currentGroup]
  );
  res.send(getPostsQuery.rows);
};

// module.exports.handleGetPosts = async (req, res) => {
//   const getPostsQuery = await pool.query(
//     "SELECT c.post_id post_id, sender_id, title, body_text, post_author, created_at, coalesce(point_total,0) point_total, coalesce(number_comments,0) number_comments FROM (SELECT a.post_id post_id, sender_id, title, body_text, post_author, created_at, point_total FROM (SELECT posts.id post_id, sender_id, title, body_text, username post_author, posts.created_at created_at FROM posts INNER JOIN users ON posts.sender_id = users.id WHERE group_id = $1) a LEFT JOIN (SELECT posts_id post_id, SUM(point_value) point_total FROM points WHERE group_id = $1 GROUP BY posts_id) b ON a.post_id = b.post_id) c LEFT JOIN (select post_id, count(id) number_comments from post_comments group by post_id) d on c.post_id = d.post_id;",
//     [req.body.currentGroup]
//   );
//   res.send(getPostsQuery.rows);
// };

module.exports.handleGetPostInfo = async (req, res) => {
  const getPostInfoQuery = await pool.query(
    "SELECT title post_title, body_text, username post_author, image_url, file_url, posts.created_at iso_time_sent FROM posts INNER JOIN users ON posts.sender_id = users.id WHERE posts.id=$1;",
    [req.body.currentPost]
  );

  if (getPostInfoQuery.rows[0].file_url != null) {
    const parts = getPostInfoQuery.rows[0].file_url.split("upload/");
    const jpgPart2 = parts[2].split(".pdf");
    const publicId = "image/upload/" + jpgPart2[0];

    // Configure Cloudinary with your credentials
    cloudinary.config({
      cloud_name: "dvvdc9evd",
      api_key: "971765162862783",
      api_secret: "QeLPD1CnHJU05WGP8j0GtIryHEw",
    });

    // Function to get metadata from public id
    function getPdfMetadata(publicId) {
      return new Promise((resolve, reject) => {
        cloudinary.api.resource(publicId, { pages: true }, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result.pages);
          }
        });
      });
    }

    getPdfMetadata(publicId)
      .then((pages) => {
        let filePages = pages;
        res.send({ ...getPostInfoQuery.rows[0], filePages: filePages });
      })
      .catch((error) => {
        //   console.error("Error:", error);
        res.send({
          ...getPostInfoQuery.rows[0],
          filePages: null,
          error: error,
        });
      });
  } else {
    res.send({ ...getPostInfoQuery.rows[0], filePages: null });
  }
};

module.exports.handleGetGroupInfo = async (req, res) => {
  // const getGroupInfoQuery = await pool.query(
  //   "SELECT name groupname, description, is_public, participants.user_id admin_id FROM groups LEFT JOIN participants ON groups.id = participants.group_id WHERE groups.id=$1 and participants.is_admin=true;",
  //   [req.body.currentGroup]
  // );
  const getGroupInfoQuery = await pool.query(
    `SELECT name AS groupname, 
            description, 
            is_public, 
            COALESCE(participants.user_id, 'deleted') AS admin_id 
     FROM groups 
     LEFT JOIN participants ON groups.id = participants.group_id 
     AND participants.is_admin = true 
     WHERE groups.id = $1;`,
    [req.body.currentGroup]
  );
  res.send(getGroupInfoQuery.rows[0]);
};

module.exports.handleCreateComment = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const newPostQuery = await pool.query(
          "INSERT INTO post_comments(comment_text, sender_id, post_id) values($1,$2,$3) RETURNING id",
          [req.body.mycomment, userID, req.body.currentPost]
        );

        res.json({
          ...req.body,
          status: "Comment successfully created",
        });
      } catch (error) {
        console.error("Error creating comment: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleGetPostComments = async (req, res) => {
  const getPostCommentsQuery = await pool.query(
    "SELECT a.sender_username, a.post_comment_id, a.sender_id, a.comment_text, a.comment_iso_time_sent, coalesce(b.count,0) comment_points FROM (SELECT username sender_username, post_comments.id post_comment_id, sender_id, comment_text, post_comments.created_at comment_iso_time_sent FROM post_comments INNER JOIN users ON post_comments.sender_id = users.id WHERE post_id = $1 ORDER BY post_comments.created_at DESC) a LEFT JOIN (SELECT COUNT(point_value), comment_id FROM points WHERE group_id = $2 GROUP BY comment_id) b ON a.post_comment_id = b.comment_id;",
    [req.body.currentPost, req.body.currentGroup]
  );

  res.send(getPostCommentsQuery.rows);
};

module.exports.handleAddPostPoint = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const pointGiven = await points.sum("point_value", {
          where: {
            giver_id: userID,
            posts_id: req.body.currentPost,
          },
        });

        const post = await posts.findByPk(req.body.currentPost);
        const recipient_id = post.sender_id;

        if (pointGiven === null || pointGiven === 0) {
          await points.create({
            recipient_id,
            giver_id: userID,
            posts_id: req.body.currentPost,
            group_id: req.body.currentGroup,
            created_at: currentDate.getTime(),
            updated_at: currentDate.getTime(),
          });

          res.json({
            ...req.body,
            status: "added a point",
          });
        } else {
          await points.destroy({
            where: {
              giver_id: userID,
              posts_id: req.body.currentPost,
            },
          });

          res.json({
            ...req.body,
            status: "deleted a point",
          });
        }
      } catch (error) {
        console.error("Error adding post point: ", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleAddMessagePoint = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const pointGiven = await points.sum("point_value", {
          where: {
            giver_id: userID,
            messages_id: req.body.message_id,
          },
        });

        const message = await messages.findOne({
          where: {
            id: req.body.message_id,
          },
        });
        const recipient_id = message.sender_id;

        if (pointGiven === null || pointGiven === 0) {
          await points.create({
            recipient_id,
            giver_id: userID,
            messages_id: req.body.message_id,
            group_id: req.body.currentGroup,
            created_at: currentDate.getTime(),
            updated_at: currentDate.getTime(),
          });
        } else {
          await points.destroy({
            where: {
              giver_id: userID,
              messages_id: req.body.message_id,
            },
          });
        }

        res.json({
          ...req.body,
          status: "added a point",
        });
      } catch (error) {
        console.error("Error adding message point:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleAddCommentPoint = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const pointGiven = await pool.query(
          "SELECT SUM(point_value) FROM points WHERE giver_id = $1 and comment_id = $2",
          [userID, req.body.comment_id]
        );

        const getRecipientId = await pool.query(
          "SELECT sender_id FROM post_comments WHERE id = $1;",
          [req.body.comment_id]
        );

        const recipient_id = getRecipientId.rows[0].sender_id;

        if (pointGiven.rows[0].sum == null) {
          const newCommentPoint = await pool.query(
            "INSERT INTO points(recipient_id, giver_id, comment_id, group_id) values($1,$2,$3,$4);",
            [recipient_id, userID, req.body.comment_id, req.body.currentGroup]
          );
        } else {
          const deleteCommentPoint = await pool.query(
            "DELETE FROM points WHERE giver_id = $1 AND comment_id = $2;",
            [userID, req.body.comment_id]
          );
        }

        res.json({
          ...req.body,
          status: "added a point",
        });
      } catch (error) {
        console.error("Error adding comment point:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.handleGetPostPoints = async (req, res) => {
  const getPostPoints = await pool.query(
    "SELECT SUM(point_value) FROM points WHERE posts_id = $1;",
    [req.body.currentPost]
  );

  if (getPostPoints.rows[0].sum == null) {
    postPoints = "0";
  } else {
    postPoints = getPostPoints.rows[0].sum;
  }

  res.send(postPoints);
};

module.exports.handleGetUserPoints = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const getUsername = await pool.query(
          "SELECT username FROM users WHERE id = $1;",
          [userID]
        );

        const username = getUsername.rows[0].username;
        const getUserPoints = await pool.query(
          "SELECT SUM(point_value) FROM points WHERE recipient_id = $1;",
          [userID]
        );

        if (getUserPoints.rows[0].sum == null) {
          userPoints = "0";
        } else {
          userPoints = getUserPoints.rows[0].sum;
        }
        res.send({ username: username, userPoints: userPoints });
      } catch (error) {
        console.error("Error getting user points:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.getCommentLikes = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const getLikesQuery = await pool.query(
          "SELECT comment_id FROM points WHERE giver_id = $1 AND group_id = $2;",
          [userID, req.body.currentGroup]
        );
        res.send(getLikesQuery.rows);
      } catch (error) {
        console.error("Error getting comment likes:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.getPostLiked = async (req, res) => {
  // Use getJwt to get the token from either cookies or the Authorization header
  const token = getJwt(req);

  // Check if token is available
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  // Now verify the token
  jwtVerify(token, process.env.JWT_SECRET)
    // jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      try {
        const postId = req.body.currentPost;
        const userId = userID;

        const likedRecord = await points.findOne({
          where: {
            giver_id: userId,
            posts_id: postId,
          },
        });

        res.send(likedRecord !== null);
      } catch (error) {
        console.error("Error getting post liked:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};
