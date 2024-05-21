const Sequelize = require("sequelize");
module.exports = (sequelize, DataTypes) => {
    const Task = sequelize.define('tasks', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      criteria: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      point_value: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
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
      tableName: "tasks",
      schema: "public",
      timestamps: true,
      indexes: [
        {
          name: "tasks_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
      ],
    });
    return Task;
  };
  