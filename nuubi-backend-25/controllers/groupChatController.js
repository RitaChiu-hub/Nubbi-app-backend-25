const pool = require("../db");
const {
  Participant,
  Group,
  Message,
  Points,
  Post,
  sequelize,
} = require("../index");
module.exports.addMessage = async (req, res) => {
  // const newMessageQuery = await pool.query(
  //   "INSERT INTO messages(sender_id, group_id, text) values ($1, $2, $3)",
  //   [req.body.userId, req.body.currentGroup, req.body.mymessage]
  // );

  // res.json({
  //   ...req.body,
  //   status: "Message successfully sent",
  // });

  const newMessage = await Message.create({
    sender_id: req.body.userId,
    group_id: req.body.currentGroup,
    text: req.body.mymessage,
  });

  res.json({
    ...req.body,
    status: "Message successfully sent",
  });
};

module.exports.getMessages = async (req, res) => {
  // const getMessagesQuery = await pool.query(
  //     "SELECT a.user_id, a.sender_username, a.text, a.messages_id, a.iso_time_sent, coalesce(b.count,0) message_points FROM (SELECT users.id user_id, username sender_username, text, messages.id messages_id, messages.created_at iso_time_sent, messages.created_at messages_created_at FROM messages INNER JOIN users ON messages.sender_id = users.id WHERE messages.group_id = $1) a LEFT JOIN (SELECT COUNT(point_value), messages_id FROM points WHERE group_id = $1 GROUP BY messages_id) b ON a.messages_id = b.messages_id  ORDER BY a.messages_created_at ASC;",
  //     [req.body.currentGroup]
  // );
  // res.send(getMessagesQuery.rows);
  const messages = await Message.findAll({
    attributes: [
      [sequelize.col("a.id"), "user_id"],
      "sender_username",
      "text",
      "messages_id",
      "iso_time_sent",
      [sequelize.fn("coalesce", sequelize.col("b.count"), 0), "message_points"],
    ],
    include: [
      {
        model: User,
        attributes: ["id", "username"],
      },
      {
        model: Points,
        attributes: [
          [sequelize.fn("COUNT", sequelize.col("point_value")), "point_count"],
        ],
        where: {
          group_id: req.body.currentGroup,
        },
        required: false,
        group: ["messages_id"],
      },
    ],
    order: [[sequelize.col("messages_created_at"), "ASC"]],
  });

  res.send(messages);
};

module.exports.getLikes = async (req, res) => {
  // const getLikesQuery = await pool.query(
  //     "SELECT messages_id FROM points WHERE giver_id = $1 AND group_id = $2;",
  //     [req.body.userId, req.body.currentGroup]
  // );

  const getLikesQuery = await Points.findAll({
    attributes: ["messages_id"],
    where: {
      giver_id: req.body.userId,
      group_id: req.body.currentGroup,
    },
  });

  res.json(getLikesQuery);
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
