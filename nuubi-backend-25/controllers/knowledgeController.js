const knowledgeService = require("../services/knowledgeService");

/**
 * Knowledge Controller - Handles HTTP requests for Group Knowledge Base
 */
class KnowledgeController {
  /**
   * Get S3 Presigned URL for knowledge upload
   */
  async getPresignedUrl(req, res) {
    try {
      const { fileName, fileType } = req.body;
      const { groupId } = req.params;

      if (!fileName || !fileType) {
        return res.status(400).json({ error: "fileName and fileType are required" });
      }

      const result = await knowledgeService.getUploadUrl(fileName, fileType, groupId);
      return res.json(result);
    } catch (err) {
      console.error("[KnowledgeController] Error in getPresignedUrl:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Confirm upload and create record
   */
  async confirmUpload(req, res) {
    try {
      const { groupId } = req.params;
      const { fileName, s3Key, content } = req.body;

      if (!s3Key && !content) {
        return res.status(400).json({ error: "Either s3Key or content is required" });
      }

      const record = await knowledgeService.createKnowledgeRecord({
        groupId,
        fileName,
        s3Key,
        content
      });

      // TODO: Trigger SQS for processing (PDF parsing + Embedding)
      
      return res.status(201).json({
        message: "Knowledge base item added successfully",
        data: record
      });
    } catch (err) {
      console.error("[KnowledgeController] Error in confirmUpload:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * List knowledge base items for a group
   */
  async list(req, res) {
    try {
      const { groupId } = req.params;
      const items = await knowledgeService.listKnowledge(groupId);
      return res.json(items);
    } catch (err) {
      console.error("[KnowledgeController] Error in list:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Delete a knowledge base item
   */
  async delete(req, res) {
    try {
      const { groupId, id } = req.params;
      await knowledgeService.deleteKnowledge(id, groupId);
      return res.json({ message: "Item deleted successfully" });
    } catch (err) {
      console.error("[KnowledgeController] Error in delete:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}

module.exports = new KnowledgeController();
