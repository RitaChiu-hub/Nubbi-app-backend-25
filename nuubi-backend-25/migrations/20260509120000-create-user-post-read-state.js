"use strict";

/*
 * Table: user_post_read_state
 *
 * user_id
 *   Foreign key to users(id). ON DELETE CASCADE.
 *
 * post_id
 *   Foreign key to posts(id). ON DELETE CASCADE.
 *
 * last_read_at
 *   Same role as lastViewedPosts[postId]: last time this user marked this thread caught up.
 *
 * created_at, updated_at
 *   Standard rows.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("user_post_read_state", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
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
      post_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "posts",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      last_read_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
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

    await queryInterface.addIndex("user_post_read_state", ["user_id", "post_id"], {
      unique: true,
      name: "user_post_read_state_user_post_uidx",
    });

    await queryInterface.addIndex("user_post_read_state", ["user_id"], {
      name: "user_post_read_state_user_id_idx",
    });

    await queryInterface.addIndex("user_post_read_state", ["post_id"], {
      name: "user_post_read_state_post_id_idx",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("user_post_read_state");
  },
};
