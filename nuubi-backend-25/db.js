const { pool } = require("./config/database");

// 为了保持向后兼容，导出 pool 实例
// 这样旧代码 require("./db") 依然能工作
module.exports = pool;
