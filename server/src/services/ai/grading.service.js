export class GradingService {
  calculateGrade(percentage) {
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B";
    if (percentage >= 60) return "C";
    if (percentage >= 50) return "D";
    return "F";
  }

  processMarks(awardedMarks, maxMarks) {
    let score = Number(awardedMarks);
    if (isNaN(score)) {
      score = 0;
    }
    // Prevent negative score
    score = Math.max(score, 0);
    // Respect maximum marks
    score = Math.min(score, maxMarks);
    // Consistently round to 1 decimal place
    return Math.round(score * 10) / 10;
  }
}

export default new GradingService();
