const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { OpenAI } = require("openai");
const pdf = require("pdf-parse");
const { Client } = require("pg");

// Initialize Clients
const s3 = new S3Client({ region: process.env.AWS_REGION });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


const KEYWORD_EXTRACTION_MODEL = process.env.KEYWORD_EXTRACTION_MODEL || "gpt-4o-mini";
 
// Same keyword-extraction approach as services/keywordDictionaryService.js in
// the main backend repo. Duplicated here (rather than imported) because this
// Lambda is a separately deployed package with its own dependencies — keep
// the two in sync if the extraction prompt ever changes.
async function extractKeywords(chunkText) {
  const completion = await openai.chat.completions.create({
    model: KEYWORD_EXTRACTION_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Extract the key terms/concepts from a piece of course material. " +
          'Respond with ONLY a JSON object: {"keywords": ["...", "..."]}. ' +
          "List 3-8 short, specific terms or phrases (e.g. \"event horizon\", " +
          "\"supply and demand\") that a student would recognize as topics " +
          "from this material. No full sentences, no duplicates, no generic " +
          "words like \"example\" or \"chapter\".",
      },
      { role: "user", content: chunkText },
    ],
    max_tokens: 200,
  });
 
  const raw = completion.choices?.[0]?.message?.content?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.keywords)) return [];
    return parsed.keywords.filter((k) => typeof k === "string" && k.trim()).map((k) => k.trim());
  } catch (err) {
    console.warn("Failed to parse keyword extraction JSON:", err.message);
    return [];
  }
}
 
// Extract + embed + store keywords for one chunk. Errors here are logged and
// swallowed rather than thrown, so a keyword-extraction hiccup never fails
// the whole knowledge-processing job (the chunk/embedding itself already
// succeeded by the time this runs).
async function storeKeywordsForChunk(dbClient, groupId, knowledgeId, chunkText) {
  try {
    const keywords = await extractKeywords(chunkText);
    for (const keyword of keywords) {
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: keyword,
        });
        const embedding = embeddingResponse.data[0].embedding;
        await dbClient.query(
          `INSERT INTO group_knowledge_keywords (group_id, keyword, embedding, source_knowledge_id, created_at, updated_at)
           VALUES ($1, $2, $3::vector, $4, NOW(), NOW())
           ON CONFLICT (group_id, keyword) DO NOTHING`,
          [groupId, keyword, JSON.stringify(embedding), knowledgeId]
        );
      } catch (err) {
        console.error(`Failed to store keyword "${keyword}":`, err.message);
      }
    }
  } catch (err) {
    console.error(`Keyword extraction failed for knowledgeId ${knowledgeId}:`, err.message);
  }
}

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
 
          // 📚 Extract key terms from this chunk into the keyword
          // dictionary (group_knowledge_keywords), used later for tagging
          // comment-thread summaries against real course vocabulary instead
          // of having the LLM invent keywords on the spot.
          const res = await dbClient.query('SELECT group_id FROM group_knowledge WHERE id = $1', [knowledgeId]);
          await storeKeywordsForChunk(dbClient, res.rows[0].group_id, knowledgeId, chunk);
        } else {
          // Create new records for additional chunks
          // Note: You might want to fetch groupId from the original record first
          const res = await dbClient.query('SELECT group_id FROM group_knowledge WHERE id = $1', [knowledgeId]);
          const groupId = res.rows[0].group_id;
 
          const insertRes = await dbClient.query(
            'INSERT INTO group_knowledge (group_id, content, embedding, file_name, s3_key, created_at, updated_at) VALUES ($1, $2, $3::vector, $4, $5, NOW(), NOW()) RETURNING id',
            [groupId, chunk, JSON.stringify(embedding), fileName, s3Key]
          );
 
          // 📚 Same keyword extraction for every additional chunk.
          await storeKeywordsForChunk(dbClient, groupId, insertRes.rows[0].id, chunk);
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
