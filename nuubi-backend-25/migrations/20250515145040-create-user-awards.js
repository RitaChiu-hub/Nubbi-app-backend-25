"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("user_awards", {
      id: {
        type: Sequelize.INTEGER,
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
      award_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "awards",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("now"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("now"),
      },
    });

    // composite unique index to prevent duplicate awards per user/group
    await queryInterface.addConstraint("user_awards", {
      fields: ["user_id", "group_id", "award_id"],
      type: "unique",
      name: "user_awards_unique",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("user_awards");
  },
};
