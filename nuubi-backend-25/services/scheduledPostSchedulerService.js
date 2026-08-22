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

            if (!schedule) {
              return null;
            }

            const currentTime = new Date();

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