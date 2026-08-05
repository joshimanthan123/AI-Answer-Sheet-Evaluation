export class SimilarityService {
  calculateSimilarity(studentText, modelText) {
    if (!studentText || !modelText) {
      return {
        similarityScore: 0,
        matchedConcepts: [],
        missingConcepts: [],
      };
    }

    const clean = (text) =>
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3);

    const studentWords = new Set(clean(studentText));
    const modelWords = clean(modelText);

    if (modelWords.length === 0) {
      return {
        similarityScore: 0,
        matchedConcepts: [],
        missingConcepts: [],
      };
    }

    const matched = modelWords.filter((w) => studentWords.has(w));
    const uniqueModelWords = Array.from(new Set(modelWords));
    const uniqueMatched = Array.from(new Set(matched));

    const ratio = uniqueMatched.length / uniqueModelWords.length;
    const score = Math.round(ratio * 100) / 100;

    return {
      similarityScore: score,
      matchedConcepts: uniqueMatched,
      missingConcepts: uniqueModelWords.filter((w) => !studentWords.has(w)),
    };
  }
}

export default new SimilarityService();
