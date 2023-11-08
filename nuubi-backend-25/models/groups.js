const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "groups",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "untitled group",
      },
      description: {
        type: DataTypes.STRING(800),
        allowNull: true,
      },
      is_public: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      invite_passcode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "groups",
      schema: "public",
      timestamps: true,
      indexes: [
        {
          name: "groups_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
      ],
    }
  );
};
