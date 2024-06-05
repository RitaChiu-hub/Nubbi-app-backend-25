const express = require("express");
const router = express.Router();
const pool = require("../db.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  handleCreateGroup,
  getAllGroups,
  handleJoinGroup,
  getMyGroups,
  handleCreatePost,
  handleGetPosts,
  handleCreateComment,
  handleGetPostComments,
  handleAddPostPoint,
  handleGetPostPoints,
  handleGetUserPoints,
  getAllPublicGroups,
  getMemberCount,
  handleLeaveGroup,
  handleIsAdmin,
  handleDeleteGroup,
  getGroupMembers,
  handleJoinGroupWithPasscode,
  handleEditPost,
  handleEditGroup,
  handleGetPostInfo,
  handleGetGroupInfo,
  handleAddMessagePoint,
  getCommentLikes,
  handleAddCommentPoint,
  getPostLiked,
  getLeaderboard,
  getNotifications,
  getWonBadges,
  getNotificationsUnread,
  getNotificationsRead,
  handleCreateTask,
} = require("../controllers/groupController");
const validateCreateGroup = require("../controllers/validation/validateCreateGroup");
const validateCreatePost = require("../controllers/validation/validateCreatePost");
const validateCreateComment = require("../controllers/validation/validateCreateComment");
const { UnauthorizedError } = require("express-jwt");
const { verifyUserID } = require("../controllers/jwt/verifyUserId");

router.post("/creategroup", validateCreateGroup, handleCreateGroup);
router.get("/getgroups", getAllGroups);
router.get("/getpublicgroups", getAllPublicGroups);
router.post("/joingroup", handleJoinGroup);
router.post("/joingroupwithpasscode", handleJoinGroupWithPasscode);

// router.use(verifyUserID);

router.post("/mygroups", getMyGroups);

router.post("/:group_id/createpost", validateCreatePost, handleCreatePost);
router.post("/:group_id/posts", handleGetPosts);

router.post(
  "/:group_id/posts/:post_id/createcomment",
  //	validateCreateComment,
  handleCreateComment
);
router.post("/:group_id/posts/:post_id/getcomments", handleGetPostComments);

router.post("/addpostpoint", handleAddPostPoint);
router.post("/getpostpoints", handleGetPostPoints);
router.post("/getuserpoints", handleGetUserPoints);
router.post("/getmembercount", getMemberCount);
router.post("/leavegroup", handleLeaveGroup);
router.post("/isadmin", handleIsAdmin);
router.post("/deletegroup", handleDeleteGroup);
router.post("/getmembers", getGroupMembers);
router.post("/getleaderboard", getLeaderboard);
router.post("/editpost", handleEditPost);
router.post("/editgroup", handleEditGroup);
router.post("/getpostinfo", handleGetPostInfo);
router.post("/getgroupinfo", handleGetGroupInfo);
router.post("/addmessagepoint", handleAddMessagePoint);
router.post("/getcommentlikes", getCommentLikes);
router.post("/addcommentpoint", handleAddCommentPoint);
router.post("/getpostliked", getPostLiked);
router.post("/getnotifications", getNotifications);
router.post("/getwonbadges", getWonBadges);
router.post("/getnotificationsunread", getNotificationsUnread);
router.post("/getnotificationsread", getNotificationsRead);
router.post("/createtask", handleCreateTask);

module.exports = router;
