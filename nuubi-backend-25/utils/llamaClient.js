// server/utils/llamaClient.js
import OpenAI from "openai";

export const llama = new OpenAI({
  apiKey: process.env.LLAMA_API_KEY,
  baseURL: process.env.LLAMA_API_URL, // points at HF inference
});
