const pool = require("../db");
const { jwtVerify, getJwt } = require("./jwt/jwtAuth");
const cloudinary = require("cloudinary").v2;
const { checkAwardsForUser } = require("./awardService");
const { recordActivity } = require("../services/statsUpdateService");
const { triggerPostTagging } = require("../services/aiQueueService");
const { getTemporaryDownloadUrl } = require("./fileController");
const { openai } = require("../utils/llamaClient");
const { isExpoPushToken, sendExpoPush } = require("../utils/expoPush");

const { sequelize, Sequelize, DataTypes } = require("../config/database");
const { Op } = require("sequelize");

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
  awards,
  user_awards,
  user_sessions,
  user_session_totals,
  weekly_takeaway_schedules,
  weekly_takeaway_schedule_runs,
  scheduled_posts,
} = require("../models/init-models")(sequelize, DataTypes);

const bcrypt = require("bcrypt");
const currentDate = new Date();
const { DateTime } = require("luxon");

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
        console.log("Creating group with user:", userID);
        console.log("Created group id:", newGroup.id);  

        const seederMessage = await messages.create({
          group_id: newGroup.id,
          sender_id: "05df1721-e456-4f8c-b474-d7b49bc93044", // Local admin
          text: "Welcome to your group’s Chat! This is your space for informal, ongoing conversations. Get to know your group members, ask quick questions, and keep the energy alive. Want to kick things off with a subject-related joke?",
          created_at: currentDate.getTime(),
          updated_at: currentDate.getTime(),
        });

        const seededPost = await posts.create({
          sender_id: "05df1721-e456-4f8c-b474-d7b49bc93044", // Local admin
          group_id: newGroup.id,
          title: "Welcome to Threads! Click here for more info",
          body_text:
            "This is a Post. Use this space to ask questions, share resources, or offer helpful tips. Posts are perfect for starting deeper conversations that everyone in the group can see and respond to. Try asking about a tricky concept from class or sharing a study strategy that’s working well for you!",
          created_at: currentDate.getTime(),
          updated_at: currentDate.getTime(),
        });

        const seededComment = await post_comments.create({
          sender_id: "05df1721-e456-4f8c-b474-d7b49bc93044", // Local admin
          post_id: seededPost.id,
          comment_text:
            "This is a Post Comment. It can be an answer to the question in the Post or any other helpful response. See the plus signs next to Posts and Comments? You can click the + to reward helpful contributions with a point!",
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
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "An error occurred during group invite" });
    }
  });
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
          console.error("No participants found for the group.");
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

    // 📈 Record points in Redis for analytics
    recordActivity({
      userId: task.user_id,
      groupId: task.group_id,
      statDate: new Date().toISOString().split("T")[0],
      increments: { points: parseInt(taskPoints.point_value) },
    }).catch((err) =>
      console.error("Redis analytics error (task points):", err)
    );

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

