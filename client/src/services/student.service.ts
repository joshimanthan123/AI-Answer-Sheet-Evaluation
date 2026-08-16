import { Student, AnswerSheet, Evaluation, Feedback } from '../types';
import apiClient from '../api/axios';

export const studentService = {
  getDashboardData: async (): Promise<any> => {
    const response = await apiClient.get<any, any>('/student/dashboard');
    return response.data?.data || response.data;
  },

  getProfile: async (studentId: string = 'stud-1'): Promise<any> => {
    const response = await apiClient.get<any, any>('/student/profile');
    return response.data?.user || response.data;
  },

  updateProfile: async (data: FormData | { name: string; profilePhoto?: string }): Promise<any> => {
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const response = await apiClient.patch<any, any>('/student/profile', data, { headers });
    return response.data?.user || response.data;
  },

  getEvaluations: async (): Promise<any[]> => {
    const response = await apiClient.get('/student/results');
    const results = response.data?.data || response.data || [];
    return results.map((res: any) => ({
      id: res.id || res._id,
      fileName: 'Optical Scan Paper.pdf',
      subjectName: res.subjectName || 'Unknown Subject',
      examName: res.examName || 'Semester Placement',
      status: res.status === 'approved' || res.status === 'finalized' ? 'evaluated' : 'pending',
      inkColor: 'blue',
      scanDpi: 300,
      evaluationId: res.id || res._id
    }));
  },

  getResults: async (): Promise<any[]> => {
    const response = await apiClient.get('/student/results');
    return response.data?.data || response.data;
  },

  requestReevaluation: async (evaluationId: string): Promise<{ message: string }> => {
    const response = await apiClient.post(`/student/results/${evaluationId}/reevaluate`);
    return response.data?.data || response.data;
  },

  getExams: async (params?: {
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<any> => {
    const response = await apiClient.get('/student/exams', { params });
    return response.data;
  },

  getExamById: async (examId: string): Promise<any> => {
    const response = await apiClient.get(`/student/exams/${examId}`);
    return response.data?.data || response.data;
  },

  getExamEligibility: async (examId: string): Promise<any> => {
    const response = await apiClient.get(`/student/exams/${examId}/eligibility`);
    return response.data?.data || response.data;
  },

  getExamWorkspace: async (examId: string): Promise<any> => {
    const response = await apiClient.get(`/student/exams/${examId}/workspace`);
    return response.data?.data || response.data;
  },

  startExam: async (examId: string): Promise<any> => {
    const response = await apiClient.post(`/student/exams/${examId}/start`);
    return response.data?.data || response.data;
  },

  autosaveExamAnswer: async (examId: string, payload: any): Promise<any> => {
    const response = await apiClient.patch(`/student/exams/${examId}/autosave`, payload);
    return response.data?.data || response.data;
  },

  submitExam: async (examId: string): Promise<any> => {
    const response = await apiClient.post(`/student/exams/${examId}/submit`);
    return response.data?.data || response.data;
  },

  getSubmissionStatus: async (examId: string): Promise<any> => {
    const response = await apiClient.get(`/student/exams/${examId}/submission-status`);
    return response.data?.data || response.data;
  },

  getExamResult: async (examId: string): Promise<any> => {
    const response = await apiClient.get(`/student/exams/${examId}/result`);
    return response.data?.data || response.data;
  }
};

export default studentService;
