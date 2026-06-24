'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Ensure pgcrypto extension exists for gen_random_uuid()
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    // 1. Users table
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        unique: true
      },
      email: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true
      },
      username: {
        type: Sequelize.STRING(28),
        allowNull: false,
        unique: true
      },
      passhash: {
        type: Sequelize.STRING,
        allowNull: false
      },
      avatar_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      last_signin: {
        type: Sequelize.DATE,
        allowNull: true
      },
      push_notification_token: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // 2. Groups table
    await queryInterface.createTable('groups', {
      id: {
        autoIncrement: true,
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: 'untitled group'
      },
      description: {
        type: Sequelize.STRING(800),
        allowNull: true
      },
      is_public: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      invite_passcode: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // 3. Participants table
    await queryInterface.createTable('participants', {
      id: {
        autoIncrement: true,
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      group_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      is_admin: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // 4. Posts table
    await queryInterface.createTable('posts', {
      id: {
        autoIncrement: true,
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      body_text: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      sender_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      group_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      image_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      file_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      file_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      view_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      tagging_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // 5. Messages table
    await queryInterface.createTable('messages', {
      id: {
        autoIncrement: true,
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      sender_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      group_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      text: {
        type: Sequelize.STRING,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // 6. Post Comments table
    await queryInterface.createTable('post_comments', {
      id: {
        autoIncrement: true,
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      sender_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      post_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'posts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      comment_text: {
        type: Sequelize.STRING,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // 7. Notifications table
    await queryInterface.createTable('notifications', {
      id: {
        autoIncrement: true,
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      message: {
        type: Sequelize.STRING,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      post_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'posts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      message_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'messages', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      is_read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // 8. Points table
    await queryInterface.createTable('points', {
      id: {
        autoIncrement: true,
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      giver_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' }
      },
      recipient_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' }
      },
      point_value: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      messages_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'messages', key: 'id' }
      },
      posts_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'posts', key: 'id' }
      },
      comment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'post_comments', key: 'id' }
      },
      group_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'groups', key: 'id' }
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // 9. Awards table
    await queryInterface.createTable('awards', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: Sequelize.STRING, allowNull: false },
      skill: { type: Sequelize.STRING },
      criteria_text: { type: Sequelize.TEXT, allowNull: false },
      asset_url: { type: Sequelize.STRING },
      unwon_asset_url: { type: Sequelize.STRING },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    // 10. User Awards table
    await queryInterface.createTable('user_awards', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      group_id: { type: Sequelize.INTEGER, references: { model: 'groups', key: 'id' }, onDelete: 'CASCADE' },
      award_id: { type: Sequelize.INTEGER, references: { model: 'awards', key: 'id' }, onDelete: 'CASCADE' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    // 11. Badges table
    await queryInterface.createTable('badges', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.STRING, allowNull: false },
      criteria: { type: Sequelize.STRING, allowNull: false },
      point_value: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    // 12. User Badges table
    await queryInterface.createTable('user_badges', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      badge_id: { type: Sequelize.INTEGER, references: { model: 'badges', key: 'id' }, onDelete: 'CASCADE' },
      group_id: { type: Sequelize.INTEGER, references: { model: 'groups', key: 'id' }, onDelete: 'CASCADE' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    // 13. User Sessions table
    await queryInterface.createTable('user_sessions', {
      session_id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      started_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      ended_at: { type: Sequelize.DATE, allowNull: true },
      active_seconds: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      device_type: { type: Sequelize.STRING(50), allowNull: true },
      platform: { type: Sequelize.STRING(50), allowNull: true },
      ip_address: { type: Sequelize.STRING(45), allowNull: true },
      country_code: { type: Sequelize.STRING(10), allowNull: true },
      pages_viewed: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      posts_viewed_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      actions_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      errors_encountered: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      connection_drops: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    // 14. User Group Daily Stats table
    await queryInterface.createTable('user_group_daily_stats', {
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        primaryKey: true
      },
      group_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'groups', key: 'id' },
        onDelete: 'CASCADE',
        primaryKey: true
      },
      stat_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        primaryKey: true
      },
      posts_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      comments_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      messages_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      points_earned: { type: Sequelize.INTEGER, defaultValue: 0 },
      active_seconds: { type: Sequelize.INTEGER, defaultValue: 0 },
      sessions_count: { type: Sequelize.INTEGER, defaultValue: 0 }
    });

    // 15. User Session Totals table
    await queryInterface.createTable('user_session_totals', {
      user_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      total_active_seconds: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      total_pages_viewed: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_posts_viewed: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_actions: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_sessions: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_errors: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_connection_drops: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      last_active_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    // Add Indexes
    await queryInterface.addIndex('user_sessions', ['user_id']);
    await queryInterface.addIndex('user_group_daily_stats', ['group_id', 'stat_date']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_session_totals');
    await queryInterface.dropTable('user_group_daily_stats');
    await queryInterface.dropTable('user_sessions');
    await queryInterface.dropTable('user_badges');
    await queryInterface.dropTable('badges');
    await queryInterface.dropTable('user_awards');
    await queryInterface.dropTable('awards');
    await queryInterface.dropTable('points');
    await queryInterface.dropTable('notifications');
    await queryInterface.dropTable('post_comments');
    await queryInterface.dropTable('messages');
    await queryInterface.dropTable('posts');
    await queryInterface.dropTable('participants');
    await queryInterface.dropTable('groups');
    await queryInterface.dropTable('users');
  }
};
