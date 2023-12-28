const express = require("express");
const router = express.Router();
const pool = require("../db.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  handleDeleteAccount,
  handleUpdateUsername,
  handleUpdatePassword,
  handleForgotPassword,
  handleGeneratePasscode,
  handleGenerateSignUpCode,
  handleUpdateAvatar,
  handleGetAvatar,
  handleDeleteAvatar,
  handleValidateSignUpCode,
  handleValidateSignUp,
} = require("../controllers/settingsController");
const validateChangeUsernameForm = require("../controllers/validation/validateChangeUsernameForm");
const validateChangePasswordForm = require("../controllers/validation/validateChangePasswordForm");
const validateForgotPasswordForm = require("../controllers/validation/validateForgotPasswordForm");

router.post("/delete", handleDeleteAccount);

router.post("/updateavatar", handleUpdateAvatar);

router.post("/getuseravatar", handleGetAvatar);

router.post("/deleteavatar", handleDeleteAvatar);

router.post(
  "/updateusername",
  validateChangeUsernameForm,
  handleUpdateUsername
);
router.post(
  "/updatepassword",
  validateChangePasswordForm,
  handleUpdatePassword
);
router.post("/generatepasscode", handleGeneratePasscode);

router.post("/generatesignupcode", handleGenerateSignUpCode);

router.post("/validatesignup", handleValidateSignUp);

router.post(
  "/forgotpassword",
  validateForgotPasswordForm,
  handleForgotPassword
);

module.exports = router;
