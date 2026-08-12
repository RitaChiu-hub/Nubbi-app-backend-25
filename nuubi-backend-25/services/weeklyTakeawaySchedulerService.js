const { sequelize } = require("../config/database");
const initModels = require("../models/init-models");
const { DateTime } = require("luxon");

const {
  posts,
  weekly_takeaway_schedules,
  weekly_takeaway_schedule_runs,
} = initModels(sequelize);

const DEFAULT_TIME_ZONE = "America/Los_Angeles";

const getDateInfoForTimezone = (
    timezone = DEFAULT_TIME_ZONE,
    date = new Date()
  ) => {
    const safeTimezone = timezone || DEFAULT_TIME_ZONE;
  
    let localDateTime = DateTime.fromJSDate(date)
      .setZone(safeTimezone)
      .setLocale("en");
  
    if (!localDateTime.isValid) {
      localDateTime = DateTime.fromJSDate(date)
        .setZone(DEFAULT_TIME_ZONE)
        .setLocale("en");
    }
  
    return {
      localDate: localDateTime.toISODate(),
      localDayName: localDateTime.toFormat("cccc"),
      localTime: localDateTime.toFormat("HH:mm"),
    };
  };

const parseDateOnlyAsUTC = (dateOnly) => {
  const [year, month, day] = String(dateOnly).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const getDateOnlyValue = (dateValue) => {
  if (dateValue instanceof Date) {
    return dateValue.toISOString().split("T")[0];
  }

  return String(dateValue).split("T")[0];
};

const getWeekNumber = (startDate, scheduledDate) => {
  const start = parseDateOnlyAsUTC(getDateOnlyValue(startDate));
  const current = parseDateOnlyAsUTC(getDateOnlyValue(scheduledDate));

  const diffInMs = current - start;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  return Math.floor(diffInDays / 7) + 1;
};

const buildPostTitle = (baseTitle, weekNumber) => {
  return `Week ${weekNumber}: ${baseTitle}`;
};

const runWeeklyTakeawayScheduler = async () => {
  console.log("[weekly takeaway scheduler] Checking active schedules");

  const result = {
    checkedSchedules: 0,
    matchedSchedules: 0,
    createdPosts: 0,
    skippedSchedules: 0,
    errors: [],
  };

  const schedules = await weekly_takeaway_schedules.findAll({
    where: {
      is_active: true,
    },
  });

  result.checkedSchedules = schedules.length;

  for (const schedule of schedules) {
    const timezone = schedule.timezone || DEFAULT_TIME_ZONE;
    const { localDate, localDayName, localTime } = getDateInfoForTimezone(timezone);

    const startDate = getDateOnlyValue(schedule.start_date);
    const endDate = getDateOnlyValue(schedule.end_date);
    console.log("[expired schedule debug]", {
        scheduleId: schedule.id,
        localDate,
        endDate,
        localDateType: typeof localDate,
        endDateType: typeof endDate,
        isExpired: localDate > endDate,
      });

    // Deactivate expired schedules
  if (localDate > endDate) {
    await schedule.update({
      is_active: false,
    });

    console.log(
      "[weekly takeaway scheduler] Deactivated expired schedule",
      {
        scheduleId: schedule.id,
        endDate,
        localDate,
      }
    );

    result.skippedSchedules += 1;
    continue;
  }


    const isWithinDateRange =
      localDate >= startDate && localDate <= endDate;

    const isCorrectDay = localDayName === schedule.day_of_week;
    const scheduledTime = schedule.scheduled_time || "13:30";
    const isCorrectTime = localTime === scheduledTime;

    console.log("[weekly takeaway scheduler timezone check]", {
        scheduleId: schedule.id,
        timezone,
        localDate,
        localDayName,
        localTime,
        startDate,
        endDate,
        scheduledDay: schedule.day_of_week,
        scheduledTime,
        isWithinDateRange,
        isCorrectDay,
        isCorrectTime,
    });

    if (!isWithinDateRange || !isCorrectDay || !isCorrectTime) {
        result.skippedSchedules += 1;
        continue;
      }

    result.matchedSchedules += 1;

    try {
      const newPost = await sequelize.transaction(async (transaction) => {
        const existingRun = await weekly_takeaway_schedule_runs.findOne({
          where: {
            schedule_id: schedule.id,
            scheduled_date: localDate,
          },
          transaction,
        });

        if (existingRun) {
          return null;
        }

        const currentTime = new Date();
        const weekNumber = getWeekNumber(schedule.start_date, localDate);
        const postTitle = buildPostTitle(schedule.title, weekNumber);

        const createdPost = await posts.create(
          {
            sender_id: schedule.creator_id,
            group_id: schedule.group_id,
            title: postTitle,
            body_text: schedule.body_text,
            image_url: null,
            file_url: null,
            file_name: null,
            created_at: currentTime,
            updated_at: currentTime,
          },
          { transaction }
        );

        await weekly_takeaway_schedule_runs.create(
          {
            schedule_id: schedule.id,
            group_id: schedule.group_id,
            post_id: createdPost.id,
            scheduled_date: localDate,
            created_at: currentTime,
          },
          { transaction }
        );

        return createdPost;
      });

      if (!newPost) {
        console.log(
          `[weekly takeaway scheduler] Schedule ${schedule.id} already ran for ${localDate} in ${timezone}`
        );
        result.skippedSchedules += 1;
        continue;
      }

      console.log(
        `[weekly takeaway scheduler] Created post ${newPost.id} for schedule ${schedule.id}`
      );

      result.createdPosts += 1;
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        console.log(
          `[weekly takeaway scheduler] Schedule ${schedule.id} was already created by another run`
        );
        result.skippedSchedules += 1;
        continue;
      }

      console.error(
        `[weekly takeaway scheduler] Error running schedule ${schedule.id}:`,
        error
      );

      result.errors.push({
        scheduleId: schedule.id,
        message: error.message,
      });
    }
  }

  return result;
};

module.exports = {
  runWeeklyTakeawayScheduler,
};