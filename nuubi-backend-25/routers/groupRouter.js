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
  handleJoinGroupWithPasscode,
  handleEditPost,
  handleEditGroup,
  handleGetPostInfo,
  handleGetGroupInfo,
  handleAddMessagePoint,
  getCommentLikes,
  handleAddCommentPoint,
  getPostLiked,
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
  handleInviteLink,
  getWonCertificates,
  handleCreateWeeklyTakeawaySchedule,
  handleGetWeeklyTakeawaySchedules,
  handleDeactivateWeeklyTakeawaySchedule,
  handleUpdateWeeklyTakeawaySchedule,
  handleCreateScheduledPost,
  handleGetScheduledPosts,
  handleGetAllScheduledPosts,
  handleUpdateScheduledPost,
  handleCancelScheduledPost,
} = require("../controllers/groupController");
const validateCreateGroup = require("../controllers/validation/validateCreateGroup");
const validateCreatePost = require("../controllers/validation/validateCreatePost");
const validateCreateComment = require("../controllers/validation/validateCreateComment");
const { UnauthorizedError } = require("express-jwt");
const { verifyUserID } = require("../controllers/jwt/verifyUserId");
const { jwtVerifyMiddleware } = require("../controllers/jwt/jwtAuth");
const { loadGroupRole } = require("../middlewares/loadGroupRole");
const adminAnalyticsController = require("../controllers/adminAnalyticsController");
const validateCreateWeeklyTakeawaySchedule = require(
  "../controllers/validation/validateCreateWeeklyTakeawaySchedule"
);

const validateCreateScheduledPost = require(
  "../controllers/validation/validateCreateScheduledPost"
);

console.log(
  "validateCreateScheduledPost:",
  validateCreateScheduledPost
);

console.log(
  "handleCreateScheduledPost:",
  handleCreateScheduledPost
);

router.post("/creategroup", jwtVerifyMiddleware, validateCreateGroup, handleCreateGroup);
router.get("/getgroups", jwtVerifyMiddleware, getAllGroups);
router.get("/getpublicgroups", getAllPublicGroups);
router.post("/joingroup", handleJoinGroup);
router.post("/joingroupwithpasscode", handleJoinGroupWithPasscode);

// Apply JWT middleware to verify the token and decode it
// router.use(jwtVerifyMiddleware);

// router.use(verifyUserID); /// auth middleware

router.post("/mygroups", jwtVerifyMiddleware, getMyGroups);

// router.post("/mygroups",getMyGroups);

router.post("/:group_id/createpost",validateCreatePost, handleCreatePost);
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
router.post("/getmembers", jwtVerifyMiddleware, adminAnalyticsController.students);
router.post("/getleaderboard", adminAnalyticsController.getLeaderboard);
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
router.post("/myleaderboards", jwtVerifyMiddleware, adminAnalyticsController.getMyLeaderboards);
router.post("/mygroupanalytics", jwtVerifyMiddleware, adminAnalyticsController.getMyGroupAnalytics);
router.post("/getweeklygroupinfo", jwtVerifyMiddleware, loadGroupRole, adminAnalyticsController.getWeeklyTrend);
router.post("/invite/:token", handleInviteLink);
router.post("/getwoncertificates", getWonCertificates);
router.post("/studentparticipationanalytics", jwtVerifyMiddleware, adminAnalyticsController.getDeepParticipation);

router.post(
  "/:group_id/weekly-takeaway-schedules",
  validateCreateWeeklyTakeawaySchedule,
  handleCreateWeeklyTakeawaySchedule
);
router.get(
  "/:group_id/weekly-takeaway-schedules",
  handleGetWeeklyTakeawaySchedules
);
router.patch(
  "/:group_id/weekly-takeaway-schedules/:schedule_id/deactivate",
  handleDeactivateWeeklyTakeawaySchedule
);

router.patch(
  "/:group_id/weekly-takeaway-schedules/:schedule_id",
  validateCreateWeeklyTakeawaySchedule,
  handleUpdateWeeklyTakeawaySchedule
);
router.post(
  "/:group_id/scheduled-posts",
  jwtVerifyMiddleware,
  validateCreateScheduledPost,
  handleCreateScheduledPost
);
router.get(
  "/:group_id/scheduled-posts/all",
  jwtVerifyMiddleware,
  handleGetAllScheduledPosts
);

router.get(
  "/:group_id/scheduled-posts",
  jwtVerifyMiddleware,
  handleGetScheduledPosts
);

router.patch(
  "/:group_id/scheduled-posts/:scheduled_post_id/cancel",
  jwtVerifyMiddleware,
  handleCancelScheduledPost
);

router.patch(
  "/:group_id/scheduled-posts/:scheduled_post_id",
  jwtVerifyMiddleware,
  validateCreateScheduledPost,
  handleUpdateScheduledPost
);

module.exports = router;
