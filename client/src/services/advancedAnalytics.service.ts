import apiClient from '../api/axios';

export interface FilterOptions {
  academicYears: string[];
  semesters: string[];
  subjects: { id: string; name: string; code: string }[];
  exams: {
    id: string;
    _id: string;
    title: string;
    subjectName: string;
    subjectCode: string;
    examDate: string;
    totalMarks: number;
    examStatus: string;
  }[];
}

export interface CrossExamItem {
  examId: string;
  title: string;
  subjectCode: string;
  subjectName: string;
  examType: string;
  examDate: string;
  totalMarks: number;
  studentCount: number;
  averageFinalMarks: number;
  averageAIMarks: number;
  averagePercentage: number;
  averageAIPercentage: number;
  overrideRate: number;
  passRate?: number | null;
}

export interface CrossExamAnalyticsResponse {
  crossExamComparison: CrossExamItem[];
  summary: {
    totalExams: number;
    averagePercentageAcrossExams: number;
  };
}

export interface PerformanceTrendItem {
  examId: string;
  title: string;
  examDate: string;
  averagePercentage: number;
  studentCount: number;
  totalMarks: number;
}

export interface StudentPerformanceTrend {
  student: {
    id: string;
    name: string;
    studentIdentifier: string;
  } | null;
  performanceTrend: {
    evaluationId: string;
    examId: string;
    examTitle: string;
    examDate: string;
    obtainedMarks: number;
    totalMarks: number;
    percentage: number;
    grade: string;
    finalizedAt: string;
  }[];
}

export interface QuestionTrendItem {
  questionKey: string;
  questionNumber: number | string;
  questionId?: string | null;
  maxMarks: number;
  evaluatedCount: number;
  averageFinalMarks: number;
  averageAIMarks: number;
  averagePercentage: number;
  aiAveragePercentage: number;
  overrideRate: number;
  overridesCount: number;
  ocrIssuesCount: number;
  referenceIssuesCount: number;
  rubricIssuesCount: number;
}

export interface PotentialImprovementArea {
  examId: string;
  questionNumber: string;
  questionId?: string | null;
  totalOverrides: number;
  ocrIssues: number;
  referenceAnswerIssues: number;
  rubricIssues: number;
  alternativeAnswers: number;
  markCorrections: number;
  otherIssues: number;
  label: string;
}

export interface AIEvaluationTrendItem {
  examId: string;
  title: string;
  examDate: string;
  averageAIMarks: number;
  averageFacultyMarks: number;
  averageDifference: number;
  overrideRate: number;
  studentCount: number;
}

export interface FeedbackTrendItem {
  examId: string;
  examTitle: string;
  examDate: string;
  OCR_issue: number;
  rubric_issue: number;
  reference_answer_issue: number;
  alternative_answer: number;
  mark_correction: number;
  evaluation_logic_issue: number;
  other: number;
  totalFeedback: number;
}

export interface VersionTimelineItem {
  id: string;
  type: string;
  version: string;
  versionNumber: number;
  createdBy: string;
  approvedBy: string;
  createdDate: string;
  status: string;
  changeReason: string;
}

export interface SystemMonitoringMetrics {
  health: {
    ocrService: string;
    backendApi: string;
    database: string;
    aiEvaluation: string;
    uptimeSeconds: number;
    memoryUsageMB: number;
  };
  ocrMetrics: {
    totalRequests: number;
    successful: number;
    failed: number;
    averageProcessingTime: string;
    averageConfidence: number | string;
  };
  aiMetrics: {
    processed: number;
    successful: number;
    failed: number;
    averageProcessingTime: string;
  };
}

export interface PipelineHealth {
  pipelineCounts: {
    submitted: number;
    ocrCompleted: number;
    aiEvaluated: number;
    facultyReviewed: number;
    finalized: number;
  };
  bottleneck: {
    pendingOCR: number;
    pendingAI: number;
    pendingFacultyReview: number;
    pendingFinalization: number;
  };
}

export interface AdminOverview {
  users: {
    total: number;
    students: number;
    faculty: number;
    admins: number;
  };
  exams: { total: number };
  submissions: { total: number };
  evaluations: { total: number; finalized: number };
  feedback: { total: number };
  improvementSuggestions: { total: number };
}

export interface ReviewPriorityItem {
  evaluationId: string;
  answerSheetId: string;
  studentName: string;
  studentIdentifier: string;
  reviewPriority: 'High' | 'Medium' | 'Low';
  score: number;
  reasons: string[];
}

export interface AuditLogItem {
  _id: string;
  user?: { _id: string; name: string; email: string; role: string } | null;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  exam?: { _id: string; title: string };
  details: string;
  metadata?: any;
  ipAddress: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILURE';
  createdAt: string;
}

export interface AuditLogSearchResponse {
  logs: AuditLogItem[];
  total: number;
  page: number;
  pages: number;
}

export interface SystemAlertConfigData {
  ocrFailureRateThreshold: number;
  evaluationFailureRateThreshold: number;
  pendingEvaluationCountThreshold: number;
  highOverrideRateThreshold: number;
}

export interface SystemAlertItem {
  alertType: string;
  title: string;
  message: string;
  threshold: number;
  actualValue: number;
  status: string;
  createdAt: string;
}

export interface SystemAlertsResponse {
  config: SystemAlertConfigData;
  alerts: SystemAlertItem[];
}

