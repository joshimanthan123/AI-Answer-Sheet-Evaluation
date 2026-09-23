import apiClient from '../api/axios';
import { mockAnswerSheets } from '../mocks/db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_ID_REGEX = /^[0-9a-f]{24}$/i;

const isRealSheetId = (id: string) => {
  console.log('[Digital Viewer] sheetId:', id);
  console.log('[Digital Viewer] Is UUID:', UUID_REGEX.test(id));
  console.log('[Digital Viewer] Is MongoDB ObjectId:', OBJECT_ID_REGEX.test(id));
  return UUID_REGEX.test(id) || OBJECT_ID_REGEX.test(id);
};

const getAuthHeaders = () => {
  const userJson = localStorage.getItem('gradeai_user');
  if (userJson) {
    try {
      const user = JSON.parse(userJson);
      return {
        'X-User-Id': user.id || user._id || 'stud-1',
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

const normalizeUrl = (url: any): string => {
  if (typeof url !== 'string') return '';
  let clean = url.replace(/\\/g, '/');
  if (clean.startsWith('./')) clean = clean.substring(2);
  return clean;
};

const normalizeSheetData = (sheet: any) => {
  if (!sheet) return sheet;

  // Helper to safely extract text from any answer item
  const extractText = (ans: any): string => {
    const candidates = [
      ans?.text,
      ans?.answer_text,
      ans?.recognizedText,
      ans?.extracted_text,
      ans?.extractedText,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 0) {
        return c.trim();
      }
    }
    return '';
  };

  let digital_answers = sheet.digital_answers;

  // 1. If digital_answers exists as non-empty array, normalize its items
  if (Array.isArray(digital_answers) && digital_answers.length > 0) {
    digital_answers = digital_answers.map((ans: any, idx: number) => {
      let strokes: any[] = ans.strokes || [];
      if ((!strokes || strokes.length === 0) && ans.handwrittenData) {
        try {
          const parsed = typeof ans.handwrittenData === 'string' ? JSON.parse(ans.handwrittenData) : ans.handwrittenData;
          if (parsed && Array.isArray(parsed.strokes)) {
            strokes = parsed.strokes;
          }
        } catch (e) {}
      }
      const textVal = extractText(ans);
      return {
        ...ans,
        question_number: String(ans.question_number || ans.questionNumber || ans.normalized_question_number || idx + 1),
        text: textVal,
        answer_text: textVal,
        recognizedText: textVal,
        strokes
      };
    });
  } else {
    digital_answers = null;
  }

  // 2. If digital_answers is empty/null but sheet.answers exists and is non-empty, convert sheet.answers
  if (!digital_answers && Array.isArray(sheet.answers) && sheet.answers.length > 0) {
    digital_answers = sheet.answers.map((ans: any, idx: number) => {
      let strokes: any[] = [];
      if (ans.handwrittenData) {
        try {
          const parsed = typeof ans.handwrittenData === 'string' ? JSON.parse(ans.handwrittenData) : ans.handwrittenData;
          if (parsed && Array.isArray(parsed.strokes)) {
            strokes = parsed.strokes;
          } else if (Array.isArray(parsed)) {
            strokes = parsed;
          }
        } catch (e) {}
      }

      const qObj = typeof ans.questionId === 'object' ? ans.questionId : null;
      const textVal = extractText(ans);

      return {
        question_id: qObj?._id || ans.questionId,
        question_number: String(ans.question_number || qObj?.questionNumber || ans.normalized_question_number || idx + 1),
        question_text: qObj?.questionText || ans.questionText || '',
        max_marks: qObj?.maximumMarks || ans.maximumMarks || 10,
        text: textVal,
        answer_text: textVal,
        recognizedText: textVal,
        handwrittenData: ans.handwrittenData,
        strokes,
        page_number: ans.page_number || ans.pageNumber || 1,
        confidence: ans.confidence !== undefined ? ans.confidence : 1.0
      };
    });
  }

  // 3. Fallback: If digital_answers is still empty, build from sheet.extractedText or sheet.extracted_text
  if (!digital_answers || digital_answers.length === 0) {
    const rawText = sheet.extractedText ?? sheet.extracted_text ?? '';
    if (rawText.trim().length > 0) {
      const parts = rawText.split(/\n\n+/).filter((p: string) => p.trim().length > 0);
      digital_answers = parts.map((part: string, idx: number) => {
        const match = part.match(/^Q(\d+):\s*(.*)/s);
        const qNum = match ? match[1] : String(idx + 1);
        const qText = match ? match[2] : part;
        return {
          question_number: qNum,
          text: qText.trim(),
          answer_text: qText.trim(),
          recognizedText: qText.trim(),
          page_number: 1,
          confidence: 0.95,
          strokes: []
        };
      });
    }
  }

  // 4. Fallback: If still empty, build from page-level extracted text or line array
  if ((!digital_answers || digital_answers.length === 0) && sheet.pages && Array.isArray(sheet.pages)) {
    const pageAnswers: any[] = [];
    sheet.pages.forEach((p: any, idx: number) => {
      let pageText = p.extracted_text ?? p.extractedText ?? p.text ?? p.recognizedText ?? '';
      if (!pageText && Array.isArray(p.lines) && p.lines.length > 0) {
        pageText = p.lines.map((l: any) => (typeof l === 'string' ? l : l.text || '')).join('\n');
      }
      if (pageText.trim().length > 0) {
        pageAnswers.push({
          question_number: String(idx + 1),
          text: pageText.trim(),
          answer_text: pageText.trim(),
          recognizedText: pageText.trim(),
          page_number: p.page_number || p.pageNumber || idx + 1,
          confidence: p.average_confidence || p.confidence || 0.90,
          strokes: []
        });
      }
    });
    if (pageAnswers.length > 0) {
      digital_answers = pageAnswers;
    }
  }

  // Map pages
  let pages = sheet.pages;
  if (pages && Array.isArray(pages) && pages.length > 0) {
    pages = pages.map((p: any) => ({
      page_number: p.pageNumber || p.page_number,
      original_file_reference: normalizeUrl(p.originalFileReference || p.original_file_reference),
      processed_file_reference: normalizeUrl(p.processedFileReference || p.processed_file_reference),
      width: p.width,
      height: p.height,
      processing_status: p.processingStatus || p.processing_status
    }));
  } else {
    pages = [];
  }

  const uploadedUrl = normalizeUrl(sheet.uploadedFileUrl || sheet.fileUrl || sheet.uploadedFileRef || sheet.original_file_reference);
  if (pages.length === 0 && uploadedUrl) {
    pages = [
      {
        page_number: 1,
        original_file_reference: uploadedUrl,
        processed_file_reference: uploadedUrl,
        width: 800,
        height: 1000,
        processing_status: 'PROCESSED'
      }
    ];
  }

  const fastapiSheetId = sheet.fastapiSheetId || sheet.fastapi_sheet_id || (UUID_REGEX.test(sheet.id || sheet._id) ? (sheet.id || sheet._id) : undefined);

  return {
    ...sheet,
    id: sheet._id || sheet.id,
    fastapiSheetId,
    exam_id: sheet.exam?._id || sheet.exam || sheet.examId,
    original_filename: sheet.uploadedFileName || sheet.original_filename || 'digital_canvas_submission',
    uploaded_at: sheet.submittedAt || sheet.createdAt || sheet.uploaded_at,
    processing_status: sheet.processingStatus || sheet.uploadStatus || sheet.processing_status || 'completed',
    submissionType: sheet.submissionType || (pages.length > 0 ? 'UPLOAD' : 'DIGITAL'),
    page_count: pages.length,
    pages,
    digital_answers
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
    let fastapiSheets: any[] = [];
    let expressSheets: any[] = [];

    try {
      const res: any = await apiClient.get('/v1/student/answer-sheets', { headers });
      fastapiSheets = res.data?.data || res.data || (Array.isArray(res) ? res : []);
    } catch (e) {
      console.warn('FastAPI listStudentSheets call bypassed/failed:', e);
    }

    try {
      const resExpress: any = await apiClient.get('/answer-sheets', { headers });
      const expData = resExpress.data?.data || resExpress.data || (Array.isArray(resExpress) ? resExpress : []);
      if (Array.isArray(expData)) {
        expressSheets = expData;
      }
    } catch (e) {
      console.warn('Express listStudentSheets call bypassed/failed:', e);
    }

    const combinedMap = new Map<string, any>();

    expressSheets.forEach((s: any) => {
      const norm = normalizeSheetData(s);
      if (norm.id) combinedMap.set(String(norm.id), norm);
    });

    fastapiSheets.forEach((s: any) => {
      const norm = normalizeSheetData(s);
      if (norm.id) combinedMap.set(String(norm.id), norm);
    });

    return {
      success: true,
      data: Array.from(combinedMap.values())
    };
  },

  getStudentSheetDetail: async (id: string) => {
    if (!isRealSheetId(id)) {
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
    const isUuid = UUID_REGEX.test(id);
    const primaryEndpoint = isUuid ? `/v1/student/answer-sheets/${id}` : `/v1/answer-sheets/${id}`;
    
    try {
      const res: any = await apiClient.get(primaryEndpoint, { headers });
      const rawData = res?.data || res;
      if (rawData) {
        const normalized = normalizeSheetData(rawData);
        return { success: true, data: normalized };
      }
    } catch (err) {
      console.warn(`[getStudentSheetDetail] Primary endpoint ${primaryEndpoint} failed for ${id}, attempting fallback endpoint.`);
    }

    // Fallback to Express MongoDB route if primary endpoint failed
    if (isUuid) {
      try {
        const fallbackRes: any = await apiClient.get(`/v1/answer-sheets/${id}`, { headers });
        const rawData = fallbackRes?.data || fallbackRes;
        if (rawData) {
          const normalized = normalizeSheetData(rawData);
          return { success: true, data: normalized };
        }
      } catch (fallbackErr) {
        console.error(`[getStudentSheetDetail] Fallback endpoint /v1/answer-sheets/${id} failed:`, fallbackErr);
      }
    }
    
    throw new Error('Answer sheet metadata could not be fetched.');
  },

  getStudentSheetDigitalAnswers: async (id: string) => {
    if (!isRealSheetId(id)) {
      return {
        success: true,
        data: []
      };
    }
    const headers = getAuthHeaders();
    try {
      return await apiClient.get(`/v1/student/answer-sheets/${id}/digital`, { headers });
    } catch (err) {
      console.warn(`[getStudentSheetDigitalAnswers] /digital endpoint failed for ${id}, fetching full sheet details as fallback.`);
      try {
        const detailRes: any = await answerSheetService.getStudentSheetDetail(id);
        const data = detailRes?.data || detailRes;
        return {
          success: true,
          data: data?.digital_answers || data?.answers || []
        };
      } catch (fallbackErr) {
        console.error('[getStudentSheetDigitalAnswers] Fallback failed:', fallbackErr);
        return { success: true, data: [] };
      }
    }
  },

  listFacultySheets: async () => {
    const headers = getAuthHeaders();
    return apiClient.get('/v1/faculty/answer-sheets', { headers });
  },

  getExamAnswerSheets: async (examId: string) => {
    const headers = getAuthHeaders();
    return apiClient.get(`/v1/exams/${examId}/answer-sheets`, { headers });
  },

  uploadFacultySheets: async (
    examId: string,
    files: File[],
    studentIdentifier?: string,
    onProgress?: (percent: number) => void
  ) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file); // Use 'files' field name as defined in multer array
    });
    formData.append('examId', examId);
    if (studentIdentifier) {
      formData.append('studentIdentifier', studentIdentifier);
    }

    const headers = getAuthHeaders();
    const token = localStorage.getItem('gradeai_token');
    
    return apiClient.post('/v1/answer-sheets', formData, {
      headers: {
        ...headers,
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'multipart/form-data',
      },
      timeout: 180000, // 3 minutes timeout
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
  },

  retryAnswerSheet: async (id: string) => {
    const headers = getAuthHeaders();
    return apiClient.post(`/v1/answer-sheets/${id}/retry`, {}, { headers });
  },

  deleteAnswerSheet: async (id: string) => {
    const headers = getAuthHeaders();
    return apiClient.delete(`/v1/answer-sheets/${id}`, { headers });
  },

  getFacultySheetDetail: async (id: string) => {
    if (!isRealSheetId(id)) {
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
    const isUuid = UUID_REGEX.test(id);
    const primaryEndpoint = isUuid ? `/v1/faculty/answer-sheets/${id}` : `/v1/answer-sheets/${id}`;
    
    try {
      const res: any = await apiClient.get(primaryEndpoint, { headers });
      const rawData = res?.data || res;
      if (rawData) {
        const normalized = normalizeSheetData(rawData);
        return { success: true, data: normalized };
      }
    } catch (err) {
      console.warn(`[getFacultySheetDetail] Primary endpoint ${primaryEndpoint} failed for ${id}, attempting fallback endpoint.`);
    }

    // Fallback to Express MongoDB route if primary endpoint failed
    if (isUuid) {
      try {
        const fallbackRes: any = await apiClient.get(`/v1/answer-sheets/${id}`, { headers });
        const rawData = fallbackRes?.data || fallbackRes;
        if (rawData) {
          const normalized = normalizeSheetData(rawData);
          return { success: true, data: normalized };
        }
      } catch (fallbackErr) {
        console.error(`[getFacultySheetDetail] Fallback endpoint /v1/answer-sheets/${id} failed:`, fallbackErr);
      }
    }

    throw new Error('Answer sheet metadata could not be fetched.');
  },

  getFacultySheetDigitalAnswers: async (id: string) => {
    if (!isRealSheetId(id)) {
      return {
        success: true,
        data: []
      };
    }
    const headers = getAuthHeaders();
    try {
      return await apiClient.get(`/v1/faculty/answer-sheets/${id}/digital`, { headers });
    } catch (err) {
      console.warn(`[getFacultySheetDigitalAnswers] /digital endpoint failed for ${id}, fetching full sheet details as fallback.`);
      try {
        const detailRes: any = await answerSheetService.getFacultySheetDetail(id);
        const data = detailRes?.data || detailRes;
        return {
          success: true,
          data: data?.digital_answers || data?.answers || []
        };
      } catch (fallbackErr) {
        console.error('[getFacultySheetDigitalAnswers] Fallback failed:', fallbackErr);
        return { success: true, data: [] };
      }
    }
  },

  getPageImageObjectURL: async (id: string, pageNumber: number, isFaculty = false, type: 'original' | 'processed' = 'original'): Promise<string> => {
    if (!isRealSheetId(id)) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="%23f0f4f9"/><text x="400" y="500" font-family="sans-serif" font-weight="bold" font-size="22" fill="%231a73e8" text-anchor="middle">Local Attempt Fallback Page Scan</text><text x="400" y="540" font-family="sans-serif" font-size="14" fill="%2370757a" text-anchor="middle">Bypassed remote endpoint checking for ID: ' + id + '</text></svg>';
    }
    const headers = getAuthHeaders();
    const prefix = isFaculty ? 'faculty' : 'student';
    const isUuid = UUID_REGEX.test(id);

    // Only attempt FastAPI page endpoint directly if ID is a valid UUID
    if (isUuid) {
      try {
        const response = await apiClient.get(`/v1/${prefix}/answer-sheets/${id}/pages/${pageNumber}?type=${type}`, {
          headers,
          responseType: 'blob',
        });
        return URL.createObjectURL(response as unknown as Blob);
      } catch (err) {
        console.warn(`[getPageImageObjectURL] FastAPI page endpoint failed for UUID ${id}, attempting static file fallback.`);
      }
    }

    // Static uploaded file fallback logic for both MongoDB ObjectIds and failed FastAPI UUIDs
    try {
      const detailRes: any = isFaculty
        ? await answerSheetService.getFacultySheetDetail(id)
        : await answerSheetService.getStudentSheetDetail(id);
      const sheetData = detailRes?.data || detailRes;
      
      let refUrl = sheetData?.pages?.[pageNumber - 1]?.original_file_reference ||
                   sheetData?.uploadedFileUrl || 
                   sheetData?.uploadedFileRef ||
                   sheetData?.original_file_reference;
      
      if (refUrl) {
        const cleanRef = normalizeUrl(refUrl);
        if (cleanRef.startsWith('http://') || cleanRef.startsWith('https://') || cleanRef.startsWith('data:')) {
          return cleanRef;
        }

        const relativePath = cleanRef.replace(/^[/\\]+/, '');
        const requestPath = relativePath.startsWith('uploads/') ? `/${relativePath}` : `/uploads/${relativePath}`;
        
        const staticBlobRes = await apiClient.get(requestPath, {
          headers,
          responseType: 'blob'
        });
        return URL.createObjectURL(staticBlobRes as unknown as Blob);
      }
    } catch (fallbackErr) {
      console.error('[getPageImageObjectURL] Static fallback failed for ID ' + id + ':', fallbackErr);
    }
    
    throw new Error(`Unable to load scanned page ${pageNumber} for sheet ${id}.`);
  },

  reviewAnswer: async (answerId: string, reviewData: { action: 'approve' | 'modify' | 're_evaluate'; finalMarks?: number; comment?: string; questionId?: string }) => {
    const headers = getAuthHeaders();
    const token = localStorage.getItem('gradeai_token');
    return apiClient.patch(`/v1/evaluation/${answerId}/review`, reviewData, {
      headers: {
        ...headers,
        'Authorization': token ? `Bearer ${token}` : '',
      }
    });
  },

  getEvaluationSummary: async (answerSheetId: string) => {
    const headers = getAuthHeaders();
    const token = localStorage.getItem('gradeai_token');
    return apiClient.get(`/v1/evaluation/answersheet/${answerSheetId}/summary`, {
      headers: {
        ...headers,
        'Authorization': token ? `Bearer ${token}` : '',
      }
    });
  },

  finalizeAnswerSheet: async (answerSheetId: string) => {
    const headers = getAuthHeaders();
    const token = localStorage.getItem('gradeai_token');
    return apiClient.post(`/v1/evaluation/answersheet/${answerSheetId}/finalize`, {}, {
      headers: {
        ...headers,
        'Authorization': token ? `Bearer ${token}` : '',
      }
    });
  },

  getReviewDashboardData: async (examId: string) => {
    const headers = getAuthHeaders();
    const token = localStorage.getItem('gradeai_token');
    return apiClient.get(`/v1/evaluations/exam/${examId}/review-dashboard`, {
      headers: {
        ...headers,
        'Authorization': token ? `Bearer ${token}` : '',
      }
    });
  },

  getEvaluationDetail: async (evaluationId: string) => {
    const headers = getAuthHeaders();
    const token = localStorage.getItem('gradeai_token');
    return apiClient.get(`/v1/evaluations/${evaluationId}/detail`, {
      headers: {
        ...headers,
        'Authorization': token ? `Bearer ${token}` : '',
      }
    });
  },

  updateReviewStatus: async (evaluationId: string, reviewStatus: string, comment?: string) => {
    const headers = getAuthHeaders();
    const token = localStorage.getItem('gradeai_token');
    return apiClient.patch(`/v1/evaluations/${evaluationId}/review-status`, { reviewStatus, comment }, {
      headers: {
        ...headers,
        'Authorization': token ? `Bearer ${token}` : '',
      }
    });
  },

  acceptAiMarks: async (evaluationOrSheetId: string, questionIdOrNumber: string) => {
    const headers = getAuthHeaders();
    const token = localStorage.getItem('gradeai_token');
    return apiClient.post(`/v1/evaluations/${evaluationOrSheetId}/questions/${questionIdOrNumber}/accept-ai`, {}, {
      headers: {
        ...headers,
        'Authorization': token ? `Bearer ${token}` : '',
      }
    });
  },

  overrideQuestionMarks: async (
    evaluationOrSheetId: string,
    questionIdOrNumber: string,
    payload: { facultyMarks: number; overrideReason: string; comment?: string }
  ) => {
    const headers = getAuthHeaders();
    const token = localStorage.getItem('gradeai_token');
    return apiClient.patch(`/v1/evaluations/${evaluationOrSheetId}/questions/${questionIdOrNumber}/review`, payload, {
      headers: {
        ...headers,
        'Authorization': token ? `Bearer ${token}` : '',
      }
    });
  },

  finalizeSingleQuestion: async (evaluationOrSheetId: string, questionIdOrNumber: string) => {
    const headers = getAuthHeaders();
    const token = localStorage.getItem('gradeai_token');
    return apiClient.post(`/v1/evaluations/${evaluationOrSheetId}/questions/${questionIdOrNumber}/finalize`, {}, {
      headers: {
        ...headers,
        'Authorization': token ? `Bearer ${token}` : '',
      }
    });
  },

  finalizeStudentEvaluation: async (evaluationOrSheetId: string) => {
    const headers = getAuthHeaders();
    const token = localStorage.getItem('gradeai_token');
    return apiClient.post(`/v1/evaluations/${evaluationOrSheetId}/finalize-student`, {}, {
      headers: {
        ...headers,
        'Authorization': token ? `Bearer ${token}` : '',
      }
    });
  },
};


export default answerSheetService;
