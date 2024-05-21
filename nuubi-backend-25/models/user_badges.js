const Sequelize = require("sequelize");
module.exports = (sequelize, DataTypes) => {
    const UserBadge = sequelize.define('user_badges', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.STRING,
        references: {
          model: 'users', // name of Target model
          key: 'id', // key in Target model
        },
      },
      badge_id: {
        type: DataTypes.INTEGER,
        references: {
          model: 'badges', // name of Target model
          key: 'id', // key in Target model
        },
      },
      group_id: {
        type: DataTypes.INTEGER,
        references: {
          model: 'groups', // name of Target model
          key: 'id', // key in Target model
        },
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "user_badges",
      schema: "public",
      timestamps: true,
      indexes: [
        {
          name: "user_badges_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
      ],
    });
    return UserBadge;
  };
  