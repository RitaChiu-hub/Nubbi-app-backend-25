const express = require("express");
const router = express.Router();
const {
  addMessage,
  getMessages,
  getLikes,
  uploadImage,
  getImage,
} = require("../controllers/groupChatController");
const validateAddMessage = require("../controllers/validation/validateMessage");
const { verifyUserID } = require("../controllers/jwt/verifyUserId");
const { jwtVerifyMiddleware } = require("../controllers/jwt/jwtAuth");

// Apply JWT middleware to verify the token and decode it
router.use(jwtVerifyMiddleware);

// router.use(verifyUserID);
router.post("/addmessage", validateAddMessage, addMessage);
router.post("/getmessages", getMessages);
router.post("/getlikes", getLikes);
router.post("/uploadimage", uploadImage);
router.post("/getimage", getImage);

module.exports = router;
