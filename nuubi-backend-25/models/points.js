const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "points",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      giver_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      recipient_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      point_value: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      messages_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "messages",
          key: "id",
        },
      },
      posts_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "posts",
          key: "id",
        },
      },
      comment_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "post_comments",
          key: "id",
        },
      },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "groups",
          key: "id",
        },
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
      task_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "tasks",
          key: "id",
        },
      },
    },
    {
      sequelize,
      tableName: "points",
      schema: "public",
      timestamps: true,
      indexes: [
        {
          name: "points_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
      ],
    }
  );
};
