// server/utils/llamaClient.js
require("dotenv").config();
const OpenAI = require("openai");

module.exports.openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // apiKey: process.env.LLAMA_API_KEY,
  // baseURL: process.env.LLAMA_API_URL, // points at HF inference
});
