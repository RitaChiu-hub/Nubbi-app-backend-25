const { openai } = require("../utils/llamaClient");
const knowledgeService = require("./knowledgeService");

/**
 * Agent Service - Handles AI Agent logic (Cuubi)
 */
class AgentService {
  /**
   * Process a user message and generate an AI response using RAG
   * @param {string} userMessage - The message from the user
   * @param {number} groupId - The group context
   * @param {Object} options - Additional options (history, user info, etc.)
   */
  async generateResponse(userMessage, groupId, options = {}) {
    try {
      // 1. Retrieve relevant context from Knowledge Base
      const contextChunks = await knowledgeService.searchRelevantKnowledge(userMessage, groupId, 3);
      
      let contextText = "";
      if (contextChunks && contextChunks.length > 0) {
        contextText = contextChunks
          .map(chunk => `[Source: ${chunk.file_name}]\n${chunk.content}`)
          .join("\n\n");
      }

      // 2. Build the System Prompt
      const systemPrompt = `You are Cuubi, a helpful AI assistant for the Nuubi learning community. 
Your goal is to assist students and teachers with their questions based on the provided knowledge base and the conversation history.

CONTEXT FROM KNOWLEDGE BASE:
${contextText || "No specific context found in the knowledge base for this query."}

INSTRUCTIONS:
- Use the provided context to answer the question as accurately as possible.
- If the answer is not in the context, use the conversation history to understand the user's intent.
- If neither context nor history provides the answer, use your general knowledge but mention it's not from the official group knowledge base.
- Be encouraging, friendly, and concise.
- If you don't know the answer, just say you don't know, don't make up facts.
- Always respond in the same language as the user's message.
- DO NOT use Chinese unless the user's message is in Chinese.`;

      // 3. Call OpenAI for generation
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Or gpt-4o for better quality
        messages: [
          { role: "system", content: systemPrompt },
          ...(options.history || []),
          { role: "user", content: userMessage }
        ],
        temperature: 0.7,
      });

      return {
        text: response.choices[0].message.content,
        sources: contextChunks.map(c => c.file_name)
      };
    } catch (err) {
      console.error("[AgentService] Error generating response:", err);
      throw err;
    }
  }

  /**
   * Check if a message is calling the agent
   * @param {string} text 
   */
  isAgentMentioned(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return lowerText.includes("@cuubi") || lowerText.includes("cuubi");
  }
}

module.exports = new AgentService();
