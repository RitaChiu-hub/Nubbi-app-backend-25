require("dotenv").config();

const { sequelize } = require("./config/database"); // 根据你的实际路径调整
const Sequelize = require("sequelize");

async function run() {
    try {
        const queryInterface = sequelize.getQueryInterface();

        // 修改这里，执行你想跑的 migration
        const migrations = [
            "20260322000000-create-user-group-daily-stats",
            "20260504000000-add-ai-tagging-system",
            "20260504000001-fix-notifications-columns",
        ];

        for (const file of migrations) {
            console.log(`Running ${file}...`);

            const migration = require(`./migrations/${file}`);

            await migration.up(queryInterface, Sequelize);

            console.log(`✓ ${file}`);
        }
    } catch (err) {
        console.error("❌ Migration failed:");
        console.error(err);
    } finally {
        await sequelize.close();
    }
}

run();