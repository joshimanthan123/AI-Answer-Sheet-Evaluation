import axiosInstance from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

export interface CalibrationSummary {
  hasData: boolean;
  message?: string;
  totalReviewed: number;
  approvedCount: number;
  modifiedCount: number;
  rejectedCount: number;
  averageAiMarks: number;
  averageFacultyMarks: number;
  averageAbsoluteDifference: number;
  averageDifference: number;
  modificationRate: number;
  confidenceDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
}

export interface QuestionCalibrationItem {
  examTitle: string;
  questionNumber: string;
  totalReviews: number;
  approvedCount: number;
  modifiedCount: number;
  aiAverageMarks: number;
  facultyAverageMarks: number;
  averageDifference: number;
  modificationRate: number;
}

export interface ConfidenceVsCorrectionItem {
  confidenceRange: string;
  reviews: number;
  modified: number;
  modificationRate: number;
}

export interface ReferenceEffectAnalysis {
  hasData: boolean;
  message?: string;
  note?: string;
  referenceUsed: { reviewed: number; modified: number; modificationRate: number };
  referenceNotUsed: { reviewed: number; modified: number; modificationRate: number };
}

export interface CalibrationInsights {
  hasData: boolean;
  message?: string;
  totalRecords?: number;
  insights: string[];
  recommendations: string[];
}

export interface LearningFeedbackItem {
  _id: string;
  evaluationId: string;
  examId?: { _id: string; title: string };
  subjectId?: { _id: string; name: string; code: string };
  questionNumber: string;
  studentId?: { _id: string; name: string; rollNo: string };
  aiMarks: number;
  finalMarks: number;
  maximumMarks: number;
  difference: number;
  reviewStatus: string;
  reviewCategory: string;
  reason: string;
  comment?: string;
  matchedConcepts?: string[];
  missingConcepts?: string[];
  referenceUsed: boolean;
  aiConfidence: number;
  approvedForLearning: boolean;
  createdBy?: { _id: string; name: string; role: string };
  createdAt: string;
}

export interface ReviewHistoryItem {
  evaluationId: string;
  reviewStatus: string;
  auditHistory: Array<{
    action: string;
    questionNumber?: string;
    previousValue?: any;
    newValue?: any;
    comment?: string;
    changedBy?: { name: string; email: string; role: string };
    changedAt: string;
  }>;
  feedbackRecords: LearningFeedbackItem[];
}

class CalibrationService {
  async getSummary(params?: Record<string, any>): Promise<CalibrationSummary> {
    const response = await axiosInstance.get(API_ENDPOINTS.CALIBRATION.SUMMARY, { params });
    return response.data.data;
  }

  async getByQuestion(params?: Record<string, any>): Promise<{ hasData: boolean; message?: string; questions: QuestionCalibrationItem[] }> {
    const response = await axiosInstance.get(API_ENDPOINTS.CALIBRATION.BY_QUESTION, { params });
    return response.data.data;
  }

  async getByConfidence(params?: Record<string, any>): Promise<{ hasData: boolean; message?: string; ranges: ConfidenceVsCorrectionItem[] }> {
    const response = await axiosInstance.get(API_ENDPOINTS.CALIBRATION.BY_CONFIDENCE, { params });
    return response.data.data;
  }

  async getReferenceImpact(params?: Record<string, any>): Promise<ReferenceEffectAnalysis> {
    const response = await axiosInstance.get(API_ENDPOINTS.CALIBRATION.REFERENCE_IMPACT, { params });
    return response.data.data;
  }

  async getInsights(params?: Record<string, any>): Promise<CalibrationInsights> {
    const response = await axiosInstance.get(API_ENDPOINTS.CALIBRATION.INSIGHTS, { params });
    return response.data.data;
  }

  async getLearningFeedback(params?: Record<string, any>): Promise<{ items: LearningFeedbackItem[]; total: number; page: number; totalPages: number }> {
    const response = await axiosInstance.get(API_ENDPOINTS.CALIBRATION.FEEDBACK, { params });
    return {
      items: response.data.data || [],
      total: response.data.pagination?.total || 0,
      page: response.data.pagination?.page || 1,
      totalPages: response.data.pagination?.totalPages || 1,
    };
  }

  async updateLearningApproval(id: string, approvedForLearning: boolean): Promise<LearningFeedbackItem> {
    const response = await axiosInstance.put(API_ENDPOINTS.CALIBRATION.APPROVAL(id), { approvedForLearning });
    return response.data.data;
  }

  async getReviewHistory(evaluationId: string): Promise<ReviewHistoryItem> {
    const response = await axiosInstance.get(API_ENDPOINTS.CALIBRATION.REVIEW_HISTORY(evaluationId));
    return response.data.data;
  }
}

export const calibrationService = new CalibrationService();
export default calibrationService;
