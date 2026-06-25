const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { OpenAI } = require("openai");
const pdf = require("pdf-parse");
const { Client } = require("pg");

// Initialize Clients
const s3 = new S3Client({ region: process.env.AWS_REGION });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.handler = async (event) => {
  const dbClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await dbClient.connect();

    for (const record of event.Records) {
      const body = JSON.parse(record.body);
      if (body.type !== "KNOWLEDGE_PROCESSING") continue;

      const { knowledgeId, s3Key, fileName } = body.payload;
      console.log(`Processing knowledgeId: ${knowledgeId}, s3Key: ${s3Key}`);

      // 1. Download from S3
      const s3Params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
      };
      const response = await s3.send(new GetObjectCommand(s3Params));
      const streamToBuffer = (stream) =>
        new Promise((resolve, reject) => {
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => resolve(Buffer.concat(chunks)));
        });
      const buffer = await streamToBuffer(response.Body);

      // 2. Parse Text
      let text = "";
      if (fileName.toLowerCase().endsWith(".pdf")) {
        const data = await pdf(buffer);
        text = data.text;
      } else {
        text = buffer.toString("utf-8");
      }

      // 3. Chunking
      const chunks = chunkText(text, 1000, 200); // 1000 chars, 200 overlap
      console.log(`Generated ${chunks.length} chunks`);

      // 4. Process Chunks (Embedding + DB Update)
      // For simplicity in this version, we update the original record with the first chunk
      // In a full RAG, you might want to create multiple records in a chunks table
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Get Embedding
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunk,
        });
        const embedding = embeddingResponse.data[0].embedding;

        if (i === 0) {
          // Update the main record with the first chunk
          await dbClient.query(
            'UPDATE group_knowledge SET content = $1, embedding = $2::vector WHERE id = $3',
            [chunk, JSON.stringify(embedding), knowledgeId]
          );
        } else {
          // Create new records for additional chunks
          // Note: You might want to fetch groupId from the original record first
          const res = await dbClient.query('SELECT group_id FROM group_knowledge WHERE id = $1', [knowledgeId]);
          const groupId = res.rows[0].group_id;

          await dbClient.query(
            'INSERT INTO group_knowledge (group_id, content, embedding, file_name, s3_key, created_at, updated_at) VALUES ($1, $2, $3::vector, $4, $5, NOW(), NOW())',
            [groupId, chunk, JSON.stringify(embedding), fileName, s3Key]
          );
        }
      }

      console.log(`Successfully processed knowledgeId: ${knowledgeId}`);
    }
  } catch (err) {
    console.error("Error processing knowledge:", err);
    throw err;
  } finally {
    await dbClient.end();
  }
};

/**
 * Simple character-based chunking
 */
function chunkText(text, size, overlap) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
}
