"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("awards", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: Sequelize.STRING, allowNull: false },
      skill: { type: Sequelize.STRING },
      criteria_text: { type: Sequelize.TEXT, allowNull: false },
      asset_url: { type: Sequelize.STRING },
      unwon_asset_url: { type: Sequelize.STRING },
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
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable("awards");
  },
};
