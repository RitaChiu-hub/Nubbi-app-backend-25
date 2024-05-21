const Sequelize = require("sequelize");
module.exports = (sequelize, DataTypes) => {
    const UserTask = sequelize.define('user_tasks', {
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
      task_id: {
        type: DataTypes.INTEGER,
        references: {
          model: 'tasks', // name of Target model
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
      tableName: "user_tasks",
      schema: "public",
      timestamps: true,
      indexes: [
        {
          name: "user_tasks_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
      ],
    });
    return UserTask;
  };
  