const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  database: process.env.DATABASE_NAME,
  host: process.env.DATABASE_HOST,
  password: process.env.DATABASE_PASSWORD,
  user: process.env.DATABASE_USER,
  port: process.env.DATABASE_PORT,
  // Only use SSL if explicitly enabled in environment
  ssl: false, // Force disable SSL for local development
});

module.exports = pool;
