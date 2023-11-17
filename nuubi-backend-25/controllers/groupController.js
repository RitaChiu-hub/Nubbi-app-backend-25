const pool = require("../db");
const { jwtVerify } = require("./jwt/jwtAuth");

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

const { participants, groups, messages, points, post_comments, posts, users } =
  require("../models/init-models")(sequelize, DataTypes);

const bcrypt = require("bcrypt");
const currentDate = new Date();
require("dotenv").config();

module.exports.handleCreateGroup = async (req, res) => {
  var isPublic = req.body.privacySelection === "Public" ? "true" : "false";
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
    user_id: req.body.userId,
    group_id: newGroup.id,
    is_admin: true,
    created_at: currentDate.getTime(),
    updated_at: currentDate.getTime(),
  });

  res.json({
    ...req.body,
    status: "Group successfully created & you are the admin of this group",
  });
};

module.exports.getAllGroups = async (req, res) => {
  const getAllGroups = await groups.findAll({
    attributes: ["name", "description", "id"],
  });
  res.send(getAllGroups);
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
    "SELECT c.user_id as user_id, username, email, is_admin, coalesce(group_total_points,0) group_total_points FROM (  SELECT users.id user_id, users.username username, users.email email, participants.is_admin is_admin FROM participants INNER JOIN users ON participants.user_id = users.id WHERE participants.group_id = $1) c FULL OUTER JOIN ( SELECT user_id, recipient_id, count as group_total_points FROM (SELECT DISTINCT participants.user_id FROM participants INNER JOIN points ON participants.user_id = points.recipient_id WHERE participants.group_id = $1) a LEFT JOIN (SELECT recipient_id, count(point_value) FROM points WHERE group_id = $1 GROUP BY recipient_id) b ON a.user_id = b.recipient_id) d ON c.user_id = d.user_id ORDER BY group_total_points DESC;",
    [req.body.currentGroup]
  );
  res.send(groupMembersQuery.rows);
};

