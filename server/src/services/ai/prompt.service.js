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
                `${i + 1}. Criterion: "${r.criterion || r.criteria}", Max Marks: ${r.maxMarks || r.marks}${r.description ? `, Description: ${r.description}` : ""}`
            )
            .join("\n")
        : `1. Criterion: "General Correctness and Completeness", Max Marks: ${maximumMarks}, Description: Evaluate accuracy against model answer`;

    const keywordsText =
      keywords.length > 0 ? `Expected Key Concepts / Keywords: ${keywords.join(", ")}` : "";

    return `
You are a strict, objective academic evaluator evaluating a student's handwritten answer sheet (digitized via OCR).

==================================================
EVALUATION INPUTS
==================================================

QUESTION:
${questionText}

MAXIMUM MARKS:
${maximumMarks}

MODEL ANSWER:
${modelAnswer}

RUBRIC CRITERIA:
${rubricText}

${keywordsText}

STUDENT OCR DIGITIZED ANSWER:
"${studentAnswer || ""}"

==================================================
EVALUATION INSTRUCTIONS
==================================================
- Evaluate semantic meaning, conceptual correctness, and completeness—NOT exact wording.
- Different wording expressing the exact same correct concept MUST receive full credit.
- Do NOT award marks merely because matching keywords appear if the underlying reasoning is incorrect.
- Check the correctness of all claims.
- Check completeness against each rubric criterion.
- Evaluate each rubric criterion independently based on its specified maxMarks.
- Award partial credit where student output partial correctness according to the rubric.
- Never award negative marks for any criterion.
- Never exceed the maxMarks for any individual criterion.
- Never exceed the overall question MAXIMUM MARKS (${maximumMarks}).
- Ignore irrelevant content; do not penalize valid extra details.
- Do NOT invent or assume information not present in the student's OCR answer.
- If the student answer does not demonstrate a criterion, award 0 for that criterion with status "missing" or "incorrect".
- Return ONLY a valid JSON object matching the required schema below. No markdown formatting, no extra prose outside the JSON.

==================================================
REQUIRED STRUCTURED JSON SCHEMA
==================================================
{
  "marksAwarded": <number_total_awarded_marks>,
  "maxMarks": ${maximumMarks},
  "percentage": <number_percentage_marksAwarded_div_maxMarks_times_100>,
  "criteria": [
    {
      "criterion": "<exact_criterion_name_from_rubric>",
      "marksAwarded": <number_marks_for_this_criterion>,
      "maxMarks": <number_max_marks_for_this_criterion>,
      "status": "<matched | partial | missing | incorrect>",
      "reason": "<short_specific_justification_for_criterion_score>"
    }
  ],
  "matchedConcepts": ["<concept_or_keyword_1>", "<concept_or_keyword_2>"],
  "missingConcepts": ["<missing_concept_1>"],
  "feedback": "<comprehensive_academic_feedback_summarizing_performance>",
  "confidence": <number_confidence_score_between_0_and_1>
}
`;
  }

  buildReferenceAwarePrompt({
    questionText,
    studentAnswer,
    modelAnswer,
    rubric = [],
    maximumMarks = 10,
    keywords = [],
    normalEvaluation = null,
    historicalReferences = [],
  }) {
    const rubricText =
      rubric.length > 0
        ? rubric
            .map(
              (r, i) =>
                `${i + 1}. Criterion: "${r.criterion || r.criteria}", Max Marks: ${r.maxMarks || r.marks}${
                  r.description ? `, Description: ${r.description}` : ""
                }`
            )
            .join("\n")
        : `1. Criterion: "General Correctness and Completeness", Max Marks: ${maximumMarks}, Description: Evaluate accuracy against model answer`;

    const keywordsText =
      keywords.length > 0 ? `Expected Key Concepts / Keywords: ${keywords.join(", ")}` : "";

    const normalEvalText = normalEvaluation
      ? `INITIAL NORMAL AI EVALUATION:\n- Marks Awarded: ${normalEvaluation.marksAwarded || 0} / ${maximumMarks}\n- Confidence: ${normalEvaluation.confidence || 0.7}\n- Feedback: "${normalEvaluation.feedback || ""}"`
      : "";

    const referencesText =
      historicalReferences.length > 0
        ? historicalReferences
            .map(
              (ref, idx) => `
--- HISTORICAL REFERENCE #${idx + 1} (Contextual Evidence Only) ---
Academic Year: ${ref.academicYear || "N/A"}
Similarity Score: ${ref.similarity ? (ref.similarity * 100).toFixed(0) : "N/A"}%
Previous Faculty Marks Awarded: ${ref.marksAwarded} / ${ref.maxMarks}
Historical Question: "${ref.questionText || questionText}"
Historical Student Answer: "${ref.studentAnswer || ref.ocrText || ""}"
`
            )
            .join("\n")
        : "No historical references available.";

    return `
You are a strict, objective academic evaluator evaluating a student's handwritten answer sheet (digitized via OCR). This evaluation is flagged for REFERENCE-AWARE ADAPTIVE REVIEW.

==================================================
EVALUATION INPUTS
==================================================

QUESTION:
${questionText}

MAXIMUM MARKS:
${maximumMarks}

MODEL ANSWER:
${modelAnswer}

RUBRIC CRITERIA:
${rubricText}

${keywordsText}

STUDENT OCR DIGITIZED ANSWER:
"${studentAnswer || ""}"

${normalEvalText}

APPROVED HISTORICAL EVALUATION REFERENCES (CONTEXTUAL EVIDENCE ONLY):
${referencesText}

==================================================
CRITICAL EVALUATION INSTRUCTIONS (STRICT COMPLIANCE REQUIRED)
==================================================
1. HISTORICAL ANSWERS ARE EXAMPLES OF PREVIOUSLY FACULTY-FINALIZED EVALUATIONS.
2. THEY ARE CONTEXTUAL EVIDENCE ONLY.
3. DO NOT COPY THEIR MARKS.
4. DO NOT AVERAGE THEIR MARKS.
5. DO NOT USE HISTORICAL MARKS AS A MATHEMATICAL FORMULA OR RATING CEILING.
6. DO NOT ASSUME THAT A SIMILAR ANSWER AUTOMATICALLY DESERVES THE SAME MARKS.
7. EVALUATE THE CURRENT ANSWER INDEPENDENTLY USING THE CURRENT QUESTION, CURRENT MODEL ANSWER, CURRENT RUBRIC, AND CURRENT MAXIMUM MARKS.
8. USE HISTORICAL REFERENCES ONLY TO HELP RESOLVE AMBIGUITY IN INTERPRETATION WHEN THEY ARE GENUINELY RELEVANT.
9. IF HISTORICAL EVIDENCE CONFLICTS WITH THE CURRENT RUBRIC, THE CURRENT RUBRIC TAKES PRECEDENCE.
10. DO NOT INVENT FACTS OR REWARD KEYWORD OVERLAP ALONE. SEMANTIC MEANING AND CORRECTNESS MATTER.
11. "markTransfer" FIELD MUST ALWAYS BE FALSE.
12. Return ONLY a valid JSON object matching the required schema below. No markdown formatting, no extra prose outside the JSON.

==================================================
REQUIRED STRUCTURED JSON SCHEMA
==================================================
{
  "marksAwarded": <number_total_awarded_marks>,
  "maxMarks": ${maximumMarks},
  "percentage": <number_percentage_marksAwarded_div_maxMarks_times_100>,
  "criteria": [
    {
      "criterion": "<exact_criterion_name_from_rubric>",
      "marksAwarded": <number_marks_for_this_criterion>,
      "maxMarks": <number_max_marks_for_this_criterion>,
      "status": "<matched | partial | missing | incorrect>",
      "reason": "<short_specific_justification_for_criterion_score>"
    }
  ],
  "matchedConcepts": ["<concept_1>"],
  "missingConcepts": ["<missing_concept_1>"],
  "feedback": "<academic_feedback_explaining_independent_score_and_reference_context>",
  "confidence": <number_confidence_score_between_0_and_1>,
  "referenceAnalysis": {
    "used": true,
    "referencesConsidered": ${historicalReferences.length},
    "relevanceSummary": "<summary_of_historical_reference_relevance_or_lack_thereof>",
    "interpretationGuidance": "<guidance_derived_from_references_without_copying_marks>",
    "markTransfer": false
  }
}
`;
  }
}

export default new PromptService();

