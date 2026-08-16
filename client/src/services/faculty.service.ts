import { Faculty, AnswerSheet, Evaluation, EvaluationDetail, User, Report } from '../types';
import apiClient from '../api/axios';
import { 
  mockFacultyProfile, 
  mockAnswerSheets, 
  mockEvaluations, 
  mockEvaluationDetails,
  mockUsers,
  mockReports
} from '../mocks/db';

export const facultyService = {
  getDashboardData: async (): Promise<any> => {
    const response = await apiClient.get<any, any>('/faculty/dashboard');
    return response.data?.data || response.data;
  },

  getProfile: async (facultyId: string = 'fac-1'): Promise<Faculty> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockFacultyProfile);
      }, 500);
    });
  },

  getPendingEvaluations: async (): Promise<any[]> => {
    const response = await apiClient.get('/faculty/review-queue');
    const evaluations = response.data?.data || response.data || [];
    return evaluations.map((ev: any) => ({
      id: ev._id,
      studentName: ev.answerSheet?.student?.name || 'Unknown Student',
      subjectName: ev.answerSheet?.subject?.name || 'Unknown Subject',
      fileName: ev.answerSheet?.original_filename || ev.answerSheet?.fileName || 'AnswerSheet.pdf',
      status: ev.evaluationStatus === 'AI_COMPLETED' ? 'pending' : 'reevaluate_requested',
      similarityIndex: ev.similarityIndex || 96,
      evaluationId: ev._id
    }));
  },

  submitEvaluation: async (
    evaluationData: Omit<Evaluation, 'date'> & { questions: EvaluationDetail[] }
  ): Promise<Evaluation> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const index = mockEvaluations.findIndex(ev => ev.id === evaluationData.id);
        
        let savedEval: Evaluation;

        if (index !== -1) {
          // Update existing
          mockEvaluations[index] = {
            ...mockEvaluations[index],
            ...evaluationData,
            status: 'approved',
            date: new Date().toISOString().split('T')[0]
          };
          savedEval = mockEvaluations[index];
        } else {
          // Create new
          const newEval: Evaluation = {
            id: evaluationData.id || `eval-${Date.now()}`,
            answerSheetId: evaluationData.answerSheetId,
            evaluatorId: evaluationData.evaluatorId || 'fac-1',
            evaluatorName: evaluationData.evaluatorName || 'Dr. Dr. Sarah Jenkins',
            finalScore: evaluationData.finalScore,
            totalScore: evaluationData.totalScore || 100,
            grade: evaluationData.grade || 'B',
            timeTakenSeconds: evaluationData.timeTakenSeconds || 1200,
            similarityIndex: evaluationData.similarityIndex || 10,
            strengths: evaluationData.strengths || [],
            weaknesses: evaluationData.weaknesses || [],
            suggestions: evaluationData.suggestions || [],
            date: new Date().toISOString().split('T')[0],
            status: 'approved'
          };
          mockEvaluations.push(newEval);
          savedEval = newEval;
        }

        // Sync answer sheet status
        const sheetIndex = mockAnswerSheets.findIndex(sh => sh.id === evaluationData.answerSheetId);
        if (sheetIndex !== -1) {
          mockAnswerSheets[sheetIndex].status = 'evaluated';
          mockAnswerSheets[sheetIndex].evaluationId = savedEval.id;
        }

        // Save detailed questions
        mockEvaluationDetails[savedEval.id] = evaluationData.questions.map(q => ({
          ...q,
          evaluationId: savedEval.id
        }));

        resolve(savedEval);
      }, 800);
    });
  },

  getStudentsList: async (): Promise<any[]> => {
    const response = await apiClient.get('/faculty/students');
    const students = response.data?.data || response.data || [];
    return students.map((s: any) => ({
      id: s._id || s.id,
      name: s.name,
      email: s.email,
      department: s.department || 'B.Tech Computer Science',
      avgScore: s.avgScore || 0,
      rank: s.rank || 'N/A'
    }));
  },

  getReportsList: async (): Promise<Report[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockReports);
      }, 500);
    });
  },

  uploadModelAnswer: async (
    file: File,
    subjectId: string,
    examId: string,
    questions: any[]
  ): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 600);
    });
  },

  approveGrading: async (
    answerSheetId: string,
    finalScore: number,
    questions: any[]
  ): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const index = mockAnswerSheets.findIndex(sh => sh.id === answerSheetId);
        if (index !== -1) {
          mockAnswerSheets[index].status = 'evaluated';
          mockAnswerSheets[index].evaluationId = 'eval-1';
        }
        resolve();
      }, 600);
    });
  }
};

export default facultyService;

