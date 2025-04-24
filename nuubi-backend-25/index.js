require("dotenv").config();
const { jwtSign, jwtVerify, getJwt } = require("./controllers/jwt/jwtAuth");
const express = require("express");
const app = express();
app.use(express.static("public"));

const helmet = require("helmet");
const { Sequelize } = require("sequelize");

const { Server } = require("socket.io");
const pool = require("./db");
const cors = require("cors");
const cookieParser = require("cookie-parser");

app.use(express.json());
// app.use(helmet());

app.use(
  helmet({
    frameguard: false, // This disables X-Frame-Options so your app can be embedded in iframes
  })
);

// CSP to allow iframe embedding
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  next();
});

app.use(cookieParser());

app.use(express.urlencoded({ extended: false }));

// Load the private key from .env
const privateKey = process.env.NUUBI_PRIVATE_KEY.replace(/\\n/g, "\n");

// Store it in app.locals or export it for use elsewhere
app.locals.privateKey = privateKey;

app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const server = require("http").createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

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

var _badges = require("./models/badges");
var _user_badges = require("./models/user_badges");
var _tasks = require("./models/tasks");
var _user_tasks = require("./models/user_tasks");
var _notifications = require("./models/notifications");

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

// var initModels = require("./models/init-models");
const models = initModels(sequelize);

var User = require("./models/users.js")(sequelize, DataTypes);
var Participant = require("./models/participants.js")(sequelize, DataTypes);
var Group = require("./models/groups.js")(sequelize, DataTypes);
var Message = require("./models/messages")(sequelize, DataTypes);
var Points = require("./models/points")(sequelize, DataTypes);
var Post = require("./models/posts")(sequelize, DataTypes);
var PostComment = require("./models/post_comments")(sequelize, DataTypes);
var Badge = require("./models/badges")(sequelize, DataTypes);
var UserBadge = require("./models/user_badges")(sequelize, DataTypes);
var Task = require("./models/tasks")(sequelize, DataTypes);
var UserTask = require("./models/user_tasks")(sequelize, DataTypes);
var Notification = require("./models/notifications")(sequelize, DataTypes);

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
  PostComment: PostComment,
  Badge: Badge,
  UserBadge: UserBadge,
  Task: Task,
  UserTask: UserTask,
  Notification: Notification,
};

// Export the object containing both sequelize and User
module.exports = exportsObject;

const ltiRoutes = require("./routes/lti");
app.use("/lti", ltiRoutes);

const myRouter = require("./routers.js");
const authRouter = require("./routers/authRouter");
const settingsRouter = require("./routers/settingsRouter");
const groupRouter = require("./routers/groupRouter");
const groupchatRouter = require("./routers/groupchatRouter");
const fileRouter = require("./routers/fileRouter");

///// auth middleware
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

// // Middleware to extract token from cookie
// app.use((req, res, next) => {
//   console.log("is this working?");
//   const token = req.cookies.token; // Access token from cookie
//   console.log("this is the request: " + req.cookies);
//   console.log("req.cookies.token " + req.cookies.token);
//   if (token) {
//     jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
//       if (err) return res.status(401).send("Unauthorized");
//       req.auth = decoded; // Attach user info to req.auth
//       next();
//     });
//   } else {
//     res.status(401).send("Unauthorized");
//   }
// });

