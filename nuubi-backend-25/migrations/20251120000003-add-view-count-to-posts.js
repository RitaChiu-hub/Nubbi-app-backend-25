"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add view_count column to posts table
    await queryInterface.addColumn("posts", "view_count", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // Add index for analytics queries
    await queryInterface.addIndex("posts", ["view_count"], {
      name: "posts_view_count_idx",
    });

    // Add index for combined queries (group + views)
    await queryInterface.addIndex("posts", ["group_id", "view_count"], {
      name: "posts_group_views_idx",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("posts", "posts_group_views_idx");
    await queryInterface.removeIndex("posts", "posts_view_count_idx");
    await queryInterface.removeColumn("posts", "view_count");
  },
};


