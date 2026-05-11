const { SendMessageCommand } = require("@aws-sdk/client-sqs");
const sqsClient = require("../utils/sqsClient");
require("dotenv").config();

/**
 * Trigger AI tagging for a post by sending its ID to SQS
 * @param {number} postId - The ID of the post to tag
 */
async function triggerPostTagging(postId) {
  try {
    if (!process.env.AWS_SQS_QUEUE_URL) {
      console.warn("⚠️ AWS_SQS_QUEUE_URL not configured. AI tagging skipped.");
      return;
    }

    const command = new SendMessageCommand({
      QueueUrl: process.env.AWS_SQS_QUEUE_URL,
      MessageBody: JSON.stringify({
        postId: postId,
        timestamp: new Date().toISOString()
      }),
    });

    const response = await sqsClient.send(command);
    console.log(`✅ AI Tagging triggered for post ${postId}. MessageId: ${response.MessageId}`);
    return response;
  } catch (err) {
    console.error(`❌ Failed to trigger AI tagging for post ${postId}:`, err);
    // Don't throw error to avoid breaking the main post creation flow
  }
}

module.exports = {
  triggerPostTagging
};
