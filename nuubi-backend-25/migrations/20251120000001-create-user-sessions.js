"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("user_sessions", {
      session_id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      ended_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      active_seconds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      device_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      platform: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      country_code: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      pages_viewed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      posts_viewed_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      actions_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      errors_encountered: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      connection_drops: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    // Add indexes for query performance
    await queryInterface.addIndex("user_sessions", ["user_id"], {
      name: "user_sessions_user_id_idx",
    });

    await queryInterface.addIndex("user_sessions", ["started_at"], {
      name: "user_sessions_started_at_idx",
    });

    await queryInterface.addIndex("user_sessions", ["user_id", "started_at"], {
      name: "user_sessions_user_started_idx",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("user_sessions");
  },
};

