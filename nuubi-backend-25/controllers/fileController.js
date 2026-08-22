const crypto = require("crypto");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3Client = require("../utils/s3Client");
const cloudinarySecret = process.env.CLOUDINARY_SECRET;
const GOOGLE_SAFE_BROWSING_API_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;


/**
 * Generate S3 Presigned URL for direct frontend upload
 */
module.exports.getS3PresignedUrl = async (req, res) => {
  try {
    console.log("[getS3PresignedUrl] Request body:", req.body);
    const { fileName, fileType } = req.body;
    
    if (!fileName || !fileType) {
      console.warn("[getS3PresignedUrl] Missing fileName or fileType");
      return res.status(400).json({ error: "fileName and fileType are required" });
    }
    // Only retrieve the filename itself, remove any path information
    const originalFileName = String(fileName || "")
  .split(/[\\/]/)
  .pop();
// Further clean up the file names to create "safe file names".
const safeFileName = originalFileName
  .trim()
  .replace(/\s+/g, "-")
  .replace(/[^a-zA-Z0-9._-]/g, "_");
// Use the cleaned filenames to form the final S3 key, and add a timestamp to avoid filename conflicts.
const key = `uploads/${Date.now()}-${safeFileName}`;

console.log("[getS3PresignedUrl]", {
  originalFileName,
  safeFileName,
  key,
  fileType,
});
    console.log("[getS3PresignedUrl] Generating URL for key:", key);
    
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    // URL valid for 5 minutes for upload
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    console.log("[getS3PresignedUrl] Successfully generated URL");

    return res.json({
      uploadUrl: presignedUrl,
      fileUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      key: key
    });
  } catch (err) {
    console.error("Error generating S3 presigned URL:", err);
    return res.status(500).json({ error: "Failed to generate upload URL" });
  }
};

/**
 * Helper to generate a temporary download URL for AI to see the private S3 image
 */
module.exports.getTemporaryDownloadUrl = async (key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
  });
  // URL valid for 10 minutes
  return await getSignedUrl(s3Client, command, { expiresIn: 600 });
};

module.exports.signFile = async (req, res) => {
  const fileHashes = {};

  for (const { public_id, timestamp } of req.body.files) {
    // console.log(
    //   `public_id=${public_id}&timestamp=${timestamp}${cloudinarySecret}`
    // );
    fileHashes[public_id] = crypto
      .createHash("sha1")
      .update(
        `public_id=${public_id}&timestamp=${timestamp}${cloudinarySecret}`
      )
      .digest("hex");
  }

  return res.json(fileHashes);
};

/**
 * Uses the Google Safe Browsing API to check if a URL is associated with malware or phishing.
 * The API key is stored only in a backend environment variable (GOOGLE_SAFE_BROWSING_API_KEY);
 * the frontend calls this backend API and never accesses the key itself.
 *
 * A "fail-open" strategy is used: if any issue arises during the check
 * (e.g., missing API key, failed request to Google, network error),
 * the function returns { safe: true }. This ensures that users are not prevented
 * from posting due to instability in the security check service itself—
 * errors are simply logged (via console.error) for later troubleshooting.
 * If a more conservative approach is desired (blocking the action upon check failure,
 * or "fail-closed"), simply change the corresponding return value to { safe: false }.
 */
module.exports.checkUrlSafety = async (req, res) => {
  try {
    const { url } = req.body;
 
    if (!url) {
      return res.status(400).json({ error: "url is required" });
    }
 
    if (!GOOGLE_SAFE_BROWSING_API_KEY) {
      console.error("[checkUrlSafety] Missing GOOGLE_SAFE_BROWSING_API_KEY env var");
      return res.json({ safe: true }); // fail-open：設定沒弄好也不擋使用者，但錯誤要看得到
    }
 
    const safeBrowsingRes = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_SAFE_BROWSING_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: {
            clientId: "nuubi-app",
            clientVersion: "1.0.0",
          },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
      }
    );
 
     if (!safeBrowsingRes.ok) {
      // If the request to Google Safe Browsing fails (e.g., network error, invalid API key), log the error and return { safe: true } to avoid blocking users due to backend issues.
      console.error(
        "[checkUrlSafety] Google Safe Browsing request failed:",
        safeBrowsingRes.status
      );
      return res.json({ safe: true }); // fail-open
    }
 
    const data = await safeBrowsingRes.json();
 
    // Google only returns the 'matches' field if the URL is actually flagged;
    // the absence of 'matches' indicates that the URL is clean.
    if (data.matches && data.matches.length > 0) {
      return res.json({
        safe: false,
        threatType: data.matches[0].threatType,
      });
    }
 
    return res.json({ safe: true });
  } catch (err) {
    console.error("[checkUrlSafety] Error:", err);
    return res.json({ safe: true }); // fail-open
  }
};

