const Sequelize = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  const Award = sequelize.define(
    "awards",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      skill: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      criteria_text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      asset_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      unwon_asset_url: {
        type: DataTypes.STRING,
        allowNull: true,
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
      tableName: "awards",
      schema: "public",
      timestamps: true,
      indexes: [
        {
          name: "awards_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
      ],
    }
  );
  return Award;
};
