import { Evaluation, EvaluationDetail } from '../types';
import { 
  mockEvaluations, 
  mockEvaluationDetails, 
  mockStudentTermTrends, 
  mockFacultyTopicTrends, 
  mockDefaultMetrics 
} from '../mocks/db';

export const evaluationService = {
  getEvaluationById: async (evaluationId: string): Promise<Evaluation | undefined> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const evaluation = mockEvaluations.find(ev => ev.id === evaluationId);
        resolve(evaluation);
      }, 400);
    });
  },

  getEvaluationDetails: async (evaluationId: string): Promise<EvaluationDetail[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const details = mockEvaluationDetails[evaluationId] || [];
        resolve(details);
      }, 500);
    });
  },

  getAnalyticsMetrics: async (): Promise<typeof mockDefaultMetrics> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockDefaultMetrics);
      }, 300);
    });
  },

  getStudentTrends: async (): Promise<typeof mockStudentTermTrends> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockStudentTermTrends);
      }, 300);
    });
  },

  getFacultyTopicTrends: async (): Promise<typeof mockFacultyTopicTrends> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockFacultyTopicTrends);
      }, 300);
    });
  }
};

export default evaluationService;
