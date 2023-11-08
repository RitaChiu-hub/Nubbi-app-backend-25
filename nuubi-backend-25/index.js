require("dotenv").config();
const express = require("express");
const app = express();

const helmet = require("helmet");
const { Sequelize } = require("sequelize");

const { Server } = require("socket.io");
const pool = require("./db");
const cors = require("cors");

app.use(express.json());
app.use(helmet());

app.use(cors({ origin: true, credentials: true }));

const server = require("http").createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.use(cors({ origin: "*", credentials: true }));

// app.use(
//   cors({
//     origin: "http://localhost:19006",
//     credentials: true,
//   })
// );

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
});

var DataTypes = require("sequelize").DataTypes;

var _groups = function (sequelize, DataTypes) {
  return sequelize.define(
    "groups",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "untitled group",
      },
      description: {
        type: DataTypes.STRING(800),
        allowNull: true,
      },
      is_public: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      invite_passcode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "groups",
      schema: "public",
      timestamps: true,
      indexes: [
        {
          name: "groups_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
      ],
    }
  );
};

var _messages = require("./models/messages");
// var _participants = require("./models/participants");

var _participants = function (sequelize, DataTypes) {
  return sequelize.define(
    "participants",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "groups",
          key: "id",
        },
      },
      is_admin: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      tableName: "participants",
      schema: "public",
      timestamps: true,
      indexes: [
        {
          name: "participants_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
      ],
    }
  );
};

var _points = require("./models/points");
var _post_comments = require("./models/post_comments");
var _posts = require("./models/posts");
var _users = require("./models/users");

function initModels(sequelize) {
  var groups = _groups(sequelize, DataTypes);
  var messages = _messages(sequelize, DataTypes);
  var participants = _participants(sequelize, DataTypes);
  var points = _points(sequelize, DataTypes);
  var post_comments = _post_comments(sequelize, DataTypes);
  var posts = _posts(sequelize, DataTypes);
  var users = _users(sequelize, DataTypes);

  messages.belongsTo(groups, { as: "group", foreignKey: "group_id" });
  groups.hasMany(messages, { as: "messages", foreignKey: "group_id" });
  participants.belongsTo(groups, { as: "groups", foreignKey: "groups_id" });
  groups.hasMany(participants, { as: "participants", foreignKey: "groups_id" });
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
  participants.belongsTo(users, { as: "user", foreignKey: "user_id" });
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
}

// var initModels = require("./models/init-models");
const models = initModels(sequelize);

var User = require("./models/users.js")(sequelize, DataTypes);
var Participant = require("./models/participants.js")(sequelize, DataTypes);
var Group = require("./models/groups.js")(sequelize, DataTypes);
var Message = require("./models/messages")(sequelize, DataTypes);
var Points = require("./models/points")(sequelize, DataTypes);
var Post = require("./models/posts")(sequelize, DataTypes);
// Find all users

// Create an object to hold both exports
const exportsObject = {
  sequelize: sequelize,
  User: User,
  Participant: Participant,
  Group: Group,
  Message: Message,
  Points: Points,
  Post: Post,
};

// Export the object containing both sequelize and User
module.exports = exportsObject;

const myRouter = require("./routers.js");
const authRouter = require("./routers/authRouter");
const settingsRouter = require("./routers/settingsRouter");
const groupRouter = require("./routers/groupRouter");
const groupchatRouter = require("./routers/groupchatRouter");
const fileRouter = require("./routers/fileRouter");

// const { expressjwt: jwt, UnauthorizedError } = require("express-jwt");

app.use("/auth", authRouter);

// app.use(
//   jwt({
//     secret: process.env.JWT_SECRET,
//     algorithms: ["HS256"],
//     onExpired: (req, err) => {
//       throw err;
//     },
//   })
// );

app.use("/settings", settingsRouter);
app.use("/groups", groupRouter);
app.use("/groupchat", groupchatRouter);
app.use("/file", fileRouter);
app.use("/backend", myRouter);

