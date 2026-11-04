import apiClient from '../api/axios';

export interface AccessibleExam {
  id: string;
  _id: string;
  title: string;
  examCode: string;
  subjectName: string;
  subjectCode: string;
  totalMarks: number;
  passingMarks?: number | null;
  examDate: string;
  status: string;
}

export interface OverviewAnalytics {
  examId: string;
  examTitle: string;
  totalMarks: number;
  totalStudents: number;
  finalizedStudents: number;
  pendingEvaluations: number;
  averageFinalMarks: number;
  averagePercentage: number;
  highestFinalMarks: number;
  lowestFinalMarks: number;
  hasPassingRule: boolean;
  passingMarks?: number | null;
}

export interface StudentPerformanceItem {
  evaluationId?: string | null;
  answerSheetId: string;
  studentIdentifier: string;
  studentName: string;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  status: string;
  isFinalized: boolean;
  resultStatus: string;
  submittedAt?: string;
}

export interface StudentPerformanceAnalytics {
  examId: string;
  distribution: {
    '0-20%': number;
    '21-40%': number;
    '41-60%': number;
    '61-80%': number;
    '81-100%': number;
  };
  passFailAnalytics: {
    hasPassingRule: boolean;
    passingMarks?: number | null;
    passCount: number;
    failCount: number;
    passPercentage: number;
    message?: string | null;
  };
  students: StudentPerformanceItem[];
  totalCount: number;
}

export interface QuestionPerformanceItem {
  questionId: string;
  questionNumber: number | string;
  questionText: string;
  maxMarks: number;
  averageMarks: number;
  aiAverageMarks?: number;
  averagePercentage: number;
  highestMarks: number;
  lowestMarks: number;
  finalizedAnswers: number;
  overriddenCount: number;
  observedPerformanceLabel: string;
}

export interface QuestionPerformanceAnalytics {
  examId: string;
  totalQuestions: number;
  finalizedCount: number;
  questions: QuestionPerformanceItem[];
  lowerPerformingQuestions?: QuestionPerformanceItem[];
}

export interface AIVsFacultyAnalytics {
  examId: string;
  finalizedCount: number;
  averageAIMarks: number;
  averageFacultyMarks: number;
  averageDifference: number;
  questionsAccepted: number;
  questionsOverridden: number;
  markChanges: {
    marksIncreased: number;
    marksDecreased: number;
    marksUnchanged: number;
  };
  differenceDistribution: {
    '-5 or lower': number;
    '-4 to -3': number;
    '-2 to -1': number;
    '0': number;
    '+1 to +2': number;
    '+3 to +4': number;
    '+5 or higher': number;
  };
}

export interface ConfidenceOverrideBand {
  range: string;
  evaluations: number;
  overrides: number;
}

export interface ConfidenceAnalytics {
  examId: string;
  totalEvaluatedQuestions: number;
  averageConfidence: number;
  highConfidenceCount: number;
  moderateConfidenceCount: number;
  lowConfidenceCount: number;
  observedOverrideDistribution: ConfidenceOverrideBand[];
}

export interface ReviewCommentItem {
  evaluationId: string;
  studentIdentifier: string;
  studentName: string;
  questionNumber: string;
  aiMarks: number;
  finalMarks: number;
  reason: string;
  comment: string;
  reviewedAt: string;
}

export interface OverrideAnalytics {
  examId: string;
  reviewWorkload: {
    totalEvaluations: number;
    reviewed: number;
    pending: number;
    overridden: number;
    finalized: number;
    averageReviewTimeMinutes: number | null;
  };
  overrideReasons: { reason: string; count: number }[];
  reviewComments: ReviewCommentItem[];
}

export interface ConsolidatedAnalytics {
  overview: OverviewAnalytics;
  studentPerformance: StudentPerformanceAnalytics;
  questionPerformance: QuestionPerformanceAnalytics;
  aiVsFaculty: AIVsFacultyAnalytics;
  confidence: ConfidenceAnalytics;
  overrides: OverrideAnalytics;
}

export interface StudentMeAnalytics {
  totalExams: number;
  averagePercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
  hasResults: boolean;
}

