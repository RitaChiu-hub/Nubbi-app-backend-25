const express = require("express");
const router = express.Router();
const { signFile, getS3PresignedUrl ,checkUrlSafety } = require("../controllers/fileController");
const { jwtVerifyMiddleware } = require("../controllers/jwt/jwtAuth");

router.post("/sign", signFile);
router.post("/s3-presigned-url", jwtVerifyMiddleware, getS3PresignedUrl);
router.post("/check-url-safety", jwtVerifyMiddleware, checkUrlSafety);

module.exports = router;
