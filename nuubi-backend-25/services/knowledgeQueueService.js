const { SendMessageCommand } = require("@aws-sdk/client-sqs");
const sqsClient = require("../utils/sqsClient");
require("dotenv").config();

/**
 * Knowledge Queue Service - Handles sending tasks to SQS for RAG processing
 */
class KnowledgeQueueService {
  /**
   * Send a knowledge processing task to SQS
   * @param {Object} data - Task data
   * @param {number} data.knowledgeId - The ID of the record in group_knowledge table
   * @param {number} data.groupId - The group ID
   * @param {string} data.s3Key - The S3 key of the uploaded file
   * @param {string} data.fileName - The original file name
   */
  async sendToProcessingQueue(data) {
    const queueUrl = process.env.AWS_SQS_KNOWLEDGE_QUEUE_URL || process.env.AWS_SQS_QUEUE_URL;

    if (!queueUrl) {
      console.warn("[KnowledgeQueueService] No SQS Queue URL configured, skipping trigger.");
      return null;
    }

    try {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          type: "KNOWLEDGE_PROCESSING",
          payload: {
            knowledgeId: data.knowledgeId,
            groupId: data.groupId,
            s3Key: data.s3Key,
            fileName: data.fileName,
          },
          timestamp: new Date().toISOString(),
        }),
      });

      const response = await sqsClient.send(command);
      console.log(`[KnowledgeQueueService] Task sent to SQS for knowledgeId: ${data.knowledgeId}, MessageId: ${response.MessageId}`);
      return response;
    } catch (err) {
      console.error(`[KnowledgeQueueService] Failed to send SQS message:`, err);
      // We don't throw here to avoid failing the whole request if SQS is down
      return null;
    }
  }
}

module.exports = new KnowledgeQueueService();
