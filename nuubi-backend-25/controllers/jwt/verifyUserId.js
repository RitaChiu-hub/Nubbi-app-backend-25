const { UnauthorizedError } = require("express-jwt");

console.log("Hi???");

module.exports.verifyUserID = (req, res, next) => {
  console.log("---------inside verifyuserid---------");
  // Debugging: Log req.auth to check if it's defined

  // console.log("req:", req);
  console.log("req.auth:", req.auth);
  console.log("req.body:", req.body);

  if (req.auth.id !== req.body.token) {
    throw new UnauthorizedError("invalid_token", {
      message: "Invalid user id",
    });
  } else {
    next();
  }
};
