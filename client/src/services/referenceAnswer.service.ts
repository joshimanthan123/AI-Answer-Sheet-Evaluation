import api from '../api/axios';

export interface ReferenceQuestion {
  _id?: string;
  questionNumber: number | string;
  questionId?: string;
  questionText: string;
  answerText: string;
  maximumMarks: number;
  awardedMarks: number;
  keywords: string[];
  concepts: string[];
  partialCreditPoints: string[];
  facultyComment?: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  ocrConfidence?: number;
}

export interface ReferenceAnswerItem {
  _id: string;
  examId: any;
  subjectId?: any;
  uploadedBy: any;
  referenceType: string;
  academicYear: string;
  description?: string;
  sourceFile: {
    filename: string;
    path: string;
    storageReference?: string;
    pages?: number;
    mimeType?: string;
    size?: number;
  };
  questions: ReferenceQuestion[];
  processingStatus: 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'VERIFICATION_PENDING' | 'APPROVED' | 'FAILED';
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  processingError?: string;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceFilterParams {
  examId?: string;
  subjectId?: string;
  academicYear?: string;
  processingStatus?: string;
  verificationStatus?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const referenceAnswerService = {
  /**
   * Upload reference answer sheet
   */
  uploadReference: async (formData: FormData) => {
    const res: any = await api.post('/v1/reference-answers/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res;
  },

  /**
   * Get filtered reference answers list
   */
  getReferences: async (params?: ReferenceFilterParams) => {
    const res: any = await api.get('/v1/reference-answers', { params });
    return res;
  },

  /**
   * Get single reference answer by ID
   */
  getReferenceById: async (id: string) => {
    const res: any = await api.get(`/v1/reference-answers/${id}`);
    return res;
  },

  /**
   * Trigger OCR processing / reprocessing for reference answer
   */
  processReference: async (id: string) => {
    const res: any = await api.post(`/v1/reference-answers/${id}/process`);
    return res;
  },

  /**
   * Update question extracted data in reference answer
   */
  updateQuestion: async (id: string, questionId: string, updateData: Partial<ReferenceQuestion>) => {
    const res: any = await api.put(`/v1/reference-answers/${id}/questions/${questionId}`, updateData);
    return res;
  },

  /**
   * Approve reference answer
   */
  approveReference: async (id: string) => {
    const res: any = await api.post(`/v1/reference-answers/${id}/approve`);
    return res;
  },

  /**
   * Reject reference answer
   */
  rejectReference: async (id: string, reason?: string) => {
    const res: any = await api.post(`/v1/reference-answers/${id}/reject`, { reason });
    return res;
  },

  /**
   * Delete reference answer
   */
  deleteReference: async (id: string) => {
    const res: any = await api.delete(`/v1/reference-answers/${id}`);
    return res;
  },
};

export default referenceAnswerService;
