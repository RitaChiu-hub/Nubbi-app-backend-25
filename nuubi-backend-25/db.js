const { pool } = require("./config/database");

// For backward compatibility, export the pool instance
// so that old code like require("./db") still works.
module.exports = pool;
