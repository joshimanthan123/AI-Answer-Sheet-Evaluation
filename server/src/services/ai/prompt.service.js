export class PromptService {
  buildEvaluationPrompt({
    questionText,
    studentAnswer,
    modelAnswer,
    rubric = [],
    maximumMarks = 10,
    keywords = [],
    concepts = [],
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
      keywords.length > 0 ? `Expected Keywords: ${keywords.join(", ")}` : "";
    const conceptsText =
      concepts.length > 0 ? `Expected Concepts: ${concepts.join(", ")}` : "";

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
${conceptsText}

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
  "keywordEvidence": ["<keyword_1>"],
  "feedback": "<comprehensive_academic_feedback_summarizing_performance>",
  "confidence": <number_confidence_score_between_0_and_1>,
  "rubricCoverage": <number_rubric_coverage_between_0_and_1>
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
    concepts = [],
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
      keywords.length > 0 ? `EXPECTED KEYWORDS: ${keywords.join(", ")}` : "";
    const conceptsText =
      concepts.length > 0 ? `EXPECTED CONCEPTS: ${concepts.join(", ")}` : "";

    const normalEvalText = normalEvaluation
      ? `INITIAL STANDALONE EVALUATION CONTEXT:\n- Marks Awarded: ${normalEvaluation.marksAwarded || 0} / ${maximumMarks}\n- Confidence: ${normalEvaluation.confidence || 0.7}\n- Feedback: "${normalEvaluation.feedback || ""}"`
      : "";

    const referencesText =
      historicalReferences.length > 0
        ? historicalReferences
            .map(
              (ref, idx) => `
--- APPROVED REFERENCE ANSWER EVIDENCE #${idx + 1} (Contextual Evidence Only) ---
Reference ID: ${ref.referenceId || `REF-${idx + 1}`}
Academic Year: ${ref.academicYear || "N/A"}
Relevance / Semantic Similarity: ${ref.similarity ? (ref.similarity * 100).toFixed(0) : "80"}%
Reference Awarded Marks: ${ref.marksAwarded} / ${ref.maxMarks}
Historical Question: "${ref.questionText || questionText}"
Reference Answer Text: "${ref.studentAnswer || ref.ocrText || ""}"
Key Concepts Demonstrated: ${Array.isArray(ref.concepts) ? ref.concepts.join(", ") : "N/A"}
`
            )
            .join("\n")
        : "No approved reference answers available.";

    return `
You are a strict, objective AI academic evaluator performing ADAPTIVE AI ANSWER EVALUATION using multi-source evidence.

==================================================
EVALUATION EVIDENCE SOURCES
==================================================

1. QUESTION TEXT:
${questionText}

2. MAXIMUM MARKS:
${maximumMarks}

3. FACULTY MODEL ANSWER:
${modelAnswer}

4. MARKING RUBRIC:
${rubricText}

5. ${keywordsText}

6. ${conceptsText}

7. STUDENT OCR/DIGITIZED ANSWER:
"${studentAnswer || ""}"

8. ${normalEvalText}

9. APPROVED REFERENCE EVIDENCE (FACULTY-APPROVED PREVIOUS EVALUATIONS):
${referencesText}

==================================================
CRITICAL EVALUATION RULES & GUARDRAILS (STRICT MANDATE)
==================================================
1. THE STUDENT'S ACTUAL ANSWER REMAINS THE PRIMARY OBJECT BEING EVALUATED.
2. APPROVED REFERENCE ANSWERS PROVIDE CONTEXTUAL EVIDENCE ONLY.
3. NEVER BLINDLY COPY MARKS FROM PREVIOUS REFERENCE ANSWERS.
4. NEVER AUTOMATICALLY AWARD A REFERENCE SCORE (e.g., Reference Score = 8/10 + Current Student Answer != 8/10 automatically).
5. DO NOT AVERAGE REFERENCE MARKS OR USE THEM AS A MATHEMATICAL FORMULA.
6. EVALUATE THE STUDENT'S DEMONSTRATED CONCEPTS, FACTUAL RELEVANCE, AND RUBRIC SATISFACTION INDEPENDENTLY.
7. FINAL MARKS MUST BE STRICTLY CONSTRAINED BY: 0 <= marksAwarded <= MAXIMUM MARKS (${maximumMarks}).
8. IF STUDENT'S ANSWER IS DIFFERENT FROM REFERENCE ANSWERS BUT FACTUALLY CORRECT, DO NOT PENALIZE IT.
9. IF STUDENT'S ANSWER CONTAINS INCORRECT STATEMENTS, REFERENCE EVIDENCE MUST NOT CAUSE YOU TO OVERLOOK INCORRECT STATEMENTS.
10. IF REFERENCE ANSWERS CONFLICT WITH THE MODEL ANSWER/RUBRIC, THE FACULTY MODEL ANSWER AND RUBRIC REMAIN AUTHORITATIVE.
11. Return ONLY a valid JSON object matching the required schema below. No extra prose outside the JSON.

==================================================
REQUIRED STRUCTURED JSON SCHEMA
==================================================
{
  "marksAwarded": <number_total_awarded_marks_between_0_and_${maximumMarks}>,
  "maxMarks": ${maximumMarks},
  "percentage": <number_percentage>,
  "confidence": <number_evidence_confidence_score_between_0_and_1>,
  "criteria": [
    {
      "criterion": "<exact_criterion_name_from_rubric>",
      "marksAwarded": <number_marks>,
      "maxMarks": <number_max_marks>,
      "status": "<matched | partial | missing | incorrect>",
      "reason": "<criterion_justification>"
    }
  ],
  "matchedConcepts": ["<matched_concept_1>", "<matched_concept_2>"],
  "missingConcepts": ["<missing_concept_1>"],
  "keywordEvidence": ["<keyword_1>"],
  "referenceEvidence": [
    {
      "referenceId": "<reference_id_from_above>",
      "relevance": <number_relevance_between_0_and_1>,
      "reason": "<concise_explanation_of_how_reference_provided_contextual_evidence>"
    }
  ],
  "feedback": "<comprehensive_evaluation_explanation_for_faculty_review>",
  "reasoningSummary": "<concise_summary_of_strengths_and_gaps>",
  "rubricCoverage": <number_rubric_coverage_ratio_between_0_and_1>,
  "evaluationStatus": "evaluated"
}
`;
  }
}

export default new PromptService();


