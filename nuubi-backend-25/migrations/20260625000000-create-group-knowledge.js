'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Enable pgvector extension
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');

    // 2. Create group_knowledge table
    await queryInterface.createTable('group_knowledge', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      group_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'The actual text chunk'
      },
      embedding: {
        type: 'vector(1536)', // Raw type for pgvector
        allowNull: true
      },
      file_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      s3_key: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // 3. Add vector index for fast similarity search (HNSW index)
    // Note: HNSW is generally better for performance than IVFFlat
    await queryInterface.sequelize.query(
      'CREATE INDEX ON group_knowledge USING hnsw (embedding vector_cosine_ops);'
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('group_knowledge');
  }
};
