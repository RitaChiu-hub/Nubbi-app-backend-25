const pool = require("../db");

module.exports.addMessage = async (req, res) => {
  const newMessageQuery = await pool.query(
    "INSERT INTO messages(sender_id, group_id, text) values ($1, $2, $3)",
    [req.body.userId, req.body.currentGroup, req.body.mymessage]
  );

  res.json({
    ...req.body,
    status: "Message successfully sent",
  });
};

module.exports.getMessages = async (req, res) => {
  const getMessagesQuery = await pool.query(
    "SELECT a.sender_username, a.text, a.messages_id, a.iso_time_sent, coalesce(b.count,0) message_points FROM (SELECT username sender_username, text, messages.id messages_id, messages.created_at iso_time_sent, messages.created_at messages_created_at FROM messages INNER JOIN users ON messages.sender_id = users.id WHERE messages.group_id = $1) a LEFT JOIN (SELECT COUNT(point_value), messages_id FROM points WHERE group_id = $1 GROUP BY messages_id) b ON a.messages_id = b.messages_id  ORDER BY a.messages_created_at ASC;",
    [req.body.currentGroup]
  );
  res.send(getMessagesQuery.rows);
};

module.exports.getLikes = async (req, res) => {
  const getLikesQuery = await pool.query(
    "SELECT messages_id FROM points WHERE giver_id = $1 AND group_id = $2;",
    [req.body.userId, req.body.currentGroup]
  );
  res.send(getLikesQuery.rows);
};
