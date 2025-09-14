require("dotenv").config();
const { jwtSign, jwtVerify, getJwt } = require("./controllers/jwt/jwtAuth");
const express = require("express");
const app = express();
app.use(express.static("public"));
const { checkAwardsForUser } = require("./controllers/awardService");

const helmet = require("helmet");
const { Sequelize } = require("sequelize");

const { Server } = require("socket.io");
const pool = require("./db");
const cors = require("cors");
const cookieParser = require("cookie-parser");

app.use(cookieParser());

app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginEmbedderPolicy: false, //  <- turn COEP off
    crossOriginResourcePolicy: false,
  })
);

app.use(express.json());

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
  transports: ["websocket"],
});

const sequelize = new Sequelize({
  dialect: "postgres",
  logging: false,
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
var _awards = require("./models/awards");
var _user_awards = require("./models/user_awards");

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
  var awards = _awards(sequelize, DataTypes);
  var user_awards = _user_awards(sequelize, DataTypes);

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

  awards.belongsToMany(users, { through: user_awards, foreignKey: "award_id" });
  users.belongsToMany(awards, { through: user_awards, foreignKey: "user_id" });

  // The join table itself
  user_awards.belongsTo(users, { foreignKey: "user_id" });
  users.hasMany(user_awards, { foreignKey: "user_id" });

  user_awards.belongsTo(awards, { foreignKey: "award_id" });
  awards.hasMany(user_awards, { foreignKey: "award_id" });

  user_awards.belongsTo(groups, { foreignKey: "group_id" });
  groups.hasMany(user_awards, { foreignKey: "group_id" });

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
    awards,
    user_awards,
  };
}

// var initModels = require("./models/init-models");
const models = initModels(sequelize);
const { notifications, users } = models;

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
var Award = require("./models/awards")(sequelize, DataTypes);
var UserAward = require("./models/user_awards")(sequelize, DataTypes);

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
  Award: Award,
  UserAward: UserAward,
};

// Export the object containing both sequelize and User
module.exports = exportsObject;

const ltiRoutes = require("./routes/lti");
// app.use("/lti", ltiRoutes);

// ─── only for requests whose final path is /lti/login ────────────
function addLaunchHeaders(req, res, next) {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://*.instructure.com https://*.blackboard.com https://*.ondigitalocean.app http://localhost:8080 https://canvas.northeastern.edu https://canvas.merrimack.edu"
  );
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}

app.use(
  ["/lti/login", "/lti/launch"], //  ← BOTH paths after the mount
  require("helmet")({
    contentSecurityPolicy: false, // keep Helmet from rewriting our CSP
    frameguard: false,
  }),
  addLaunchHeaders
);

// app.use(
//   "/lti/login", // full path after the router mount
//   require("helmet")({
//     contentSecurityPolicy: false, // don’t overwrite our CSP
//     frameguard: false,
//   }),
//   addLaunchHeaders
// );

