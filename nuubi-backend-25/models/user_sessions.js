const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "user_sessions",
    {
      session_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      ended_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      active_seconds: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      device_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      platform: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      country_code: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      pages_viewed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      posts_viewed_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      actions_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      errors_encountered: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      connection_drops: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at",
      },
    },
    {
      sequelize,
      tableName: "user_sessions",
      schema: "public",
      timestamps: true,
      indexes: [
        {
          name: "user_sessions_pkey",
          unique: true,
          fields: [{ name: "session_id" }],
        },
        {
          name: "user_sessions_user_id_idx",
          fields: [{ name: "user_id" }],
        },
        {
          name: "user_sessions_started_at_idx",
          fields: [{ name: "started_at" }],
        },
      ],
    }
  );
};