// app.use((err, req, res, next) => {
//   console.log(err);
//   if (err.name === "UnauthorizedError") {
//     res.status(401).json({
//       loggedIn: false,
//       status: "Unauthorized",
//     });
//   } else {
//     next(err);
//   }
// });

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("insert msg return updated list", (req) => {
    const firstQuery = pool.query(
      "INSERT INTO messages(sender_id, group_id, text) values ($1, $2, $3)",
      [req.userId, req.currentGroup, req.mymessage]
    );

    pool.query(
      "SELECT username sender_username, text, messages.id messages_id, messages.created_at iso_time_sent FROM messages INNER JOIN users ON messages.sender_id = users.id WHERE messages.group_id = $1 ORDER BY messages.created_at DESC",
      [req.currentGroup],
      (err, res) => {
        if (err) throw err;
        io.emit("insert msg return updated list", res.rows);
      }
    );
  });

  socket.on("insert comment return updated list", (req) => {
    const firstQuery = pool.query(
      "INSERT INTO post_comments(comment_text, sender_id, post_id) values($1,$2,$3) RETURNING id",
      [req.mycomment, req.userId, req.currentPost]
    );

    pool.query(
      "SELECT username sender_username, post_comments.id post_comment_id, sender_id, comment_text, post_comments.created_at comment_iso_time_sent FROM post_comments INNER JOIN users ON post_comments.sender_id = users.id WHERE post_id = $1 ORDER BY post_comments.created_at DESC;",
      [req.currentPost],
      (err, res) => {
        if (err) throw err;
        io.emit("insert comment return updated list", res.rows);
      }
    );
  });

  socket.on("add post point return updated sum", async (req) => {
    const pointGiven = await pool.query(
      "SELECT SUM(point_value) FROM points WHERE giver_id = $1 and posts_id = $2",
      [req.userId, req.currentPost]
    );

    const getRecipientId = await pool.query(
      "SELECT sender_id FROM posts WHERE id = $1;",
      [req.currentPost]
    );

    const recipient_id = getRecipientId.rows[0].sender_id;

    if (pointGiven.rows[0].sum == null) {
      const newPostPoint = await pool.query(
        "INSERT INTO points(recipient_id, giver_id, posts_id, group_id) values($1,$2,$3,$4);",
        [recipient_id, req.userId, req.currentPost, req.currentGroup]
      );

      pool.query(
        "SELECT SUM(point_value) FROM points WHERE posts_id = $1;",
        [req.currentPost],
        (err, res) => {
          if (err) throw err;
          io.emit("add post point return updated sum", res.rows[0].sum);
        }
      );
    } else {
      const deletePostPoint = await pool.query(
        "DELETE FROM points WHERE giver_id = $1 AND posts_id = $2;",
        [req.userId, req.currentPost]
      );

      pool.query(
        "SELECT COALESCE(SUM(point_value),0) FROM points WHERE posts_id = $1;",
        [req.currentPost],
        (err, res) => {
          if (err) throw err;
          io.emit("add post point return updated sum", res.rows[0].sum);
        }
      );
    }
  });

  socket.on("add comment point return updated sum", async (req) => {
    const pointGiven = await pool.query(
      "SELECT SUM(point_value) FROM points WHERE giver_id = $1 and comment_id = $2",
      [req.userId, req.post_comment_id]
    );

    if (pointGiven.rows[0].sum == null) {
      const newCommentPoint = await pool.query(
        "INSERT INTO points(recipient_id, giver_id, comment_id, group_id) values($1,$2,$3,$4);",
        [req.sender_id, req.userId, req.post_comment_id, req.currentGroup]
      );

      pool.query(
        "SELECT SUM(point_value) FROM points WHERE comment_id = $1;",
        [req.post_comment_id],
        (err, res) => {
          if (err) throw err;
          io.emit("add comment point return updated sum", res.rows[0].sum);
        }
      );
    } else {
      const deleteCommentPoint = await pool.query(
        "DELETE FROM points WHERE giver_id = $1 AND comment_id = $2;",
        [req.userId, req.post_comment_id]
      );

      pool.query(
        "SELECT COALESCE(SUM(point_value),0) FROM points WHERE comment_id = $1;",
        [req.post_comment_id],
        (err, res) => {
          if (err) throw err;
          io.emit("add comment point return updated sum", res.rows[0].sum);
        }
      );
    }
  });

  socket.on("add message point return updated sum", async (req) => {
    const pointGiven = await pool.query(
      "SELECT SUM(point_value) FROM points WHERE giver_id = $1 and messages_id = $2",
      [req.userId, req.message_id]
    );

    const getRecipientId = await pool.query(
      "SELECT sender_id FROM messages WHERE id = $1;",
      [req.message_id]
    );

    const recipient_id = getRecipientId.rows[0].sender_id;

    if (pointGiven.rows[0].sum == null) {
      const newMessagePoint = await pool.query(
        "INSERT INTO points(recipient_id, giver_id, messages_id, group_id) values($1,$2,$3,$4);",
        [recipient_id, req.userId, req.message_id, req.currentGroup]
      );

      pool.query(
        "SELECT SUM(point_value) FROM points WHERE messages_id = $1;",
        [req.message_id],
        (err, res) => {
          if (err) throw err;
          io.emit("add message point return updated sum", res.rows[0].sum);
        }
      );
    } else {
      const deleteMessagePoint = await pool.query(
        "DELETE FROM points WHERE giver_id = $1 AND messages_id = $2;",
        [req.userId, req.message_id]
      );

      pool.query(
        "SELECT COALESCE(SUM(point_value),0) FROM points WHERE messages_id = $1;",
        [req.message_id],
        (err, res) => {
          if (err) throw err;
          io.emit("add message point return updated sum", res.rows[0].sum);
        }
      );
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

server.listen(8080, () => {
  console.log("server listening on port 8080");
});
