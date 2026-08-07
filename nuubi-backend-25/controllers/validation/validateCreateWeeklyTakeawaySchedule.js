const {
    createWeeklyTakeawayScheduleSchema,
  } = require("./schema");
  
  const validateCreateWeeklyTakeawaySchedule = async (req, res, next) => {
    console.log("Weekly takeaway request body:", req.body);
    console.log(
      "Schedule schema:",
      createWeeklyTakeawayScheduleSchema
    );
  
    try {
      await createWeeklyTakeawayScheduleSchema.validate(req.body, {
        abortEarly: false,
      });
  
      next();
    } catch (error) {
      console.error("Full validation error:", error);
      console.error("Validation error message:", error?.message);
      console.error("Validation error details:", error?.errors);
  
      return res.status(422).json({
        error: "Invalid weekly takeaway schedule",
        details: error?.errors || [
          error?.message || "Unknown validation error",
        ],
      });
    }
  };
  
  module.exports = validateCreateWeeklyTakeawaySchedule;