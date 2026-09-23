export const ACTIVE_EVALUATION_STATES = [
  "QUEUED_FOR_EVALUATION",
  "LOADING_ANSWER_KEY",
  "BUILDING_PROMPT",
  "AI_EVALUATING",
  "VALIDATING_RESULT",
];

/**
 * Checks if the evaluation is already running.
 * @param {string} status The evaluation status of the answer sheet.
 * @returns {boolean} True if evaluation is eligible to run, false if already running.
 */
export const validateEvaluationState = (status) => {
  return !ACTIVE_EVALUATION_STATES.includes(status);
};

/**
 * Validates and normalizes marks obtained from the LLM evaluator.
 * @param {any} awardedMarks Marks awarded by LLM.
 * @param {number} maxMarks Student question maximum marks.
 * @returns {object} Object with { valid, marks, warning, error, clamped, normalized }
 */
export const validateMarks = (awardedMarks, maxMarks) => {
  if (awardedMarks === null || awardedMarks === undefined) {
    return { valid: false, error: "Marks value is null or undefined" };
  }
  const numericMarks = Number(awardedMarks);
  if (isNaN(numericMarks) || !isFinite(numericMarks)) {
    return { valid: false, error: "Marks value is not a valid finite number" };
  }

  // Reject negative marks
  if (numericMarks < 0) {
    return { valid: false, error: `Negative marks (${numericMarks}) not allowed` };
  }

  // Check slight floating-point overflow
  if (numericMarks > maxMarks) {
    const overflowDelta = numericMarks - maxMarks;
    if (overflowDelta <= 0.001) {
      // Slight floating-point overflow, normalize safely
      return { valid: true, marks: maxMarks, normalized: true };
    }
    // Clamping large overflow (e.g. 12/10) with validation warning
    return {
      valid: true,
      marks: maxMarks,
      clamped: true,
      warning: {
        code: "MARKS_EXCEEDED_MAX",
        message: `Awarded marks (${numericMarks}) exceeded maximum marks (${maxMarks}) and were clamped to ${maxMarks}.`,
      },
    };
  }

  return { valid: true, marks: numericMarks };
};

/**
 * Validates Phase 3C structured LLM evaluation response.
 * @param {object} aiResult AI evaluation JSON response object.
 * @param {Array} rubric Configured rubric criteria list [{ criterion/criteria, maxMarks }].
 * @param {number} maxMarks Question maximum marks.
 * @returns {object} Validation result { valid, errors, warnings, calculatedMarks }
 */
