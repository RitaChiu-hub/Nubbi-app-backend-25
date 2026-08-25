// server/services/keywordDictionaryService.js
const { openai } = require("../utils/llamaClient");

const EXTRACTION_MODEL = process.env.KEYWORD_EXTRACTION_MODEL || "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small"; // must match group_knowledge's embedding model

// Ask the model to pull out concrete key terms/concepts from one knowledge
// base chunk. Kept deliberately narrow (single words or short noun phrases,
// not sentences) so these are useful as tags later, not paraphrased text.
async function extractKeywordsFromText(chunkText) {
  const completion = await openai.chat.completions.create({
    model: EXTRACTION_MODEL,
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
    return parsed.keywords
      .filter((k) => typeof k === "string" && k.trim())
      .map((k) => k.trim());
  } catch (err) {
    console.warn("[KeywordDictionary] Failed to parse keyword extraction JSON:", err.message);
    return [];
  }
}

// Embed a single keyword/phrase, using the SAME model as group_knowledge's
// chunk embeddings, so keyword vectors and comment-thread vectors are
// directly comparable with pgvector cosine distance.
async function embedText(text) {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

// Extract keywords from one knowledge chunk, embed each one, and store them
// in group_knowledge_keywords (skipping ones that already exist for this
// group, thanks to the unique (group_id, keyword) index).
//
// `dbClient` just needs a `.query(sql, params)` method — works with either
// the main backend's pg Pool or a plain pg Client (used in the Lambda).
async function extractAndStoreKeywords(dbClient, { groupId, knowledgeId, chunkText }) {
  const keywords = await extractKeywordsFromText(chunkText);
  if (keywords.length === 0) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;

  for (const keyword of keywords) {
    try {
      const embedding = await embedText(keyword);
      const result = await dbClient.query(
        `INSERT INTO group_knowledge_keywords (group_id, keyword, embedding, source_knowledge_id, created_at, updated_at)
         VALUES ($1, $2, $3::vector, $4, NOW(), NOW())
         ON CONFLICT (group_id, keyword) DO NOTHING
         RETURNING id`,
        [groupId, keyword, JSON.stringify(embedding), knowledgeId || null]
      );
      if (result.rows.length > 0) inserted++;
      else skipped++; // already existed for this group
    } catch (err) {
      console.error(`[KeywordDictionary] Failed to store keyword "${keyword}" for group ${groupId}:`, err.message);
    }
  }

  return { inserted, skipped };
}

module.exports = { extractKeywordsFromText, embedText, extractAndStoreKeywords };
