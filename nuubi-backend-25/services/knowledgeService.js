const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3Client = require("../utils/s3Client");
const { sequelize, DataTypes } = require("../config/database");
const { group_knowledge } = require("../models/init-models")(
  sequelize,
  DataTypes
);

/**
 * Knowledge Service - Handles logic for Group Knowledge Base (RAG)
 */
class KnowledgeService {
  /**
   * Generate a presigned URL for uploading knowledge base files
   * @param {string} fileName
   * @param {string} fileType
   * @param {number} groupId
   */
  async getUploadUrl(fileName, fileType, groupId) {
    const key = `knowledge-base/group-${groupId}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    }); // 1 hour

    return {
      uploadUrl: presignedUrl,
      s3Key: key,
      fileUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    };
  }

  /**
   * Create a placeholder record in group_knowledge table
   * This is called after the frontend confirms successful upload to S3
   */
  async createKnowledgeRecord(data) {
    const { groupId, fileName, s3Key, content } = data;

    return await group_knowledge.create({
      groupId: groupId,
      fileName: fileName,
      s3Key: s3Key,
      content: content || "Processing...", // Placeholder if it's a file
      // embedding will be filled by the worker later
    });
  }

  /**
   * List all knowledge base items for a group
   */
  async listKnowledge(groupId) {
    const items = await group_knowledge.findAll({
      where: { groupId: groupId },
      attributes: ["id", "fileName", "createdAt", "s3Key"],
      order: [["createdAt", "DESC"]],
    });

    // Add presigned fileUrl to each item for secure viewing
    return await Promise.all(
      items.map(async (item) => {
        const plainItem = item.get({ plain: true });
        if (plainItem.s3Key) {
          const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: plainItem.s3Key,
          });
          // Generate a presigned URL that expires in 1 hour
          plainItem.fileUrl = await getSignedUrl(s3Client, command, {
            expiresIn: 3600,
          });
        }
        return plainItem;
      })
    );
  }

  /**
   * Delete a knowledge base item
   */
  async deleteKnowledge(id, groupId) {
    // 1. Find the item to get the s3Key
    const item = await group_knowledge.findOne({
      where: { id, groupId: groupId },
    });

    if (!item) return 0;

    // 2. Delete from S3
    if (item.s3Key) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: item.s3Key,
        });
        await s3Client.send(deleteCommand);
        console.log(`[KnowledgeService] Deleted from S3: ${item.s3Key}`);
      } catch (err) {
        console.error(`[KnowledgeService] Failed to delete from S3:`, err);
        // We continue to delete from DB even if S3 fails
      }
    }

    // 3. Delete from DB
    return await group_knowledge.destroy({
      where: { id, groupId: groupId },
    });
  }
}

module.exports = new KnowledgeService();