export const validateAiEvaluationResponse = (aiResult, rubric = [], maxMarks = 10) => {
  const errors = [];
  const warnings = [];

  if (!aiResult || typeof aiResult !== "object") {
    return { valid: false, errors: ["AI output is not a valid JSON object"] };
  }

  // 1. Validate marksAwarded
  if (aiResult.marksAwarded === undefined || aiResult.marksAwarded === null) {
    errors.push("marksAwarded is missing in AI response");
  }
  const awardedMarks = Number(aiResult.marksAwarded);
  if (isNaN(awardedMarks) || !isFinite(awardedMarks)) {
    errors.push("marksAwarded is not a valid finite number");
  } else if (awardedMarks < 0) {
    errors.push(`marksAwarded (${awardedMarks}) cannot be negative`);
  } else if (awardedMarks > maxMarks) {
    errors.push(`marksAwarded (${awardedMarks}) exceeds maximum question marks (${maxMarks})`);
  }

  // 2. Validate confidence
  if (aiResult.confidence === undefined || aiResult.confidence === null) {
    errors.push("confidence score is missing");
  } else {
    const conf = Number(aiResult.confidence);
    if (isNaN(conf) || conf < 0 || conf > 1) {
      errors.push(`confidence score (${aiResult.confidence}) must be between 0 and 1`);
    }
  }

  // 3. Validate required string fields
  if (typeof aiResult.feedback !== "string" || aiResult.feedback.trim().length === 0) {
    errors.push("feedback string is missing or empty");
  }

  if (!Array.isArray(aiResult.matchedConcepts)) {
    warnings.push("matchedConcepts is missing or not an array");
  }
  if (!Array.isArray(aiResult.missingConcepts)) {
    warnings.push("missingConcepts is missing or not an array");
  }

  // 4. Validate criteria array & criterion-level marks
  if (!Array.isArray(aiResult.criteria)) {
    errors.push("criteria must be an array");
  } else {
    const knownCriteriaNames = rubric.map((r) =>
      (r.criterion || r.criteria || "").trim().toLowerCase()
    );

    let sumCriterionMarks = 0;

    aiResult.criteria.forEach((c, index) => {
      const name = (c.criterion || "").trim();
      if (!name) {
        errors.push(`Criterion at index ${index} is missing a criterion name`);
        return;
      }

      // Check if criterion exists in configured rubric (if rubric is provided and non-empty)
      if (knownCriteriaNames.length > 0) {
        const matches = knownCriteriaNames.some((k) => k === name.toLowerCase());
        if (!matches) {
          errors.push(`Unknown rubric criterion introduced by model: "${name}"`);
        }
      }

      const cMarks = Number(c.marksAwarded);
      const cMax = Number(c.maxMarks);

      if (isNaN(cMarks) || cMarks < 0) {
        errors.push(`Criterion "${name}" marksAwarded (${c.marksAwarded}) cannot be negative`);
      }

      if (!isNaN(cMax) && cMax > 0 && cMarks > cMax + 0.001) {
        errors.push(`Criterion "${name}" marksAwarded (${cMarks}) exceeds criterion maxMarks (${cMax})`);
      }

      const validStatuses = ["matched", "partial", "missing", "incorrect"];
      if (c.status && !validStatuses.includes(c.status)) {
        errors.push(`Criterion "${name}" has invalid status "${c.status}". Must be one of: ${validStatuses.join(", ")}`);
      }

      if (!isNaN(cMarks) && cMarks >= 0) {
        sumCriterionMarks += cMarks;
      }
    });

    // 5. Verify total criterion marks matches marksAwarded within decimal tolerance
    sumCriterionMarks = Number(sumCriterionMarks.toFixed(2));
    const targetMarks = Number(awardedMarks.toFixed(2));
    const delta = Math.abs(sumCriterionMarks - targetMarks);

    if (delta > 0.01) {
      errors.push(
        `Total criterion marks (${sumCriterionMarks}) does not match total awarded marks (${targetMarks})`
      );
    }
  }

  const isValid = errors.length === 0;

  return {
    valid: isValid,
    errors,
    warnings,
    calculatedMarks: isValid ? Number(awardedMarks.toFixed(2)) : 0,
  };
};

/**
 * Calculates summary metrics for the whole answer sheet evaluation.
 * @param {Array} questions List of question evaluation records.
 * @returns {object} Summary object
 */
export const calculateEvaluationSummary = (questions = []) => {
  const totalQuestions = questions.length;
  let evaluatedQuestions = 0;
  let failedQuestions = 0;
  let totalMaximumMarks = 0;
  let totalAwardedMarks = 0;

  for (const q of questions) {
    const maxQ = q.maximumMarks || q.maxMarks || 0;
    totalMaximumMarks += maxQ;

    if (q.errorMessage || q.status === "failed") {
      failedQuestions++;
    } else {
      evaluatedQuestions++;
      // aiAwardedMarks is default or finalAwardedMarks if overridden
      const awarded = q.finalAwardedMarks !== undefined ? q.finalAwardedMarks : (q.aiAwardedMarks || q.aiMarks || 0);
      totalAwardedMarks += awarded;
    }
  }

  const percentage = totalMaximumMarks > 0 ? Number(((totalAwardedMarks / totalMaximumMarks) * 100).toFixed(2)) : 0;

  return {
    totalQuestions,
    evaluatedQuestions,
    failedQuestions,
    totalMaximumMarks: Number(totalMaximumMarks.toFixed(2)),
    totalAwardedMarks: Number(totalAwardedMarks.toFixed(2)),
    percentage,
  };
};

export default {
  ACTIVE_EVALUATION_STATES,
  validateEvaluationState,
  validateMarks,
  validateAiEvaluationResponse,
  calculateEvaluationSummary,
};

