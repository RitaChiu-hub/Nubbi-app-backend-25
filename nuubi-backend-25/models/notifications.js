const Sequelize = require("sequelize");
module.exports = (sequelize, DataTypes) => {
    const Notification = sequelize.define('notifications', {
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
          model: 'users', // name of Target model
          key: 'id', // key in Target model
        },
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
    });
    return Notification;
  };
  