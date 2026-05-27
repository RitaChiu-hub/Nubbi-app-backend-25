const { Pool } = require("pg");
const { Sequelize, DataTypes } = require("sequelize");
require("dotenv").config();

/**
 * Database Configuration Center
 * 
 * This file integrates:
 * 1. Native SQL connection pool (pg Pool) -> Replaces root db.js
 * 2. Sequelize instance -> For Controllers and Models
 * 3. Intelligent SSL logic -> Automatically detects localhost or cloud environment
 */

const dbConfig = {
  database: process.env.DATABASE_NAME,
  host: process.env.DATABASE_HOST,
  password: process.env.DATABASE_PASSWORD,
  user: process.env.DATABASE_USER,
  port: process.env.DATABASE_PORT || 5432,
};

// Intelligent SSL logic: only enable encryption for non-localhost environments
const isLocal = dbConfig.host === "localhost" || dbConfig.host === "127.0.0.1";
const sslConfig = isLocal ? false : { require: true, rejectUnauthorized: false };

// 1. Create pg Pool (for native SQL queries)
const pool = new Pool({
  ...dbConfig,
  ssl: sslConfig,
});

// 2. Create Sequelize instance (for ORM usage)
const sequelize = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: sslConfig,
  },
});

// Export all required objects
module.exports = {
  pool,      // Replaces original require("../db") functionality
  sequelize, // For require("../config/database") usage
  DataTypes, // For Model definitions
};
