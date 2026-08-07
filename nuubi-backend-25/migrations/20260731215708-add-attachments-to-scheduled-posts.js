"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable(
      "scheduled_posts"
    );

    if (!columns.image_url) {
      await queryInterface.addColumn(
        "scheduled_posts",
        "image_url",
        {
          type: Sequelize.TEXT,
          allowNull: true,
        }
      );
    }

    if (!columns.file_url) {
      await queryInterface.addColumn(
        "scheduled_posts",
        "file_url",
        {
          type: Sequelize.TEXT,
          allowNull: true,
        }
      );
    }

    if (!columns.file_name) {
      await queryInterface.addColumn(
        "scheduled_posts",
        "file_name",
        {
          type: Sequelize.STRING(255),
          allowNull: true,
        }
      );
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable(
      "scheduled_posts"
    );

    if (columns.file_name) {
      await queryInterface.removeColumn(
        "scheduled_posts",
        "file_name"
      );
    }

    if (columns.file_url) {
      await queryInterface.removeColumn(
        "scheduled_posts",
        "file_url"
      );
    }

    if (columns.image_url) {
      await queryInterface.removeColumn(
        "scheduled_posts",
        "image_url"
      );
    }
  },
};