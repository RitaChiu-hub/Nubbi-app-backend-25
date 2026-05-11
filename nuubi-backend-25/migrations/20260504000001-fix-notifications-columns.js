'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add missing columns to notifications table
    await queryInterface.addColumn('notifications', 'type', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.addColumn('notifications', 'post_id', {
      type: Sequelize.INTEGER,
      references: {
        model: 'posts',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      allowNull: true
    });
    await queryInterface.addColumn('notifications', 'message_id', {
      type: Sequelize.INTEGER,
      references: {
        model: 'messages',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('notifications', 'message_id');
    await queryInterface.removeColumn('notifications', 'post_id');
    await queryInterface.removeColumn('notifications', 'type');
  }
};
