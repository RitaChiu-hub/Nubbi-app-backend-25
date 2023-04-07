const pool = require("../db");
const bcrypt = require("bcrypt");
require("dotenv").config();

module.exports.handleCreateGroup = async (req, res) => {
  var isPublic = req.body.privacySelection === "Public" ? "true" : "false";
  var invitePasscode = Math.random().toString(10).substring(2, 8);

  const newGroupQuery = await pool.query(
    "INSERT INTO groups(name, description, is_public, invite_passcode) values($1,$2,$3,$4) RETURNING id",
    [req.body.groupname, req.body.description, isPublic, invitePasscode]
  );

  const groupId = newGroupQuery.rows[0].id;

  const newParticipantQuery = await pool.query(
    "INSERT INTO participants(user_id, group_id, is_admin) values ($1, $2, true) RETURNING id, user_id, group_id",
    [req.body.userId, groupId]
  );

  res.json({
    ...req.body,
    status: "Group successfully created & you are the admin of this group",
  });
};

module.exports.getAllGroups = async (req, res) => {
  const allGroupsQuery = await pool.query(
    "SELECT name, description, id FROM groups"
  );
  res.send(allGroupsQuery.rows);
};

module.exports.getAllPublicGroups = async (req, res) => {
  const allGroupsQuery = await pool.query(
    "SELECT name, description, id FROM groups WHERE is_public"
  );
  res.send(allGroupsQuery.rows);
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
  const myGroupsQuery = await pool.query(
    "SELECT groups.invite_passcode invite_passcode, groups.id group_id, groups.name, groups.description, participants.user_id user_id FROM groups INNER JOIN participants ON groups.id = participants.group_id WHERE participants.user_id = $1 order by participants.created_at desc;",
    [req.body.userId]
  );
  res.send(myGroupsQuery.rows);
};

module.exports.getGroupMembers = async (req, res) => {
  const groupMembersQuery = await pool.query(
    "SELECT c.user_id as user_id, username, email, is_admin, coalesce(group_total_points,0) group_total_points FROM (  SELECT users.id user_id, users.username username, users.email email, participants.is_admin is_admin FROM participants INNER JOIN users ON participants.user_id = users.id WHERE participants.group_id = $1) c FULL OUTER JOIN ( SELECT user_id, recipient_id, count as group_total_points FROM (SELECT DISTINCT participants.user_id FROM participants INNER JOIN points ON participants.user_id = points.recipient_id WHERE participants.group_id = $1) a LEFT JOIN (SELECT recipient_id, count(point_value) FROM points WHERE group_id = $1 GROUP BY recipient_id) b ON a.user_id = b.recipient_id) d ON c.user_id = d.user_id ORDER BY group_total_points DESC;",
    [req.body.currentGroup]
  );
  res.send(groupMembersQuery.rows);
};

module.exports.handleJoinGroup = async (req, res) => {
  const existingParticipant = await pool.query(
    "SELECT user_id, group_id FROM participants WHERE user_id=$1 AND group_id=$2",
    [req.body.userId, req.body.joinGroupId]
  );

  if (existingParticipant.rowCount === 0) {
    //user isn't already participating & can be added
    const joinGroupQuery = await pool.query(
      "INSERT INTO participants(user_id, group_id, is_admin) values ($1, $2, false) RETURNING id, user_id, group_id",
      [req.body.userId, req.body.joinGroupId]
    );
    res.json({
      ...req.body,
      status: "Successfully added 😘",
    });
    // now check to see if the user is already a participant or not. If not, add them to the group.
  } else {
    res.json({
      ...req.body,
      status: "You're already in this group 😁",
    });
  }
};

