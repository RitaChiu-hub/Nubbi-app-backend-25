var DataTypes = require("sequelize").DataTypes;
var _groups = require("./groups");
var _messages = require("./messages");
var _participants = require("./participants");
var _points = require("./points");
var _post_comments = require("./post_comments");
var _posts = require("./posts");
var _users = require("./users");

function initModels(sequelize) {
  var groups = _groups(sequelize, DataTypes);
  var messages = _messages(sequelize, DataTypes);
  var participants = _participants(sequelize, DataTypes);
  var points = _points(sequelize, DataTypes);
  var post_comments = _post_comments(sequelize, DataTypes);
  var posts = _posts(sequelize, DataTypes);
  var users = _users(sequelize, DataTypes);

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

  return {
    groups,
    messages,
    participants,
    points,
    post_comments,
    posts,
    users,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
