const express = require("express");
const router = express.Router();
const { signFile } = require("../controllers/fileController");

router.post("/sign", signFile);

module.exports = router;