module.exports.handleJoinGroupWithPasscode = async (req, res) => {
  const getGroupId = await pool.query(
    "select id group_id from groups WHERE invite_passcode = $1;",
    [req.body.passcode]
  );

  if (getGroupId.rowCount !== 0) {
    const getAdminId = await pool.query(
      "SELECT participants.user_id admin_id FROM participants FULL OUTER JOIN groups ON groups.id = participants.group_id where participants.is_admin=true and groups.invite_passcode=$1;",
      [req.body.passcode]
    );

    const GroupId = getGroupId.rows[0].group_id;
    const AdminId = getAdminId.rows[0].admin_id;

    const getAdminUsername = await pool.query(
      "SELECT username FROM users WHERE id = $1;",
      [AdminId]
    );

    const AdminUsername = getAdminUsername.rows[0].username;

    if (AdminUsername === req.body.admin) {
      const existingParticipant = await pool.query(
        "SELECT user_id, group_id FROM participants WHERE user_id=$1 AND group_id=$2",
        [req.body.userId, GroupId]
      );

      if (existingParticipant.rowCount === 0) {
        //user isn't already participating & can be added
        const joinGroupQuery = await pool.query(
          "INSERT INTO participants(user_id, group_id, is_admin) values ($1, $2, false) RETURNING id, user_id, group_id",
          [req.body.userId, GroupId]
        );
        res.json({
          ...req.body,
          status: "Successfully added 😘",
        });
        // now check to see if the user is already a participant or not. If not, add them to the group.
      } else {
        res.json({
          ...req.body,
          status: "You're already in this group 😁",
        });
      }
    } else {
      res.json({
        ...req.body,
        status: "Wrong passcode or admin username", //wrong admin username
      });
    }
  } else {
    res.json({
      ...req.body,
      status: "Wrong passcode or admin username", //wrong passcode
    });
  }
};

module.exports.handleIsAdmin = async (req, res) => {
  const isAdmin = await pool.query(
    "SELECT * FROM participants WHERE user_id = $1 AND group_id = $2 AND is_admin = true;",
    [req.body.userId, req.body.currentGroup]
  );

  if (isAdmin.rowCount != 0) {
    res.json({
      ...req.body,
      isAdmin: "true",
    });
  } else {
    res.json({
      ...req.body,
      isAdmin: "false",
    });
  }
};

module.exports.handleLeaveGroup = async (req, res) => {
  const isAdmin = await pool.query(
    "SELECT * FROM participants WHERE user_id = $1 AND group_id = $2 AND is_admin = true;",
    [req.body.userId, req.body.currentGroup]
  );

  if (isAdmin.rowCount === 0) {
    const leaveGroupQuery = await pool.query(
      "DELETE FROM participants WHERE user_id = $1 AND group_id = $2",
      [req.body.userId, req.body.currentGroup]
    );
    res.json({
      ...req.body,
      status: "Success",
    });
  } else {
    res.json({
      ...req.body,
      status: "You're can't leave bc you're the admin 😁",
    });
  }
};