export interface StudentTrendItem {
  evaluationId: string;
  answerSheetId: string | null;
  examId: string | null;
  examTitle: string;
  subjectName: string;
  subjectCode: string;
  examDate: string;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  publishedAt: string;
}

export interface StudentQuestionDetail {
  questionId: string;
  questionNumber: string;
  questionText: string;
  maximumMarks: number;
  obtainedMarks: number;
  aiMarks: number;
  percentage: number;
  wasOverridden: boolean;
  confidence: number;
  feedback: string;
  matchedConcepts: string[];
  missingConcepts: string[];
}

export interface StudentExamDetails {
  examId: string;
  examTitle: string;
  subjectName: string;
  subjectCode: string;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  questions: StudentQuestionDetail[];
}

export interface AdminOverviewAnalytics {
  totalExams: number;
  totalEvaluations: number;
  publishedResults: number;
  pendingEvaluations: number;
  totalStudentsEvaluated: number;
  totalFaculty: number;
  averageEvaluationPercentage: number;
}

export interface AdminExamItem {
  examId: string;
  title: string;
  subjectCode: string;
  subjectName: string;
  examDate: string;
  totalMarks: number;
  totalEvaluated: number;
  averageMarks: number;
  averagePercentage: number;
  highestMarks: number;
  lowestMarks: number;
  passCount: number;
  failCount: number;
  passRate: number | null;
}

export const analyticsService = {
  getAccessibleExams: async (): Promise<AccessibleExam[]> => {
    const response = await apiClient.get<any, any>('/analytics/exams');
    const resData = response.data || response;
    return resData.data || resData;
  },

  getConsolidatedAnalytics: async (examId: string): Promise<ConsolidatedAnalytics> => {
    const response = await apiClient.get<any, any>(`/analytics/exam/${examId}`);
    const resData = response.data || response;
    return resData.data || resData;
  },

  getStudentMeAnalytics: async (): Promise<StudentMeAnalytics> => {
    const response = await apiClient.get<any, any>('/analytics/student/me');
    const resData = response.data || response;
    return resData.data || resData;
  },

  getStudentMeTrends: async (): Promise<StudentTrendItem[]> => {
    const response = await apiClient.get<any, any>('/analytics/student/me/trends');
    const resData = response.data || response;
    return resData.data || resData;
  },

  getStudentMeExamDetails: async (examId: string): Promise<StudentExamDetails> => {
    const response = await apiClient.get<any, any>(`/analytics/student/me/exam/${examId}`);
    const resData = response.data || response;
    return resData.data || resData;
  },

  getAdminOverviewAnalytics: async (): Promise<AdminOverviewAnalytics> => {
    const response = await apiClient.get<any, any>('/analytics/admin/overview');
    const resData = response.data || response;
    return resData.data || resData;
  },

  getAdminExamsAnalytics: async (): Promise<AdminExamItem[]> => {
    const response = await apiClient.get<any, any>('/analytics/admin/exams');
    const resData = response.data || response;
    return resData.data || resData;
  },

  exportCSV: (examId: string): void => {
    const token = localStorage.getItem('gradeai_token') || localStorage.getItem('token');
    const baseURL = apiClient.defaults.baseURL || 'http://localhost:5000/api';
    const url = `${baseURL}/analytics/exam/${examId}/export/csv?token=${token || ''}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `evaluation-analytics-${examId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  exportPDF: (examId: string): void => {
    const token = localStorage.getItem('gradeai_token') || localStorage.getItem('token');
    const baseURL = apiClient.defaults.baseURL || 'http://localhost:5000/api';
    const url = `${baseURL}/analytics/exam/${examId}/export/pdf?token=${token || ''}`;
    window.open(url, '_blank');
  },

  exportExcel: (examId: string): void => {
    const token = localStorage.getItem('gradeai_token') || localStorage.getItem('token');
    const baseURL = apiClient.defaults.baseURL || 'http://localhost:5000/api';
    const url = `${baseURL}/analytics/exam/${examId}/export/excel?token=${token || ''}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `evaluation-analytics-${examId}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

export default analyticsService;
