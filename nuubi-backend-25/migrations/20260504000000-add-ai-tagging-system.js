'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add tagging_status to posts table
    await queryInterface.addColumn('posts', 'tagging_status', {
      type: Sequelize.STRING(20),
      defaultValue: 'pending', // pending, processing, completed, failed
      allowNull: false
    });

    // 2. Create topics table
    await queryInterface.createTable('topics', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      group_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'groups',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Add unique constraint for name within a group
    await queryInterface.addIndex('topics', ['name', 'group_id'], {
      unique: true,
      name: 'unique_topic_per_group'
    });

    // 3. Create post_topic_map table
    await queryInterface.createTable('post_topic_map', {
      post_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'posts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      topic_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'topics',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('post_topic_map');
    await queryInterface.dropTable('topics');
    await queryInterface.removeColumn('posts', 'tagging_status');
  }
};
