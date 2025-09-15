const Sequelize = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "notifications",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      message: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.STRING,
        references: {
          model: "users", // name of Target model
          key: "id", // key in Target model
        },
      },
      type: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "type",
      },
      post_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "post_id",
      },
      message_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "message_id",
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
      tableName: "notifications",
      schema: "public",
      timestamps: true,
      indexes: [
        {
          name: "notifications_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
      ],
    }
  );
  return Notification;
};
