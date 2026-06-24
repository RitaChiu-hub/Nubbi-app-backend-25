const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "user_group_daily_stats",
    {
      user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        primaryKey: true,
      },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "groups",
          key: "id",
        },
        primaryKey: true,
      },
      stat_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        primaryKey: true,
      },
      posts_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      comments_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      messages_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      points_earned: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      active_seconds: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      sessions_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      tableName: "user_group_daily_stats",
      schema: "public",
      timestamps: false,
      indexes: [
        {
          name: "idx_daily_stats_lookup",
          fields: [{ name: "group_id" }, { name: "stat_date" }],
        },
      ],
    }
  );
};