module.exports.handleJoinGroup = async (req, res) => {
  try {
    const existingParticipant = await participants.findOne({
      where: {
        user_id: req.body.userId,
        group_id: req.body.joinGroupId,
      },
    });

    if (!existingParticipant) {
      await participants.create({
        user_id: req.body.userId,
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
    console.error("Error joining group:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports.handleJoinGroupWithPasscode = async (req, res) => {
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
          user_id: req.body.userId,
          group_id: group.id,
        },
      });

      if (!existingParticipant) {
        await participants.create({
          user_id: req.body.userId,
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
  const isAdmin = await participants.findOne({
    where: {
      user_id: req.body.userId,
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
        user_id: req.body.userId,
        group_id: req.body.currentGroup,
      },
    });

    res.json({
      ...req.body,
      status: "Success",
    });
  }
};

module.exports.handleDeleteGroup = async (req, res) => {
  const existingUser = await users.findOne({
    where: {
      username: req.body.username,
    },
  });

  if (!existingUser) {
    res.json({
      ...req.body,
      status: "User does not exist",
    });
    return;
  }

  const isSamePass = await bcrypt.compare(
    req.body.passattempt,
    existingUser.passhash
  );

  const isAdmin = await participants.findOne({
    where: {
      user_id: req.body.userId,
      group_id: req.body.currentGroup,
      is_admin: true,
    },
  });

  if (!isAdmin) {
    res.json({
      ...req.body,
      status: "Not admin",
    });
    return;
  }

  if (isSamePass) {
    await sequelize.transaction(async (t) => {
      await points.destroy({
        where: {
          group_id: req.body.currentGroup,
        },
        transaction: t,
      });

      await post_comments.destroy({
        where: {},
        include: [
          {
            model: posts,
            where: {
              group_id: req.body.currentGroup,
            },
          },
        ],
        transaction: t,
      });

      await posts.destroy({
        where: {
          group_id: req.body.currentGroup,
        },
        transaction: t,
      });

      await messages.destroy({
        where: {
          group_id: req.body.currentGroup,
        },
        transaction: t,
      });

      await participants.destroy({
        where: {
          group_id: req.body.currentGroup,
        },
        transaction: t,
      });

      await groups.destroy({
        where: {
          id: req.body.currentGroup,
        },
        transaction: t,
      });
    });

    res.json({
      ...req.body,
      status: "Success",
    });
  } else {
    res.json({
      ...req.body,
      status: "Wrong password",
    });
  }
};

module.exports.handleCreatePost = async (req, res) => {
  const newPost = await posts.create({
    title: req.body.title,
    body_text: req.body.body_text,
    image_url: req.body.imageUrl,
    sender_id: req.body.userId,
    group_id: req.params.group_id,
    created_at: currentDate.getTime(),
    updated_at: currentDate.getTime(),
  });

  res.json({
    ...req.body,
    status: "Post successfully created",
  });
};

module.exports.handleEditPost = async (req, res) => {
  const [updatedRowCount] = await posts.update(
    {
      title: req.body.title,
      body_text: req.body.body_text,
      image_url: req.body.imageUrl,
    },
    {
      where: {
        sender_id: req.body.userId,
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
    "SELECT title post_title, body_text, username post_author, image_url, posts.created_at iso_time_sent FROM posts INNER JOIN users ON posts.sender_id = users.id WHERE posts.id=$1;",
    [req.body.currentPost]
  );
  res.send(getPostInfoQuery.rows[0]);
};

module.exports.handleGetGroupInfo = async (req, res) => {
  const getGroupInfoQuery = await pool.query(
    "SELECT name groupname, description, is_public, participants.user_id admin_id FROM groups LEFT JOIN participants ON groups.id = participants.group_id WHERE groups.id=$1 and participants.is_admin=true;",
    [req.body.currentGroup]
  );
  res.send(getGroupInfoQuery.rows[0]);
};

module.exports.handleCreateComment = async (req, res) => {
  const newPostQuery = await pool.query(
    "INSERT INTO post_comments(comment_text, sender_id, post_id) values($1,$2,$3) RETURNING id",
    [req.body.mycomment, req.body.userId, req.params.post_id]
  );

  res.json({
    ...req.body,
    status: "Comment successfully created",
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
  const pointGiven = await points.sum("point_value", {
    where: {
      giver_id: req.body.userId,
      posts_id: req.body.currentPost,
    },
  });

  const post = await posts.findByPk(req.body.currentPost);
  const recipient_id = post.sender_id;

  if (pointGiven === null || pointGiven === 0) {
    await points.create({
      recipient_id,
      giver_id: req.body.userId,
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
        giver_id: req.body.userId,
        posts_id: req.body.currentPost,
      },
    });

    res.json({
      ...req.body,
      status: "deleted a point",
    });
  }
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
  const pointGiven = await pool.query(
    "SELECT SUM(point_value) FROM points WHERE giver_id = $1 and comment_id = $2",
    [req.body.userId, req.body.comment_id]
  );

  const getRecipientId = await pool.query(
    "SELECT sender_id FROM post_comments WHERE id = $1;",
    [req.body.comment_id]
  );

  const recipient_id = getRecipientId.rows[0].sender_id;

  if (pointGiven.rows[0].sum == null) {
    const newCommentPoint = await pool.query(
      "INSERT INTO points(recipient_id, giver_id, comment_id, group_id) values($1,$2,$3,$4);",
      [
        recipient_id,
        req.body.userId,
        req.body.comment_id,
        req.body.currentGroup,
      ]
    );
  } else {
    const deleteCommentPoint = await pool.query(
      "DELETE FROM points WHERE giver_id = $1 AND comment_id = $2;",
      [req.body.userId, req.body.comment_id]
    );
  }

  res.json({
    ...req.body,
    status: "added a point",
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
  const getUserPoints = await pool.query(
    "SELECT SUM(point_value) FROM points WHERE recipient_id = $1;",
    [req.body.userId]
  );

  if (getUserPoints.rows[0].sum == null) {
    userPoints = "0";
  } else {
    userPoints = getUserPoints.rows[0].sum;
  }

  res.send(userPoints);
};

module.exports.getCommentLikes = async (req, res) => {
  const getLikesQuery = await pool.query(
    "SELECT comment_id FROM points WHERE giver_id = $1 AND group_id = $2;",
    [req.body.userId, req.body.currentGroup]
  );
  res.send(getLikesQuery.rows);
};

module.exports.getPostLiked = async (req, res) => {
  const postId = req.body.currentPost;
  const userId = req.body.userId;

  const likedRecord = await points.findOne({
    where: {
      giver_id: userId,
      posts_id: postId,
    },
  });

  res.send(likedRecord !== null);
};
