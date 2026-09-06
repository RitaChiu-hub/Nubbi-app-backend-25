// server/services/commentSummaryService.js
const pool = require("../db");
const { openai } = require("../utils/llamaClient");

// Minimum number of comments before the very first summary is generated.
const SUMMARY_THRESHOLD = parseInt(process.env.COMMENT_SUMMARY_THRESHOLD || "5", 10);
// After the first summary, regenerate again every this-many NEW comments.
// Defaults to 1 — i.e. regenerate on every single new comment once past the
// threshold — so a Cuubi answer immediately followed by a student follow-up
// question is always reflected right away, instead of waiting for enough
// comments to pile up. Raise this (e.g. to 5) later if OpenAI costs become
// a concern and near-real-time freshness isn't critical.
const SUMMARY_REGEN_INTERVAL = parseInt(process.env.COMMENT_SUMMARY_REGEN_INTERVAL || "1", 10);
const AI_MODEL = process.env.OPENAI_COMMENT_MODEL || "gpt-4o-mini";
// Must match the model used for group_knowledge / group_knowledge_keywords
// embeddings, so vectors are directly comparable.
const EMBEDDING_MODEL = "text-embedding-3-small";
// Cosine distance cutoff (0 = identical, 2 = opposite) for treating a
// dictionary keyword as "relevant enough" to use as a tag. Keywords farther
// than this are ignored even if they're the closest match available.
const KEYWORD_MATCH_DISTANCE_CUTOFF = parseFloat(process.env.KEYWORD_MATCH_DISTANCE_CUTOFF || "0.45");
// Total number of keyword tags to show per summary (dictionary matches +
// LLM-generated supplements combined).
const MAX_KEYWORDS = parseInt(process.env.MAX_SUMMARY_KEYWORDS || "6", 10);
// Same fixed Cuubi user id used everywhere else in the codebase
// (groupChatController.js, groupController.js post-tagging, etc.)
const CUUBI_USER_ID = "205851f3-f034-4316-b278-9c962443a5d5";
// Embed text with the SAME model used for group_knowledge / keyword
// dictionary embeddings, so vectors are directly comparable via pgvector.
async function embedText(text) {
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: text });
  return res.data[0].embedding;
}



