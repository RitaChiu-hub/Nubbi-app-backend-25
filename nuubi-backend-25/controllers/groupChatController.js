const pool = require("../db");
const currentDate = new Date();
const { jwtVerify } = require("./jwt/jwtAuth");

const Sequelize = require("sequelize");

var config = {
  define: {
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
};

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
  config: config,
});

const DataTypes = require("sequelize").DataTypes;

const { participants, groups, messages, points, post_comments, posts, users } =
  require("../models/init-models")(sequelize, DataTypes);

module.exports.addMessage = async (req, res) => {
  const newMessage = await messages.create({
    sender_id: req.body.userId,
    group_id: req.body.currentGroup,
    text: req.body.mymessage,
    created_at: currentDate.getTime(),
    updated_at: currentDate.getTime(),
  });

  res.json({
    ...req.body,
    status: "Message successfully sent",
  });
};

module.exports.getMessages = async (req, res) => {
  console.log("get messages is here ");
  const getMessagesQuery = await pool.query(
    "SELECT a.user_id, a.sender_username, a.text, a.messages_id, a.iso_time_sent, coalesce(b.count,0) message_points FROM (SELECT users.id user_id, username sender_username, text, messages.id messages_id, messages.created_at iso_time_sent, messages.created_at messages_created_at FROM messages INNER JOIN users ON messages.sender_id = users.id WHERE messages.group_id = $1) a LEFT JOIN (SELECT COUNT(point_value), messages_id FROM points WHERE group_id = $1 GROUP BY messages_id) b ON a.messages_id = b.messages_id  ORDER BY a.messages_created_at ASC;",
    [req.body.currentGroup]
  );
  res.send(getMessagesQuery.rows);
};

module.exports.getLikes = async (req, res) => {
  jwtVerify(req.body.token, process.env.JWT_SECRET)
    .then(async (decoded) => {
      const userID = decoded.id;
      console.log("hello from getLikes " + userID);
      try {
        const getLikesQuery = await points.findAll({
          attributes: ["messages_id"],
          where: {
            giver_id: userID,
            group_id: req.body.currentGroup,
          },
        });

        res.json(getLikesQuery);
      } catch (error) {
        console.error("Error fetching message likes:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    })
    .catch(async () => {
      res.json({ token: null });
    });
};

module.exports.getImage = async (req, res) => {
  const getImageQuery = await pool.query(
    "SELECT image_base64 FROM practice_pics WHERE id = 32;"
  );
  res.send(getImageQuery.rows);
};

module.exports.uploadImage = async (req, res) => {
  const uploadImageQuery = await pool.query(
    "INSERT INTO practice_pics(image, image_base64) values($1, $2) RETURNING id",
    [req.body.uri, req.body.base64]
  );

  const newImage = uploadImageQuery.rows[0].id;

  res.json({
    ...req.body,
    body: req.body,
    status: newImage,
  });
};
