const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "weekly_takeaway_schedules",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      creator_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
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
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      day_of_week: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      timezone: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: "America/Los_Angeles",
      },
      scheduled_time: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: "13:30",
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      body_text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
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
      tableName: "weekly_takeaway_schedules",
      schema: "public",
      timestamps: true,
      indexes: [
        {
          name: "weekly_takeaway_schedules_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
      ],
    }
  );
};