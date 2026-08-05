export class MockLlmProvider {
  async evaluate(prompt, maxMarks = 10) {
    // Artificial latency (1.2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Assign mock marks: default 75% of maximumMarks
    const mockMarks = Math.round(maxMarks * 0.75 * 10) / 10;
    const similarity = 0.82;

    return {
      marks: mockMarks,
      similarity: similarity,
      strengths:
        "The student correctly identified the core components and explained the main mechanism fairly well.",
      weaknesses:
        "A few secondary details and critical vocabulary terms were not included in the response.",
      suggestions:
        "Include more context about structural dynamics and reference key terms from the prompt rubric.",
      justification:
        "Student response overlaps with core criteria, deserving partial marks of 75%.",
      tokensUsed: {
        promptTokens: 250,
        completionTokens: 80,
        totalTokens: 330,
      },
    };
  }
}

export default MockLlmProvider;
