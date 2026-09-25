import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from './ProtectedRoute';

// Layouts
import AuthLayout from '../layouts/AuthLayout';
import StudentLayout from '../layouts/StudentLayout';
import FacultyLayout from '../layouts/FacultyLayout';
import AdminLayout from '../layouts/AdminLayout';

// Public Pages
import Landing from '../pages/Public/Landing';
import Login from '../pages/Public/Login';
import Register from '../pages/Public/Register';
import ForgotPassword from '../pages/Public/ForgotPassword';
import NotFound from '../pages/Public/NotFound';

// Student Pages
import StudentDashboard from '../pages/Student/Dashboard';
import StudentMyExams from '../pages/Student/MyExams';
import StudentInstructions from '../pages/Student/Instructions';
import StudentExamWorkspace from '../pages/Student/ExamWorkspace';
import StudentSuccess from '../pages/Student/Success';
import StudentResults from '../pages/Student/Results';
import StudentAnalytics from '../pages/Student/Analytics';
import StudentSettings from '../pages/Student/Settings';
import StudentDetailedReport from '../pages/Student/DetailedReport';
import StudentUploadAnswerSheet from '../pages/Student/UploadAnswerSheet';
import ExamSubmissionStatus from '../pages/Student/ExamSubmissionStatus';
import ExamResult from '../pages/Student/ExamResult';

// Faculty Pages
import FacultyDashboard from '../pages/Faculty/Dashboard';
import FacultyCreateExam from '../pages/Faculty/CreateExam';
import FacultyExams from '../pages/Faculty/Exams';
import FacultyExamDetails from '../pages/Faculty/ExamDetails';
import FacultyAnswerKey from '../pages/Faculty/AnswerKey';
import FacultyQuestionBank from '../pages/Faculty/QuestionBank';
import FacultyModelAnswers from '../pages/Faculty/ModelAnswers';
import FacultyUploadAnswerKey from '../pages/Faculty/UploadAnswerKey';
import FacultyEvaluationQueue from '../pages/Faculty/EvaluationQueue';
import FacultyPending from '../pages/Faculty/Pending';
import FacultyManualEvaluation from '../pages/Faculty/ManualEvaluation';
import FacultyStudents from '../pages/Faculty/Students';
import FacultyReports from '../pages/Faculty/Reports';
import FacultySettings from '../pages/Faculty/Settings';
import FacultySubjects from '../pages/Faculty/Subjects';
import AnswerSheets from '../pages/Faculty/AnswerSheets';
import FacultyAnswerSheetViewerPage from '../pages/Faculty/AnswerSheetViewerPage';
import FacultyHistoricalReferences from '../pages/Faculty/HistoricalReferencesPage';
import ResultsDashboard from '../pages/Faculty/ResultsDashboard';
import IndividualResult from '../pages/Faculty/IndividualResult';
import AIEvaluationReviewDashboard from '../pages/Faculty/AIEvaluationReviewDashboard';
import AnalyticsDashboard from '../pages/Faculty/AnalyticsDashboard';
import AdvancedAnalyticsDashboard from '../pages/Faculty/AdvancedAnalyticsDashboard';
import AIImprovementDashboard from '../pages/Faculty/AIImprovementDashboard';

// Admin Pages

import AdminDashboard from '../pages/Admin/Dashboard';
import AdminUsers from '../pages/Admin/Users';
import AdminRegistries from '../pages/Admin/Registries';
import AdminAIConfig from '../pages/Admin/AIConfig';
import AdminLogs from '../pages/Admin/Logs';
import AdminSettings from '../pages/Admin/Settings';
import SystemIntelligence from '../pages/Admin/SystemIntelligence';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      
      <Route path="/auth" element={<AuthLayout />}>
        <Route index element={<Navigate to="/auth/login" replace />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Role-Based Protected Routes */}
      
      {/* Student Portal */}
      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<StudentDashboard />} />
          <Route path="exams" element={<StudentMyExams />} />
          <Route path="exams/:id/instructions" element={<StudentInstructions />} />
          <Route path="exam-workspace" element={<StudentExamWorkspace />} />
          <Route path="exams/:id/workspace" element={<StudentExamWorkspace />} />
          <Route path="exams/:id/submission-status" element={<ExamSubmissionStatus />} />
          <Route path="exams/:id/result" element={<ExamResult />} />
          <Route path="upload-answer-sheet" element={<StudentUploadAnswerSheet />} />
          <Route path="success" element={<StudentSuccess />} />
          <Route path="evaluations/:id" element={<StudentDetailedReport />} />
          <Route path="results/:id" element={<StudentDetailedReport />} />
          <Route path="results" element={<StudentResults />} />
          <Route path="analytics" element={<StudentAnalytics />} />
          <Route path="settings" element={<StudentSettings />} />
        </Route>
      </Route>

      {/* Faculty Portal */}
      <Route element={<ProtectedRoute allowedRoles={['faculty']} />}>
        <Route path="/faculty" element={<FacultyLayout />}>
          <Route index element={<FacultyDashboard />} />
          <Route path="create-exam" element={<FacultyCreateExam />} />
          <Route path="exams" element={<FacultyExams />} />
          <Route path="exams/create" element={<FacultyCreateExam />} />
          <Route path="exams/:id" element={<FacultyExamDetails />} />
          <Route path="exams/:examId/results" element={<ResultsDashboard />} />
          <Route path="results/:evaluationId" element={<IndividualResult />} />
          <Route path="exams/:id/edit" element={<FacultyCreateExam />} />
          <Route path="exams/:id/answer-key" element={<FacultyAnswerKey />} />
          <Route path="exams/:id/answer-sheets" element={<AnswerSheets />} />
          <Route path="answer-sheets/:id" element={<FacultyAnswerSheetViewerPage />} />
          <Route path="question-bank" element={<FacultyQuestionBank />} />
          <Route path="model-answers" element={<FacultyModelAnswers />} />
          <Route path="upload-answer-key" element={<FacultyUploadAnswerKey />} />
          <Route path="evaluations" element={<AIEvaluationReviewDashboard />} />
          <Route path="evaluation-queue" element={<FacultyEvaluationQueue />} />
          <Route path="review-evaluations" element={<FacultyPending />} />

          <Route path="historical-references" element={<FacultyHistoricalReferences />} />
          <Route path="pending/:id" element={<FacultyManualEvaluation />} />
          <Route path="students" element={<FacultyStudents />} />
          <Route path="reports" element={<FacultyReports />} />
          <Route path="analytics" element={<AnalyticsDashboard />} />
          <Route path="advanced-analytics" element={<AdvancedAnalyticsDashboard />} />
          <Route path="ai-improvement" element={<AIImprovementDashboard />} />
          <Route path="feedback" element={<AIImprovementDashboard />} />
          <Route path="settings" element={<FacultySettings />} />
          <Route path="subjects" element={<FacultySubjects />} />
        </Route>
      </Route>

      {/* Admin Portal */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="registries" element={<AdminRegistries />} />
          <Route path="ai-config" element={<AdminAIConfig />} />
          <Route path="ai-improvement" element={<AIImprovementDashboard />} />
          <Route path="feedback" element={<AIImprovementDashboard />} />
          <Route path="analytics" element={<AnalyticsDashboard />} />
          <Route path="advanced-analytics" element={<AdvancedAnalyticsDashboard />} />
          <Route path="system-intelligence" element={<SystemIntelligence />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>

      {/* Error Fallbacks */}
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
};

export default AppRoutes;
