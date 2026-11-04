import env from "../../config/env.js";
import logger from "../../utils/logger.js";

export class BorderlineDetectionService {
  /**
   * Evaluates an AI question evaluation result against multiple borderline signals.
   * @param {Object} questionEval - The AI evaluation object for a question
   * @param {Number} maxMarks - Maximum marks for the question
   * @param {Array} rubric - Rubric criteria array
   * @returns {Object} { isBorderline: boolean, reasons: string[], confidence: number, detectedAt: Date }
   */
  detectBorderline(questionEval, maxMarks = 10, rubric = []) {
    const thresholdConfidence = parseFloat(
      process.env.BORDERLINE_CONFIDENCE_THRESHOLD || env.AI?.BORDERLINE_CONFIDENCE_THRESHOLD || 0.75
    );

    const reasons = [];
    const confidence =
      questionEval.confidence !== undefined
        ? Number(questionEval.confidence)
        : questionEval.aiEvaluation?.confidence !== undefined
        ? Number(questionEval.aiEvaluation.confidence)
        : 1.0;

    const marksAwarded =
      questionEval.marksAwarded !== undefined
        ? Number(questionEval.marksAwarded)
        : questionEval.aiMarks !== undefined
        ? Number(questionEval.aiMarks)
        : questionEval.aiEvaluation?.marksAwarded !== undefined
        ? Number(questionEval.aiEvaluation.marksAwarded)
        : 0;

    // Signal A: Low AI confidence
    if (confidence < thresholdConfidence) {
      reasons.push("low_confidence");
    }

    // Signal B: Score boundary proximity (near half-mark boundary or score boundary)
    const decimalPart = Math.abs(marksAwarded - Math.floor(marksAwarded));
    // If marks are near .25, .5, or .75 or score percentage is borderline near pass/fail/grade boundaries (e.g. 45-55%, 70-75%)
    const pct = maxMarks > 0 ? (marksAwarded / maxMarks) * 100 : 0;
    const isBoundaryFraction = decimalPart >= 0.2 && decimalPart <= 0.8;
    const isGradeBoundaryPct = (pct >= 45 && pct <= 55) || (pct >= 68 && pct <= 75);

    if (isBoundaryFraction || isGradeBoundaryPct) {
      reasons.push("score_boundary_proximity");
    }

    // Signal C: Criterion ambiguity (has partial criterion statuses)
    const criteria =
      questionEval.criteria ||
      questionEval.criteriaScores ||
      questionEval.aiEvaluation?.criteria ||
      [];

    const hasPartialCriterion = criteria.some(
      (c) => c.status === "partial" || (c.marksAwarded > 0 && c.marksAwarded < c.maxMarks)
    );
    if (hasPartialCriterion) {
      reasons.push("criterion_ambiguity");
    }

    // Signal D: Mixed / conflicting evidence
    const similarityScore =
      questionEval.similarityScore !== undefined
        ? questionEval.similarityScore / 100
        : questionEval.semanticScore !== undefined
        ? questionEval.semanticScore / 100
        : null;

    if (similarityScore !== null && maxMarks > 0) {
      const scoreRatio = marksAwarded / maxMarks;
      // High similarity but low marks or vice versa
      if (Math.abs(similarityScore - scoreRatio) > 0.35) {
        reasons.push("mixed_evidence");
      }
    }

    const isBorderline = reasons.length > 0;

    logger.info(
      `Borderline detection result: isBorderline=${isBorderline}, reasons=[${reasons.join(
        ", "
      )}], confidence=${confidence}, marks=${marksAwarded}/${maxMarks}`
    );

    return {
      isBorderline,
      reasons,
      confidence,
      detectedAt: new Date(),
    };
  }
}

export default new BorderlineDetectionService();
