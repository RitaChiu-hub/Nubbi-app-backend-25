const express = require("express");
const router = express.Router();
const { signFile, getS3PresignedUrl } = require("../controllers/fileController");
const { jwtVerifyMiddleware } = require("../controllers/jwt/jwtAuth");

router.post("/sign", signFile);
router.post("/s3-presigned-url", jwtVerifyMiddleware, getS3PresignedUrl);

module.exports = router;
