const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "users",
    {
      id: {
        type: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
        unique: "users_pkey",
      },
      email: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: "users_email_key",
      },
      username: {
        type: DataTypes.STRING(28),
        allowNull: false,
        unique: "users_username_key",
      },
      passhash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      avatar_url: {
        type: DataTypes.STRING,
        allowNull: true,
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
      push_notification_token: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "users",
      schema: "public",
      timestamps: false,
      indexes: [
        {
          name: "users_email_key",
          unique: true,
          fields: [{ name: "email" }],
        },
        {
          name: "users_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
        {
          name: "users_username_key",
          unique: true,
          fields: [{ name: "username" }],
        },
      ],
    }
  );
};
