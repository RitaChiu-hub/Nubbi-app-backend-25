"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("posts", "comment_summary", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("posts", "comment_summary_count", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("posts", "comment_summary_keywords", {
      type: Sequelize.TEXT,
      allowNull: true, // comma-separated keyword list, e.g. "black holes, gravity, event horizon"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("posts", "comment_summary_keywords");
    await queryInterface.removeColumn("posts", "comment_summary_count");
    await queryInterface.removeColumn("posts", "comment_summary");
  },
};