// Check whether it's time to (re)generate the AI summary of a post's comment
// thread, and do so if needed.
//
// IMPORTANT: call this WITHOUT `await` from the request handler
// (fire-and-forget, with a `.catch()` at the call site) — same reasoning as
// triggerCuubiCommentReply: a live OpenAI call can take a second or more, and
// we don't want to delay the response to whoever just posted the comment.
module.exports.maybeUpdateCommentSummary = async (postId) => {
  const {
    rows: [countRow],
  } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM post_comments WHERE post_id = $1`,
    [postId]
  );
  const commentCount = countRow.count;
  console.log(`[CommentSummary] post ${postId}: commentCount=${commentCount}, threshold=${SUMMARY_THRESHOLD}`);

  // Not enough comments yet for even the first summary.
  if (commentCount < SUMMARY_THRESHOLD) {
    console.log(`[CommentSummary] post ${postId}: below threshold, skipping.`);
    return;
  }

  const {
    rows: [postRow],
  } = await pool.query(
    `SELECT comment_summary_count, group_id FROM posts WHERE id = $1`,
    [postId]
  );
  if (!postRow) {
    console.log(`[CommentSummary] post ${postId}: no matching row in posts table, skipping.`);
    return;
  }
  const lastSummaryCount = postRow.comment_summary_count || 0;
  const groupId = postRow.group_id;
  console.log(`[CommentSummary] post ${postId}: lastSummaryCount=${lastSummaryCount}, regenInterval=${SUMMARY_REGEN_INTERVAL}`);

  // Already summarized at/above the threshold once (lastSummaryCount > 0),
  // and not enough NEW comments have come in since then — skip.
  if (lastSummaryCount > 0 && commentCount - lastSummaryCount < SUMMARY_REGEN_INTERVAL) {
    console.log(`[CommentSummary] post ${postId}: not enough new comments since last summary, skipping.`);
    return;
  }

  console.log(`[CommentSummary] post ${postId}: generating summary now (calling OpenAI)...`);

  const { rows: comments } = await pool.query(
    `SELECT sender_id, comment_text FROM post_comments WHERE post_id = $1 ORDER BY created_at ASC`,
    [postId]
  );

  // Label each line by speaker (Cuubi vs. Student) so the model can actually
  // follow the back-and-forth — e.g. "Cuubi explained X, then a student
  // asked a follow-up about Y" — instead of just seeing an undifferentiated
  // list of text.
  const transcript = comments
    .map((c, i) => {
      const speaker = c.sender_id === CUUBI_USER_ID ? "Cuubi" : "Student";
      return `${i + 1}. [${speaker}] ${c.comment_text}`;
    })
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write a short discussion summary shown to both students and " +
          "the teacher on a classroom post. Each line of the thread is " +
          "labeled [Cuubi] or [Student] so you can follow who's answering " +
          "and who's asking — use that only to understand the flow, but do " +
          "NOT narrate it in your summary (avoid phrasing like \"Cuubi " +
          "explained\" or \"a student asked\"). Instead, write it as a plain " +
          "topic summary.\n\n" +
          "Respond with ONLY a JSON object, no other text, in this exact shape:\n" +
          '{"summary": "...", "keywords": ["...", "..."]}\n\n' +
          "For \"summary\": write 2-4 plain, readable sentences covering what " +
          "the discussion is about, the key information or decisions that " +
          "came up, and anything still open or unresolved. Write it as a " +
          "neutral topic summary (not addressed to anyone, not narrating who " +
          "said what), in clear language a student or teacher can skim in a " +
          "few seconds.\n\n" +
          "For \"keywords\": list 3-6 short key terms/topics that came up in " +
          "the discussion (single words or short phrases, e.g. \"event " +
          "horizon\", \"gravity\"), most important first.\n\n" +
          "Don't invent anything not present in the comments.",
      },
      {
        role: "user",
        content: `Here is the full comment thread (${commentCount} comments so far):\n\n${transcript}\n\nSummarize it.`,
      },
    ],
    max_tokens: 300,
  });

  const rawContent = completion.choices?.[0]?.message?.content?.trim();
  if (!rawContent) {
    console.log(`[CommentSummary] post ${postId}: OpenAI returned empty content, skipping update.`);
    return;
  }

  let summaryText;
  let llmKeywords = [];
  try {
    const parsed = JSON.parse(rawContent);
    summaryText = typeof parsed.summary === "string" ? parsed.summary.trim() : null;
    if (Array.isArray(parsed.keywords)) {
      llmKeywords = parsed.keywords
        .filter((k) => typeof k === "string" && k.trim())
        .map((k) => k.trim());
    }
  } catch (err) {
    // Model didn't return valid JSON (rare, but possible) — fall back to
    // treating the whole response as the summary text, with no keywords,
    // rather than losing the update entirely.
    console.warn("[CommentSummary] Failed to parse JSON response, falling back to raw text:", err.message);
    summaryText = rawContent;
  }
  if (!summaryText) {
    console.log(`[CommentSummary] post ${postId}: parsed summaryText was empty, skipping update.`);
    return;
  }
  
 // 📚 Prefer real vocabulary from this group's knowledge base over
  // LLM-invented keywords: embed the summary, then find the closest
  // matching terms in group_knowledge_keywords (built from the group's
  // actual course material) via pgvector cosine distance. Falls back to
  // the LLM's own keyword guesses if the dictionary is empty for this
  // group, or nothing matches closely enough.
  //
  // Each keyword is stored as { keyword, knowledgeId } — knowledgeId points
  // back to the group_knowledge chunk it came from (source_knowledge_id),
  // so the frontend can let someone click a tag and see the actual course
  // material it's grounded in. LLM-fallback keywords have knowledgeId: null
  // since they aren't tied to any real source.
  let keywords = llmKeywords.map((k) => ({ keyword: k, knowledgeId: null }));
  try {
    const summaryEmbedding = await embedText(summaryText);
    const { rows: matches } = await pool.query(
      `SELECT keyword, source_knowledge_id, embedding <=> $1::vector AS distance
       FROM group_knowledge_keywords
       WHERE group_id = $2
       ORDER BY embedding <=> $1::vector
       LIMIT 6`,
      [JSON.stringify(summaryEmbedding), groupId]
    );
    const dictMatches = matches
      .filter((m) => m.distance <= KEYWORD_MATCH_DISTANCE_CUTOFF)
      .map((m) => ({ keyword: m.keyword, knowledgeId: m.source_knowledge_id }));
 
    // Always log the actual top candidates + their distances, even when
    // none pass the cutoff — this is the only way to tell whether the
    // cutoff itself is miscalibrated vs. the content genuinely being
    // unrelated to anything in the dictionary.
    console.log(
      `[CommentSummary] post ${postId}: top dictionary candidates — ` +
        matches.map((m) => `"${m.keyword}" (distance=${Number(m.distance).toFixed(3)})`).join(", ")
    );
 
    if (dictMatches.length > 0) {
      // Mixed mode: dictionary matches lead (clickable, grounded in real
      // course material), then fill any remaining slots with LLM-generated
      // keywords not already covered — so the tag list still gives full
      // topic coverage instead of shrinking down to just the 1-2 terms
      // that happened to match the dictionary.
      const usedKeywordsLower = new Set(dictMatches.map((m) => m.keyword.toLowerCase()));
      const supplementary = llmKeywords
        .filter((k) => !usedKeywordsLower.has(k.toLowerCase()))
        .map((k) => ({ keyword: k, knowledgeId: null }));
      keywords = [...dictMatches, ...supplementary].slice(0, MAX_KEYWORDS);
      console.log(
        `[CommentSummary] post ${postId}: using ${dictMatches.length} dictionary keyword(s) + ` +
          `${keywords.length - dictMatches.length} LLM keyword(s) as supplement.`
      );
    } else {
      console.log(`[CommentSummary] post ${postId}: no close dictionary matches (group ${groupId}), using LLM keywords only.`);
    }
  } catch (err) {
    console.error(`[CommentSummary] post ${postId}: dictionary keyword matching failed, falling back to LLM keywords:`, err.message);
  }
 
  await pool.query(
    `UPDATE posts SET comment_summary = $1, comment_summary_keywords = $2, comment_summary_count = $3 WHERE id = $4`,
    [summaryText, JSON.stringify(keywords), commentCount, postId]
  );
  console.log(`[CommentSummary] post ${postId}: summary updated successfully (comment_summary_count now ${commentCount}).`);
};
 