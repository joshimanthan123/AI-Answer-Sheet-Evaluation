import apiClient from '../api/axios';
import { Evaluation } from '../types';

export const evaluationService = {
  getEvaluationById: async (evaluationId: string): Promise<any> => {
    const response = await apiClient.get<any, any>(`/v1/evaluations/${evaluationId}`);
    const resData = response.data || response;
    const finalData = resData.data || resData;
    return finalData;
  },

  getEvaluationDetails: async (evaluationId: string): Promise<any[]> => {
    const response = await apiClient.get<any, any>(`/v1/evaluations/${evaluationId}`);
    const resData = response.data || response;
    const finalData = resData.data || resData;
    return finalData.questions || [];
  },

  getEvaluationByAnswerSheetId: async (sheetId: string): Promise<any> => {
    const response = await apiClient.get<any, any>(`/v1/evaluations?answerSheet=${sheetId}`);
    const resData = response.data || response;
    const finalData = resData.data || resData;
    if (Array.isArray(finalData)) {
      return finalData.length > 0 ? finalData[0] : null;
    }
    return finalData;
  },

  startEvaluation: async (sheetId: string): Promise<any> => {
    const response = await apiClient.post<any, any>(`/v1/answer-sheets/${sheetId}/evaluate`);
    const resData = response.data || response;
    return resData.data || resData;
  },

  bulkEvaluate: async (examId: string, answerSheetIds?: string[]): Promise<any> => {
    const response = await apiClient.post<any, any>(`/v1/exams/${examId}/evaluate`, { answerSheetIds });
    const resData = response.data || response;
    return resData.data || resData;
  },

  reEvaluate: async (sheetId: string): Promise<any> => {
    const response = await apiClient.post<any, any>(`/v1/answer-sheets/${sheetId}/re-evaluate`);
    const resData = response.data || response;
    return resData.data || resData;
  },

  reviewQuestion: async (evaluationId: string, questionId: string, finalAwardedMarks: number, facultyComment: string, overrideReason?: string): Promise<any> => {
    const response = await apiClient.put<any, any>(`/v1/evaluations/${evaluationId}/questions/${questionId}/review`, {
      finalAwardedMarks,
      facultyComment,
      overrideReason
    });
    const resData = response.data || response;
    return resData.data || resData;
  },

  finalizeEvaluation: async (evaluationId: string): Promise<any> => {
    const response = await apiClient.post<any, any>(`/v1/evaluations/${evaluationId}/finalize`);
    const resData = response.data || response;
    return resData.data || resData;
  },
  
  getAnalyticsMetrics: async (): Promise<any> => {
    const response = await apiClient.get<any, any>(`/v1/evaluations/analytics/metrics`);
    const resData = response.data || response;
    return resData.data || resData;
  },

  getStudentTrends: async (): Promise<any> => {
    const response = await apiClient.get<any, any>(`/v1/evaluations/analytics/student-trends`);
    const resData = response.data || response;
    return resData.data || resData;
  },

  getFacultyTopicTrends: async (): Promise<any> => {
    const response = await apiClient.get<any, any>(`/v1/evaluations/analytics/faculty-trends`);
    const resData = response.data || response;
    return resData.data || resData;
  }
};

export default evaluationService;
