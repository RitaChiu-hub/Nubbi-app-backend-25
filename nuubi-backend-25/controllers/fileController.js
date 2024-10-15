const crypto = require("crypto");
const cloudinarySecret = process.env.CLOUDINARY_SECRET;

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
