import { Faculty, AnswerSheet, Evaluation, EvaluationDetail, User, Report } from '../types';
import { 
  mockFacultyProfile, 
  mockAnswerSheets, 
  mockEvaluations, 
  mockEvaluationDetails,
  mockUsers,
  mockReports
} from '../mocks/db';

export const facultyService = {
  getProfile: async (facultyId: string = 'fac-1'): Promise<Faculty> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockFacultyProfile);
      }, 500);
    });
  },

  getPendingEvaluations: async (): Promise<AnswerSheet[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const pending = mockAnswerSheets.filter(sheet => sheet.status !== 'evaluated');
        resolve(pending);
      }, 500);
    });
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
    return new Promise((resolve) => {
      setTimeout(() => {
        // Map user and student features
        const students = mockUsers
          .filter(u => u.role === 'student')
          .map(u => ({
            ...u,
            rollNo: '24-CSE-0042',
            enrolledYear: '2024',
            avgScore: u.id === 'user-stud-1' ? 84.8 : 76.4,
            rank: u.id === 'user-stud-1' ? 'Top 5%' : 'Top 25%'
          }));
        resolve(students);
      }, 500);
    });
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

