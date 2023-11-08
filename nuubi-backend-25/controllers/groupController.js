const pool = require("../db");
const {
  Participant,
  Group,
  Message,
  Points,
  Post,
  sequelize,
} = require("../index");

const DataTypes = require("sequelize").DataTypes;

const Sequelize = require("sequelize");

// const sequelize = new Sequelize({
//   dialect: "postgres",
//   database: process.env.DATABASE_NAME,
//   host: process.env.DATABASE_HOST,
//   port: process.env.DATABASE_PORT,
//   username: process.env.DATABASE_USER,
//   password: process.env.DATABASE_PASSWORD,
//   dialectOptions: {
//     ssl: {
//       rejectUnauthorized: false, // Disable SSL certificate verification
//     },
//   },
// });

// const participants = require("../models/participants")(sequelize, DataTypes);
const { participants, groups } = require("../models/init-models")(
  sequelize,
  DataTypes
);

const bcrypt = require("bcrypt");
require("dotenv").config();

module.exports.handleCreateGroup = async (req, res) => {
  var isPublic = req.body.privacySelection === "Public" ? "true" : "false";
  var invitePasscode = Math.random().toString(10).substring(2, 8);

  // const newGroupQuery = await pool.query(
  //   "INSERT INTO groups(name, description, is_public, invite_passcode) values($1,$2,$3,$4) RETURNING id",
  //   [req.body.groupname, req.body.description, isPublic, invitePasscode]
  // );

  const newGroup = await Group.create({
    name: req.body.groupname,
    description: req.body.description,
    is_public: isPublic,
    invite_passcode: invitePasscode,
  });

  // const newParticipantQuery = await pool.query(
  //     "INSERT INTO participants(user_id, group_id, is_admin) values ($1, $2, true) RETURNING id, user_id, group_id",
  //     [req.body.userId, groupId]
  // );
  const newParticipant = await Participant.create({
    user_id: req.body.userId,
    group_id: newGroup.id,
    is_admin: true,
  });

  res.json({
    ...req.body,
    status: "Group successfully created & you are the admin of this group",
  });
};

module.exports.getAllGroups = async (req, res) => {
  // const allGroupsQuery = await pool.query(
  //     "SELECT name, description, id FROM groups"
  // );

  const getAllGroups = await Group.findAll({
    attributes: ["name", "description", "id"],
  });
  res.json(getAllGroups);
};

module.exports.getAllPublicGroups = async (req, res) => {
  // const allGroupsQuery = await pool.query(
  //     "SELECT name, description, id FROM groups WHERE is_public"
  // );
  const allPubGroups = await Group.findAll({
    where: { is_public: true },
    attributes: ["name", "description", "id"],
  });
  res.json(allPubGroups);
};

module.exports.getMemberCount = async (req, res) => {
  const { currentGroup } = req.body;

  const memberCount = await Participant.count({
    where: { group_id: currentGroup },
  });

  res.json({ memberCount });
};

module.exports.getMyGroups = async (req, res) => {
  // const myGroupsQuery = await pool.query(
  //     "SELECT groups.invite_passcode invite_passcode, groups.id group_id, groups.name, groups.description, participants.user_id user_id FROM groups INNER JOIN participants ON groups.id = participants.group_id WHERE participants.user_id = $1 order by participants.created_at desc;",
  //     [req.body.userId]
  // );
  // res.send(myGroupsQuery.rows);
  const myGroups = await groups.findAll({
    attributes: ["invite_passcode", ["id", "group_id"], "name", "description"],
    include: [
      {
        model: participants,
        where: { user_id: req.body.userId },
        attributes: ["user_id"],
        required: true,
      },
    ],
    order: [[Sequelize.literal("participants.created_at"), "DESC"]],
  });

  res.json(myGroups);
};

module.exports.getGroupMembers = async (req, res) => {
  const groupMembers = await User.findAll({
    attributes: [
      [Sequelize.col("c.user_id"), "user_id"],
      "username",
      "email",
      "is_admin",
    ],
    include: [
      {
        model: Participant,
        where: { group_id: req.body.currentGroup },
        required: true,
      },
    ],

    order: [[Sequelize.literal("group_total_points"), "DESC"]],
  });

  res.json(groupMembers);
};

