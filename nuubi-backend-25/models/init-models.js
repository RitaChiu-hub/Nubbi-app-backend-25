var DataTypes = require("sequelize").DataTypes;
var _groups = require("./groups");
var _messages = require("./messages");
var _participants = require("./participants");
var _points = require("./points");
var _post_comments = require("./post_comments");
var _posts = require("./posts");
var _users = require("./users");

// function initModels(sequelize) {
const initModels = (sequelize) => {
  var groups = _groups(sequelize, DataTypes);
  var messages = _messages(sequelize, DataTypes);
  var participants = _participants(sequelize, DataTypes);
  var points = _points(sequelize, DataTypes);
  var post_comments = _post_comments(sequelize, DataTypes);
  var posts = _posts(sequelize, DataTypes);
  var users = _users(sequelize, DataTypes);

  messages.belongsTo(groups, { as: "groups", foreignKey: "groups_id" });
  groups.hasMany(messages, { as: "messages", foreignKey: "groups_id" });
  // participants.belongsTo(groups, { as: "groups", foreignKey: "group_id" });
  // groups.hasMany(participants, { as: "participants", foreignKey: "group_id" });
  participants.belongsTo(groups, { foreignKey: "group_id" });
  groups.hasMany(participants, { foreignKey: "group_id" });
  points.belongsTo(groups, { as: "group", foreignKey: "group_id" });
  groups.hasMany(points, { as: "points", foreignKey: "group_id" });
  posts.belongsTo(groups, { as: "group", foreignKey: "group_id" });
  groups.hasMany(posts, { as: "posts", foreignKey: "group_id" });
  points.belongsTo(messages, { as: "message", foreignKey: "messages_id" });
  messages.hasMany(points, { as: "points", foreignKey: "messages_id" });
  points.belongsTo(post_comments, { as: "comment", foreignKey: "comment_id" });
  post_comments.hasMany(points, { as: "points", foreignKey: "comment_id" });
  points.belongsTo(posts, { as: "post", foreignKey: "posts_id" });
  posts.hasMany(points, { as: "points", foreignKey: "posts_id" });
  post_comments.belongsTo(posts, { as: "post", foreignKey: "post_id" });
  posts.hasMany(post_comments, { as: "post_comments", foreignKey: "post_id" });
  messages.belongsTo(users, { as: "sender", foreignKey: "sender_id" });
  users.hasMany(messages, { as: "messages", foreignKey: "sender_id" });
  participants.belongsTo(users, { as: "users", foreignKey: "user_id" });
  users.hasMany(participants, { as: "participants", foreignKey: "user_id" });
  points.belongsTo(users, { as: "giver", foreignKey: "giver_id" });
  users.hasMany(points, { as: "points", foreignKey: "giver_id" });
  points.belongsTo(users, { as: "recipient", foreignKey: "recipient_id" });
  users.hasMany(points, { as: "recipient_points", foreignKey: "recipient_id" });
  post_comments.belongsTo(users, { as: "sender", foreignKey: "sender_id" });
  users.hasMany(post_comments, {
    as: "post_comments",
    foreignKey: "sender_id",
  });
  posts.belongsTo(users, { as: "sender", foreignKey: "sender_id" });
  users.hasMany(posts, { as: "posts", foreignKey: "sender_id" });

  return {
    groups,
    messages,
    participants,
    points,
    post_comments,
    posts,
    users,
  };
};
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
