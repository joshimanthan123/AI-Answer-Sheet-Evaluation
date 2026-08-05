export class MockHwrProvider {
  async transcribe(handwrittenData, questionModelAnswer = "") {
    // Artificial latency (800ms)
    await new Promise((resolve) => setTimeout(resolve, 800));

    let text = "This is a mock transcribed text representing student digital handwriting.";

    if (questionModelAnswer) {
      if (questionModelAnswer.length > 50) {
        text =
          questionModelAnswer.substring(0, Math.floor(questionModelAnswer.length * 0.85)) +
          " (transcribed mock)";
      } else {
        text = questionModelAnswer + " (transcribed mock)";
      }
    }

    return {
      recognizedText: text,
      confidenceScore: 0.92,
      processingTime: 800,
    };
  }
}

export default MockHwrProvider;