// keep your existing mount
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

  socket.on("insert msg return updated list", async (req) => {
    // restore your original token logic
    const token = req.token || webToken;

    if (!token) {
      // client-side will see this and can prompt for re-login or show an error
      return socket.emit("error", { error: "JWT token is required" });
    }

    try {
      const decoded = await jwtVerify(token, process.env.JWT_SECRET);
      const userID = decoded.id;
      // insert just the new row and return it
      const insertRes = await pool.query(
        `INSERT INTO messages(sender_id, group_id, text)
         VALUES ($1, $2, $3)
         RETURNING
           id       AS messages_id,
           text,
           created_at AS iso_time_sent`,
        [userID, req.currentGroup, req.mymessage]
      );

      const newMsg = insertRes.rows[0];
      // fetch username for that sender
      const userRes = await pool.query(
        `SELECT username, avatar_url
           FROM users
          WHERE id = $1`,
        [userID]
      );

      // create a notification to the members of the group, letting everyone know there's a new message
      const groupMembersRes = await pool.query(
        `SELECT user_id FROM participants WHERE group_id = $1`,
        [req.currentGroup]
      );

      const groupRes = await pool.query(
        `SELECT name FROM groups WHERE id = $1`,
        [req.currentGroup]
      );

      const groupMembers = groupMembersRes.rows.map((row) => row.user_id);
      const currentDate = new Date();
      const groupName = groupRes.rows[0]?.name || "Unnamed Group";

      for (const memberId of groupMembers) {
        if (memberId !== userID) {
          console.log(
            `New message from ${userRes.rows[0].username} in ${groupName} message chat`
          );
          await notifications.create({
            message: `New message from ${userRes.rows[0].username} in ${groupName} message chat`,
            user_id: memberId,
            is_read: false,
            created_at: currentDate.getTime(),
            updated_at: currentDate.getTime(),
          });
        }
      }

      // add push notifications
      // Send push notifications to all group members (except the sender) for a new message
      const senderUsername = userRes.rows[0].username;

      await Promise.all(
        groupMembers
          .filter((memberId) => memberId !== userID)
          .map(async (memberId) => {
            // get the recipient's push token
            const tokRes = await pool.query(
              "SELECT push_notification_token FROM users WHERE id = $1",
              [memberId]
            );
            const token = tokRes.rows[0]?.push_notification_token;

            if (!token) {
              console.log(
                `No push notification token for user ID: ${memberId}`
              );
              return;
            }

            const message = {
              to: token,
              sound: "default",
              title: "New Group Message",
              body: `New message from ${senderUsername} in "${groupName}"`,
              data: {
                groupId: req.currentGroup,
                messageId: newMsg.messages_id,
              },
              channelId: "default",
            };

            try {
              const response = await fetch(
                "https://exp.host/--/api/v2/push/send",
                {
                  method: "POST",
                  headers: {
                    Accept: "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(message),
                }
              );

              const responseData = await response.json();
              if (!response.ok) {
                console.error(
                  "Failed to send push notification:",
                  response.status,
                  response.statusText,
                  responseData
                );
              }
            } catch (error) {
              console.error("Error sending push notification:", error);
            }
          })
      );

      checkAwardsForUser(userID, req.currentGroup).catch(console.error);

      io.emit(
        "insert msg return updated list",
        Object.assign(newMsg, {
          sender_username: userRes.rows[0].username,
          sender_avatar_url: userRes.rows[0].avatar_url,
          message_points: 0,
        })
      );
    } catch (err) {
      console.error("Websocket message error:", err);
      socket.emit("error", { error: "Internal server error" });
    }
  });

  socket.on("insert comment return updated list", (req) => {
    const token = req.token || webToken;
    if (!token) {
      socket.emit("insert comment error", { error: "JWT token is required" });
      return;
    }

    jwtVerify(token, process.env.JWT_SECRET)
      .then(async (decoded) => {
        const userID = decoded.id;
        try {
          // 1) Insert and return the new comment row
          const {
            rows: [newComment],
          } = await pool.query(
            `INSERT INTO post_comments(comment_text, sender_id, post_id)
               VALUES($1, $2, $3)
               RETURNING
                 id           AS post_comment_id,
                 comment_text,
                 sender_id,
                 created_at   AS comment_iso_time_sent`,
            [req.mycomment, userID, req.currentPost]
          );

          // 2) Fetch the author’s username
          const {
            rows: [userRow],
          } = await pool.query(
            `SELECT username AS sender_username, avatar_url AS sender_avatar_url
               FROM users
              WHERE id = $1`,
            [userID]
          );

          // 3) Emit only that new comment object
          socket.emit("insert comment return updated list", {
            ...newComment,
            sender_username: userRow.sender_username,
            sender_avatar_url: userRow.sender_avatar_url,
          });

          // A) Get the post’s author and group
          const postRes = await pool.query(
            `SELECT sender_id, group_id FROM posts WHERE id = $1`,
            [req.currentPost]
          );
          const postAuthorId = postRes.rows[0].sender_id;
          const postGroupId = postRes.rows[0].group_id;

          const groupRes = await pool.query(
            `SELECT name FROM groups WHERE id = $1`,
            [postGroupId]
          );
          const groupName = groupRes.rows[0]?.name || "Unnamed Group";

          const currentDate = new Date();

          // Collect recipients = post author + prior commenters (no duplicates, no current user)
          const recipientsRes = await pool.query(
            `SELECT DISTINCT sender_id FROM post_comments WHERE post_id = $1 AND sender_id <> $2 AND sender_id IS NOT NULL`,
            [req.currentPost, userID]
          );

          console.log("Raw recipientsRes.rows:", recipientsRes.rows);

          const recipientSet = new Set(
            recipientsRes.rows.map((r) => r.sender_id) // no filter(id => id) so 0 is not dropped
          );

          if (postAuthorId && postAuthorId !== userID) {
            recipientSet.add(postAuthorId);
          }

          const recipientIds = Array.from(recipientSet);
          console.log("Final recipientIds:", recipientIds);

          for (const recipientId of recipientIds) {
            console.log("Processing recipient:", recipientId);
            await notifications.create({
              message: `New comment from ${userRow.sender_username} in "${groupName}"`,
              user_id: recipientId,
              is_read: false,
              created_at: currentDate.getTime(),
              updated_at: currentDate.getTime(),
            });
            console.log("Created in-app notification for", recipientId);
            const recipient = await users.findOne({
              where: { id: recipientId },
            });
            console.log(
              "Loaded recipient from users table:",
              recipientId,
              recipient ? "found" : "NOT FOUND"
            );

            // await notifications.create({
            //   message: `New comment from ${userRow.sender_username} in "${groupName}"`,
            //   user_id: postAuthorId,
            //   is_read: false,
            //   created_at: currentDate.getTime(),
            //   updated_at: currentDate.getTime(),
            // });

            if (recipient?.push_notification_token) {
              console.log(
                "Recipient has push token:",
                recipient.push_notification_token
              );
              const message = {
                to: recipient.push_notification_token,
                sound: "default",
                title: "New Comment on Post",
                body: `New comment from ${userRow.sender_username} in "${groupName}"`,
                data: { postId: req.currentPost, groupId: postGroupId },
                channelId: "default",
              };

              // // Fetch post author
              // const postAuthor = await users.findOne({
              //   where: { id: postAuthorId },
              // });

              // // Send push notification if token exists
              // if (postAuthor?.push_notification_token) {
              //   const message = {
              //     to: postAuthor.push_notification_token,
              //     sound: "default",
              //     title: "New Comment on Post",
              //     body: `New Comment from ${userRow.sender_username} in "${groupName}"`,
              //     data: { postId: req.currentPost, groupId: postGroupId },
              //     channelId: "default",
              //   };

              try {
                const response = await fetch(
                  "https://exp.host/--/api/v2/push/send",
                  {
                    method: "POST",
                    headers: {
                      Accept: "application/json",
                      "Accept-encoding": "gzip, deflate",
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(message),
                  }
                );

                const responseData = await response.json();

                if (!response.ok) {
                  console.error(
                    "Failed to send push notification:",
                    response.status,
                    response.statusText
                  );
                }
              } catch (error) {
                console.error("Error sending push notification:", error);
              }
            } else {
              console.log(`No push notification token for user`);
            }
          }
          // B) Commenter (communication & reliability)
          checkAwardsForUser(userID, postGroupId).catch(console.error);

          // C) Post’s author (leadership)
          checkAwardsForUser(postAuthorId, postGroupId).catch(console.error);
        } catch (err) {
          console.error("Error inserting comment:", err);
          socket.emit("insert comment error", {
            error: "Internal server error",
          });
        }
      })
      .catch((err) => {
        console.error("JWT verification failed:", err);
        socket.emit("insert comment error", { error: "Invalid token" });
      });
  });

  socket.on("add post point return updated sum", async (req) => {
    const token = req.token || webToken;
    // Check if token is available
    if (!token) {
      return socket.emit("add post point error", {
        error: "JWT token is required",
      });
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

          //  a) for the person WHO GOT the point
          checkAwardsForUser(recipient_id, req.currentGroup).catch(
            console.error
          );
          //  b) for the person WHO GAVE the point (they may earn reliability/communication)
          checkAwardsForUser(userID, req.currentGroup).catch(console.error);
        } catch (error) {
          console.error("Error adding post point: ", error);
          socket.emit("add post point error", {
            error: "Internal server error",
          });
        }
      })
      .catch(async () => {
        socket.emit("add post point error", { error: "Invalid token" });
      });
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected because:", reason);
  });
});
//   socket.on("disconnect", () => {
//     console.log("user disconnected");

//   });
// });

server.listen(8080, () => {
  console.log("server listening on port 8080");
});
