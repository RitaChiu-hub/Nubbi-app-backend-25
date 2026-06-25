const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "group_knowledge",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      groupId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "group_id",
        references: {
          model: "groups",
          key: "id",
        },
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      embedding: {
        type: "VECTOR(1536)",
        allowNull: true,
      },
      fileName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "file_name",
      },
      s3Key: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "s3_key",
      },
    },
    {
      sequelize,
      tableName: "group_knowledge",
      schema: "public",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          name: "group_knowledge_pkey",
          unique: true,
          fields: [{ name: "id" }],
        },
      ],
    }
  );
};
