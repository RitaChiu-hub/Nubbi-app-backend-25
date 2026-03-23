'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_group_daily_stats', {
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        primaryKey: true
      },
      group_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'groups',
          key: 'id'
        },
        onDelete: 'CASCADE',
        primaryKey: true
      },
      stat_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        primaryKey: true
      },
      posts_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      comments_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      messages_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      points_earned: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      active_seconds: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      sessions_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      }
    });

    // 添加索引以加速 group_id + stat_date 的范围查询
    await queryInterface.addIndex('user_group_daily_stats', ['group_id', 'stat_date'], {
      name: 'idx_daily_stats_lookup'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user_group_daily_stats');
  }
};
