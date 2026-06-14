const crypto = require("crypto");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3Client = require("../utils/s3Client");
const cloudinarySecret = process.env.CLOUDINARY_SECRET;

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

    const key = `uploads/${Date.now()}-${fileName}`;
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
