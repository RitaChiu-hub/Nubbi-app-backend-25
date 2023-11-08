const { UnauthorizedError } = require("express-jwt");

module.exports.verifyUserID = (req, res, next) => {
  if (req.auth.id !== req.body.userId) {
    throw new UnauthorizedError("invalid_token", {
      message: "Invalid user id",
    });
  } else {
    next();
  }
};
