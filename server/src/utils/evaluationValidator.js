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

    if (q.errorMessage) {
      failedQuestions++;
    } else {
      evaluatedQuestions++;
      // aiAwardedMarks is default or finalAwardedMarks if overridden
      const awarded = q.finalAwardedMarks !== undefined ? q.finalAwardedMarks : (q.aiAwardedMarks || 0);
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
  calculateEvaluationSummary,
};
