// server/utils/llamaClient.js
const OpenAI = require("openai");

module.exports.llama = new OpenAI({
  apiKey: process.env.LLAMA_API_KEY,
  baseURL: process.env.LLAMA_API_URL, // points at HF inference
});
