"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("group_knowledge_keywords", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
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
      keyword: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "A single key term/concept extracted from the group's knowledge base",
      },
      // Same raw pgvector type + dimension as group_knowledge.embedding, so
      // keyword vectors and comment-thread vectors can be compared directly
      // with pgvector's cosine distance operator (<=>).
      embedding: {
        type: "vector(1536)",
        allowNull: true,
      },
      source_knowledge_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "group_knowledge",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "Which group_knowledge chunk this keyword was extracted from",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    // Avoid piling up exact duplicate keywords for the same group.
    await queryInterface.addIndex("group_knowledge_keywords", ["group_id", "keyword"], {
      unique: true,
      name: "group_knowledge_keywords_group_keyword_unique",
    });

    // Same HNSW cosine-distance index style as group_knowledge, for fast
    // nearest-neighbor keyword lookups.
    await queryInterface.sequelize.query(
      "CREATE INDEX ON group_knowledge_keywords USING hnsw (embedding vector_cosine_ops);"
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("group_knowledge_keywords");
  },
};