module.exports.getWonCertificates = async (req, res) => {
  // 1) extract and verify token
  const token = getJwt(req);
  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  jwtVerify(token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;

      try {
        // 2) fetch all awards this user has earned, across all groups
        const certs = await user_awards.findAll({
          where: { user_id: userID },
          include: [
            { model: awards, attributes: ["id", "title"] },
            { model: groups, attributes: ["id", "name"] },
          ],
          order: [["created_at", "DESC"]],
        });

        // 3) normalize for the front-end
        const result = certs.map((ua) => ({
          award_id: ua.award_id,
          title: ua.award.title,
          group_id: ua.group.id,
          group_name: ua.group.name,
        }));

        res.json(result);
      } catch (err) {
        console.error("Error fetching won certificates:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch((err) => {
      console.error("JWT verification failed:", err);
      res.status(403).json({ error: "Invalid or expired token" });
    });
};

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
        const lastActivity = Sequelize.literal(`
(
  SELECT MAX(ts) FROM (
    SELECT LEAST(m.created_at, now()::timestamp) AS ts
      FROM messages m WHERE m.group_id = "groups"."id"
    UNION ALL
    SELECT LEAST(p.created_at, now()::timestamp) AS ts
      FROM posts p WHERE p.group_id = "groups"."id"
    UNION ALL
    SELECT LEAST(pc.created_at, now()::timestamp) AS ts
      FROM post_comments pc
      JOIN posts p2 ON p2.id = pc.post_id
     WHERE p2.group_id = "groups"."id"
    UNION ALL
    SELECT LEAST("groups"."updated_at", now()::timestamp)
    UNION ALL
    SELECT LEAST("groups"."created_at", now()::timestamp)
  ) x
)
`);

        const myGroups = await groups.findAll({
          attributes: [
            "invite_passcode",
            ["id", "group_id"],
            "name",
            "description",
            [lastActivity, "last_activity"],
          ],
          include: [
            {
              model: participants,
              where: { user_id: userID },
              attributes: ["user_id"],
              required: true,
            },
          ],
          order: [[lastActivity, "DESC"]],
          //    order: [[Sequelize.literal("participants.created_at"), "DESC"]],
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
      if (!groupID) {
        console.error("groupID is missing");
        return res
          .status(400)
          .json({ error: "Missing group_id in request body" });
      }
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
          file_name: req.body.fileName || null,
          sender_id: userID,
          //  group_id: req.params.group_id,
          group_id: groupID, // ✅ fixed
          tagging_status: 'pending', // 🤖 AI tagging status
          created_at: currentDate.getTime(),
          updated_at: currentDate.getTime(),
        });

        // 🤖 Trigger AI Tagging via SQS
        // triggerPostTagging(newPost.id).catch(err => console.error("AI Tagging trigger error:", err));

        // 📈 Record post in Redis for analytics
        recordActivity({
          userId: userID,
          groupId: groupID,
          statDate: new Date().toISOString().split('T')[0],
          increments: { posts: 1 }
        }).catch(err => console.error("Redis analytics error (post):", err));

        const postId = newPost.id;
        // Fetch the group details to get the group name
        const group = await groups.findOne({
          where: { id: groupID },
        });

        // If it's the user's first post in this group
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

          // Create a notification for the user
          await notifications.create({
            message: `Great work on publishing your first post in "${group.name}". Keep participating to earn an award!`,
            user_id: userID,
            is_read: false,
            created_at: currentDate.getTime(),
            updated_at: currentDate.getTime(),
            // created_at: currentDate,
          });
        }

        const user = await users.findOne({
          where: { id: userID },
          attributes: ["username"],
        });

        const members = await participants.findAll({
          where: { group_id: groupID },
          attributes: ["user_id"],
        });
        const groupMembers = members.map((m) => m.user_id);

        for (const memberId of groupMembers) {
          if (memberId !== userID) {
            try {
              await notifications.create({
                message: `New post was created by ${user.username} in "${group.name}"`,
                user_id: memberId,
                type: "post",
                post_id: postId,
                is_read: false,
                created_at: currentDate.getTime(),
                updated_at: currentDate.getTime(),
              });
            } catch (e) {
              console.error(`[push] failed to create in-app notification: `, e);
            }
            // push (use the member's token, not author)
            let recipient;

            try {
              recipient = await users.findOne({
                where: { id: memberId },
                attributes: ["push_notification_token"],
              });
            } catch (e) {
              console.error(`[push] failed to fetch recipient ${memberId}:`, e);
              continue;
            }
            const pushToken = recipient?.push_notification_token;

            if (!pushToken) {
              console.warn(`[push] no push token for user`);
              continue;
            }

            if (pushToken && isExpoPushToken(pushToken)) {
              await sendExpoPush({
                to: pushToken,
                sound: "default",
                title: "New post",
                body: `New post from ${user.username} in "${group.name}"`,
                data: {
                  type: "new_post",
                  groupId: groupID,
                  postId: newPost.id,
                },
                channelId: "default",
              });
            }
          }
        }

        // 🚀 Trigger AI processing flow (Asynchronous Lambda trigger via SQS)
        if (user.username !== "Cuubi") {
          await triggerPostTagging(newPost.id).catch(err => 
            console.error("Failed to trigger AI tagging:", err)
          );
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

// Helper to sign S3 URLs for frontend display
const signS3Urls = async (row) => {
  if (!row) return row;
  if (row.image_url && row.image_url.includes("amazonaws.com")) {
    try {
      const urlObj = new URL(row.image_url);
      const key = urlObj.pathname.startsWith("/")
        ? urlObj.pathname.substring(1)
        : urlObj.pathname;
      row.image_url = await getTemporaryDownloadUrl(key);
    } catch (e) {
      console.error("Error signing image_url:", e);
    }
  }
  if (row.file_url && row.file_url.includes("amazonaws.com")) {
    try {
      const urlObj = new URL(row.file_url);
      const key = urlObj.pathname.startsWith("/")
        ? urlObj.pathname.substring(1)
        : urlObj.pathname;
      row.file_url = await getTemporaryDownloadUrl(key);
    } catch (e) {
      console.error("Error signing file_url:", e);
    }
  }
  return row;
};

module.exports.handleGetPosts = async (req, res) => {
  try {
    const getPostsQuery = await pool.query(
      `SELECT c.post_id,
              sender_id,
              title,
              body_text,
              post_author,
              created_at,
              image_url,
              file_url,
              file_name,
              COALESCE(point_total, 0) AS point_total,
              COALESCE(number_comments, 0) AS number_comments
       FROM (
         SELECT a.post_id, sender_id, title, body_text, post_author, created_at, image_url, file_url, file_name, point_total 
         FROM (
           SELECT posts.id AS post_id, sender_id, title, body_text, username AS post_author, posts.created_at, image_url, file_url, file_name 
           FROM posts 
           INNER JOIN users ON posts.sender_id = users.id 
           WHERE group_id = $1
         ) a 
         LEFT JOIN (
           SELECT posts_id, SUM(point_value) AS point_total 
           FROM points 
           WHERE group_id = $1 
           GROUP BY posts_id
         ) b ON a.post_id = b.posts_id
       ) c 
       LEFT JOIN (
         SELECT post_id, COUNT(id) AS number_comments 
         FROM post_comments 
         GROUP BY post_id
       ) d ON c.post_id = d.post_id 
       ORDER BY created_at DESC;`,
      [req.body.currentGroup]
    );

    const rows = await Promise.all(
      getPostsQuery.rows.map((row) => signS3Urls(row))
    );
    console.log(
      `[handleGetPosts] Returning ${rows.length} posts for group ${req.body.currentGroup}`
    );
    res.send(rows);
  } catch (err) {
    console.error("Error in handleGetPosts:", err);
    res.status(500).send({ error: "Internal server error" });
  }
};

// module.exports.handleGetPosts = async (req, res) => {
//   const getPostsQuery = await pool.query(
//     "SELECT c.post_id post_id, sender_id, title, body_text, post_author, created_at, coalesce(point_total,0) point_total, coalesce(number_comments,0) number_comments FROM (SELECT a.post_id post_id, sender_id, title, body_text, post_author, created_at, point_total FROM (SELECT posts.id post_id, sender_id, title, body_text, username post_author, posts.created_at created_at FROM posts INNER JOIN users ON posts.sender_id = users.id WHERE group_id = $1) a LEFT JOIN (SELECT posts_id post_id, SUM(point_value) point_total FROM points WHERE group_id = $1 GROUP BY posts_id) b ON a.post_id = b.post_id) c LEFT JOIN (select post_id, count(id) number_comments from post_comments group by post_id) d on c.post_id = d.post_id;",
//     [req.body.currentGroup]
//   );
//   res.send(getPostsQuery.rows);
// };

module.exports.handleGetPostInfo = async (req, res) => {
  try {
    const getPostInfoQuery = await pool.query(
      `SELECT title AS post_title, body_text, username AS post_author, avatar_url, image_url, file_url, file_name, posts.created_at AS iso_time_sent FROM posts INNER JOIN users ON posts.sender_id = users.id WHERE posts.id = $1;`,
      [req.body.currentPost]
    );

    if (getPostInfoQuery.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    let postData = getPostInfoQuery.rows[0];

    // ☁️ If it's a Cloudinary PDF file, try to get the page count (keep legacy logic for compatibility)
    if (
      postData.file_url &&
      postData.file_url.includes("cloudinary.com") &&
      postData.file_url.includes(".pdf")
    ) {
      try {
        const parts = postData.file_url.split("upload/");
        if (parts.length >= 3) {
          const jpgPart2 = parts[2].split(".pdf");
          const publicId = "image/upload/" + jpgPart2[0];

          cloudinary.config({
            cloud_name: "dvvdc9evd",
            api_key: "971765162862783",
            api_secret: "QeLPD1CnHJU05WGP8j0GtIryHEw",
          });

          const result = await new Promise((resolve, reject) => {
            cloudinary.api.resource(
              publicId,
              { pages: true },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
          });

          return res.send({ ...postData, filePages: result.pages });
        }
      } catch (cloudinaryErr) {
        console.error("Cloudinary metadata error:", cloudinaryErr);
      }
    }

    // 📦 If it's an S3 file, sign the URL
    postData = await signS3Urls(postData);

    console.log(
      `[handleGetPostInfo] Returning post ${
        req.body.currentPost
      } with image_url: ${
        postData.image_url
          ? postData.image_url.substring(0, 50) + "..."
          : "null"
      }`
    );

    res.send({ ...postData, filePages: null });
  } catch (err) {
    console.error("Error in handleGetPostInfo:", err);
    res.status(500).json({ error: "Internal server error" });
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
            COALESCE(participants.user_id::text, 'deleted') AS admin_id 
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
      const postId = req.body.currentPost;
      try {
        const newPostQuery = await pool.query(
          "INSERT INTO post_comments(comment_text, sender_id, post_id) values($1,$2,$3) RETURNING id",
          [req.body.mycomment, userID, postId]
        );

        // look up the post's author & group - sender_id is the id of the post author
        const {
          rows: [postRow],
        } = await pool.query(
          `SELECT sender_id, group_id
             FROM posts
            WHERE id = $1`,
          [postId]
        );

        // 1. get the id of the post author

        // 2. check and make sure the sender _Id and post_author id are not the same

        // 3. if they're not the same, send a notification to the post author id that they
        // got a comment to their post in the group with group id

        // kick off award checks in parallel (don't await)
        // 1) the commenter may have just unlocked Communication / Reliability
        checkAwardsForUser(userID, postRow.group_id).catch(console.error);

        // 2) the post’s author may have just unlocked Leadership
        checkAwardsForUser(postRow.sender_id, postRow.group_id).catch(
          console.error
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
    // "SELECT a.sender_username, a.post_comment_id, a.sender_id, a.comment_text, a.comment_iso_time_sent, coalesce(b.count,0) comment_points FROM (SELECT username sender_username, post_comments.id post_comment_id, sender_id, comment_text, post_comments.created_at comment_iso_time_sent FROM post_comments INNER JOIN users ON post_comments.sender_id = users.id WHERE post_id = $1 ORDER BY post_comments.created_at DESC) a LEFT JOIN (SELECT COUNT(point_value), comment_id FROM points WHERE group_id = $2 GROUP BY comment_id) b ON a.post_comment_id = b.comment_id;",
    `SELECT a.sender_username, a.sender_avatar_url, a.post_comment_id, a.sender_id, a.comment_text, a.comment_iso_time_sent, coalesce(b.count,0) comment_points FROM (SELECT username sender_username, users.avatar_url  AS sender_avatar_url, post_comments.id post_comment_id, sender_id, comment_text, post_comments.created_at comment_iso_time_sent FROM post_comments INNER JOIN users ON post_comments.sender_id = users.id WHERE post_id = $1 ORDER BY post_comments.created_at DESC) a LEFT JOIN (SELECT COUNT(point_value), comment_id FROM points WHERE group_id = $2 GROUP BY comment_id) b ON a.post_comment_id = b.comment_id;`,
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

          // 📈 Record points in Redis for analytics
          recordActivity({
            userId: recipient_id,
            groupId: req.body.currentGroup,
            statDate: new Date().toISOString().split("T")[0],
            increments: { points: 1 },
          }).catch((err) =>
            console.error("Redis analytics error (post point):", err)
          );

          if (
            recipient_id !== userID &&
            (pointGiven === null || pointGiven === 0)
          ) {
            const currentDate = new Date();
            const giverUser = await users.findOne({
              where: { id: userID },
              attributes: ["username"],
            });

            const group = await groups.findOne({
              where: { id: req.body.currentGroup },
              attributes: ["name"],
            });

            const giverUsername = giverUser.username;
            const groupName = group.name;
            await notifications.create({
              message: `You received a point on your post from ${giverUsername} in ${groupName}!`,
              user_id: recipient_id,
              is_read: false,
              created_at: currentDate.getTime(),
              updated_at: currentDate.getTime(),
            });

            // Push notification
            try {
              const recipient = await users.findOne({
                where: { id: recipient_id },
                attributes: ["push_notification_token"],
              });

              const pushToken = recipient?.push_notification_token;

              if (!pushToken) {
                console.warn(`[push] no push token for user`);
              } else if (!isExpoPushToken(pushToken)) {
                console.warn(`[push] invalid Expo token for user`);
              } else {
                await sendExpoPush({
                  to: pushToken,
                  sound: "default",
                  title: "You earned a point 🎉",
                  body: `From ${giverUsername} in "${groupName}".`,
                  data: {
                    type: "point_received",
                    groupId: req.body.currentGroup,
                    postId: req.body.currentPost, // ← replace with your actual post id var if different
                  },
                  channelId: "default",
                });
              }
            } catch (e) {
              console.error(`[push] send failed for ${recipient_id}:`, e);
            }
          }
          // Award checks
          checkAwardsForUser(recipient_id, req.body.currentGroup).catch(
            console.error
          );
          checkAwardsForUser(userID, req.body.currentGroup).catch(
            console.error
          );

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

          // 📈 Record points in Redis for analytics
          recordActivity({
            userId: recipient_id,
            groupId: req.body.currentGroup,
            statDate: new Date().toISOString().split("T")[0],
            increments: { points: 1 },
          }).catch((err) =>
            console.error("Redis analytics error (message point):", err)
          );
        }
        if (
          recipient_id !== userID &&
          (pointGiven === null || pointGiven === 0)
        ) {
          const currentDate = new Date();
          const giverUser = await users.findOne({
            where: { id: userID },
            attributes: ["username"],
          });

          const group = await groups.findOne({
            where: { id: req.body.currentGroup },
            attributes: ["name"],
          });
          const giverUsername = giverUser.username;
          const groupName = group.name;
          await notifications.create({
            message: `You received a point on your message from ${giverUsername} in ${groupName}!`,
            user_id: recipient_id,
            is_read: false,
            created_at: currentDate.getTime(),
            updated_at: currentDate.getTime(),
          });

          // Push notification
          try {
            const recipient = await users.findOne({
              where: { id: recipient_id },
              attributes: ["push_notification_token"],
            });

            const pushToken = recipient?.push_notification_token;

            if (!pushToken) {
              console.warn(`[push] no push token for user`);
            } else if (!isExpoPushToken(pushToken)) {
              console.warn(`[push] invalid Expo token for user`);
            } else {
              await sendExpoPush({
                to: pushToken,
                sound: "default",
                title: "You earned a point 🎉",
                body: `From ${giverUsername} for your chat message in "${groupName}".`,
                data: {
                  type: "point_received",
                  groupId: req.body.currentGroup,
                  postId: req.body.currentPost,
                },
                channelId: "default",
              });
            }
          } catch (e) {
            console.error(`[push] send failed for ${recipient_id}:`, e);
          }
        }
        // Award checks
        checkAwardsForUser(recipient_id, req.body.currentGroup).catch(
          console.error
        );
        checkAwardsForUser(userID, req.body.currentGroup).catch(console.error);

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
        }
        if (
          recipient_id !== userID &&
          (pointGiven.rows[0].sum === null || pointGiven.rows[0].sum === 0)
        ) {
          const currentDate = new Date();
          const giverUser = await users.findOne({
            where: { id: userID },
            attributes: ["username"],
          });

          const group = await groups.findOne({
            where: { id: req.body.currentGroup },
            attributes: ["name"],
          });

          const giverUsername = giverUser.username;
          const groupName = group.name;

          await notifications.create({
            message: `You received a point on your comment from ${giverUsername} in ${groupName}`,
            user_id: recipient_id,
            is_read: false,
            created_at: currentDate.getTime(),
            updated_at: currentDate.getTime(),
          });
          // Push notification
          try {
            const recipient = await users.findOne({
              where: { id: recipient_id },
              attributes: ["push_notification_token"],
            });

            const pushToken = recipient?.push_notification_token;

            if (!pushToken) {
              console.warn(`[push] no push token for user`);
            } else if (!isExpoPushToken(pushToken)) {
              console.warn(`[push] invalid Expo token for user`);
            } else {
              await sendExpoPush({
                to: pushToken,
                sound: "default",
                title: "You earned a point 🎉",
                body: `From ${giverUsername} for your comment in "${groupName}".`,
                data: {
                  type: "point_received",
                  groupId: req.body.currentGroup,
                  postId: req.body.currentPost,
                },
                channelId: "default",
              });
            }
          } catch (e) {
            console.error(`[push] send failed for ${recipient_id}:`, e);
          }
        } else {
          const deleteCommentPoint = await pool.query(
            "DELETE FROM points WHERE giver_id = $1 AND comment_id = $2;",
            [userID, req.body.comment_id]
          );
        }
        checkAwardsForUser(recipient_id, req.body.currentGroup).catch(
          console.error
        );
        checkAwardsForUser(userID, req.body.currentGroup).catch(console.error);

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
        const postId = parseInt(req.body.currentPost);
        if (isNaN(postId)) {
          console.error(
            "[getPostLiked] Invalid postId received:",
            req.body.currentPost
          );
          return res.status(400).json({ error: "Invalid post ID" });
        }
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
module.exports.handleCreateScheduledPost = async (
  req,
  res
) => {
  const token = getJwt(req);

  if (!token) {
    return res.status(401).json({
      error: "JWT token is required",
    });
  }

  try {
    const decoded = await jwtVerify(
      token,
      process.env.JWT_SECRET
    );

    const creatorID = decoded.id;
    const groupID = Number(req.params.group_id);

    if (!Number.isInteger(groupID)) {
      return res.status(400).json({
        error: "Invalid group_id",
      });
    }

    const group = await groups.findByPk(groupID);

    if (!group) {
      return res.status(404).json({
        error: "Group not found",
      });
    }

    const {
      title,
      body_text,
      scheduled_date,
      scheduled_time,
      timezone,
      image_url,
      file_url,
      file_name,
    } = req.body;

    console.log(
      "Create scheduled post request:",
      req.body
    );

    /*
     * Interpret the selected date and time in the
     * timezone selected by the admin.
     */
    const localScheduledDateTime =
      DateTime.fromISO(
        `${scheduled_date}T${scheduled_time}`,
        {
          zone: timezone,
        }
      );

    if (!localScheduledDateTime.isValid) {
      return res.status(400).json({
        error:
          "Invalid scheduled date, time, or timezone",
      });
    }

    const scheduledAtUtc =
      localScheduledDateTime.toUTC();

    if (scheduledAtUtc <= DateTime.utc()) {
      return res.status(400).json({
        error:
          "Scheduled time must be in the future",
      });
    }

    const scheduledPost =
      await scheduled_posts.create({
        creator_id: creatorID,
        group_id: groupID,
        title: title.trim(),
        body_text: body_text.trim(),
        image_url: req.body.image_url || null,
  file_url: req.body.file_url || null,
  file_name: req.body.file_name || null,
        scheduled_date,
        scheduled_time,
        timezone,
        scheduled_at:
          scheduledAtUtc.toJSDate(),
        status: "pending",
      });
      console.log("Create scheduled post request:", {
        title,
        body_text,
        scheduled_date,
        scheduled_time,
        timezone,
        image_url,
        file_url,
        file_name,
      });

    console.log(
      "Scheduled post created:",
      {
        id: scheduledPost.id,
        groupID,
        creatorID,
        localTime:
          localScheduledDateTime.toISO(),
        utcTime: scheduledAtUtc.toISO(),
      }
    );

    return res.status(201).json({
      message:
        "Post scheduled successfully",
      scheduledPost,
    });
  } catch (error) {
    console.error(
      "Create scheduled post error:",
      error
    );

    return res.status(500).json({
      error: "Unable to schedule post",
    });
  }
};
module.exports.handleGetScheduledPosts = async (req, res) => {
  const token = getJwt(req);

  if (!token) {
    return res.status(401).json({
      error: "JWT token is required",
    });
  }

  try {
    await jwtVerify(token, process.env.JWT_SECRET);

    const groupID = Number(req.params.group_id);

    if (!Number.isInteger(groupID)) {
      return res.status(400).json({
        error: "Invalid group_id",
      });
    }

    const group = await groups.findByPk(groupID);

    if (!group) {
      return res.status(404).json({
        error: "Group not found",
      });
    }

    const scheduledPosts = await scheduled_posts.findAll({
      where: {
        group_id: groupID,
        status: "pending",
        scheduled_at: {
          [Op.gt]: new Date(),
        },
      },
      order: [["scheduled_at", "ASC"]],
    });

    return res.status(200).json({
      scheduledPosts,
    });
  } catch (error) {
    console.error("Get scheduled posts error:", error);

    return res.status(500).json({
      error: "Unable to load scheduled posts",
    });
  }
};
module.exports.handleGetAllScheduledPosts = async (req, res) => {
  const token = getJwt(req);

  if (!token) {
    return res.status(401).json({
      error: "JWT token is required",
    });
  }

  try {
    await jwtVerify(token, process.env.JWT_SECRET);

    const groupID = Number(req.params.group_id);

    if (!Number.isInteger(groupID)) {
      return res.status(400).json({
        error: "Invalid group_id",
      });
    }

    const scheduledPosts = await scheduled_posts.findAll({
      where: {
        group_id: groupID,
      },
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      scheduledPosts,
    });
  } catch (error) {
    console.error("Get all scheduled posts error:", error);

    return res.status(500).json({
      error: "Unable to load scheduled posts",
    });
  }
};
module.exports.handleCreateWeeklyTakeawaySchedule = async (req, res) => {
  const token = getJwt(req);

  if (!token) {
    return res.status(401).json({
      error: "JWT token is required",
    });
  }

  try {
    const decoded = await jwtVerify(token, process.env.JWT_SECRET);

    const creatorID = decoded.id;
    const groupID = Number(req.params.group_id);

    if (!Number.isInteger(groupID)) {
      return res.status(400).json({
        error: "Invalid group_id",
      });
    }

    const group = await groups.findByPk(groupID);

    if (!group) {
      return res.status(404).json({
        error: "Group not found",
      });
    }
    console.log("Controller req.body:", req.body);
    console.log("Controller scheduled_time:", req.body.scheduled_time);

    const schedule = await weekly_takeaway_schedules.create({
      creator_id: creatorID,
      group_id: groupID,
      start_date: req.body.start_date,
      end_date: req.body.end_date,
      day_of_week: req.body.day_of_week,
      timezone: req.body.timezone || "America/Los_Angeles",
      scheduled_time: req.body.scheduled_time,
      title: req.body.title,
      body_text: req.body.body_text,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.status(201).json({
      status: "Weekly takeaway schedule created",
      schedule,
    });
  } catch (error) {
    console.error("Error creating weekly takeaway schedule:", error);

    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        error: "Invalid or expired JWT token",
      });
    }

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};
module.exports.handleUpdateScheduledPost = async (
  req,
  res
) => {
  const token = getJwt(req);

  if (!token) {
    return res.status(401).json({
      error: "JWT token is required",
    });
  }

  try {
    await jwtVerify(
      token,
      process.env.JWT_SECRET
    );

    const groupID = Number(
      req.params.group_id
    );

    const scheduledPostID = Number(
      req.params.scheduled_post_id
    );

    if (
      !Number.isInteger(groupID) ||
      !Number.isInteger(scheduledPostID)
    ) {
      return res.status(400).json({
        error:
          "Invalid group or scheduled post id",
      });
    }

    /*
     * 必須先宣告 request body 裡的值，
     * 後面才能使用 title、scheduled_time 等變數。
     */
    const {
      title,
      body_text,
      scheduled_date,
      scheduled_time,
      timezone,
      image_url,
      file_url,
      file_name,
    } = req.body;

    console.log(
      "Update scheduled post request:",
      {
        title,
        body_text,
        scheduled_date,
        scheduled_time,
        timezone,
        image_url,
        file_url,
        file_name,
      }
    );

    const scheduledPost =
      await scheduled_posts.findOne({
        where: {
          id: scheduledPostID,
          group_id: groupID,
        },
      });

    if (!scheduledPost) {
      return res.status(404).json({
        error: "Scheduled post not found",
      });
    }

    if (scheduledPost.status !== "pending") {
      return res.status(409).json({
        error:
          "Only pending scheduled posts can be edited",
      });
    }

    const localScheduledDateTime =
      DateTime.fromISO(
        `${scheduled_date}T${scheduled_time}`,
        {
          zone: timezone,
        }
      );

    if (!localScheduledDateTime.isValid) {
      return res.status(400).json({
        error:
          "Invalid scheduled date, time, or timezone",
      });
    }

    const scheduledAtUtc =
      localScheduledDateTime.toUTC();

    if (scheduledAtUtc <= DateTime.utc()) {
      return res.status(400).json({
        error:
          "Scheduled time must be in the future",
      });
    }

    /*
     * 現在 title、body_text、scheduledAtUtc
     * 都已經完成宣告，可以安全建立 updateData。
     */
    const updateData = {
      title: title.trim(),
      body_text: body_text.trim(),
      scheduled_date,
      scheduled_time,
      timezone,
      scheduled_at:
        scheduledAtUtc.toJSDate(),
    };

    /*
     * 只有 frontend 確實傳入附件欄位時，
     * 才更新該欄位。
     *
     * 若 frontend 沒有傳，會保留資料庫原本的附件。
     * 若 frontend 傳 null 或空字串，會清除附件。
     */
    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "image_url"
      )
    ) {
      updateData.image_url =
        image_url || null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "file_url"
      )
    ) {
      updateData.file_url =
        file_url || null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "file_name"
      )
    ) {
      updateData.file_name =
        file_name || null;
    }

    console.log(
      "Scheduled post update data:",
      updateData
    );

    await scheduledPost.update(
      updateData
    );

    console.log(
      "Scheduled post updated:",
      {
        id: scheduledPost.id,
        groupID,
        localTime:
          localScheduledDateTime.toISO(),
        utcTime:
          scheduledAtUtc.toISO(),
        imageUrl:
          scheduledPost.image_url,
        fileUrl:
          scheduledPost.file_url,
        fileName:
          scheduledPost.file_name,
      }
    );

    return res.status(200).json({
      message:
        "Scheduled post updated successfully",
      scheduledPost,
    });
  } catch (error) {
    console.error(
      "Update scheduled post error:",
      error
    );

    console.error(
      "Update scheduled post error message:",
      error.message
    );

    return res.status(500).json({
      error:
        "Unable to update scheduled post",
      details:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
};
module.exports.handleCancelScheduledPost = async (
  req,
  res
) => {
  const token = getJwt(req);

  if (!token) {
    return res.status(401).json({
      error: "JWT token is required",
    });
  }

  try {
    await jwtVerify(
      token,
      process.env.JWT_SECRET
    );

    const groupID = Number(req.params.group_id);
    const scheduledPostID = Number(
      req.params.scheduled_post_id
    );

    if (
      !Number.isInteger(groupID) ||
      !Number.isInteger(scheduledPostID)
    ) {
      return res.status(400).json({
        error: "Invalid group or scheduled post id",
      });
    }

    const scheduledPost =
      await scheduled_posts.findOne({
        where: {
          id: scheduledPostID,
          group_id: groupID,
        },
      });

    if (!scheduledPost) {
      return res.status(404).json({
        error: "Scheduled post not found",
      });
    }

    if (scheduledPost.status !== "pending") {
      return res.status(409).json({
        error:
          "Only pending scheduled posts can be cancelled",
      });
    }

    await scheduledPost.update({
      status: "cancelled",
    });

    console.log(
      "Scheduled post cancelled:",
      {
        id: scheduledPost.id,
        groupID,
      }
    );

    return res.status(200).json({
      message:
        "Scheduled post cancelled successfully",
      scheduledPost,
    });
  } catch (error) {
    console.error(
      "Cancel scheduled post error:",
      error
    );

    return res.status(500).json({
      error:
        "Unable to cancel scheduled post",
    });
  }
};
function getNextScheduledAt(schedule) {
  const timezone = schedule.timezone || "America/Los_Angeles";

  const now = DateTime.now().setZone(timezone).setLocale("en");

  const startDate = DateTime.fromISO(schedule.start_date, {
    zone: timezone,
  }).startOf("day");

  const endDate = DateTime.fromISO(schedule.end_date, {
    zone: timezone,
  }).endOf("day");

  const [hour, minute] = schedule.scheduled_time.split(":").map(Number);

  let currentDate = now < startDate ? startDate : now.startOf("day");

  while (currentDate <= endDate) {
    const candidate = currentDate.set({
      hour,
      minute,
      second: 0,
      millisecond: 0,
    });

    const isCorrectDay = candidate.toFormat("cccc") === schedule.day_of_week;

    const isFuture = candidate > now;

    if (isCorrectDay && isFuture) {
      return candidate.toUTC().toISO();
    }

    currentDate = currentDate.plus({ days: 1 });
  }

  return null;
}

module.exports.handleGetWeeklyTakeawaySchedules = async (req, res) => {
  const token = getJwt(req);

  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  jwtVerify(token, process.env.JWT_SECRET)
    .then(async () => {
      const groupID = req.params.group_id;

      try {
        const schedules = await weekly_takeaway_schedules.findAll({
          where: {
            group_id: groupID,
            is_active: true,
          },
          order: [["created_at", "DESC"]],
        });

        const schedulesWithNextRun = schedules.map((schedule) => {
          const plainSchedule = schedule.toJSON();

          return {
            ...plainSchedule,
            next_scheduled_at: getNextScheduledAt(plainSchedule),
          };
        });

        res.json({
          schedules: schedulesWithNextRun,
        });
      } catch (error) {
        console.error("Error getting weekly takeaway schedules:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(() => {
      res.status(401).json({ token: null });
    });
};

module.exports.handleDeactivateWeeklyTakeawaySchedule = async (req, res) => {
  const token = getJwt(req);

  if (!token) {
    return res.status(401).json({ error: "JWT token is required" });
  }

  jwtVerify(token, process.env.JWT_SECRET)
    .then(async () => {
      const groupID = req.params.group_id;
      const scheduleID = req.params.schedule_id;

      try {
        const schedule = await weekly_takeaway_schedules.findOne({
          where: {
            id: scheduleID,
            group_id: groupID,
          },
        });

        if (!schedule) {
          return res.status(404).json({ error: "Schedule not found" });
        }

        await schedule.update({
          is_active: false,
          updated_at: Date.now(),
        });

        res.json({
          status: "Weekly takeaway schedule deactivated",
        });
      } catch (error) {
        console.error("Error deactivating weekly takeaway schedule:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(() => {
      res.status(401).json({ token: null });
    });
};

module.exports.handleUpdateWeeklyTakeawaySchedule = async (req, res) => {
    const token = getJwt(req);

    if (!token) {
      return res.status(401).json({
        error: "JWT token is required",
      });
    }

    jwtVerify(token, process.env.JWT_SECRET)
      .then(async () => {
        const groupID = req.params.group_id;
        const scheduleID =
          req.params.schedule_id;

        try {
          const schedule =
            await weekly_takeaway_schedules.findOne({
              where: {
                id: scheduleID,
                group_id: groupID,
                is_active: true,
              },
            });

          if (!schedule) {
            return res.status(404).json({
              error:
                "Weekly takeaway schedule not found",
            });
          }

          const {
            title,
            body_text,
            start_date,
            end_date,
            day_of_week,
            scheduled_time,
            timezone,
          } = req.body;

          await schedule.update({
            title,
            body_text,
            start_date,
            end_date,
            day_of_week,
            scheduled_time,
            timezone,
          });

          return res.status(200).json({
            status:
              "Weekly takeaway schedule updated",
            schedule,
          });
        } catch (error) {
          console.error(
            "Error updating weekly takeaway schedule:",
            error
          );

          return res.status(500).json({
            error: "Internal server error",
          });
        }
      })
      .catch(() => {
        res.status(401).json({ token: null });
      });
  };
