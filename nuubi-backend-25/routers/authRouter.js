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
  attemptMobileLogin,
  attemptRegister,
  getMessage,
  checkEmail,
  checkWebLogin,
  logout,
  attemptMobileRegister,
} = require("../controllers/authController");

router.route("/login").get(handleLogin).post(validateLoginForm, attemptLogin);

router
  .route("/mobilelogin")
  .get(handleLogin)
  .post(validateLoginForm, attemptMobileLogin);

router.post("/signup", validateSignupForm, attemptRegister);
router.post("/mobilesignup", validateSignupForm, attemptMobileRegister);

router.post("/checkemail", checkEmail);

router.post("/getmessage", getMessage);
router.post("/checkweblogin", checkWebLogin);

router.post("/logout", logout);

module.exports = router;
