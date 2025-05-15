const Sequelize = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  const UserAward = sequelize.define(
    "user_awards",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.STRING,
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
      award_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "awards",
          key: "id",
        },
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
      tableName: "user_awards",
      schema: "public",
      timestamps: true,
      indexes: [
        {
          name: "user_awards_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
        {
          name: "user_awards_unique",
          unique: true,
          fields: ["user_id", "group_id", "award_id"],
        },
      ],
    }
  );
  return UserAward;
};
