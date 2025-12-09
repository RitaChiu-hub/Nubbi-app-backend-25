const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "user_session_totals",
    {
      user_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      total_active_seconds: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
      total_pages_viewed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_posts_viewed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_actions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_sessions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_errors: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_connection_drops: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      last_active_at: {
        type: DataTypes.DATE,
        allowNull: true,
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
      tableName: "user_session_totals",
      schema: "public",
      timestamps: true,
      indexes: [
        {
          name: "user_session_totals_pkey",
          unique: true,
          fields: [{ name: "user_id" }],
        },
      ],
    }
  );
};

