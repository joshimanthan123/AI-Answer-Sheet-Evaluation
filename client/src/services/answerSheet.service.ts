import apiClient from '../api/axios';
import { mockAnswerSheets } from '../mocks/db';

const getAuthHeaders = () => {
  const userJson = localStorage.getItem('gradeai_user');
  if (userJson) {
    try {
      const user = JSON.parse(userJson);
      return {
        'X-User-Id': user.id || 'stud-1',
        'X-User-Role': user.role || 'student',
      };
    } catch (e) {
      console.error(e);
    }
  }
  return {
    'X-User-Id': 'stud-1',
    'X-User-Role': 'student',
  };
};

export const answerSheetService = {
  uploadAnswerSheet: async (
    file: File,
    examId: string,
    onProgress?: (percent: number) => void
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('exam_id', examId);
    
    const headers = getAuthHeaders();
    
    // We send request to FastAPI microservice backend
    const response = await apiClient.post('/v1/student/answer-sheets', formData, {
      headers: {
        ...headers,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000, // 2 minutes timeout for upload and OCR processing
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    return response;
  },

  listStudentSheets: async () => {
    const headers = getAuthHeaders();
    return apiClient.get('/v1/student/answer-sheets', { headers });
  },

  getStudentSheetDetail: async (id: string) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const mockSheet = mockAnswerSheets.find(s => s.id === id) || mockAnswerSheets[0];
      return {
        success: true,
        data: {
          ...mockSheet,
          id: id,
          exam_id: mockSheet.examId,
          original_filename: mockSheet.fileName,
          processing_status: 'OCR_COMPLETED',
          uploaded_at: mockSheet.date + 'T10:00:00Z',
          page_count: 1,
          pages: [
            {
              page_number: 1,
              original_file_reference: 'source.png',
              processed_file_reference: 'processed.png',
              width: 800,
              height: 1000,
              processing_status: 'PROCESSED'
            }
          ],
          digital_answers: [
            {
              question_number: "1",
              text: "Mocked fallback response. Real backend database/OCR was bypassed for simulation flow.",
              page_number: 1,
              confidence: 0.95
            }
          ]
        }
      };
    }
    const headers = getAuthHeaders();
    return apiClient.get(`/v1/student/answer-sheets/${id}`, { headers });
  },

  getStudentSheetDigitalAnswers: async (id: string) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return {
        success: true,
        data: [
          {
            question_number: "1",
            text: "Mocked fallback response. Real backend database/OCR was bypassed for simulation flow.",
            page_number: 1,
            confidence: 0.95
          }
        ]
      };
    }
    const headers = getAuthHeaders();
    return apiClient.get(`/v1/student/answer-sheets/${id}/digital`, { headers });
  },

  listFacultySheets: async () => {
    const headers = getAuthHeaders();
    return apiClient.get('/v1/faculty/answer-sheets', { headers });
  },

  getFacultySheetDetail: async (id: string) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const mockSheet = mockAnswerSheets.find(s => s.id === id) || mockAnswerSheets[0];
      return {
        success: true,
        data: {
          ...mockSheet,
          id: id,
          exam_id: mockSheet.examId,
          original_filename: mockSheet.fileName,
          processing_status: 'OCR_COMPLETED',
          uploaded_at: mockSheet.date + 'T10:00:00Z',
          page_count: 1,
          pages: [
            {
              page_number: 1,
              original_file_reference: 'source.png',
              processed_file_reference: 'processed.png',
              width: 800,
              height: 1000,
              processing_status: 'PROCESSED'
            }
          ],
          digital_answers: [
            {
              question_number: "1",
              text: "Mocked fallback response. Real backend database/OCR was bypassed for simulation flow.",
              page_number: 1,
              confidence: 0.95
            }
          ]
        }
      };
    }
    const headers = getAuthHeaders();
    return apiClient.get(`/v1/faculty/answer-sheets/${id}`, { headers });
  },

  getFacultySheetDigitalAnswers: async (id: string) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return {
        success: true,
        data: [
          {
            question_number: "1",
            text: "Mocked fallback response. Real backend database/OCR was bypassed for simulation flow.",
            page_number: 1,
            confidence: 0.95
          }
        ]
      };
    }
    const headers = getAuthHeaders();
    return apiClient.get(`/v1/faculty/answer-sheets/${id}/digital`, { headers });
  },

  getPageImageObjectURL: async (id: string, pageNumber: number, isFaculty = false, type: 'original' | 'processed' = 'original'): Promise<string> => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="%23f0f4f9"/><text x="400" y="500" font-family="sans-serif" font-weight="bold" font-size="22" fill="%231a73e8" text-anchor="middle">Local Attempt Fallback Page Scan</text><text x="400" y="540" font-family="sans-serif" font-size="14" fill="%2370757a" text-anchor="middle">Bypassed remote endpoint checking for ID: ' + id + '</text></svg>';
    }
    const headers = getAuthHeaders();
    const prefix = isFaculty ? 'faculty' : 'student';
    const response = await apiClient.get(`/v1/${prefix}/answer-sheets/${id}/pages/${pageNumber}?type=${type}`, {
      headers,
      responseType: 'blob',
    });
    // Create ObjectURL from the binary Blob
    return URL.createObjectURL(response as unknown as Blob);
  }
};

export default answerSheetService;
