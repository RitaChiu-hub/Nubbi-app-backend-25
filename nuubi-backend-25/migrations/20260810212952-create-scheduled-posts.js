"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("scheduled_posts", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      creator_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      group_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "groups",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      title: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },

      body_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      scheduled_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      scheduled_time: {
        type: Sequelize.STRING(5),
        allowNull: false,
      },

      timezone: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },

      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "pending",
      },

      post_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      published_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      image_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      file_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      file_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("scheduled_posts", [
      "status",
      "scheduled_at",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("scheduled_posts");
  },
};