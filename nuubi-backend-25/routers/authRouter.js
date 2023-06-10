const express = require("express");
const router = express.Router();
const validateLoginForm = require("../controllers/validation/validateLoginForm");
const validateSignupForm = require("../controllers/validation/validateSignupForm");
const pool = require("../db.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  handleLogin,
  attemptLogin,
  attemptRegister,
  getMessage,
} = require("../controllers/authController");
require("dotenv").config();

router.route("/login").get(handleLogin).post(validateLoginForm, attemptLogin);

//router.post("/signup", validateSignupForm, attemptRegister);
router.post("/signup", attemptRegister);

router.post("/getmessage", getMessage);

module.exports = router;
