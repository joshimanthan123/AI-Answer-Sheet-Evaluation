export class MockLlmProvider {
  async evaluate(prompt, maxMarks = 10) {
    // Artificial latency (300 ms for fast test runs)
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Parse rubric criteria from prompt if available
    const criteriaRegex = /Criterion:\s*"([^"]+)",\s*Max Marks:\s*([\d.]+)/g;
    const parsedCriteria = [];

    let match;
    while ((match = criteriaRegex.exec(prompt)) !== null) {
      parsedCriteria.push({
        criterion: match[1],
        maxMarks: parseFloat(match[2]),
      });
    }

    // Check if student answer indicates empty response
    const isEmpty = prompt.includes('Student OCR Digitized Answer:\n""') || prompt.includes('Student OCR Digitized Answer:\n"    "');

    if (isEmpty) {
      const emptyCriteria = parsedCriteria.map((c) => ({
        criterion: c.criterion,
        marksAwarded: 0,
        maxMarks: c.maxMarks,
        status: "missing",
        reason: "No answer provided.",
      }));
      return {
        marksAwarded: 0,
        maxMarks,
        percentage: 0,
        criteria: emptyCriteria,
        matchedConcepts: [],
        missingConcepts: ["all concepts"],
        feedback: "Unanswered question. No student response was detected.",
        confidence: 1.0,
        tokensUsed: { promptTokens: 100, completionTokens: 40, totalTokens: 140 },
      };
    }

    // Determine mock performance score based on prompt contents
    const lowerPrompt = prompt.toLowerCase();
    let performanceRatio = 0.75;

    if (lowerPrompt.includes("computer architecture performance") || lowerPrompt.includes("cpu clock cycle")) {
      performanceRatio = 0.0;
    } else if (lowerPrompt.includes("system can only have 2") || lowerPrompt.includes("cap stands for consistency")) {
      performanceRatio = 0.4;
    } else if (lowerPrompt.includes("cap theorem covers consistency and availability") || lowerPrompt.includes("missing one rubric criterion")) {
      performanceRatio = 0.6;
    } else if (lowerPrompt.includes("the cap theorem states that a distributed data store")) {
      performanceRatio = 0.95;
    }


    // Distribute marks across criteria
    let criteria = [];
    let totalAwarded = 0;

    if (parsedCriteria.length > 0) {
      criteria = parsedCriteria.map((c, idx) => {
        let itemRatio = performanceRatio;
        if (performanceRatio === 0.6 && idx === 2) itemRatio = 0; // Missing 3rd criterion
        const itemAwarded = Math.round(c.maxMarks * itemRatio * 10) / 10;
        totalAwarded += itemAwarded;
        const status = itemAwarded >= c.maxMarks ? "matched" : itemAwarded > 0 ? "partial" : "missing";
        return {
          criterion: c.criterion,
          marksAwarded: itemAwarded,
          maxMarks: c.maxMarks,
          status,
          reason: status === "matched" ? "Fully satisfied criterion." : status === "partial" ? "Partially satisfied criterion." : "Criterion not addressed.",
        };
      });
      // Adjust totalAwarded precisely to sum of criteria
      totalAwarded = Math.round(criteria.reduce((sum, c) => sum + c.marksAwarded, 0) * 10) / 10;
    } else {
      const c1Max = Math.round(maxMarks * 0.5 * 10) / 10;
      const c2Max = Math.round((maxMarks - c1Max) * 10) / 10;
      const c1Awarded = Math.round(c1Max * performanceRatio * 10) / 10;
      const c2Awarded = Math.round(c2Max * performanceRatio * 10) / 10;
      totalAwarded = Math.round((c1Awarded + c2Awarded) * 10) / 10;
      criteria = [
        {
          criterion: "Conceptual Understanding",
          marksAwarded: c1Awarded,
          maxMarks: c1Max,
          status: c1Awarded >= c1Max ? "matched" : c1Awarded > 0 ? "partial" : "missing",
          reason: "Evaluated conceptual alignment.",
        },
        {
          criterion: "Correctness",
          marksAwarded: c2Awarded,
          maxMarks: c2Max,
          status: c2Awarded >= c2Max ? "matched" : c2Awarded > 0 ? "partial" : "missing",
          reason: "Evaluated answer correctness.",
        },
      ];
    }

    const percentage = Math.round((totalAwarded / maxMarks) * 100);

    const isReferenceAware = prompt.includes("REFERENCE-AWARE ADAPTIVE REVIEW");
    const refCount = (prompt.match(/HISTORICAL REFERENCE #/g) || []).length;

    const result = {
      marksAwarded: totalAwarded,
      maxMarks,
      percentage,
      criteria,
      matchedConcepts: performanceRatio > 0 ? ["consistency", "availability"] : [],
      missingConcepts: performanceRatio < 0.8 ? ["partition tolerance tradeoff"] : [],
      feedback: performanceRatio > 0.8
        ? "Excellent answer covering all core principles accurately."
        : performanceRatio > 0
        ? "Satisfactory answer with partial criterion alignment."
        : "Incorrect response. Does not address the question.",
      confidence: 0.9,
      tokensUsed: { promptTokens: 250, completionTokens: 80, totalTokens: 330 },
    };

    if (isReferenceAware) {
      result.referenceAnalysis = {
        used: true,
        referencesConsidered: refCount,
        relevanceSummary: `Evaluated using ${refCount} historical reference(s) as evidence.`,
        interpretationGuidance: "Calibrated criteria interpretations based on reference contextual examples.",
        markTransfer: false,
      };
    }

    return result;
  }
}

export default MockLlmProvider;

