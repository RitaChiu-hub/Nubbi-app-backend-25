import { createHash } from "crypto";
const cloudinarySecret = process.env.CLOUDINARY_SECRET;

export async function signFile(req, res) {
  const fileHashes = {};

  for (const { public_id, timestamp } of req.body.files) {
    console.log(
      `public_id=${public_id}&timestamp=${timestamp}${cloudinarySecret}`
    );
    fileHashes[public_id] = createHash("sha1")
      .update(
        `public_id=${public_id}&timestamp=${timestamp}${cloudinarySecret}`
      )
      .digest("hex");
  }

  return res.json(fileHashes);
}
