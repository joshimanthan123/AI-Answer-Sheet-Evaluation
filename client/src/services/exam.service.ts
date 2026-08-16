import apiClient from '../api/axios';

export interface Question {
  id?: string;
  _id?: string;
  questionNumber: number;
  questionText: string;
  maximumMarks: number;
  questionType: 'Descriptive' | 'Short Answer' | 'Long Answer' | 'MCQ' | 'True/False';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  bloomsLevel: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
  keywords?: string | string[];
  rubric?: string;
  modelAnswer?: string;
  evaluationCriteria?: {
    conceptualUnderstanding: number;
    keywordAccuracy: number;
    completeness: number;
    correctness: number;
  };
  partialMarkingRules?: Array<{
    _id?: string;
    criterion: string;
    description?: string;
    marks: number;
  }>;
  expectedAnswerLength?: 'short' | 'medium' | 'long';
}

export interface Exam {
  id: string;
  _id?: string;
  title: string;
  examCode?: string;
  subject: any; // ID or populated object
  department?: string;
  semester?: string;
  examType?: 'Quiz' | 'Mid-Term' | 'Final-Semester' | string;
  examDate: string;
  startTime?: string;
  endTime?: string;
  duration: number;
  totalMarks: number;
  passingMarks?: number;
  instructions?: string;
  allowedMaterials?: string[];
  examStatus: 'Draft' | 'Published' | 'Active' | 'Completed';
  answerKeyStatus?: 'draft' | 'complete' | 'locked';
  questions: Question[];
  createdBy?: any;
  createdAt?: string;
}

export const examService = {
  getExams: async (params?: any): Promise<Exam[]> => {
    const response = await apiClient.get<any, any>('/exams', { params });
    const list = response.data || response;
    const exams = Array.isArray(list) ? list : (list.data || []);
    return exams.map((ex: any) => ({
      ...ex,
      id: ex._id || ex.id,
    }));
  },

  getExamById: async (id: string): Promise<Exam> => {
    const response = await apiClient.get<any, any>(`/exams/${id}`);
    const data = response.data || response;
    const finalData = data.data || data;
    return {
      ...finalData,
      id: finalData._id || finalData.id,
    };
  },

  createExam: async (examData: Omit<Exam, 'id'>): Promise<Exam> => {
    const response = await apiClient.post<any, any>('/exams', examData);
    const data = response.data || response;
    const finalData = data.data || data;
    return {
      ...finalData,
      id: finalData._id || finalData.id,
    };
  },

  updateExam: async (id: string, examData: Partial<Exam>): Promise<Exam> => {
    const response = await apiClient.put<any, any>(`/exams/${id}`, examData);
    const data = response.data || response;
    const finalData = data.data || data;
    return {
      ...finalData,
      id: finalData._id || finalData.id,
    };
  },

  deleteExam: async (id: string): Promise<void> => {
    await apiClient.delete(`/exams/${id}`);
  },

  updateQuestionAnswerKey: async (examId: string, questionId: string, data: any): Promise<Exam> => {
    const response = await apiClient.put<any, any>(`/exams/${examId}/questions/${questionId}/answer-key`, data);
    const resData = response.data || response;
    const finalData = resData.data || resData;
    return {
      ...finalData,
      id: finalData._id || finalData.id,
    };
  },

  finalizeAnswerKey: async (examId: string): Promise<Exam> => {
    const response = await apiClient.post<any, any>(`/exams/${examId}/answer-key/finalize`);
    const resData = response.data || response;
    const finalData = resData.data || resData;
    return {
      ...finalData,
      id: finalData._id || finalData.id,
    };
  },

  unlockAnswerKey: async (examId: string): Promise<Exam> => {
    const response = await apiClient.post<any, any>(`/exams/${examId}/answer-key/unlock`);
    const resData = response.data || response;
    const finalData = resData.data || resData;
    return {
      ...finalData,
      id: finalData._id || finalData.id,
    };
  },
};

export default examService;
