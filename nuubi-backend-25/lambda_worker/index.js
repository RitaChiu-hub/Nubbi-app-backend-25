const { Client } = require('pg');
const OpenAI = require('openai');
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// 初始化客户端
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    // 数据库连接配置
    const dbConfig = {
        host: process.env.DATABASE_HOST,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        port: parseInt(process.env.DATABASE_PORT || '5432'),
    };

    // 如果不是 localhost，通常需要 SSL
    if (dbConfig.host !== 'localhost') {
        dbConfig.ssl = { rejectUnauthorized: false };
    }

    const client = new Client(dbConfig);

    try {
        await client.connect();
        console.log("Connected to database");

        for (const record of event.Records) {
            const { postId } = JSON.parse(record.body);
            console.log(`Processing post ID: ${postId}`);

            // 1. 获取帖子内容
            const postRes = await client.query(
                'SELECT title, body_text, image_url FROM posts WHERE id = $1',
                [postId]
            );
            const post = postRes.rows[0];

            if (!post) {
                console.warn(`Post ${postId} not found in database.`);
                continue;
            }

            // 2. 处理 S3 图片签名 (如果是 S3 URL)
            let aiImageUrl = post.image_url;
            if (aiImageUrl && aiImageUrl.includes("amazonaws.com")) {
                try {
                    const urlObj = new URL(aiImageUrl);
                    const s3Key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                    
                    const command = new GetObjectCommand({
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: s3Key,
                    });
                    aiImageUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });
                    console.log(`Generated signed URL for post ${postId}`);
                } catch (s3Err) {
                    console.error("Error signing S3 URL:", s3Err);
                }
            }

            // 3. 调用 OpenAI API
            console.log(`Calling OpenAI for post ${postId}...`);
            const userContent = [
                { type: "text", text: `Title: ${post.title}\n\nContent: ${post.body_text}` }
            ];

            if (aiImageUrl) {
                userContent.push({
                    type: "image_url",
                    image_url: { url: aiImageUrl, detail: "high" }
                });
            }

            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { 
                        role: "system", 
                        content: "You are Cuubi, a friendly, concise peer-help assistant. Answer like a helpful classmate: short, clear, actionable. Analyze images if provided. Keep reply under 800 characters." 
                    },
                    { role: "user", content: userContent }
                ],
                max_tokens: 500
            });

            const answer = response.choices[0]?.message?.content || "(No reply from AI)";

            // 4. 将 AI 回复写回数据库 (作为评论)
            const cuubiUserId = '205851f3-f034-4316-b278-9c962443a5d5';
            await client.query(
                'INSERT INTO post_comments (post_id, sender_id, comment_text, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
                [postId, cuubiUserId, answer]
            );

            // 5. 更新帖子状态
            await client.query(
                'UPDATE posts SET tagging_status = $1 WHERE id = $2',
                ['completed', postId]
            );

            console.log(`Successfully processed post ${postId}`);
        }
    } catch (err) {
        console.error("Lambda Handler Error:", err);
        throw err;
    } finally {
        await client.end();
    }
};
