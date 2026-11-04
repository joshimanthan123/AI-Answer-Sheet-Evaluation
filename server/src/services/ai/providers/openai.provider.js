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
                  "You are a strict academic evaluation system. Grade student answers accurately according to the provided rubric and model answer. Output strictly valid JSON with fields: marksAwarded, maxMarks, percentage, criteria (array of {criterion, marksAwarded, maxMarks, status, reason}), matchedConcepts, missingConcepts, feedback, confidence.",
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

        const rawMarks = parsed.marksAwarded !== undefined ? Number(parsed.marksAwarded) : (parsed.marks !== undefined ? Number(parsed.marks) : 0);
        const marksAwarded = Math.min(Math.max(rawMarks, 0), maxMarks);
        const maxMarksVal = parsed.maxMarks !== undefined ? Number(parsed.maxMarks) : maxMarks;
        const percentage = maxMarksVal > 0 ? Number(((marksAwarded / maxMarksVal) * 100).toFixed(2)) : 0;
        const confidence = parsed.confidence !== undefined ? Math.min(Math.max(Number(parsed.confidence), 0), 1) : 0.85;

        const rawCriteria = Array.isArray(parsed.criteria) ? parsed.criteria : (Array.isArray(parsed.criteriaScores) ? parsed.criteriaScores : []);
        const criteria = rawCriteria.map((c) => ({
          criterion: String(c.criterion || c.criteria || "").trim(),
          marksAwarded: Math.max(0, Number(c.marksAwarded !== undefined ? c.marksAwarded : c.marks || 0)),
          maxMarks: Number(c.maxMarks || 0),
          status: c.status || (Number(c.marksAwarded || 0) >= Number(c.maxMarks || 0) && Number(c.maxMarks || 0) > 0 ? "matched" : Number(c.marksAwarded || 0) > 0 ? "partial" : "missing"),
          reason: String(c.reason || c.justification || "").trim(),
        }));

        const matchedConcepts = Array.isArray(parsed.matchedConcepts) ? parsed.matchedConcepts : (Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : []);
        const missingConcepts = Array.isArray(parsed.missingConcepts) ? parsed.missingConcepts : (Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : []);
        const feedback = String(parsed.feedback || parsed.justification || parsed.strengths || "Evaluation complete.").trim();

        return {
          marksAwarded,
          maxMarks: maxMarksVal,
          percentage,
          criteria,
          matchedConcepts,
          missingConcepts,
          feedback,
          confidence,
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
