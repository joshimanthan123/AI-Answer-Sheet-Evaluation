import { AnswerSheet, ModelAnswer } from '../types';
import { mockAnswerSheets, mockModelAnswers, mockSubjects } from '../mocks/db';

export const uploadService = {
  uploadAnswerSheet: async (
    file: File,
    subjectId: string,
    examId: string,
    studentId: string = 'stud-1',
    onProgress: (percent: number) => void
  ): Promise<AnswerSheet> => {
    return new Promise((resolve) => {
      let pct = 0;
      const interval = setInterval(() => {
        pct += 10;
        onProgress(pct);
        if (pct >= 100) {
          clearInterval(interval);
          
          const subject = mockSubjects.find(s => s.id === subjectId);
          const newSheet: AnswerSheet = {
            id: `sheet-${Date.now()}`,
            studentId,
            studentName: 'Alex Johnson',
            subjectId,
            subjectName: subject?.name || 'Computer Science Subject',
            examId,
            examName: examId === 'exam-mid' ? 'Mid-Term Examination' : 'Final Examination',
            date: new Date().toISOString().split('T')[0],
            fileUrl: '#',
            fileName: file.name,
            status: 'pending',
            scanDpi: 300,
            inkColor: 'blue',
          };
          
          mockAnswerSheets.push(newSheet);
          resolve(newSheet);
        }
      }, 200);
    });
  },

  uploadModelAnswer: async (
    file: File,
    subjectId: string,
    examId: string,
    comments: string,
    onProgress: (percent: number) => void
  ): Promise<ModelAnswer> => {
    return new Promise((resolve) => {
      let pct = 0;
      const interval = setInterval(() => {
        pct += 15;
        if (pct > 100) pct = 100;
        onProgress(pct);
        if (pct >= 100) {
          clearInterval(interval);
          
          const subject = mockSubjects.find(s => s.id === subjectId);
          const newModel: ModelAnswer = {
            id: `model-${Date.now()}`,
            subjectId,
            subjectName: subject?.name || 'Computer Science Subject',
            examId,
            examName: examId === 'exam-mid' ? 'Mid-Term Examination' : 'Final Examination',
            courseCode: subject?.code || 'CS-101',
            fileUrl: '#',
            fileName: file.name,
            uploadDate: new Date().toISOString().split('T')[0],
            comments,
            facultyName: 'Dr. Sarah Jenkins'
          };
          
          mockModelAnswers.push(newModel);
          resolve(newModel);
        }
      }, 200);
    });
  }
};

export default uploadService;
