const {
    createScheduledPostSchema,
  } = require("./schema");
  
  const validateCreateScheduledPost = async (
    req,
    res,
    next
  ) => {
    console.log(
      "Scheduled post request body:",
      req.body
    );
  
    try {
      await createScheduledPostSchema.validate(
        req.body,
        {
          abortEarly: false,
        }
      );
  
      next();
    } catch (error) {
      console.error(
        "Scheduled post validation error:",
        error
      );
  
      console.error(
        "Validation error message:",
        error?.message
      );
  
      console.error(
        "Validation error details:",
        error?.errors
      );
  
      return res.status(422).json({
        error: "Invalid scheduled post.",
        details: error?.errors || [
          error?.message || "Unknown validation error",
        ],
      });
    }
  };
  
  module.exports = validateCreateScheduledPost;