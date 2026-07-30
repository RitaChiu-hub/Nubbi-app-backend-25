const agentService = require("../services/agentService");

/**
 * Agent Controller - Handles direct API access to the AI Agent
 */
class AgentController {
  /**
   * Direct chat with the agent
   * POST /:groupId/agent/chat
   */
  async chat(req, res) {
    try {
      const { groupId } = req.params;
      const { message, history } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const response = await agentService.generateResponse(message, groupId, { history });

      return res.status(200).json({
        success: true,
        data: response
      });
    } catch (err) {
      console.error("[AgentController] Error in chat:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}

module.exports = new AgentController();
