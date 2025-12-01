const pool = require("../db");

module.exports = {
  // Add
  async addPushToken(userId, token) {
    return pool.query(
      `INSERT INTO push_tokens (user_id, token)
       VALUES ($1, $2)
       ON CONFLICT (token) DO NOTHING`,
      [userId, token]
    );
  },

  // Get
  async getPushTokens(userId) {
    const result = await pool.query(
      `SELECT token FROM push_tokens WHERE user_id = $1`,
      [userId]
    );
    return result.rows.map(row => row.token);
  },

  // Delete
  async removePushToken(token) {
    return pool.query(
      `DELETE FROM push_tokens WHERE token = $1`,
      [token]
    );
  },
};