// //// auth middleware
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
  // console.log("Socket request object:", socket.request); // Log the entire request object

  const getJwt = (request) => {
    // Check if the cookie header exists and is not empty
    if (request.headers.cookie) {
      // Extract the token from the cookie
      const token = request.headers.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1]; // Extract the token value

      return token || null; // Return the token or null if not found
    }

    return null; // Return null if cookie header is not present
  };

  // Use the updated getJwt function
  const webToken = getJwt(socket.request);

  socket.on("join", (room) => {
    socket.join(room);
  });

  socket.on("insert msg return updated list", (req) => {
    const token = req.token || webToken;

    // Check if token is available
    if (!token) {
      return socket.emit("error", { error: "JWT token is required" }); // Emit error back to client
    }
    // Now verify the token
    jwtVerify(token, process.env.JWT_SECRET)
      // jwtVerify(req.token, process.env.JWT_SECRET)
      .then(async (decoded) => {
        const userID = decoded.id;
        try {
          const firstQuery = pool.query(
            "INSERT INTO messages(sender_id, group_id, text) values ($1, $2, $3)",
            [userID, req.currentGroup, req.mymessage]
          );

          pool.query(
            "SELECT username sender_username, text, messages.id messages_id, messages.created_at iso_time_sent FROM messages INNER JOIN users ON messages.sender_id = users.id WHERE messages.group_id = $1 ORDER BY messages.created_at DESC",
            [req.currentGroup],
            (err, res) => {
              if (err) throw err;
              io.emit("insert msg return updated list", res.rows);
            }
          );
        } catch (error) {
          console.error("Error fetching and adding messages:", error);
          res.status(500).json({ error: "Internal server error" });
        }
      })
      .catch(async () => {
        res.json({ token: null });
      });
  });

  socket.on("insert comment return updated list", (req) => {
    const token = req.token || webToken;

    // Check if token is available
    if (!token) {
      return res.status(401).json({ error: "JWT token is required" });
    }

    // Now verify the token
    jwtVerify(token, process.env.JWT_SECRET)
      // jwtVerify(req.token, process.env.JWT_SECRET)
      .then(async (decoded) => {
        const userID = decoded.id;
        try {
          const firstQuery = pool.query(
            "INSERT INTO post_comments(comment_text, sender_id, post_id) values($1,$2,$3) RETURNING id",
            [req.mycomment, userID, req.currentPost]
          );

          pool.query(
            "SELECT username sender_username, post_comments.id post_comment_id, sender_id, comment_text, post_comments.created_at comment_iso_time_sent FROM post_comments INNER JOIN users ON post_comments.sender_id = users.id WHERE post_id = $1 ORDER BY post_comments.created_at DESC;",
            [req.currentPost],
            (err, res) => {
              if (err) throw err;
              io.emit("insert comment return updated list", res.rows);
            }
          );
        } catch (error) {
          console.error("Error fetching and adding comments: ", error);
          res.status(500).json({ error: "Internal server error" });
        }
      })
      .catch(async () => {
        res.json({ token: null });
      });
  });

  // socket.on("insert comment return updated list", async (req) => {
  //   const token = req.token || webToken;

  //   if (!token) {
  //     socket.emit("auth_error", { error: "JWT token is required" });
  //     return;
  //   }

  //   try {
  //     const decoded = await jwtVerify(token, process.env.JWT_SECRET);
  //     const userID = decoded.id;

  //     // Insert the comment and make sure we wait for it
  //     await pool.query(
  //       "INSERT INTO post_comments(comment_text, sender_id, post_id) VALUES ($1, $2, $3)",
  //       [req.mycomment, userID, req.currentPost]
  //     );

  //     // Short delay to ensure Postgres finishes transaction
  //     await new Promise((resolve) => setTimeout(resolve, 100));

  //     // Fetch updated list of comments for this post
  //     const result = await pool.query(
  //       "SELECT username AS sender_username, post_comments.id AS post_comment_id, sender_id, comment_text, post_comments.created_at AS comment_iso_time_sent, post_id FROM post_comments INNER JOIN users ON post_comments.sender_id = users.id WHERE post_id = $1 ORDER BY post_comments.created_at ASC",
  //       [req.currentPost]
  //     );

  //     io.to(`post-${req.currentPost}`).emit(
  //       "insert comment return updated list",
  //       result.rows
  //     );
  //   } catch (error) {
  //     console.error("Error in socket insert comment handler:", error);
  //     socket.emit("error", { error: "Internal server error or invalid token" });
  //   }
  // });

  // socket.on("insert comment return updated list", async (req) => {
  //   //console.log(" my post is: " + req.currentPost);
  //   const token = req.token || webToken;

  //   if (!token) {
  //     socket.emit("auth_error", { error: "JWT token is required" });
  //     return;
  //   }

  //   try {
  //     const decoded = await jwtVerify(token, process.env.JWT_SECRET);
  //     const userID = decoded.id;

  //     // Insert the comment
  //     await pool.query(
  //       "INSERT INTO post_comments(comment_text, sender_id, post_id) VALUES ($1, $2, $3)",
  //       [req.mycomment, userID, req.currentPost]
  //     );

  //     // Fetch updated list of comments for this post
  //     const result = await pool.query(
  //       "SELECT username AS sender_username, post_comments.id AS post_comment_id, sender_id, comment_text, post_comments.created_at AS comment_iso_time_sent FROM post_comments INNER JOIN users ON post_comments.sender_id = users.id WHERE post_id = $1 ORDER BY post_comments.created_at ASC",
  //       [req.currentPost]
  //     );

  //     // Emit updated list only to the current post's room
  //     //io.emit("insert comment return updated list", result.rows);
  //     io.to(`post-${req.currentPost}`).emit(
  //       "insert comment return updated list",
  //       result.rows
  //     );
  //   } catch (error) {
  //     console.error("Error in socket insert comment handler:", error);
  //     socket.emit("error", { error: "Internal server error or invalid token" });
  //   }
  // });

  // // Now verify the token
  // jwtVerify(token, process.env.JWT_SECRET)
  //   // jwtVerify(req.token, process.env.JWT_SECRET)
  //   .then(async (decoded) => {
  //     const userID = decoded.id;
  //     try {
  //       const firstQuery = pool.query(
  //         "INSERT INTO post_comments(comment_text, sender_id, post_id) values($1,$2,$3) RETURNING id",
  //         [req.mycomment, userID, req.currentPost]
  //       );

  //       pool.query(
  //         "SELECT username sender_username, post_comments.id post_comment_id, sender_id, comment_text, post_comments.created_at comment_iso_time_sent FROM post_comments INNER JOIN users ON post_comments.sender_id = users.id WHERE post_id = $1 ORDER BY post_comments.created_at DESC;",
  //         [req.currentPost],
  //         (err, res) => {
  //           if (err) throw err;
  //           io.emit("insert comment return updated list", res.rows);
  //         }
  //       );
  //     } catch (error) {
  //       console.error("Error fetching and adding comments: ", error);
  //       res.status(500).json({ error: "Internal server error" });
  //     }
  //   })
  //   .catch(async () => {
  //     res.json({ token: null });
  //   });

  socket.on("add post point return updated sum", async (req) => {
    const token = req.token || webToken;
    // Check if token is available
    if (!token) {
      return res.status(401).json({ error: "JWT token is required" });
    }

    // Now verify the token
    jwtVerify(token, process.env.JWT_SECRET)
      // jwtVerify(req.token, process.env.JWT_SECRET)
      .then(async (decoded) => {
        const userID = decoded.id;
        try {
          const pointGiven = await pool.query(
            "SELECT SUM(point_value) FROM points WHERE giver_id = $1 and posts_id = $2",
            [userID, req.currentPost]
          );

          const getRecipientId = await pool.query(
            "SELECT sender_id FROM posts WHERE id = $1;",
            [req.currentPost]
          );

          const recipient_id = getRecipientId.rows[0].sender_id;

          if (pointGiven.rows[0].sum == null) {
            const newPostPoint = await pool.query(
              "INSERT INTO points(recipient_id, giver_id, posts_id, group_id) values($1,$2,$3,$4);",
              [recipient_id, userID, req.currentPost, req.currentGroup]
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
              [userID, req.currentPost]
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
        } catch (error) {
          console.error("Error adding post point: ", error);
          res.status(500).json({ error: "Internal server error" });
        }
      })
      .catch(async () => {
        res.json({ token: null });
      });
  });

  // socket.on("add comment point return updated sum", async (req) => {
  //   const token = req.token || webToken;
  //   // Check if token is available
  //   if (!token) {
  //     return res.status(401).json({ error: "JWT token is required" });
  //   }

  //   // Now verify the token
  //   jwtVerify(token, process.env.JWT_SECRET)
  //     // jwtVerify(req.token, process.env.JWT_SECRET)
  //     .then(async (decoded) => {
  //       const userID = decoded.id;
  //       try {
  //         const pointGiven = await pool.query(
  //           "SELECT SUM(point_value) FROM points WHERE giver_id = $1 and comment_id = $2",
  //           [userID, req.post_comment_id]
  //         );

  //         if (pointGiven.rows[0].sum == null) {
  //           const newCommentPoint = await pool.query(
  //             "INSERT INTO points(recipient_id, giver_id, comment_id, group_id) values($1,$2,$3,$4);",
  //             [req.sender_id, userID, req.post_comment_id, req.currentGroup]
  //           );

  //           pool.query(
  //             "SELECT SUM(point_value) FROM points WHERE comment_id = $1;",
  //             [req.post_comment_id],
  //             (err, res) => {
  //               if (err) throw err;
  //               io.emit(
  //                 "add comment point return updated sum",
  //                 res.rows[0].sum
  //               );
  //             }
  //           );
  //         } else {
  //           const deleteCommentPoint = await pool.query(
  //             "DELETE FROM points WHERE giver_id = $1 AND comment_id = $2;",
  //             [userID, req.post_comment_id]
  //           );

  //           pool.query(
  //             "SELECT COALESCE(SUM(point_value),0) FROM points WHERE comment_id = $1;",
  //             [req.post_comment_id],
  //             (err, res) => {
  //               if (err) throw err;
  //               io.emit(
  //                 "add comment point return updated sum",
  //                 res.rows[0].sum
  //               );
  //             }
  //           );
  //         }
  //       } catch (error) {
  //         console.error("Error adding comment point: ", error);
  //         res.status(500).json({ error: "Internal server error" });
  //       }
  //     })
  //     .catch(async () => {
  //       res.json({ token: null });
  //     });
  // });

  // socket.on("add message point return updated sum", async (req) => {
  //   const token = req.token || webToken;

  //   // Check if token is available
  //   if (!token) {
  //     return res.status(401).json({ error: "JWT token is required" });
  //   }

  //   // Now verify the token
  //   jwtVerify(token, process.env.JWT_SECRET)
  //     // jwtVerify(req.token, process.env.JWT_SECRET)
  //     .then(async (decoded) => {
  //       const userID = decoded.id;
  //       try {
  //         const pointGiven = await pool.query(
  //           "SELECT SUM(point_value) FROM points WHERE giver_id = $1 and messages_id = $2",
  //           [userID, req.message_id]
  //         );

  //         const getRecipientId = await pool.query(
  //           "SELECT sender_id FROM messages WHERE id = $1;",
  //           [req.message_id]
  //         );

  //         const recipient_id = getRecipientId.rows[0].sender_id;

  //         if (pointGiven.rows[0].sum == null) {
  //           const newMessagePoint = await pool.query(
  //             "INSERT INTO points(recipient_id, giver_id, messages_id, group_id) values($1,$2,$3,$4);",
  //             [recipient_id, userID, req.message_id, req.currentGroup]
  //           );

  //           pool.query(
  //             "SELECT SUM(point_value) FROM points WHERE messages_id = $1;",
  //             [req.message_id],
  //             (err, res) => {
  //               if (err) throw err;
  //               io.emit(
  //                 "add message point return updated sum",
  //                 res.rows[0].sum
  //               );
  //             }
  //           );
  //         } else {
  //           const deleteMessagePoint = await pool.query(
  //             "DELETE FROM points WHERE giver_id = $1 AND messages_id = $2;",
  //             [userID, req.message_id]
  //           );

  //           pool.query(
  //             "SELECT COALESCE(SUM(point_value),0) FROM points WHERE messages_id = $1;",
  //             [req.message_id],
  //             (err, res) => {
  //               if (err) throw err;
  //               io.emit(
  //                 "add message point return updated sum",
  //                 res.rows[0].sum
  //               );
  //             }
  //           );
  //         }
  //       } catch (error) {
  //         console.error("Error adding message point: ", error);
  //         res.status(500).json({ error: "Internal server error" });
  //       }
  //     })
  //     .catch(async () => {
  //       res.json({ token: null });
  //     });
  // });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

server.listen(8080, () => {
  console.log("server listening on port 8080");
});
