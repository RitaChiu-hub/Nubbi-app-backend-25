// server/scripts/buildKeywordDictionary.js
//
// One-off / re-runnable script that walks every existing group_knowledge
// chunk and extracts+embeds keywords into group_knowledge_keywords.
// Safe to re-run: the (group_id, keyword) unique index means already-seen
// keywords are just skipped, not duplicated.
//
// Usage:
//   node scripts/buildKeywordDictionary.js
//
require("dotenv").config();
const pool = require("../db");
const { extractAndStoreKeywords } = require("../services/keywordDictionaryService");

async function main() {
  console.log("[KeywordDictionary] Fetching existing group_knowledge chunks...");
  const { rows: chunks } = await pool.query(
    `SELECT id, group_id, content FROM group_knowledge WHERE content IS NOT NULL AND content != ''`
  );
  console.log(`[KeywordDictionary] Found ${chunks.length} chunks to process.`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const [i, chunk] of chunks.entries()) {
    process.stdout.write(`[KeywordDictionary] (${i + 1}/${chunks.length}) knowledgeId=${chunk.id} group=${chunk.group_id} ... `);
    try {
      const { inserted, skipped } = await extractAndStoreKeywords(pool, {
        groupId: chunk.group_id,
        knowledgeId: chunk.id,
        chunkText: chunk.content,
      });
      totalInserted += inserted;
      totalSkipped += skipped;
      console.log(`+${inserted} new, ${skipped} already existed.`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  console.log(`[KeywordDictionary] Done. ${totalInserted} new keywords inserted, ${totalSkipped} already existed.`);
  await pool.end();
}

main().catch((err) => {
  console.error("[KeywordDictionary] Fatal error:", err);
  process.exit(1);
});
