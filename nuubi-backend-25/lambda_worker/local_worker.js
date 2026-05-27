const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const { Client } = require('pg');
const OpenAI = require('openai');
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
require('dotenv').config({ path: '../.env' });

// 初始化客户端
const sqsClient = new SQSClient({ 
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const s3Client = new S3Client({ 
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

async function processMessage(message) {
    const { postId } = JSON.parse(message.Body);
    console.log(`\n📦 收到新任务: Post ID ${postId}`);

    const dbClient = new Client({
        host: process.env.DATABASE_HOST,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        port: parseInt(process.env.DATABASE_PORT || '5432'),
    });

    try {
        await dbClient.connect();
        
        // 1. 获取帖子内容
        const postRes = await dbClient.query('SELECT title, body_text, image_url FROM posts WHERE id = $1', [postId]);
        const post = postRes.rows[0];
        if (!post) return;

        // 2. 处理图片签名
        let aiImageUrl = post.image_url;
        if (aiImageUrl && aiImageUrl.includes("amazonaws.com")) {
            const urlObj = new URL(aiImageUrl);
            const s3Key = urlObj.pathname.substring(1);
            const command = new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: s3Key });
            aiImageUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });
            console.log("🖼️ 已生成图片临时访问链接");
        }

        // 3. 调用 AI
        console.log("🤖 正在请求 OpenAI...");
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are Cuubi, a friendly peer-help assistant." },
                { role: "user", content: [
                    { type: "text", text: `Title: ${post.title}\n\nContent: ${post.body_text}` },
                    ...(aiImageUrl ? [{ type: "image_url", image_url: { url: aiImageUrl } }] : [])
                ]}
            ]
        });

        const answer = response.choices[0].message.content;

        // 4. 写回数据库
        const cuubiUserId = '205851f3-f034-4316-b278-9c962443a5d5';
        await dbClient.query(
            'INSERT INTO post_comments (post_id, sender_id, comment_text, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
            [postId, cuubiUserId, answer]
        );
        await dbClient.query('UPDATE posts SET tagging_status = $1 WHERE id = $2', ['completed', postId]);

        console.log(`✅ 处理完成！Cuubi 已回复帖子 ${postId}`);
    } catch (err) {
        console.error("❌ 处理失败:", err);
    } finally {
        await dbClient.end();
    }
}

async function pollSQS() {
    console.log("🚀 本地 Worker 已启动，正在监听 SQS 队列...");
    
    while (true) {
        try {
            const command = new ReceiveMessageCommand({
                QueueUrl: process.env.AWS_SQS_QUEUE_URL,
                MaxNumberOfMessages: 1,
                WaitTimeSeconds: 20 // 长轮询，节省请求次数
            });

            const response = await sqsClient.send(command);

            if (response.Messages) {
                for (const message of response.Messages) {
                    await processMessage(message);
                    // 处理完后从队列删除消息
                    await sqsClient.send(new DeleteMessageCommand({
                        QueueUrl: process.env.AWS_SQS_QUEUE_URL,
                        ReceiptHandle: message.ReceiptHandle
                    }));
                }
            }
        } catch (err) {
            console.error("SQS 轮询错误:", err);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

pollSQS();
