import env from "../../../config/env.js";
import MockLlmProvider from "./mock.provider.js";
import OpenAiLlmProvider from "./openai.provider.js";

export class LlmProviderFactory {
  static getProvider() {
    const apiKey = env.AI?.OPENAI_API_KEY;
    const isLiveE2E = process.env.LIVE_E2E === "true";

    if (isLiveE2E) {
      if (!apiKey || apiKey === "mock-api-key-for-development") {
        if (process.env.ALLOW_MOCK_LLM_E2E === "true") {
          return new MockLlmProvider();
        }
        throw new Error(
          "[LIVE_E2E ENFORCEMENT] OpenAI API Key is missing or invalid ('mock-api-key-for-development'). Fallback to MockLlmProvider is strictly forbidden during LIVE E2E validation."
        );
      }
      return new OpenAiLlmProvider();
    }

    // Fallback to Mock if key is missing or is default dev key in non-E2E environments
    if (!apiKey || apiKey === "mock-api-key-for-development") {
      return new MockLlmProvider();
    }
    return new OpenAiLlmProvider();
  }
}

export default LlmProviderFactory;

