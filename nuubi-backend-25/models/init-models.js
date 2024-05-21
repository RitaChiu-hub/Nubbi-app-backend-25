var DataTypes = require("sequelize").DataTypes;
var _groups = require("./groups");
var _messages = require("./messages");
var _participants = require("./participants");
var _points = require("./points");
var _post_comments = require("./post_comments");
var _posts = require("./posts");
var _users = require("./users");
var _badges = require("./badges");
var _user_badges = require("./user_badges");
var _tasks = require("./tasks");
var _user_tasks = require("./user_tasks");
var _notifications = require("./notifications");

function initModels(sequelize) {
  var groups = _groups(sequelize, DataTypes);
  var messages = _messages(sequelize, DataTypes);
  var participants = _participants(sequelize, DataTypes);
  var points = _points(sequelize, DataTypes);
  var post_comments = _post_comments(sequelize, DataTypes);
  var posts = _posts(sequelize, DataTypes);
  var users = _users(sequelize, DataTypes);
  var badges = _badges(sequelize, DataTypes);
  var user_badges = _user_badges(sequelize, DataTypes);
  var tasks = _tasks(sequelize, DataTypes);
  var user_tasks = _user_tasks(sequelize, DataTypes);
  var notifications = _notifications(sequelize, DataTypes);

  messages.belongsTo(groups, { foreignKey: "group_id" });
  groups.hasMany(messages, { foreignKey: "group_id" });
  participants.belongsTo(groups, { foreignKey: "group_id" });
  groups.hasMany(participants, { foreignKey: "group_id" });
  points.belongsTo(groups, { foreignKey: "group_id" });
  groups.hasMany(points, { foreignKey: "group_id" });
  posts.belongsTo(groups, { foreignKey: "group_id" });
  groups.hasMany(posts, { foreignKey: "group_id" });
  points.belongsTo(messages, { foreignKey: "messages_id" });
  messages.hasMany(points, { foreignKey: "messages_id" });
  points.belongsTo(post_comments, { foreignKey: "comment_id" });
  post_comments.hasMany(points, { foreignKey: "comment_id" });
  points.belongsTo(posts, { foreignKey: "posts_id" });
  posts.hasMany(points, { foreignKey: "posts_id" });
  post_comments.belongsTo(posts, { foreignKey: "post_id" });
  posts.hasMany(post_comments, { foreignKey: "post_id" });
  messages.belongsTo(users, { foreignKey: "sender_id" });
  users.hasMany(messages, { foreignKey: "sender_id" });
  participants.belongsTo(users, { foreignKey: "user_id" });
  users.hasMany(participants, { foreignKey: "user_id" });
  points.belongsTo(users, { foreignKey: "giver_id" });
  users.hasMany(points, { foreignKey: "giver_id" });
  points.belongsTo(users, { foreignKey: "recipient_id" });
  users.hasMany(points, { foreignKey: "recipient_id" });
  post_comments.belongsTo(users, { foreignKey: "sender_id" });
  users.hasMany(post_comments, {
    foreignKey: "sender_id",
  });
  posts.belongsTo(users, { foreignKey: "sender_id" });
  users.hasMany(posts, { foreignKey: "sender_id" });

  // Badge and User
  badges.belongsToMany(users, { through: user_badges, foreignKey: "badge_id" });
  users.belongsToMany(badges, { through: user_badges, foreignKey: "user_id" });

  // UserBadge
  user_badges.belongsTo(users, { foreignKey: "user_id" });
  users.hasMany(user_badges, { foreignKey: "user_id" });
  user_badges.belongsTo(badges, { foreignKey: "badge_id" });
  badges.hasMany(user_badges, { foreignKey: "badge_id" });
  user_badges.belongsTo(groups, { foreignKey: "group_id" });
  groups.hasMany(user_badges, { foreignKey: "group_id" });

  // Task and User
  tasks.belongsToMany(users, { through: user_tasks, foreignKey: "task_id" });
  users.belongsToMany(tasks, { through: user_tasks, foreignKey: "user_id" });

  // UserTask
  user_tasks.belongsTo(users, { foreignKey: "user_id" });
  users.hasMany(user_tasks, { foreignKey: "user_id" });
  user_tasks.belongsTo(tasks, { foreignKey: "task_id" });
  tasks.hasMany(user_tasks, { foreignKey: "task_id" });
  user_tasks.belongsTo(groups, { foreignKey: "group_id" });
  groups.hasMany(user_tasks, { foreignKey: "group_id" });

  // Notification and User
  notifications.belongsTo(users, { foreignKey: "user_id" });
  users.hasMany(notifications, { foreignKey: "user_id" });

  return {
    groups,
    messages,
    participants,
    points,
    post_comments,
    posts,
    users,
    badges,
    user_badges,
    tasks,
    user_tasks,
    notifications,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
