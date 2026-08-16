import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import answerSheetService from '../../services/answerSheet.service';
import evaluationService from '../../services/evaluation.service';
import { examService, Exam } from '../../services/exam.service';

interface AnswerSheet {
  _id: string;
  student?: {
    name: string;
    email: string;
    rollNo: string;
  };
  studentIdentifier?: string;
  uploadedFileName: string;
  fileSize?: number;
  processingStatus: 'uploaded' | 'processing' | 'completed' | 'failed' | 'ready_for_evaluation';
  errorMessage?: string;
  createdAt: string;
  evaluation?: {
    _id: string;
    obtainedMarks: number;
    totalMarks: number;
    percentage: number;
    evaluationStatus: 'pending' | 'queued' | 'processing' | 'completed' | 'reviewed' | 'finalized' | 'failed';
    grade?: string;
  };
}

export const AnswerSheets: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const { addToast } = useNotifications();
  const [exam, setExam] = useState<Exam | null>(null);
  const [sheets, setSheets] = useState<AnswerSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [evaluatingSheetId, setEvaluatingSheetId] = useState<string | null>(null);
  const [evaluatingBulk, setEvaluatingBulk] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<any>(null);

  const fetchExamAndSheets = async () => {
    if (!examId) return;
    try {
      const examData = await examService.getExamById(examId);
      setExam(examData);
      
      const sheetsResponse: any = await answerSheetService.getExamAnswerSheets(examId);
      if (sheetsResponse && sheetsResponse.success) {
        setSheets(sheetsResponse.data);
      }
    } catch (err: any) {
      console.error('Error fetching exam / sheets:', err);
      addToast('Failed to retrieve answer sheets list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSheetsSilent = async () => {
    if (!examId) return;
    try {
      const sheetsResponse: any = await answerSheetService.getExamAnswerSheets(examId);
      if (sheetsResponse && sheetsResponse.success) {
        setSheets(sheetsResponse.data);
      }
    } catch (err) {
      console.error('Error polling sheets:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchExamAndSheets();
    
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [examId]);

  // Start polling if any sheets are in progress or evaluating
  useEffect(() => {
    const hasUnfinished = sheets.some(
      s => s.processingStatus === 'uploaded' || 
           s.processingStatus === 'processing' ||
           (s.evaluation?.evaluationStatus && 
            ['pending', 'queued', 'processing'].includes(s.evaluation.evaluationStatus))
    );

    if (hasUnfinished) {
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(() => {
          fetchSheetsSilent();
        }, 3000);
      }
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [sheets]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !examId) return;
    const filesArray = Array.from(e.target.files);
    
    try {
      setUploading(true);
      setUploadProgress(0);
      
      const res: any = await answerSheetService.uploadFacultySheets(
        examId,
        filesArray,
        studentIdentifier || undefined,
        (percent) => setUploadProgress(percent)
      );

      if (res && res.success) {
        addToast(`Successfully queued ${filesArray.length} file(s) for processing.`, 'success');
        setStudentIdentifier('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchSheetsSilent();
      } else {
        addToast(res.message || 'Failed to submit files.', 'error');
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      addToast(err.response?.data?.message || 'Error occurred during file ingestion.', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRetry = async (sheetId: string) => {
    try {
      const res: any = await answerSheetService.retryAnswerSheet(sheetId);
      if (res && res.success) {
        addToast('OCR pipeline retry process initiated.', 'success');
        fetchSheetsSilent();
      } else {
        addToast(res.message || 'Failed to trigger retry.', 'error');
      }
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Error triggering retry processes.', 'error');
    }
  };

  const handleDelete = async (sheetId: string) => {
    if (!window.confirm('Are you sure you want to delete this answer sheet and all of its processed pages?')) return;
    try {
      const res: any = await answerSheetService.deleteAnswerSheet(sheetId);
      if (res && res.success) {
        addToast('Answer sheet deleted successfully.', 'success');
        setSheets(prev => prev.filter(s => s._id !== sheetId));
      } else {
        addToast(res.message || 'Failed to delete record.', 'error');
      }
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Error deleting answer sheet.', 'error');
    }
  };

  const handleEvaluate = async (sheetId: string) => {
    try {
      setEvaluatingSheetId(sheetId);
      await evaluationService.startEvaluation(sheetId);
      addToast('AI answering evaluation pipeline triggered successfully.', 'success');
      fetchSheetsSilent();
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.message || 'Failed to start AI evaluation.', 'error');
    } finally {
      setEvaluatingSheetId(null);
    }
  };

  const handleBulkEvaluate = async () => {
    if (!examId) return;
    try {
      setEvaluatingBulk(true);
      const res = await evaluationService.bulkEvaluate(examId);
      const succCount = res.filter((r: any) => r.success).length;
      const failCount = res.filter((r: any) => !r.success).length;
      addToast(`Bulk evaluation completed: ${succCount} initiated successfully, ${failCount} failed.`, 'info');
      fetchSheetsSilent();
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.message || 'Failed to start bulk AI evaluation.', 'error');
    } finally {
      setEvaluatingBulk(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderEvaluationStatus = (sheet: AnswerSheet) => {
    // If not OCR completed yet, show none
    if (sheet.processingStatus !== 'completed' && sheet.processingStatus !== 'ready_for_evaluation') {
      return (
        <span className="text-[10px] text-outline italic">
          Waiting for layouts
        </span>
      );
    }

    if (!sheet.evaluation) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-surface-container text-outline border border-outline-variant/30">
          Not Evaluated
        </span>
      );
    }

    const { evaluationStatus, obtainedMarks, totalMarks, grade } = sheet.evaluation;
    
    if (['pending', 'queued', 'processing'].includes(evaluationStatus)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
          Evaluating...
        </span>
      );
    }

    if (evaluationStatus === 'completed' || evaluationStatus === 'reviewed') {
      return (
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
            Pending Review
          </span>
          <p className="text-[9px] text-outline font-extrabold mt-0.5">
            AI: {obtainedMarks} / {totalMarks} Marks
          </p>
        </div>
      );
    }

    if (evaluationStatus === 'finalized') {
      return (
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-250">
            Finalized (Grade {grade || 'F'})
          </span>
          <p className="text-[9px] text-primary-dark font-black mt-0.5">
            Score: {obtainedMarks} / {totalMarks} Marks
          </p>
        </div>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
        Failed
      </span>
    );
  };

  const renderTableActions = (sheet: AnswerSheet) => {
    const isOCRProcessing = sheet.processingStatus === 'uploaded' || sheet.processingStatus === 'processing';
    const isReady = sheet.processingStatus === 'completed' || sheet.processingStatus === 'ready_for_evaluation';
    
    return (
      <div className="py-3 text-right space-x-1 shrink-0 whitespace-nowrap inline-flex items-center justify-end">
        {sheet.processingStatus === 'failed' && (
          <button
            onClick={() => handleRetry(sheet._id)}
            className="px-2 py-1 bg-indigo-600 text-white rounded font-bold uppercase text-[9px] hover:bg-indigo-700 hover:shadow active:scale-95 transition inline-flex items-center gap-0.5"
            title="Re-run HWR layout detection"
          >
            <span className="material-symbols-outlined text-[10px]">sync</span>
            Retry
          </button>
        )}
        
        {isReady && !sheet.evaluation && (
          <button
            onClick={() => handleEvaluate(sheet._id)}
            disabled={evaluatingSheetId === sheet._id}
            className="px-2 py-1 bg-primary text-on-primary rounded font-bold uppercase text-[9px] hover:bg-primary-dark hover:shadow active:scale-95 transition inline-flex items-center gap-0.5"
          >
            <span className="material-symbols-outlined text-[10px]">play_arrow</span>
            {evaluatingSheetId === sheet._id ? 'Starting...' : 'Evaluate'}
          </button>
        )}

        {sheet.evaluation && (
          <Link
            to={`/faculty/pending/${sheet._id}`}
            className="px-2 py-1 bg-emerald-600 text-white rounded font-bold uppercase text-[9px] hover:bg-emerald-700 hover:shadow active:scale-95 transition inline-flex items-center gap-0.5"
          >
            <span className="material-symbols-outlined text-[10px]">rate_review</span>
            {sheet.evaluation.evaluationStatus === 'finalized' ? 'View Audit' : 'Review'}
          </Link>
        )}

        {isReady && (
          <Link
            to={`/faculty/answer-sheets/${sheet._id}`}
            className="px-2 py-1 border border-outline-variant/35 text-on-surface rounded font-bold uppercase text-[9px] hover:bg-surface-container-low transition inline-flex items-center gap-0.5"
            title="Inspect scan file layouts"
          >
            <span className="material-symbols-outlined text-[10px]">visibility</span>
            Scan
          </Link>
        )}

        <button
          onClick={() => handleDelete(sheet._id)}
          className="px-2 py-1 border border-outline-variant/35 text-error rounded font-bold uppercase text-[9px] hover:bg-rose-50 dark:hover:bg-rose-950/20 active:scale-95 transition inline-flex items-center gap-0.5"
          disabled={isOCRProcessing}
        >
          <span className="material-symbols-outlined text-[10px]">delete</span>
          Delete
        </button>
      </div>
    );
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  const readyToEvaluateCount = sheets.filter(
    s => (s.processingStatus === 'completed' || s.processingStatus === 'ready_for_evaluation') && !s.evaluation
  ).length;

  return (
    <div className="flex flex-col gap-6 text-left max-w-5xl mx-auto py-6 animate-fade-in font-sans">
      
      {/* Breadcrumb Navigation header */}
      <div className="flex flex-col gap-1.5 border-b border-outline-variant/20 pb-4">
        <div className="flex items-center gap-2 text-xs text-outline font-semibold">
          <Link to="/faculty/exams" className="hover:text-primary">Exams</Link>
          <span className="material-symbols-outlined text-[10px]">chevron_right</span>
          {exam && <Link to={`/faculty/exams/${examId}`} className="hover:text-primary">{exam.title}</Link>}
          <span className="material-symbols-outlined text-[10px]">chevron_right</span>
          <span className="text-on-surface">Answer Sheets Ingestion</span>
        </div>
        <h2 className="text-2xl font-black text-on-surface font-display mt-1">Answer Sheets</h2>
        <p className="text-xs text-outline">Manage scanning segments and launch AI Evaluators on student submissions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Dropzone Column */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container space-y-4">
            <h3 className="text-xs font-black text-outline uppercase tracking-wider">Ingest New Scan</h3>
            
            {/* Optional roll override block */}
            <div>
              <label className="text-[10px] text-outline uppercase font-extrabold block mb-1">
                Student ID / Roll Override (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 21BCE045"
                value={studentIdentifier}
                onChange={(e) => setStudentIdentifier(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-outline-variant/35 bg-surface-container-lowest focus:border-primary focus:outline-none transition font-semibold"
                disabled={uploading}
              />
              <span className="text-[9px] text-outline mt-1 block leading-normal">
                If omitted, matching resolves candidate name directly by extracting filename words.
              </span>
            </div>

            {/* Ingestion area */}
            <div 
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                uploading 
                  ? 'border-outline/30 bg-surface-container-low cursor-not-allowed' 
                  : 'border-primary/45 hover:border-primary bg-primary/5 hover:bg-primary/10'
              }`}
            >
              <span className={`material-symbols-outlined text-3xl ${uploading ? 'text-outline animate-pulse' : 'text-primary'}`}>
                {uploading ? 'cloud_sync' : 'upload_file'}
              </span>
              <span className="text-xs font-bold text-on-surface">
                {uploading ? 'Uploading Scans...' : 'Drag or Click to Choose'}
              </span>
              <span className="text-[10px] text-outline">
                Supports multiple PDF, JPG, or PNG files
              </span>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg,image/jpg"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
              />
            </div>

            {uploading && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[10px] font-bold text-outline">
                  <span>Uploading files...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-outline-variant/20 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-primary h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard grid panel sheets listing */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container space-y-4">
            <div className="flex justify-between items-center select-none border-b border-outline-variant/10 pb-2">
              <h3 className="text-xs font-black text-outline uppercase tracking-wider">
                Submissions Database ({sheets.length})
              </h3>
              {readyToEvaluateCount > 0 && (
                <button
                  onClick={handleBulkEvaluate}
                  disabled={evaluatingBulk}
                  className="px-3 py-1.5 bg-primary text-on-primary rounded-xl font-bold uppercase text-[9px] hover:bg-primary-dark hover:shadow active:scale-95 transition inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                  {evaluatingBulk ? 'Evaluating All...' : `Evaluate All Ready (${readyToEvaluateCount})`}
                </button>
              )}
            </div>

            {sheets.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <span className="material-symbols-outlined text-3xl text-outline-variant">folder_open</span>
                <p className="text-xs text-outline italic">No answer sheets uploaded to this exam layout.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant/20 text-[10px] font-black uppercase text-outline tracking-wider">
                      <th className="py-2.5">Candidate</th>
                      <th className="py-2.5">Ingested Document</th>
                      <th className="py-2.5">Layout Scan</th>
                      <th className="py-2.5">AI Answer Score</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {sheets.map((sheet) => (
                      <tr key={sheet._id} className="align-middle hover:bg-surface-container-lowest/40 transition">
                        <td className="py-3 pr-2">
                          <p className="font-bold text-xs">
                            {sheet.student ? sheet.student.name : sheet.studentIdentifier || 'Unknown Candidate'}
                          </p>
                          {sheet.student?.rollNo && (
                            <p className="text-[10px] text-outline font-semibold mt-0.5">
                              Roll: {sheet.student.rollNo}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-2">
                          <p className="font-semibold text-[11px] max-w-[150px] truncate" title={sheet.uploadedFileName}>
                            {sheet.uploadedFileName}
                          </p>
                          <p className="text-[9px] text-outline mt-0.5">
                            {formatBytes(sheet.fileSize)} • {new Date(sheet.createdAt).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="py-3 pr-2">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                            sheet.processingStatus === 'completed' || sheet.processingStatus === 'ready_for_evaluation'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : sheet.processingStatus === 'failed'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse'
                          }`}>
                            {sheet.processingStatus}
                          </span>
                        </td>
                        <td className="py-3 pr-2">
                          {renderEvaluationStatus(sheet)}
                        </td>
                        <td className="py-3 text-right">
                          {renderTableActions(sheet)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default AnswerSheets;