module.exports.handleDeleteGroup = async (req, res) => {
  const existingUser = await pool.query(
    "SELECT username, passhash from users WHERE username=$1",
    [req.body.username]
  );
  if (existingUser.rowCount != 0) {
    const isSamePass = await bcrypt.compare(
      req.body.passattempt,
      existingUser.rows[0].passhash
    );

    const isAdmin = await pool.query(
      "SELECT * FROM participants WHERE user_id = $1 AND group_id = $2 AND is_admin = true;",
      [req.body.userId, req.body.currentGroup]
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
};

module.exports.handleCreatePost = async (req, res) => {
  const newPostQuery = await pool.query(
    "INSERT INTO posts(title, body_text, sender_id, group_id) values($1,$2,$3,$4) RETURNING id",
    [req.body.title, req.body.body_text, req.body.userId, req.params.group_id]
  );

  res.json({
    ...req.body,
    status: "Post successfully created",
  });
};

module.exports.handleEditPost = async (req, res) => {
  const editPostQuery = await pool.query(
    "UPDATE posts SET title=$1, body_text=$2 WHERE sender_id=$3 AND id=$4",
    [req.body.title, req.body.body_text, req.body.userId, req.body.currentPost]
  );

  res.json({
    ...req.body,
    status: "Post successfully edited",
  });
};

module.exports.handleEditGroup = async (req, res) => {
  var isPublic = req.body.privacySelection === "Public" ? "true" : "false";

  const editGroupQuery = await pool.query(
    "UPDATE groups SET name=$1, description=$2, is_public=$3 WHERE id=$4",
    [req.body.groupname, req.body.description, isPublic, req.body.currentGroup]
  );

  res.json({
    ...req.body,
    status: "Group successfully updated",
    groupName: req.body.groupname,
  });
};

module.exports.handleGetPosts = async (req, res) => {
  const getPostsQuery = await pool.query(
    //"SELECT posts.id post_id, sender_id, title, body_text, username post_author,  to_json(posts.created_at) iso_time_sent FROM posts INNER JOIN users ON posts.sender_id = users.id WHERE group_id = $1 ORDER BY created_at ASC;",
    //	"SELECT c.post_id post_id, sender_id, title, body_text, post_author, to_json(c.created_at) iso_time_sent, coalesce(point_total,0) point_total, coalesce(number_comments,0) number_comments FROM (SELECT posts.id post_id, sender_id, title, body_text, username post_author,  posts.created_at created_at FROM posts INNER JOIN users ON posts.sender_id = users.id WHERE group_id = $1) c FULL OUTER JOIN (SELECT point_total, number_comments, post_id FROM (SELECT SUM(point_value) point_total, posts_id FROM points WHERE group_id = $1 GROUP BY posts_id) a INNER JOIN (SELECT count(id) number_comments, post_id from post_comments group by post_id) b ON a.posts_id = b.post_id) d ON c.post_id = d.post_id ORDER BY c.created_at DESC;",
    // "SELECT c.post_id post_id, sender_id, title, body_text, post_author, to_json(c.created_at) iso_time_sent, coalesce(point_total,0) point_total, coalesce(number_comments,0) number_comments FROM (SELECT posts.id post_id, sender_id, title, body_text, username post_author,  posts.created_at created_at FROM posts INNER JOIN users ON posts.sender_id = users.id WHERE group_id = $1) c FULL OUTER JOIN (SELECT point_total, a.post_id post_id, number_comments FROM ((SELECT SUM(point_value) point_total, posts_id post_id FROM points WHERE group_id = $1 GROUP BY posts_id) UNION (SELECT DISTINCT CASE WHEN id> 0 THEN 0 END point_total, post_id from post_comments)) a LEFT JOIN (SELECT count(id) number_comments, post_id from post_comments group by post_id) b ON a.post_id = b.post_id) d ON c.post_id = d.post_id WHERE c.post_id IS NOT NULL ORDER BY c.created_at DESC;",
    "SELECT c.post_id post_id, sender_id, title, body_text, post_author, created_at, coalesce(point_total,0) point_total, coalesce(number_comments,0) number_comments FROM (SELECT a.post_id post_id, sender_id, title, body_text, post_author, created_at, point_total FROM (SELECT posts.id post_id, sender_id, title, body_text, username post_author, posts.created_at created_at FROM posts INNER JOIN users ON posts.sender_id = users.id WHERE group_id = $1) a LEFT JOIN (SELECT posts_id post_id, SUM(point_value) point_total FROM points WHERE group_id = $1 GROUP BY posts_id) b ON a.post_id = b.post_id) c LEFT JOIN (select post_id, count(id) number_comments from post_comments group by post_id) d on c.post_id = d.post_id;",
    [req.body.currentGroup]
  );
  res.send(getPostsQuery.rows);
};

module.exports.handleGetPostInfo = async (req, res) => {
  const getPostInfoQuery = await pool.query(
    "SELECT title post_title, body_text, username post_author, to_json(posts.created_at) iso_time_sent FROM posts INNER JOIN users ON posts.sender_id = users.id WHERE posts.id=$1;",
    [req.body.currentPost]
  );
  res.send(getPostInfoQuery.rows[0]);
};

module.exports.handleGetGroupInfo = async (req, res) => {
  const getGroupInfoQuery = await pool.query(
    "SELECT name groupname, description, is_public FROM groups WHERE id = $1;",
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
    // "SELECT id post_comment_id, sender_id, comment_text FROM post_comments WHERE post_id = $1 ORDER BY created_at ASC;",
    // "SELECT username sender_username, post_comments.id post_comment_id, sender_id, comment_text, to_json(post_comments.created_at) comment_iso_time_sent  FROM post_comments INNER JOIN users ON post_comments.sender_id = users.id WHERE post_id = $1 ORDER BY post_comments.created_at DESC;",
    "SELECT a.sender_username, a.post_comment_id, a.sender_id, a.comment_text, a.comment_iso_time_sent, coalesce(b.count,0) comment_points FROM (SELECT username sender_username, post_comments.id post_comment_id, sender_id, comment_text, post_comments.created_at comment_iso_time_sent FROM post_comments INNER JOIN users ON post_comments.sender_id = users.id WHERE post_id = $1 ORDER BY post_comments.created_at DESC) a LEFT JOIN (SELECT COUNT(point_value), comment_id FROM points WHERE group_id = $2 GROUP BY comment_id) b ON a.post_comment_id = b.comment_id;",
    [req.params.post_id, req.body.currentGroup]
  );

  res.send(getPostCommentsQuery.rows);
};

module.exports.handleAddPostPoint = async (req, res) => {
  const pointGiven = await pool.query(
    "SELECT SUM(point_value) FROM points WHERE giver_id = $1 and posts_id = $2",
    [req.body.userId, req.body.currentPost]
  );

  const getRecipientId = await pool.query(
    "SELECT sender_id FROM posts WHERE id = $1;",
    [req.body.currentPost]
  );

  const recipient_id = getRecipientId.rows[0].sender_id;

  if (pointGiven.rows[0].sum == null) {
    const newPostPoint = await pool.query(
      "INSERT INTO points(recipient_id, giver_id, posts_id, group_id) values($1,$2,$3,$4);",
      [
        recipient_id,
        req.body.userId,
        req.body.currentPost,
        req.body.currentGroup,
      ]
    );

    res.json({
      ...req.body,
      status: "added a point",
    });
  } else {
    const deletePostPoint = await pool.query(
      "DELETE FROM points WHERE giver_id = $1 AND posts_id = $2;",
      [req.body.userId, req.body.currentPost]
    );

    res.json({
      ...req.body,
      status: "deleted a point",
    });
  }
};

module.exports.handleAddMessagePoint = async (req, res) => {
  const pointGiven = await pool.query(
    "SELECT SUM(point_value) FROM points WHERE giver_id = $1 and messages_id = $2",
    [req.body.userId, req.body.message_id]
  );

  const getRecipientId = await pool.query(
    "SELECT sender_id FROM messages WHERE id = $1;",
    [req.body.message_id]
  );

  const recipient_id = getRecipientId.rows[0].sender_id;

  if (pointGiven.rows[0].sum == null) {
    const newMessagePoint = await pool.query(
      "INSERT INTO points(recipient_id, giver_id, messages_id, group_id) values($1,$2,$3,$4);",
      [
        recipient_id,
        req.body.userId,
        req.body.message_id,
        req.body.currentGroup,
      ]
    );
  } else {
    const deleteMessagePoint = await pool.query(
      "DELETE FROM points WHERE giver_id = $1 AND messages_id = $2;",
      [req.body.userId, req.body.message_id]
    );
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
  const getPostLikedQuery = await pool.query(
    "SELECT id FROM points WHERE giver_id = $1 AND posts_id = $2;",
    [req.body.userId, req.body.currentPost]
  );

  if (getPostLikedQuery.rowCount === 0) {
    res.send(false);
  } else {
    res.send(true);
  }
};
