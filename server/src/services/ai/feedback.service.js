export class FeedbackService {
  formatFeedback(strengths, weaknesses, suggestions) {
    return {
      strengths: strengths || "No specific strengths highlighted.",
      weaknesses: weaknesses || "No major weaknesses highlighted.",
      suggestions: suggestions || "No additional suggestions.",
    };
  }
}

export default new FeedbackService();
