import env from "../../../config/env.js";
import ApiError from "../../../utils/ApiError.js";
import { STATUS_CODES } from "../../../constants/statusCodes.js";

export class OpenAiLlmProvider {
  async evaluate(prompt, maxMarks = 10) {
    const apiKey = env.AI?.OPENAI_API_KEY;
    const modelName = env.AI?.LLM_MODEL_NAME || "gpt-4o";
    const timeout = env.AI?.AI_TIMEOUT || 30000;
    const maxRetries = env.AI?.MAX_RETRIES || 3;

    if (!apiKey || apiKey === "mock-api-key-for-development") {
      throw new ApiError(
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        "OpenAI API Key is missing or invalid"
      );
    }

    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              {
                role: "system",
                content:
                  "You are an assessment bot. Grade the student response accurately in JSON format. Return values: marks (float), similarity (float, 0-1), strengths (string), weaknesses (string), suggestions (string), justification (string). Do not exceed maxMarks. Round to 1 decimal place.",
              },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenAI HTTP Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const contentText = data.choices?.[0]?.message?.content;
        if (!contentText) {
          throw new Error("Empty response choice content from OpenAI");
        }

        const parsed = JSON.parse(contentText);
        if (
          parsed.marks === undefined ||
          parsed.similarity === undefined ||
          !parsed.strengths ||
          !parsed.weaknesses ||
          !parsed.justification
        ) {
          throw new Error("Missing structural evaluation attributes in OpenAI response");
        }

        return {
          marks: Math.min(Math.max(Number(parsed.marks), 0), maxMarks),
          similarity: Number(parsed.similarity),
          strengths: parsed.strengths,
          weaknesses: parsed.weaknesses,
          suggestions: parsed.suggestions || "",
          justification: parsed.justification,
          tokensUsed: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          },
        };
      } catch (err) {
        if (attempt >= maxRetries) {
          throw new ApiError(
            STATUS_CODES.BAD_GATEWAY,
            `OpenAI Evaluation failed after ${attempt} attempts: ${err.message}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }
}

export default OpenAiLlmProvider;