export const advancedAnalyticsService = {
  getFilters: async (): Promise<FilterOptions> => {
    const res = await apiClient.get<any, any>('/advanced-analytics/filters');
    const resData = res.data || res;
    return resData.data || resData;
  },

  getCrossExamAnalytics: async (filters: Record<string, string> = {}): Promise<CrossExamAnalyticsResponse> => {
    const query = new URLSearchParams(filters).toString();
    const res = await apiClient.get<any, any>(`/advanced-analytics/cross-exam?${query}`);
    const resData = res.data || res;
    return resData.data || resData;
  },

  getPerformanceTrends: async (filters: Record<string, string> = {}): Promise<PerformanceTrendItem[]> => {
    const query = new URLSearchParams(filters).toString();
    const res = await apiClient.get<any, any>(`/advanced-analytics/performance-trends?${query}`);
    const resData = res.data || res;
    return resData.data || resData;
  },

  getStudentPerformanceTrends: async (studentQuery: string): Promise<StudentPerformanceTrend> => {
    const res = await apiClient.get<any, any>(`/advanced-analytics/student-trends/${studentQuery}`);
    const resData = res.data || res;
    return resData.data || resData;
  },

  getQuestionTrends: async (filters: Record<string, string> = {}): Promise<QuestionTrendItem[]> => {
    const query = new URLSearchParams(filters).toString();
    const res = await apiClient.get<any, any>(`/advanced-analytics/question-trends?${query}`);
    const resData = res.data || res;
    return resData.data || resData;
  },

  getRepeatedCorrectionPatterns: async (filters: Record<string, string> = {}): Promise<PotentialImprovementArea[]> => {
    const query = new URLSearchParams(filters).toString();
    const res = await apiClient.get<any, any>(`/advanced-analytics/repeated-correction-patterns?${query}`);
    const resData = res.data || res;
    return resData.data || resData;
  },

  getAIEvaluationTrends: async (filters: Record<string, string> = {}): Promise<AIEvaluationTrendItem[]> => {
    const query = new URLSearchParams(filters).toString();
    const res = await apiClient.get<any, any>(`/advanced-analytics/ai-trends?${query}`);
    const resData = res.data || res;
    return resData.data || resData;
  },

  getFeedbackTrends: async (filters: Record<string, string> = {}): Promise<FeedbackTrendItem[]> => {
    const query = new URLSearchParams(filters).toString();
    const res = await apiClient.get<any, any>(`/advanced-analytics/feedback-trends?${query}`);
    const resData = res.data || res;
    return resData.data || resData;
  },

  getVersionHistoryTimeline: async (examId: string): Promise<VersionTimelineItem[]> => {
    const res = await apiClient.get<any, any>(`/advanced-analytics/version-history/${examId}`);
    const resData = res.data || res;
    return resData.data || resData;
  },

  getSystemMonitoringMetrics: async (): Promise<SystemMonitoringMetrics> => {
    const res = await apiClient.get<any, any>('/advanced-analytics/system-monitoring');
    const resData = res.data || res;
    return resData.data || resData;
  },

  getPipelineHealth: async (filters: Record<string, string> = {}): Promise<PipelineHealth> => {
    const query = new URLSearchParams(filters).toString();
    const res = await apiClient.get<any, any>(`/advanced-analytics/pipeline-health?${query}`);
    const resData = res.data || res;
    return resData.data || resData;
  },

  getAdminOverview: async (): Promise<AdminOverview> => {
    const res = await apiClient.get<any, any>('/advanced-analytics/admin-overview');
    const resData = res.data || res;
    return resData.data || resData;
  },

  getAuditLogs: async (params: Record<string, any> = {}): Promise<AuditLogSearchResponse> => {
    const query = new URLSearchParams(params).toString();
    const res = await apiClient.get<any, any>(`/advanced-analytics/audit-logs?${query}`);
    const resData = res.data || res;
    return resData.data || resData;
  },

  getReviewPriorityList: async (examId: string): Promise<ReviewPriorityItem[]> => {
    const res = await apiClient.get<any, any>(`/advanced-analytics/review-priority/${examId}`);
    const resData = res.data || res;
    return resData.data || resData;
  },

  getSystemAlerts: async (): Promise<SystemAlertsResponse> => {
    const res = await apiClient.get<any, any>('/advanced-analytics/alerts');
    const resData = res.data || res;
    return resData.data || resData;
  },

  updateAlertConfig: async (config: Partial<SystemAlertConfigData>): Promise<SystemAlertConfigData> => {
    const res = await apiClient.put<any, any>('/advanced-analytics/alerts/config', config);
    const resData = res.data || res;
    return resData.data || resData;
  },

  exportCSV: (filters: Record<string, string> = {}): void => {
    const token = localStorage.getItem('gradeai_token') || localStorage.getItem('token');
    const baseURL = apiClient.defaults.baseURL || 'http://localhost:5000/api';
    const query = new URLSearchParams({ ...filters, token: token || '' }).toString();
    const url = `${baseURL}/advanced-analytics/export/csv?${query}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'advanced-system-analytics.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  exportPDF: (filters: Record<string, string> = {}): void => {
    const token = localStorage.getItem('gradeai_token') || localStorage.getItem('token');
    const baseURL = apiClient.defaults.baseURL || 'http://localhost:5000/api';
    const query = new URLSearchParams({ ...filters, token: token || '' }).toString();
    const url = `${baseURL}/advanced-analytics/export/pdf?${query}`;
    window.open(url, '_blank');
  },

  exportExcel: (filters: Record<string, string> = {}): void => {
    const token = localStorage.getItem('gradeai_token') || localStorage.getItem('token');
    const baseURL = apiClient.defaults.baseURL || 'http://localhost:5000/api';
    const query = new URLSearchParams({ ...filters, token: token || '' }).toString();
    const url = `${baseURL}/advanced-analytics/export/excel?${query}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'advanced-system-analytics.xls');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

export default advancedAnalyticsService;
