const express = require("express");
const router = express.Router();
const {
	addMessage,
	getMessages,
	getLikes,
} = require("../controllers/groupChatController");
const validateAddMessage = require("../controllers/validation/validateMessage");

// add validation that makes sure the message isn't null
router.post("/addmessage", validateAddMessage, addMessage);
router.post("/getmessages", getMessages);
router.post("/getlikes", getLikes);

module.exports = router;
