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

// router.use(verifyUserID);
router.post("/addmessage", validateAddMessage, addMessage);
router.post("/getmessages", getMessages);
router.post("/getlikes", getLikes);
router.post("/uploadimage", uploadImage);
router.post("/getimage", getImage);

module.exports = router;
