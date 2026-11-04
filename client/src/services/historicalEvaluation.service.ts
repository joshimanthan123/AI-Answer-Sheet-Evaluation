import api from '../api/axios';

export interface HistoricalEvaluationRecord {
  _id: string;
  sourceAnswerSheetId?: string;
  sourceAnswerId?: string;
  academicYear: string;
  subject: {
    id?: string;
    name: string;
    code?: string;
  };
  exam: {
    id?: string;
    name: string;
  };
  examName?: string;
  questionNumber: number;
  questionId?: string;
  questionText: string;
  studentAnswer: string;
  ocrText: string;
  modelAnswer: string;
  maxMarks: number;
  marksAwarded: number;
  rubric: any[];
  evaluationConfigVersion: number;
  referenceStatus: 'pending_review' | 'approved' | 'rejected' | 'archived';
  statusComment?: string;
  approvedBy?: any;
  approvedAt?: string;
  createdBy?: any;
  createdAt: string;
  updatedAt: string;
}

export interface HistoricalFilterParams {
  subjectId?: string;
  academicYear?: string;
  examId?: string;
  questionNumber?: number | string;
  referenceStatus?: string;
  page?: number;
  limit?: number;
}

export const historicalEvaluationService = {
  /**
   * Create historical reference snapshot from finalized answer sheet
   */
  createReference: async (answerSheetId: string, answerIds: string[]) => {
    const res = await api.post('/historical-evaluations', {
      answerSheetId,
      answerIds,
    });
    return res.data;
  },

  /**
   * Get filtered historical references
   */
  getReferences: async (params?: HistoricalFilterParams) => {
    const res = await api.get('/historical-evaluations', { params });
    return res.data;
  },

  /**
   * Get single reference detail by ID
   */
  getReferenceById: async (id: string) => {
    const res = await api.get(`/historical-evaluations/${id}`);
    return res.data;
  },

  /**
   * Update reference status (approved, rejected, archived)
   */
  updateStatus: async (id: string, status: 'approved' | 'rejected' | 'archived', comment?: string) => {
    const res = await api.patch(`/historical-evaluations/${id}/status`, {
      status,
      comment,
    });
    return res.data;
  },

  /**
   * Get question reference evidence and borderline status
   */
  getQuestionReferenceEvidence: async (answerSheetId: string, questionId: string) => {
    const res = await api.get(`/evaluations/v1/answersheet/${answerSheetId}/questions/${questionId}/references`);
    return res.data;
  },

  /**
   * Trigger reference-aware evaluation for a specific question
   */
  triggerReferenceAwareEvaluation: async (answerSheetId: string, questionId: string) => {
    const res = await api.post(`/evaluations/v1/answersheet/${answerSheetId}/questions/${questionId}/reference-aware`);
    return res.data;
  },
};

export default historicalEvaluationService;
