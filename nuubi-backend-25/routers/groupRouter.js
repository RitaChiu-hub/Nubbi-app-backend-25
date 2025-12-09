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
  handleGetMyGroupTasks,
  handleTaskCompleted,
  handleGetAllGroupTasks,
  handleTaskApproved,
  handleGetMyTasks,
  getMyLeaderboards,
  getMyGroupAnalytics,
  getWeeklyGroupInfo,
  handleInviteLink,
  getWonCertificates,
  getStudentParticipationAnalytics,
} = require("../controllers/groupController");
const validateCreateGroup = require("../controllers/validation/validateCreateGroup");
const validateCreatePost = require("../controllers/validation/validateCreatePost");
const validateCreateComment = require("../controllers/validation/validateCreateComment");
const { UnauthorizedError } = require("express-jwt");
const { verifyUserID } = require("../controllers/jwt/verifyUserId");
const { jwtVerifyMiddleware } = require("../controllers/jwt/jwtAuth");

router.post("/creategroup", validateCreateGroup, handleCreateGroup);
router.get("/getgroups", getAllGroups);
router.get("/getpublicgroups", getAllPublicGroups);
router.post("/joingroup", handleJoinGroup);
router.post("/joingroupwithpasscode", handleJoinGroupWithPasscode);

// Apply JWT middleware to verify the token and decode it
// router.use(jwtVerifyMiddleware);

// router.use(verifyUserID); /// auth middleware

router.post("/mygroups", jwtVerifyMiddleware, getMyGroups);

// router.post("/mygroups",getMyGroups);

router.post("/:group_id/createpost", validateCreatePost, handleCreatePost);
router.post("/:group_id/posts", jwtVerifyMiddleware, handleGetPosts);

router.post("/posts/createcomment", handleCreateComment);
router.post("/getpostcomments", jwtVerifyMiddleware, handleGetPostComments);

router.post("/addpostpoint", handleAddPostPoint);
router.post("/getpostpoints", handleGetPostPoints);
router.post("/getuserpoints", handleGetUserPoints);
router.post("/getmembercount", getMemberCount);
router.post("/leavegroup", handleLeaveGroup);
router.post("/isadmin", handleIsAdmin);
router.post("/deletegroup", handleDeleteGroup);
router.post("/getmembers", jwtVerifyMiddleware, getGroupMembers);
router.post("/getleaderboard", getLeaderboard);
router.post("/editpost", handleEditPost);
router.post("/editgroup", jwtVerifyMiddleware, handleEditGroup);
router.post("/getpostinfo", jwtVerifyMiddleware, handleGetPostInfo);
router.post("/getgroupinfo", jwtVerifyMiddleware, handleGetGroupInfo);
router.post("/addmessagepoint", handleAddMessagePoint);
router.post("/getcommentlikes", getCommentLikes);
router.post("/addcommentpoint", handleAddCommentPoint);
router.post("/getpostliked", getPostLiked);
router.post("/getnotifications", getNotifications);
router.post("/getwonbadges", getWonBadges);
router.post("/getnotificationsunread", getNotificationsUnread);
router.post("/getnotificationsread", getNotificationsRead);
router.post("/createtask", handleCreateTask);
router.post("/mygrouptasks", handleGetMyGroupTasks);
router.post("/taskcompleted", handleTaskCompleted);
router.post("/allgrouptasks", handleGetAllGroupTasks);
router.post("/taskapproved", handleTaskApproved);
router.post("/mytasks", handleGetMyTasks);
router.post("/myleaderboards", getMyLeaderboards);
router.post("/mygroupanalytics", getMyGroupAnalytics);
router.post("/getweeklygroupinfo", getWeeklyGroupInfo);
router.post("/invite/:token", handleInviteLink);
router.post("/getwoncertificates", getWonCertificates);
router.post("/studentparticipationanalytics", jwtVerifyMiddleware, getStudentParticipationAnalytics);

module.exports = router;
