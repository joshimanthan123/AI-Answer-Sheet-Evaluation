import { Student, AnswerSheet, Evaluation, Feedback } from '../types';
import { 
  mockStudentProfile, 
  mockAnswerSheets, 
  mockEvaluations, 
  mockFeedbacks,
  mockExams 
} from '../mocks/db';

export const studentService = {
  getProfile: async (studentId: string = 'stud-1'): Promise<Student> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockStudentProfile);
      }, 500);
    });
  },

  getEvaluations: async (studentId: string = 'stud-1'): Promise<AnswerSheet[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const studentSheets = mockAnswerSheets.filter(sheet => sheet.studentId === studentId);
        resolve(studentSheets);
      }, 500);
    });
  },

  getResults: async (studentId: string = 'stud-1'): Promise<Evaluation[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const studentSheets = mockAnswerSheets.filter(sheet => sheet.studentId === studentId && sheet.status === 'evaluated');
        const evalIds = studentSheets.map(s => s.evaluationId);
        const results = mockEvaluations.filter(ev => evalIds.includes(ev.id));
        resolve(results);
      }, 500);
    });
  },

  requestReevaluation: async (evaluationId: string): Promise<{ message: string }> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const evaluationIndex = mockEvaluations.findIndex(ev => ev.id === evaluationId);
        if (evaluationIndex !== -1) {
          mockEvaluations[evaluationIndex].status = 'pending_review';
          resolve({ message: 'Re-evaluation request successfully registered with the faculty head.' });
        } else {
          reject(new Error('Evaluation record not found'));
        }
      }, 600);
    });
  },

  submitFeedback: async (studentId: string, message: string, rating: number): Promise<Feedback> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newFeedback: Feedback = {
          id: `f-${mockFeedbacks.length + 1}`,
          studentId,
          studentName: 'Alex Johnson',
          message,
          rating,
          date: new Date().toISOString().split('T')[0]
        };
        mockFeedbacks.push(newFeedback);
        resolve(newFeedback);
      }, 600);
    });
  },

  getExams: async (): Promise<any[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockExams);
      }, 400);
    });
  },

  getExamById: async (id: string): Promise<any | undefined> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockExams.find(e => e.id === id));
      }, 300);
    });
  }
};

export default studentService;
