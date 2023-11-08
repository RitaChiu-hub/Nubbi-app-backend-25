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

app.use(
  cors({
    origin: "http://localhost:19006",
  })
);

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

const myRouter = require("./routers.js");
const authRouter = require("./routers/authRouter");
const settingsRouter = require("./routers/settingsRouter");
const groupRouter = require("./routers/groupRouter");
const groupchatRouter = require("./routers/groupchatRouter");
const fileRouter = require("./routers/fileRouter");

const { expressjwt: jwt, UnauthorizedError } = require("express-jwt");

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