module.exports.handleJoinGroup = async (req, res) => {
  try {
    const existingParticipant = await Participant.findOne({
      where: {
        user_id: req.body.userId,
        group_id: req.body.joinGroupId,
      },
    });

    if (!existingParticipant) {
      await Participant.create({
        user_id: req.body.userId,
        group_id: req.body.joinGroupId,
        is_admin: false,
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
  const group = await Group.findOne({
    where: {
      invite_passcode: req.body.passcode,
    },
  });

  if (group) {
    const admin = await Participant.findOne({
      where: {
        group_id: group.id,
        is_admin: true,
      },
      attributes: ["user_id"],
      include: [
        {
          model: User,
          attributes: ["username"],
        },
      ],
    });

    if (admin.User.username === req.body.admin) {
      const existingParticipant = await Participant.findOne({
        where: {
          user_id: req.body.userId,
          group_id: group.id,
        },
      });

      if (!existingParticipant) {
        await Participant.create({
          user_id: req.body.userId,
          group_id: group.id,
          is_admin: false,
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
  const isAdmin = await Participant.findOne({
    where: {
      user_id: req.body.userId,
      group_id: req.body.currentGroup,
      is_admin: true,
    },
  });

  res.json({
    ...req.body,
    isAdmin: isAdmin ? "true" : "false",
  });
};

module.exports.handleLeaveGroup = async (req, res) => {
  const isAdmin = await Participant.findOne({
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
    await Participant.destroy({
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
  const username = req.body.username;
  const passattempt = req.body.passattempt;
  const userId = req.body.userId;
  const currentGroup = req.body.currentGroup;

  const existingUser = await User.findOne({
    attributes: ["username", "passhash"],
    where: { username },
  });

  if (existingUser) {
    const isSamePass = await bcrypt.compare(passattempt, existingUser.passhash);

    const isAdmin = await Participant.findOne({
      where: {
        user_id: userId,
        group_id: currentGroup,
        is_admin: true,
      },
    });

    if (isAdmin) {
      if (isSamePass) {
        await Points.update(
          {
            group_id: null,
            posts_id: null,
            comment_id: null,
            messages_id: null,
          },
          {
            where: { group_id: currentGroup },
          }
        );

        await PostComment.destroy({
          where: {},
          include: [
            {
              model: Post,
              where: { group_id: currentGroup },
            },
          ],
        });

        await Post.destroy({
          where: { group_id: currentGroup },
        });

        await Message.destroy({
          where: { group_id: currentGroup },
        });

        await Participant.destroy({
          where: { group_id: currentGroup },
        });

        await Group.destroy({
          where: { id: currentGroup },
        });

        res.json({ ...req.body, status: "Success" });
      } else {
        res.json({ ...req.body, status: "Wrong password" });
      }
    }
  }
};

module.exports.handleCreatePost = async (req, res) => {
  const newPost = await Post.create({
    title: req.body.title,
    body_text: req.body.body_text,
    image_url: req.body.imageUrl,
    sender_id: req.body.userId,
    group_id: req.params.group_id,
  });

  res.json({
    ...req.body,
    status: "Post successfully created",
  });
};

module.exports.handleEditPost = async (req, res) => {
  // const editPostQuery = await pool.query(
  //     "UPDATE posts SET title=$1, body_text=$2, image_url=$3 WHERE sender_id=$4 AND id=$5",
  //     [
  //         req.body.title,
  //         req.body.body_text,
  //         req.body.imageUrl,
  //         req.body.userId,
  //         req.body.currentPost,
  //     ]
  // );

  // res.json({
  //     ...req.body,
  //     status: "Post successfully edited",
  // });
  const updatedRowCount = await Post.update(
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

  const updatedGroup = await Group.update(
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
  const getPosts = await Post.findAll({
    attributes: [
      [Sequelize.col("c.post_id"), "post_id"],
      "sender_id",
      "title",
      "body_text",
      [Sequelize.col("post_author"), "post_author"],
      "created_at",
      [Sequelize.literal("COALESCE(point_total, 0)"), "point_total"],
      [Sequelize.literal("COALESCE(number_comments, 0)"), "number_comments"],
    ],
    include: [
      {
        model: User,
        attributes: ["username"],
        where: { id: Sequelize.col("sender_id") },
      },
      {
        model: Points,
        attributes: [
          [Sequelize.fn("SUM", Sequelize.col("point_value")), "point_total"],
        ],
        where: { group_id: req.body.currentGroup },
        required: false,
        group: ["post_id"],
      },
      {
        model: PostComment,
        attributes: [
          [Sequelize.fn("COUNT", Sequelize.col("id")), "number_comments"],
        ],
        group: ["post_id"],
        required: false,
      },
    ],
  });

  res.json(getPosts);
};

module.exports.handleGetPostInfo = async (req, res) => {
  const postInfo = await Post.findOne({
    attributes: ["title", "body_text", "image_url", "created_at"],
    include: [
      {
        model: User,
        attributes: ["username"],
        where: {
          id: Sequelize.col("post.sender_id"),
        },
      },
    ],
    where: {
      id: req.body.currentPost,
    },
  });

  if (postInfo) {
    res.send(postInfo);
  } else {
    res.json({
      ...req.body,
      status: "Post not found",
    });
  }
};

module.exports.handleGetGroupInfo = async (req, res) => {
  const groupInfo = await Group.findOne({
    attributes: ["name", "description", "is_public"],
    include: [
      {
        model: Participant,
        attributes: ["user_id"],
        where: {
          is_admin: true,
        },
      },
    ],
    where: {
      id: req.body.currentGroup,
    },
  });

  if (groupInfo) {
    res.send(groupInfo);
  } else {
    res.json({
      ...req.body,
      status: "Group not found",
    });
  }
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
    // "SELECT id post_comment_id, sender_id, comment_text FROM post_comments WHERE post_id = $1 ORDER BY created_at ASC;",
    // "SELECT username sender_username, post_comments.id post_comment_id, sender_id, comment_text, to_json(post_comments.created_at) comment_iso_time_sent  FROM post_comments INNER JOIN users ON post_comments.sender_id = users.id WHERE post_id = $1 ORDER BY post_comments.created_at DESC;",
    "SELECT a.sender_username, a.post_comment_id, a.sender_id, a.comment_text, a.comment_iso_time_sent, coalesce(b.count,0) comment_points FROM (SELECT username sender_username, post_comments.id post_comment_id, sender_id, comment_text, post_comments.created_at comment_iso_time_sent FROM post_comments INNER JOIN users ON post_comments.sender_id = users.id WHERE post_id = $1 ORDER BY post_comments.created_at DESC) a LEFT JOIN (SELECT COUNT(point_value), comment_id FROM points WHERE group_id = $2 GROUP BY comment_id) b ON a.post_comment_id = b.comment_id;",
    [req.params.post_id, req.body.currentGroup]
  );

  res.send(getPostCommentsQuery.rows);
};

module.exports.handleAddPostPoint = async (req, res) => {
  const pointGiven = await Points.sum("point_value", {
    where: {
      giver_id: req.body.userId,
      posts_id: req.body.currentPost,
    },
  });

  const post = await Post.findByPk(req.body.currentPost);
  const recipient_id = post.sender_id;

  if (pointGiven === null || pointGiven === 0) {
    await Points.create({
      recipient_id,
      giver_id: req.body.userId,
      posts_id: req.body.currentPost,
      group_id: req.body.currentGroup,
    });

    res.json({
      ...req.body,
      status: "added a point",
    });
  } else {
    await Points.destroy({
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
  const pointGiven = await Points.sum("point_value", {
    where: {
      giver_id: req.body.userId,
      messages_id: req.body.message_id,
    },
  });

  const message = await Message.findOne({
    where: {
      id: req.body.message_id,
    },
  });
  const recipient_id = message.sender_id;

  if (pointGiven === null || pointGiven === 0) {
    await Points.create({
      recipient_id,
      giver_id: req.body.userId,
      messages_id: req.body.message_id,
      group_id: req.body.currentGroup,
    });
  } else {
    await Points.destroy({
      where: {
        giver_id: req.body.userId,
        messages_id: req.body.message_id,
      },
    });
  }

  res.json({
    ...req.body,
    status: "added a point",
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
  const postPointsResult = await Points.sum("point_value", {
    where: {
      posts_id: req.body.currentPost,
    },
  });

  const postPoints = postPointsResult || 0;

  res.send(postPoints);
};

module.exports.handleGetUserPoints = async (req, res) => {
  const userPointsResult = await Points.sum("point_value", {
    where: {
      recipient_id: req.body.userId,
    },
  });

  const userPoints = userPointsResult || 0;

  res.send(userPoints);
};

// module.exports.handleAddPostCommentPoint = async (req, res) => {
// 	const pointGiven = await pool.query(
// 		"SELECT SUM(point_value) FROM points WHERE giver_id = $1 and comment_id = $2",
// 		[req.body.userId, req.body.post_comment_id]
// 	);

// 	if (pointGiven.rows[0].sum == null) {
// 		const newCommentPoint = await pool.query(
// 			"INSERT INTO points(recipient_id, giver_id, comment_id, group_id) values($1,$2,$3,$4);",
// 			[
// 				req.body.sender_id,
// 				req.body.userId,
// 				req.body.post_comment_id,
// 				req.body.currentGroup,
// 			]
// 		);
// 		console.log("point added");

// 		// pool.query(
// 		// 	"SELECT SUM(point_value) FROM points WHERE posts_id = $1;",
// 		// 	[req.currentPost],
// 		// 	(err, res) => {
// 		// 		if (err) throw err;
// 		// 		io.emit("add post point return updated sum", res.rows[0].sum);
// 	} else {
// 		console.log("can't add anymore points to this comment");
// 		res.json({
// 			...req.body,
// 			status: "You already gave a point",
// 		});
// 	}
// };

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

  const likedRecord = await Points.findOne({
    where: {
      giver_id: userId,
      posts_id: postId,
    },
  });

  res.send(likedRecord !== null);
};
