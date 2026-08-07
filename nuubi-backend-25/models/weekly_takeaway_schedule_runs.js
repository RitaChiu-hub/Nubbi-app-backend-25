const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "weekly_takeaway_schedule_runs",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      schedule_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "weekly_takeaway_schedules",
          key: "id",
        },
      },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "groups",
          key: "id",
        },
      },
      post_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "posts",
          key: "id",
        },
      },
      scheduled_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
      },
    },
    {
      sequelize,
      tableName: "weekly_takeaway_schedule_runs",
      schema: "public",
      timestamps: false,
      indexes: [
        {
          name: "weekly_takeaway_schedule_runs_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
        {
          name: "weekly_takeaway_schedule_runs_unique",
          unique: true,
          fields: [{ name: "schedule_id" }, { name: "scheduled_date" }],
        },
      ],
    }
  );
};