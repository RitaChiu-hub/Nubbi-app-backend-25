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
// Same fixed Cuubi user id used everywhere else in the codebase
// (groupChatController.js, groupController.js post-tagging, etc.)
const CUUBI_USER_ID = "205851f3-f034-4316-b278-9c962443a5d5";

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
    `SELECT comment_summary_count FROM posts WHERE id = $1`,
    [postId]
  );
  if (!postRow) {
    console.log(`[CommentSummary] post ${postId}: no matching row in posts table, skipping.`);
    return;
  }
  const lastSummaryCount = postRow.comment_summary_count || 0;
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
  let keywords = [];
  try {
    const parsed = JSON.parse(rawContent);
    summaryText = typeof parsed.summary === "string" ? parsed.summary.trim() : null;
    if (Array.isArray(parsed.keywords)) {
      keywords = parsed.keywords
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

  await pool.query(
    `UPDATE posts SET comment_summary = $1, comment_summary_keywords = $2, comment_summary_count = $3 WHERE id = $4`,
    [summaryText, keywords.join(", "), commentCount, postId]
  );
  console.log(`[CommentSummary] post ${postId}: summary updated successfully (comment_summary_count now ${commentCount}).`);
};