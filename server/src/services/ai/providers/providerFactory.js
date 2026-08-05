import env from "../../../config/env.js";
import MockLlmProvider from "./mock.provider.js";
import OpenAiLlmProvider from "./openai.provider.js";

export class LlmProviderFactory {
  static getProvider() {
    const apiKey = env.AI?.OPENAI_API_KEY;
    // Fallback to Mock if key is missing or is the default dev key
    if (!apiKey || apiKey === "mock-api-key-for-development") {
      return new MockLlmProvider();
    }
    return new OpenAiLlmProvider();
  }
}

export default LlmProviderFactory;
