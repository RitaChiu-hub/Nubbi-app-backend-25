"use strict";

const tableExists = async (queryInterface, tableName) => {
  const [result] = await queryInterface.sequelize.query(
    `SELECT to_regclass('public.${tableName}') AS table_name;`
  );

  return result[0].table_name !== null;
};

const indexExists = async (queryInterface, indexName) => {
  const [result] = await queryInterface.sequelize.query(
    `
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = '${indexName}';
    `
  );

  return result.length > 0;
};

const columnExists = async (queryInterface, tableName, columnName) => {
  const [result] = await queryInterface.sequelize.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = '${tableName}'
      AND column_name = '${columnName}';
    `
  );

  return result.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const schedulesTableExists = await tableExists(
      queryInterface,
      "weekly_takeaway_schedules"
    );

    const runsTableExists = await tableExists(
      queryInterface,
      "weekly_takeaway_schedule_runs"
    );

    if (!schedulesTableExists) {
      await queryInterface.createTable("weekly_takeaway_schedules", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        creator_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
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
        start_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        end_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        day_of_week: {
          type: Sequelize.STRING(20),
          allowNull: false,
        },
        timezone: {
          type: Sequelize.STRING(64),
          allowNull: false,
          defaultValue: "America/Los_Angeles",
        },
        scheduled_time: {
          type: Sequelize.STRING(5),
          allowNull: false,
          defaultValue: "13:30",
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        body_text: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });
    }

    if (schedulesTableExists) {
      const scheduledTimeColumnExists = await columnExists(
        queryInterface,
        "weekly_takeaway_schedules",
        "scheduled_time"
      );

      if (!scheduledTimeColumnExists) {
        await queryInterface.addColumn(
          "weekly_takeaway_schedules",
          "scheduled_time",
          {
            type: Sequelize.STRING(5),
            allowNull: false,
            defaultValue: "13:30",
          }
        );
      }
    }

    if (!runsTableExists) {
      await queryInterface.createTable("weekly_takeaway_schedule_runs", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        schedule_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "weekly_takeaway_schedules",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
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
        post_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "posts",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        scheduled_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });
    }

    const uniqueIndexExists = await indexExists(
      queryInterface,
      "weekly_takeaway_schedule_runs_unique"
    );

    if (!uniqueIndexExists) {
      await queryInterface.addIndex("weekly_takeaway_schedule_runs", {
        fields: ["schedule_id", "scheduled_date"],
        unique: true,
        name: "weekly_takeaway_schedule_runs_unique",
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("weekly_takeaway_schedule_runs");
    await queryInterface.dropTable("weekly_takeaway_schedules");
  },
};