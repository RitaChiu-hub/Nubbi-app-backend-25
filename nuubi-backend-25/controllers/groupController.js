const pool = require("../db");
const { jwtVerify } = require("./jwt/jwtAuth");
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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

module.exports.handleCreateTask = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET).then(async (decoded) => {
    const { task, pointValue, currentGroup } = req.body;
    const userID = decoded.id;

    try {
      // Insert into the tasks table
      const result = await pool.query(
        "INSERT INTO tasks (task, point_value) VALUES ($1, $2) RETURNING id",
        [task, pointValue]
      );
      const taskId = result.rows[0].id;

      // Fetch all participant IDs for the given group
      const participantsResult = await pool.query(
        "SELECT user_id FROM participants WHERE group_id = $1",
        [currentGroup]
      );
      const participantIds = participantsResult.rows.map((row) => row.user_id);

      // Insert into the user_tasks table for each participant
      const userTasksPromises = participantIds.map((userId) => {
        return pool.query(
          "INSERT INTO user_tasks (user_id, task_id, group_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())",
          [userID, taskId, currentGroup]
        );
      });

      await Promise.all(userTasksPromises);
      res.status(201).json({
        ...req.body,
        status:
          "Task created and assigned to all group participants successfully",
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
        attributes: ["is_completed", "is_approved"],
        include: [
          {
            model: tasks,
            attributes: ["task", "point_value"],
          },
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

module.exports.getAllGroups = async (req, res) => {
  const getAllGroups = await groups.findAll({
    attributes: ["name", "description", "id"],
  });
  res.send(getAllGroups);
};

module.exports.getNotifications = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET).then(async (decoded) => {
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
  jwtVerify(req.body.token, process.env.JWT_SECRET).then(async (decoded) => {
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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

module.exports.getLeaderboard = async (req, res) => {
  const groupLeaderboardQuery = await pool.query(
    //  "WITH RankedMonths AS (SELECT EXTRACT(YEAR FROM p.updated_at) AS year, EXTRACT(MONTH FROM p.updated_at) AS month, DENSE_RANK() OVER (ORDER BY EXTRACT(YEAR FROM p.updated_at), EXTRACT(MONTH FROM p.updated_at)) AS month_rank FROM points p WHERE p.group_id = $1 GROUP BY EXTRACT(YEAR FROM p.updated_at), EXTRACT(MONTH FROM p.updated_at)), MonthlyPoints AS (SELECT EXTRACT(YEAR FROM p.updated_at) AS year, EXTRACT(MONTH FROM p.updated_at) AS month, p.recipient_id, SUM(p.point_value) AS group_total_points FROM points p WHERE p.group_id = $1 GROUP BY EXTRACT(YEAR FROM p.updated_at), EXTRACT(MONTH FROM p.updated_at), p.recipient_id), UserDetails AS (SELECT u.id AS user_id, u.username, u.email FROM users u JOIN participants p ON u.id = p.user_id WHERE p.group_id = $1) SELECT ud.user_id, ud.username, ud.email, MAX(CASE WHEN rm.month_rank = 1 THEN mp.group_total_points ELSE 0 END) AS Unit_1, MAX(CASE WHEN rm.month_rank = 2 THEN mp.group_total_points ELSE 0 END) AS Unit_2, MAX(CASE WHEN rm.month_rank = 3 THEN mp.group_total_points ELSE 0 END) AS Unit_3, MAX(CASE WHEN rm.month_rank = 4 THEN mp.group_total_points ELSE 0 END) AS Unit_4, MAX(CASE WHEN rm.month_rank = 5 THEN mp.group_total_points ELSE 0 END) AS Unit_5, MAX(CASE WHEN rm.month_rank = 6 THEN mp.group_total_points ELSE 0 END) AS Unit_6, MAX(CASE WHEN rm.month_rank = 7 THEN mp.group_total_points ELSE 0 END) AS Unit_7, MAX(CASE WHEN rm.month_rank = 8 THEN mp.group_total_points ELSE 0 END) AS Unit_8, COALESCE(SUM(mp.group_total_points), 0) AS group_total_points FROM RankedMonths rm CROSS JOIN UserDetails ud LEFT JOIN MonthlyPoints mp ON mp.year = rm.year AND mp.month = rm.month AND mp.recipient_id = ud.user_id GROUP BY ud.user_id, ud.username, ud.email ORDER BY ud.username;  ",
    "SELECT c.user_id as user_id, username, email, is_admin, coalesce(group_total_points,0) group_total_points FROM (  SELECT users.id user_id, users.username username, users.email email, participants.is_admin is_admin FROM participants INNER JOIN users ON participants.user_id = users.id WHERE participants.group_id = $1) c FULL OUTER JOIN ( SELECT user_id, recipient_id, count as group_total_points FROM (SELECT DISTINCT participants.user_id FROM participants INNER JOIN points ON participants.user_id = points.recipient_id WHERE participants.group_id = $1) a LEFT JOIN (SELECT recipient_id, count(point_value) FROM points WHERE group_id = $1 GROUP BY recipient_id) b ON a.user_id = b.recipient_id) d ON c.user_id = d.user_id ORDER BY group_total_points DESC;",
    [req.body.currentGroup]
  );

  res.send(groupLeaderboardQuery.rows);
};

module.exports.handleJoinGroup = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
            message: `Congratulations! You've been awarded the Composer Badge in the group "${group.name}" for creating your first post in that group.`,
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
  jwtVerify(req.body.token, process.env.JWT_SECRET).then(async (decoded) => {
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
      // console.log(hasUnreadNotifications);
      res.json({ hasUnreadNotifications });
    } catch (error) {
      console.error("Error checking unread notifications:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
};

module.exports.getNotificationsRead = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET).then(async (decoded) => {
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
    "SELECT c.post_id post_id, sender_id, title, body_text, post_author, created_at, coalesce(point_total,0) point_total, coalesce(number_comments,0) number_comments FROM (SELECT a.post_id post_id, sender_id, title, body_text, post_author, created_at, point_total FROM (SELECT posts.id post_id, sender_id, title, body_text, username post_author, posts.created_at created_at FROM posts INNER JOIN users ON posts.sender_id = users.id WHERE group_id = $1) a LEFT JOIN (SELECT posts_id post_id, SUM(point_value) point_total FROM points WHERE group_id = $1 GROUP BY posts_id) b ON a.post_id = b.post_id) c LEFT JOIN (select post_id, count(id) number_comments from post_comments group by post_id) d on c.post_id = d.post_id;",
    [req.body.currentGroup]
  );
  res.send(getPostsQuery.rows);
};

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
    //const pdfPublicId = "image/upload/jsyo8yxcr5vpwrcobqui";

    getPdfMetadata(publicId)
      .then((pages) => {
        //   console.log(`The PDF has ${pages} pages.`);
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
          [req.body.mycomment, userID, req.params.post_id]
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
    [req.params.post_id, req.body.currentGroup]
  );

  res.send(getPostCommentsQuery.rows);
};

module.exports.handleAddPostPoint = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
  jwtVerify(req.body.token, process.env.JWT_SECRET)
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
