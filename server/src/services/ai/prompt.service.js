export class PromptService {
  buildEvaluationPrompt({
    questionText,
    studentAnswer,
    modelAnswer,
    rubric = [],
    maximumMarks = 10,
    keywords = [],
  }) {
    const rubricText =
      rubric.length > 0
        ? rubric
            .map(
              (r, i) =>
                `${i + 1}. Criteria: "${r.criteria || r.criterion}", Marks: ${r.marks || r.maxMarks}${r.description ? `, Description: ${r.description}` : ""}`
            )
            .join("\n")
        : "No detailed grading rubric provided. Grade based on correct facts matching model answer.";

    const keywordsText =
      keywords.length > 0 ? `Expected keywords/concepts to check: ${keywords.join(", ")}` : "";

    return `
You are an expert academic evaluator. Analyze the student's answer and grade it out of ${maximumMarks} marks based on the model answer and rubric.

QUESTION:
"${questionText}"

STUDENT ANSWER:
"${studentAnswer || "[No student answer provided or detected]"}"

MODEL ANSWER:
"${modelAnswer}"

${keywordsText}

GRADING RUBRIC GUIDELINES:
${rubricText}

Provide an accurate evaluation. Award partial marks if student is partially correct. Do not go below 0 or exceed the maximum allowed marks (${maximumMarks}).
Return your assessment strictly in the following JSON structure:
{
  "marks": <float_value_awarded>,
  "similarity": <float_value_from_0_to_1>,
  "strengths": <string_summarizing_good_details>,
  "weaknesses": <string_summarizing_missing_details>,
  "suggestions": <string_improvement_tips_or_comments>,
  "justification": <string_reasoning_for_awarded_marks>,
  "confidence": <float_value_from_0_to_1>,
  "criteriaScores": [
    {
      "criterion": "<criterion_name_from_guidelines>",
      "marksAwarded": <float_marks_awarded>,
      "maxMarks": <float_max_marks>
    }
  ],
  "matchedKeywords": [
    "<matching_keyword_1>",
    "<matching_keyword_2>"
  ],
  "missingKeywords": [
    "<missing_keyword_1>"
  ]
}
`;
  }
}

export default new PromptService();
