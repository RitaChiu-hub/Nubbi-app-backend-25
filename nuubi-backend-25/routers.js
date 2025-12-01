const express = require("express");
const router = express.Router();

const { getMessage, getMessage2 } = require("./controllers.js");

router.post("/getmessage", getMessage);
router.post("/getmessage2", getMessage2);

module.exports = router;
