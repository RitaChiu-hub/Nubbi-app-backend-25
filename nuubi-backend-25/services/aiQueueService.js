const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
require("dotenv").config();

// Initialize SQS client
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Send post ID to SQS queue to trigger asynchronous AI processing
 * @param {number|string} postId 
 */
async function triggerPostTagging(postId) {
  if (!process.env.AWS_SQS_QUEUE_URL) {
    console.warn("⚠️ AWS_SQS_QUEUE_URL not configured, skipping AI trigger.");
    return;
  }

  try {
    const command = new SendMessageCommand({
      QueueUrl: process.env.AWS_SQS_QUEUE_URL,
      MessageBody: JSON.stringify({
        postId: postId,
        timestamp: new Date().toISOString(),
      }),
    });

    const response = await sqsClient.send(command);
    console.log(`✅ AI task sent to SQS (Post: ${postId}), MessageId: ${response.MessageId}`);
    return response;
  } catch (err) {
    console.error(`❌ Failed to send SQS message (Post: ${postId}):`, err);
    throw err;
  }
}

module.exports = { triggerPostTagging };
