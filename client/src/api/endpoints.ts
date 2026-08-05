export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    FORGOT_PASSWORD: '/auth/forgot-password',
    ME: '/auth/me',
  },
  STUDENT: {
    PROFILE: '/student/profile',
    UPLOAD_SHEET: '/student/upload-sheet',
    EVALUATIONS: '/student/evaluations',
    RESULTS: '/student/results',
    SUBMIT_FEEDBACK: '/student/feedback',
  },
  FACULTY: {
    PROFILE: '/faculty/profile',
    UPLOAD_MODEL: '/faculty/upload-model',
    PENDING_EVALUATIONS: '/faculty/pending-evaluations',
    SUBMIT_EVALUATION: '/faculty/evaluation',
    STUDENTS: '/faculty/students',
    REPORTS: '/faculty/reports',
  },
  ADMIN: {
    USERS: '/admin/users',
    DEPARTMENTS: '/admin/departments',
    COURSES: '/admin/courses',
    SUBJECTS: '/admin/subjects',
    AI_CONFIG: '/admin/ai-config',
    AUDIT_LOGS: '/admin/audit-logs',
  },
};
