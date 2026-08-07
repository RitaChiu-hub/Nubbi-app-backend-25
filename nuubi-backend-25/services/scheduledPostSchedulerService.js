"use strict";

const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const initModels = require("../models/init-models");

const {
  posts,
  scheduled_posts,
} = initModels(sequelize);

const runScheduledPostScheduler = async () => {
  console.log(
    "[scheduled post scheduler] Checking due scheduled posts"
  );

  const result = {
    checkedSchedules: 0,
    publishedPosts: 0,
    skippedSchedules: 0,
    failedSchedules: 0,
    errors: [],
  };

  /*
   * 先找出：
   * 1. 尚未發布
   * 2. 排程時間已到
   *
   * 使用 <=，所以 backend 重啟後，
   * 之前漏掉的排程也仍然可以補發。
   */
  const dueSchedules = await scheduled_posts.findAll({
    attributes: ["id"],
    where: {
      status: "pending",
      scheduled_at: {
        [Op.lte]: new Date(),
      },
    },
    order: [["scheduled_at", "ASC"]],
    raw: true,
  });

  result.checkedSchedules = dueSchedules.length;

  console.log(
    `[scheduled post scheduler] Found ${dueSchedules.length} due scheduled posts`
  );

  for (const dueSchedule of dueSchedules) {
    try {
      /*
       * 每筆使用 transaction 和 row lock。
       * 避免兩個 scheduler 同時建立重複貼文。
       */
      const publishedResult =
        await sequelize.transaction(
          async (transaction) => {
            const schedule =
              await scheduled_posts.findOne({
                where: {
                  id: dueSchedule.id,
                  status: "pending",
                  scheduled_at: {
                    [Op.lte]: new Date(),
                  },
                },
                transaction,
                lock: transaction.LOCK.UPDATE,
              });

            /*
             * 可能已經被另一個 scheduler 處理。
             */
            if (!schedule) {
              return null;
            }

            const currentTime = new Date();

            /*
             * 完全沿用 Weekly Takeaway scheduler
             * 建立 posts 時使用的欄位。
             */
            const createdPost = await posts.create(
              {
                sender_id: schedule.creator_id,
                group_id: schedule.group_id,
                title: schedule.title,
                body_text: schedule.body_text,
                image_url:
                schedule.image_url || null,
              
              file_url:
                schedule.file_url || null,
              
              file_name:
                schedule.file_name || null,
                created_at: currentTime,
                updated_at: currentTime,
              },
              {
                transaction,
              }
            );

            await schedule.update(
              {
                status: "published",
                post_id: createdPost.id,
                published_at: currentTime,
                error_message: null,
              },
              {
                transaction,
              }
            );

            return {
              scheduleId: schedule.id,
              postId: createdPost.id,
            };
          }
        );

      if (!publishedResult) {
        console.log(
          `[scheduled post scheduler] Schedule ${dueSchedule.id} was already handled`
        );

        result.skippedSchedules += 1;
        continue;
      }

      console.log(
        "[scheduled post scheduler] Published scheduled post",
        publishedResult
      );

      result.publishedPosts += 1;
    } catch (error) {
      console.error(
        `[scheduled post scheduler] Failed to publish schedule ${dueSchedule.id}:`,
        error
      );

      result.failedSchedules += 1;

      result.errors.push({
        scheduleId: dueSchedule.id,
        message: error.message,
      });

      /*
       * Transaction 失敗時，post insert 會 rollback。
       * 再把排程標成 failed，方便從資料庫查看原因。
       */
      try {
        await scheduled_posts.update(
          {
            status: "failed",
            error_message:
              error.message ||
              "Unknown scheduled post publishing error",
          },
          {
            where: {
              id: dueSchedule.id,
              status: "pending",
            },
          }
        );
      } catch (updateError) {
        console.error(
          `[scheduled post scheduler] Unable to mark schedule ${dueSchedule.id} as failed:`,
          updateError
        );
      }
    }
  }

  return result;
};

module.exports = {
  runScheduledPostScheduler,
};