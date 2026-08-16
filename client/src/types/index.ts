export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'student' | 'faculty' | 'admin';
  status: 'online' | 'offline';
  departmentId?: string;
  token?: string;
  lecturerId?: string;
  studentId?: string;
  employeeId?: string;
  rollNo?: string;
  createdAt?: string;
  profilePhoto?: string;
  department?: string;
  semester?: number;
}

export interface Student {
  id: string;
  userId: string;
  rollNo: string;
  enrolledYear: string;
  departmentId: string;
  reportsCount: number;
  avgScore: number;
  rank: string;
}

export interface Faculty {
  id: string;
  userId: string;
  designation: string;
  departmentId: string;
  subjectsCount: number;
  coursesCount: number;
}

export interface Admin {
  id: string;
  userId: string;
}

export interface Subject {
  id: string;
  _id?: string;
  name: string;
  code: string;
  credits: number;
  courseId?: string;
  course?: any;
  semester: number;
  faculty?: any;
  description?: string;
  isActive?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  degree: string;
  departmentId: string;
}

export interface Department {
  id: string;
  name: string;
  block: string;
  code: string;
}

export interface Exam {
  id: string;
  _id?: string;
  name: string;
  title?: string;
  date: string;
  code: string;
  totalMarks: number;
  duration: string | number; // e.g. "3 Hours" or 180 (minutes)
  subjectId: string;
  subject?: any;
  subjectName?: string;
  subjectCode?: string;
  allowedMaterials?: string | string[];
  instructions?: string | string[];
  questions?: Question[];
  answerKeyStatus?: 'draft' | 'complete' | 'locked';
  examStatus?: string;
}

export interface Question {
  id: string;
  _id?: string;
  number: number;
  text: string;
  weight: number;
  expectedConcept: string;
  modelAnswer?: string;
  keywords?: string[];
  bloomsLevel?: string;
  difficulty?: string;
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

export interface AnswerSheet {
  id: string;
  studentId: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  examId: string;
  examName: string;
  date: string;
  fileUrl: string;
  fileName: string;
  status: 'pending' | 'evaluated' | 'flagged';
  scanDpi: number;
  inkColor: 'blue' | 'black' | 'other';
  evaluationId?: string;
}

export interface ModelAnswer {
  id: string;
  subjectId: string;
  subjectName: string;
  examId: string;
  examName: string;
  courseCode: string;
  fileUrl: string;
  fileName: string;
  uploadDate: string;
  comments?: string;
  facultyName?: string;
}

export interface Evaluation {
  id: string;
  answerSheetId: string;
  evaluatorId: string;
  evaluatorName: string;
  finalScore: number;
  totalScore: number;
  grade: string;
  timeTakenSeconds: number;
  similarityIndex: number; // in percentage, e.g. 12
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  date: string;
  status: 'approved' | 'draft' | 'pending_review';
}

export interface EvaluationDetail {
  id: string;
  evaluationId: string;
  questionId: string;
  questionNumber: number;
  questionText: string;
  weight: number;
  score: number;
  suggestedScore: number;
  feedback: string;
  status: 'match' | 'partial' | 'miss';
  expectedAnswer: string;
  studentAnswer: string;
  conceptMatch: number; // in percentage, e.g. 88
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'alert';
}

export interface Feedback {
  id: string;
  studentId: string;
  studentName: string;
  message: string;
  rating: number; // 1-5
  date: string;
}

export interface Report {
  id: string;
  name: string;
  type: 'analytic' | 'grade' | 'system';
  status: 'completed' | 'generating';
  date: string;
  fileUrl: string;
}

export interface Analytics {
  id: string;
  timePeriod: string;
  keyMetrics: {
    totalStudents: number;
    pendingEvaluations: number;
    completedCount: number;
    avgScore: number;
    gradingAccuracy: number;
  };
  detailTrends: {
    name: string; // e.g. "Sem 1", "Week 1"
    score: number;
    accuracy: number;
  }[];
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  role: string;
  action: string;
  ipAddress: string;
  timestamp: string;
  status: 'success' | 'failed';
  level: 'info' | 'warning' | 'error';
  message: string;
}

export type SystemLog = AuditLog;

