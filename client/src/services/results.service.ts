import apiClient from '../api/axios';

export interface ResultSummary {
  evaluationId: string;
  answerSheetId: string;
  studentIdentifier: string;
  studentName: string;
  filename: string;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'reviewed' | 'finalized' | 'failed';
  finalizedAt?: string;
}

export interface QuestionAnalytics {
  questionId: string;
  questionNumber: number;
  maxMarks: number;
  averageMarks: number;
  averagePercentage: number;
  highestMarks: number;
  lowestMarks: number;
  zeroCount: number;
  fullMarksCount: number;
  performanceDifficulty: 'easy' | 'moderate' | 'difficult';
}

export interface ExamAnalytics {
  totalAnswerSheets: number;
  totalEvaluated: number;
  finalizedResults: number;
  pendingReview: number;
  processing: number;
  failed: number;
  averageMarks: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number;
  passCount: number;
  failCount: number;
  passPercentage: number;
  distribution: {
    '0-20%': number;
    '21-40%': number;
    '41-60%': number;
    '61-80%': number;
    '81-100%': number;
  };
  questionAnalytics: QuestionAnalytics[];
  insights: string[];
}

export const resultsService = {
  getExamResults: async (examId: string, params: any = {}): Promise<{ data: ResultSummary[]; pagination: any }> => {
    const response = await apiClient.get<any, any>(`/v1/exams/${examId}/results`, { params });
    const resData = response.data || response;
    return {
      data: resData.data || [],
      pagination: resData.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 }
    };
  },

  getExamAnalytics: async (examId: string): Promise<ExamAnalytics> => {
    const response = await apiClient.get<any, any>(`/v1/exams/${examId}/analytics`);
    const resData = response.data || response;
    return resData.data || resData;
  },

  getIndividualResult: async (evaluationId: string): Promise<any> => {
    const response = await apiClient.get<any, any>(`/v1/evaluations/${evaluationId}/result`);
    const resData = response.data || response;
    return resData.data || resData;
  },

  downloadExamSummaryReport: (examId: string): void => {
    // Open in a new window/tab to trigger printing
    const token = localStorage.getItem('token');
    const url = `${apiClient.defaults.baseURL || ''}/v1/exams/${examId}/results/report?token=${token || ''}`;
    window.open(url, '_blank');
  },

  downloadIndividualReport: (evaluationId: string): void => {
    const token = localStorage.getItem('token');
    const url = `${apiClient.defaults.baseURL || ''}/v1/evaluations/${evaluationId}/report?token=${token || ''}`;
    window.open(url, '_blank');
  },

  exportExamResultsCSV: (examId: string): void => {
    const token = localStorage.getItem('token');
    const url = `${apiClient.defaults.baseURL || ''}/v1/exams/${examId}/results/export?token=${token || ''}`;
    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `results-${examId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  getPublishableResults: async (params: any = {}): Promise<{ data: any[]; pagination: any }> => {
    const response = await apiClient.get<any, any>('/faculty/results/publishable', { params });
    const resData = response.data || response;
    return {
      data: resData.data || [],
      pagination: resData.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 }
    };
  },

  getPublishedResults: async (params: any = {}): Promise<{ data: any[]; pagination: any }> => {
    const response = await apiClient.get<any, any>('/faculty/results/published', { params });
    const resData = response.data || response;
    return {
      data: resData.data || [],
      pagination: resData.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 }
    };
  },

  publishResult: async (answerSheetId: string, comment: string = ''): Promise<any> => {
    const response = await apiClient.post<any, any>(`/faculty/answer-sheets/${answerSheetId}/publish-result`, { comment });
    return response.data || response;
  },

  unpublishResult: async (answerSheetId: string, reason: string = ''): Promise<any> => {
    const response = await apiClient.post<any, any>(`/faculty/answer-sheets/${answerSheetId}/unpublish-result`, { reason });
    return response.data || response;
  },

  getPublicationStatus: async (answerSheetId: string): Promise<any> => {
    const response = await apiClient.get<any, any>(`/faculty/answer-sheets/${answerSheetId}/publication-status`);
    return response.data || response;
  }
};

export default resultsService;
