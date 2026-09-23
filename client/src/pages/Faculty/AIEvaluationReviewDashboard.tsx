import React, { useEffect, useState, useRef } from 'react';
import { examService } from '../../services/exam.service';
import answerSheetService from '../../services/answerSheet.service';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

const StrokeCanvasRenderer: React.FC<{ strokes: any[]; width?: number; height?: number }> = ({
  strokes,
  width = 500,
  height = 300,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !strokes || strokes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokes.forEach((stroke: any) => {
      const points = stroke.points || stroke;
      if (!Array.isArray(points) || points.length === 0) return;

      ctx.strokeStyle = stroke.color || '#1e293b';
      ctx.lineWidth = stroke.width || 2;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    });
  }, [strokes, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="max-w-full max-h-full border border-slate-200 rounded-lg bg-white"
    />
  );
};


interface ExamOption {
  _id: string;
  title: string;
  code?: string;
  totalMarks?: number;
}

interface StudentEvaluationSummary {
  evaluationId: string | null;
  answerSheetId: string;
  studentId: string;
  studentName: string;
  enrollmentNumber: string;
  rollNo: string;
  examId: string;
  examTitle: string;
  submittedAt: string;
  totalAiMarks: number;
  maxMarks: number;
  percentage: number;
  overallConfidence: number;
  reviewStatus: 'Pending Review' | 'Reviewed' | 'Needs Attention' | string;
  isEvaluated: boolean;
  isUnanswered: boolean;
}

interface DetailedQuestionEvaluation {
  questionId: string;
  questionNumber: number;
  questionText: string;
  maxMarks: number;
  originalHandwriting: {
    pageNumber: number;
    strokes: any[];
    pages: any[];
    uploadedFileUrl?: string;
  };
  ocrDigitizedAnswer: string;
  referenceAnswer: string;
  aiEvaluation: {
    aiMarks: number;
    maxMarks: number;
    confidence: number;
    status: string;
    feedback: string;
    criteria: any[];
  };
  matchedConcepts: string[];
  missingConcepts: string[];
  conceptComparison: Array<{
    concept: string;
    referenceMatched: boolean;
    studentMatched: boolean;
  }>;
  borderlineEvaluation?: any;
  referenceAwareEvaluation?: any;
  facultyEvaluation?: {
    status: string;
    reviewType?: string;
    finalMarks: number | null;
    overrideReason?: string;
    comment: string | null;
  };
}

interface EvaluationDetailData {
  evaluationId: string | null;
  answerSheetId: string;
  student: {
    studentId: string;
    name: string;
    rollNo: string;
    email: string;
  };
  exam: {
    examId: string;
    title: string;
    code: string;
    subjectName: string;
  };
  submittedAt: string;
  totalAiMarks: number;
  maxMarks: number;
  percentage: number;
  overallConfidence: number;
  reviewStatus: string;
  questions: DetailedQuestionEvaluation[];
}

const PREDEFINED_REASONS = [
  'AI underestimated answer',
  'AI overestimated answer',
  'OCR error',
  'Valid alternative answer',
  'Partial concept accepted',
  'Reference answer mismatch',
  'Correct concept with different wording',
  'Student answer deserves additional marks',
  'Student answer deserves fewer marks',
  'Other',
];

export const AIEvaluationReviewDashboard: React.FC = () => {
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [loadingExams, setLoadingExams] = useState<boolean>(true);

  // Dashboard Data
  const [stats, setStats] = useState({
    totalStudents: 0,
    evaluated: 0,
    pendingReview: 0,
    needsAttention: 0,
    reviewed: 0,
  });
  const [students, setStudents] = useState<StudentEvaluationSummary[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(false);

  // Filters & Search
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Detail Modal State
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<EvaluationDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [pageImageUrl, setPageImageUrl] = useState<string>('');
  const [loadingImage, setLoadingImage] = useState<boolean>(false);

  // Phase 4B Faculty Decision & Override Panel States
  const [isOverrideEditing, setIsOverrideEditing] = useState<boolean>(false);
  const [facultyMarksInput, setFacultyMarksInput] = useState<string>('');
  const [overrideReasonInput, setOverrideReasonInput] = useState<string>(PREDEFINED_REASONS[0]);
  const [facultyCommentInput, setFacultyCommentInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    badgeText?: string;
    badgeColor?: string;
    onConfirm: () => void;
  } | null>(null);

  // Load Exams list on mount
  useEffect(() => {
    fetchExams();
  }, []);

  // Fetch Dashboard data when exam selection changes
  useEffect(() => {
    if (selectedExamId) {
      fetchDashboardData(selectedExamId);
    }
  }, [selectedExamId]);

  const fetchExams = async () => {
    setLoadingExams(true);
    try {
      const res: any = await examService.getExams();
      const list = res.data?.data || res.data || (Array.isArray(res) ? res : []);
      setExams(list);
      if (list.length > 0) {
        setSelectedExamId(list[0]._id || list[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch exams:', err);
    } finally {
      setLoadingExams(false);
    }
  };


  const fetchDashboardData = async (examId: string) => {
    setLoadingDashboard(true);
    try {
      const res: any = await answerSheetService.getReviewDashboardData(examId);
      const data = res.data?.data || res.data || res;
      if (data) {
        setStats(data.stats || { totalStudents: 0, evaluated: 0, pendingReview: 0, needsAttention: 0, reviewed: 0 });
        setStudents(data.studentsList || []);
      }
    } catch (err) {
      console.error('Failed to fetch evaluation review dashboard data:', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  // Open Detail Modal
  const handleOpenDetail = async (studentItem: StudentEvaluationSummary) => {
    const targetId = studentItem.evaluationId || studentItem.answerSheetId;
    setSelectedEvaluationId(targetId);
    setLoadingDetail(true);
    setActiveQuestionIdx(0);
    setDetailData(null);

    try {
      const res: any = await answerSheetService.getEvaluationDetail(targetId);
      const data = res.data?.data || res.data || res;
      setDetailData(data);
      if (data && data.questions && data.questions.length > 0) {
        loadScannedPageImage(data.answerSheetId, data.questions[0].originalHandwriting?.pageNumber || 1);
      }
    } catch (err) {
      console.error('Failed to load evaluation detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadScannedPageImage = async (sheetId: string, pageNum: number) => {
    setLoadingImage(true);
    try {
      const imgUrl = await answerSheetService.getPageImageObjectURL(sheetId, pageNum, true, 'original');
      setPageImageUrl(imgUrl);
    } catch (err) {
      console.warn('Scanned page image fallback load error:', err);
      setPageImageUrl('');
    } finally {
      setLoadingImage(false);
    }
  };

  const handleQuestionChange = (newIdx: number) => {
    if (!detailData || newIdx < 0 || newIdx >= detailData.questions.length) return;
    setActiveQuestionIdx(newIdx);
    setIsOverrideEditing(false);
    setActionError(null);
    setActionSuccess(null);
    const q = detailData.questions[newIdx];
    const pNum = q.originalHandwriting?.pageNumber || 1;
    loadScannedPageImage(detailData.answerSheetId, pNum);
  };

  const startOverrideMode = (q: DetailedQuestionEvaluation) => {
    const currentMarks = q.facultyEvaluation?.finalMarks ?? q.aiEvaluation?.aiMarks ?? 0;
    setFacultyMarksInput(String(currentMarks));
    setOverrideReasonInput(q.facultyEvaluation?.comment && PREDEFINED_REASONS.includes(q.facultyEvaluation.comment) ? q.facultyEvaluation.comment : PREDEFINED_REASONS[0]);
    setFacultyCommentInput(q.facultyEvaluation?.comment || '');
    setIsOverrideEditing(true);
    setActionError(null);
    setActionSuccess(null);
  };

  const handleAcceptAiMarks = async (q: DetailedQuestionEvaluation) => {
    if (!selectedEvaluationId || !detailData) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const qNumOrId = String(q.questionId || q.questionNumber);
      await answerSheetService.acceptAiMarks(selectedEvaluationId, qNumOrId);
      setActionSuccess(`Accepted AI marks (${q.aiEvaluation.aiMarks}) for Question ${q.questionNumber}`);
      setIsOverrideEditing(false);

      const refreshed: any = await answerSheetService.getEvaluationDetail(selectedEvaluationId);
      setDetailData(refreshed.data?.data || refreshed.data || refreshed);

      if (selectedExamId) {
        fetchDashboardData(selectedExamId);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to accept AI marks.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveOverrideDecision = async (q: DetailedQuestionEvaluation) => {
    if (!selectedEvaluationId || !detailData) return;
    const marksNum = parseFloat(facultyMarksInput);
    if (isNaN(marksNum) || marksNum < 0 || marksNum > q.maxMarks) {
      setActionError(`Faculty marks must be a valid number between 0 and ${q.maxMarks}.`);
      return;
    }

    if (overrideReasonInput === 'Other' && !facultyCommentInput.trim()) {
      setActionError('Faculty comment is mandatory when "Other" is selected as the override reason.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const qNumOrId = String(q.questionId || q.questionNumber);
      await answerSheetService.overrideQuestionMarks(selectedEvaluationId, qNumOrId, {
        facultyMarks: marksNum,
        overrideReason: overrideReasonInput,
        comment: facultyCommentInput.trim() || overrideReasonInput,
      });

      setActionSuccess(`Successfully saved faculty override (${marksNum}/${q.maxMarks}) for Question ${q.questionNumber}`);
      setIsOverrideEditing(false);

      const refreshed: any = await answerSheetService.getEvaluationDetail(selectedEvaluationId);
      setDetailData(refreshed.data?.data || refreshed.data || refreshed);

      if (selectedExamId) {
        fetchDashboardData(selectedExamId);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to save mark override.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalizeQuestion = async (q: DetailedQuestionEvaluation) => {
    if (!selectedEvaluationId || !detailData) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const qNumOrId = String(q.questionId || q.questionNumber);
      await answerSheetService.finalizeSingleQuestion(selectedEvaluationId, qNumOrId);
      setActionSuccess(`Question ${q.questionNumber} evaluation finalized and locked.`);
      setIsOverrideEditing(false);

      const refreshed: any = await answerSheetService.getEvaluationDetail(selectedEvaluationId);
      setDetailData(refreshed.data?.data || refreshed.data || refreshed);

      if (selectedExamId) {
        fetchDashboardData(selectedExamId);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to finalize question.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalizeStudentEvaluation = async () => {
    if (!selectedEvaluationId || !detailData) return;

    let totalAi = 0;
    let totalFac = 0;
    detailData.questions.forEach((q) => {
      totalAi += q.aiEvaluation?.aiMarks || 0;
      totalFac += q.facultyEvaluation?.finalMarks ?? q.aiEvaluation?.aiMarks ?? 0;
    });
    const diff = totalFac - totalAi;
    const diffStr = diff >= 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`;

    setConfirmModal({
      title: 'Finalize Student Evaluation',
      message: `You are about to finalize the evaluation for student ${detailData.student.name} (${detailData.student.rollNo}). This action will seal all marks and lock all question reviews.`,
      badgeText: `AI Total: ${totalAi.toFixed(1)} | Faculty Final Total: ${totalFac.toFixed(1)} | Net Difference: ${diffStr}`,
      badgeColor: diff >= 0 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800',
      onConfirm: async () => {
        setConfirmModal(null);
        setActionLoading(true);
        setActionError(null);
        setActionSuccess(null);
        try {
          await answerSheetService.finalizeStudentEvaluation(selectedEvaluationId);
          setActionSuccess(`Student evaluation successfully finalized and sealed!`);

          const refreshed: any = await answerSheetService.getEvaluationDetail(selectedEvaluationId);
          setDetailData(refreshed.data?.data || refreshed.data || refreshed);

          if (selectedExamId) {
            fetchDashboardData(selectedExamId);
          }
        } catch (err: any) {
          setActionError(err.response?.data?.message || err.message || 'Failed to finalize student evaluation.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Update Review Status
  const handleUpdateReviewStatus = async (newStatus: 'Reviewed' | 'Needs Attention') => {
    if (!selectedEvaluationId || !detailData) return;
    setUpdatingStatus(true);
    try {
      await answerSheetService.updateReviewStatus(selectedEvaluationId, newStatus);
      // Update local detail state
      setDetailData((prev) => (prev ? { ...prev, reviewStatus: newStatus } : prev));
      // Refresh list metrics
      if (selectedExamId) {
        fetchDashboardData(selectedExamId);
      }
    } catch (err) {
      console.error('Failed to update review status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Filtering
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.studentName.toLowerCase().includes(search.toLowerCase()) ||
      s.enrollmentNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'All') return true;
    if (statusFilter === 'Pending Review') return s.reviewStatus === 'Pending Review';
    if (statusFilter === 'Reviewed') return s.reviewStatus === 'Reviewed';
    if (statusFilter === 'Needs Attention') return s.reviewStatus === 'Needs Attention';
    if (statusFilter === 'Low Confidence') return s.overallConfidence < 75;
    if (statusFilter === 'Unanswered') return s.isUnanswered;

    return true;
  });

  if (loadingExams) {
    return <LoadingSpinner size="lg" className="py-20" />;
  }

  const activeQuestion = detailData?.questions?.[activeQuestionIdx];

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-on-surface font-display">AI Evaluation Review</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Review AI-generated evaluations, OCR answers, and concepts before final faculty approval.
          </p>
        </div>

        {/* Exam Selector Dropdown */}
        <div className="flex items-center gap-3 bg-surface-container/60 p-2 rounded-2xl border border-outline-variant/40">
          <span className="material-symbols-outlined text-outline text-lg ml-2">assignment</span>
          <label className="text-xs font-bold text-on-surface-variant whitespace-nowrap">Select Exam:</label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="bg-white dark:bg-surface-container-high border border-outline-variant/60 rounded-xl px-3 py-1.5 text-xs font-bold text-on-surface focus:outline-none focus:border-primary shadow-sm"
          >
            {exams.map((ex) => (
              <option key={ex._id} value={ex._id}>
                {ex.title} ({ex.code || 'EXAM'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Database Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="glass-card p-4 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-outline">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Students</span>
            <span className="material-symbols-outlined text-lg text-primary">groups</span>
          </div>
          <span className="text-2xl font-black text-on-surface font-display mt-2">{stats.totalStudents}</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-outline">
            <span className="text-xs font-semibold uppercase tracking-wider">Evaluated</span>
            <span className="material-symbols-outlined text-lg text-blue-500">task_alt</span>
          </div>
          <span className="text-2xl font-black text-on-surface font-display mt-2">{stats.evaluated}</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-outline">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Review</span>
            <span className="material-symbols-outlined text-lg text-amber-500">hourglass_top</span>
          </div>
          <span className="text-2xl font-black text-on-surface font-display mt-2">{stats.pendingReview}</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-outline">
            <span className="text-xs font-semibold uppercase tracking-wider">Needs Attention</span>
            <span className="material-symbols-outlined text-lg text-red-500">warning</span>
          </div>
          <span className="text-2xl font-black text-on-surface font-display mt-2">{stats.needsAttention}</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-outline">
            <span className="text-xs font-semibold uppercase tracking-wider">Reviewed</span>
            <span className="material-symbols-outlined text-lg text-green-500">verified</span>
          </div>
          <span className="text-2xl font-black text-on-surface font-display mt-2">{stats.reviewed}</span>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative max-w-sm w-full">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg select-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search student name, enrollment, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-xs text-on-surface focus:outline-none focus:border-primary transition-colors shadow-sm"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {['All', 'Pending Review', 'Reviewed', 'Needs Attention', 'Low Confidence', 'Unanswered'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === f
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/30'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Student Evaluations List Table */}
      {loadingDashboard ? (
        <LoadingSpinner size="lg" className="py-20" />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          title="No evaluations found"
          description="No student submissions matched the selected filter criteria for this exam."
        />
      ) : (
        <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm bg-white dark:bg-surface-container">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">AI Score</th>
                  <th className="px-6 py-4">Confidence</th>
                  <th className="px-6 py-4">Review Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-xs text-on-surface-variant">
                {filteredStudents.map((s) => {
                  const confBg =
                    s.overallConfidence >= 90
                      ? 'text-green-600 bg-green-50 border-green-200'
                      : s.overallConfidence >= 75
                      ? 'text-amber-600 bg-amber-50 border-amber-200'
                      : 'text-red-600 bg-red-50 border-red-200';

                  const statusBadge =
                    s.reviewStatus === 'Reviewed'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : s.reviewStatus === 'Needs Attention'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200';

                  return (
                    <tr key={s.answerSheetId} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-on-surface text-sm block">{s.studentName}</span>
                        <span className="text-[11px] text-outline mt-0.5">
                          ID / Roll: {s.enrollmentNumber}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-extrabold text-on-surface text-sm">
                          {s.totalAiMarks} / {s.maxMarks}
                        </span>
                        <span className="text-[10px] text-outline block mt-0.5">
                          ({s.percentage.toFixed(1)}%)
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${confBg}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              s.overallConfidence >= 90
                                ? 'bg-green-500'
                                : s.overallConfidence >= 75
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                          />
                          {s.overallConfidence}% Confidence
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBadge}`}
                        >
                          {s.reviewStatus}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenDetail(s)}
                          className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-sm hover:bg-primary/95 transition-all text-center inline-flex items-center gap-1.5 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          View Evaluation
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Evaluation Detail View Modal */}
      {selectedEvaluationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-surface-container max-w-5xl w-full rounded-3xl border border-outline-variant/40 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-high/40">
              <div>
                <h3 className="text-lg font-black text-on-surface font-display">
                  Student Evaluation Detail — {detailData?.student?.name || 'Loading...'}
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Roll / ID: {detailData?.student?.rollNo} | Exam: {detailData?.exam?.title}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Review Action Buttons */}
                {detailData && (
                  <div className="flex items-center gap-2">
                    <button
                      disabled={updatingStatus}
                      onClick={() => handleUpdateReviewStatus('Reviewed')}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 shadow-sm ${
                        detailData.reviewStatus === 'Reviewed'
                          ? 'bg-green-600 text-white'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Mark as Reviewed
                    </button>

                    <button
                      disabled={updatingStatus}
                      onClick={() => handleUpdateReviewStatus('Needs Attention')}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 shadow-sm ${
                        detailData.reviewStatus === 'Needs Attention'
                          ? 'bg-red-600 text-white'
                          : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">warning</span>
                      Needs Attention
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setSelectedEvaluationId(null)}
                  className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            {loadingDetail || !detailData ? (
              <div className="py-20">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Question Navigation Bar */}
                <div className="px-6 py-3 bg-surface-container/50 border-b border-outline-variant/20 flex items-center justify-between gap-4 overflow-x-auto custom-scrollbar">
                  <div className="flex items-center gap-2">
                    {detailData.questions.map((q, idx) => {
                      const isActive = idx === activeQuestionIdx;
                      const hasWarning = q.aiEvaluation.confidence < 75 || q.missingConcepts.length > 2;

                      return (
                        <button
                          key={q.questionId}
                          onClick={() => handleQuestionChange(idx)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            isActive
                              ? 'bg-primary text-on-primary shadow-sm'
                              : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/30'
                          }`}
                        >
                          <span>Q{q.questionNumber}</span>
                          <span className="opacity-80">
                            ({q.aiEvaluation.aiMarks}/{q.maxMarks})
                          </span>
                          {hasWarning && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Prev / Next */}
                  <div className="flex items-center gap-2">
                    <button
                      disabled={activeQuestionIdx === 0}
                      onClick={() => handleQuestionChange(activeQuestionIdx - 1)}
                      className="px-3 py-1.5 bg-surface-container-high text-on-surface rounded-xl text-xs font-bold disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      disabled={activeQuestionIdx === detailData.questions.length - 1}
                      onClick={() => handleQuestionChange(activeQuestionIdx + 1)}
                      className="px-3 py-1.5 bg-surface-container-high text-on-surface rounded-xl text-xs font-bold disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>

                {/* Question Detail Body */}
                {activeQuestion && (
                  <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                    {/* Question Prompt Header */}
                    <div className="p-4 rounded-2xl bg-surface-container-high/40 border border-outline-variant/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-extrabold text-xs text-primary uppercase tracking-wider">
                          Question {activeQuestion.questionNumber}
                        </span>
                        <span className="font-extrabold text-xs text-on-surface bg-surface-container px-2.5 py-1 rounded-full border border-outline-variant/30">
                          Max Marks: {activeQuestion.maxMarks}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-on-surface leading-relaxed">
                        {activeQuestion.questionText}
                      </h4>
                    </div>

                    {/* 2-Column Layout: Original Handwriting Scan / Canvas vs OCR & Reference */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Original Handwritten Answer Scan / Canvas */}
                      <div className="flex flex-col gap-3 p-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low/50">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-xs uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-primary">draw</span>
                            Original Handwritten Answer
                          </h5>
                          <span className="text-[10px] text-outline font-mono">
                            Page {activeQuestion.originalHandwriting?.pageNumber || 1}
                          </span>
                        </div>

                        <div className="relative min-h-[260px] max-h-[360px] rounded-xl overflow-hidden bg-white dark:bg-surface-container border border-outline-variant/20 flex items-center justify-center">
                          {activeQuestion.originalHandwriting?.strokes?.length > 0 ? (
                            <div className="w-full h-full p-2">
                              <StrokeCanvasRenderer
                                strokes={activeQuestion.originalHandwriting.strokes}
                                width={500}
                                height={300}
                              />
                            </div>
                          ) : loadingImage ? (
                            <LoadingSpinner size="md" />
                          ) : pageImageUrl ? (
                            <img
                              src={pageImageUrl}
                              alt="Handwritten page scan"
                              className="object-contain max-h-[340px] w-full"
                            />
                          ) : (
                            <div className="text-center p-6 text-outline text-xs">
                              <span className="material-symbols-outlined text-3xl block mb-1">image_not_supported</span>
                              Scanned page image preview available in viewer.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: OCR Digitized Answer & Model Reference */}
                      <div className="flex flex-col gap-4">
                        {/* OCR Digitized Answer */}
                        <div className="p-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low/50 flex flex-col gap-2">
                          <h5 className="font-bold text-xs uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-blue-500">subtitles</span>
                            OCR Digitized Answer
                          </h5>
                          <div className="p-3 rounded-xl bg-white dark:bg-surface-container text-xs text-on-surface leading-relaxed border border-outline-variant/20 min-h-[90px] font-mono">
                            {activeQuestion.ocrDigitizedAnswer || (
                              <span className="text-outline italic">
                                [No OCR digitized text captured for this question]
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Reference / Model Answer */}
                        <div className="p-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low/50 flex flex-col gap-2">
                          <h5 className="font-bold text-xs uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-purple-500">menu_book</span>
                            Reference / Model Answer
                          </h5>
                          <div className="p-3 rounded-xl bg-white dark:bg-surface-container text-xs text-on-surface leading-relaxed border border-outline-variant/20 min-h-[90px] font-mono">
                            {activeQuestion.referenceAnswer || (
                              <span className="text-outline italic">
                                [No reference answer specified in Answer Key]
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Evaluation Explanation & Scores */}
                    <div className="p-4 rounded-2xl border border-outline-variant/30 bg-primary/5 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-xs uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-primary">psychology</span>
                          AI Evaluation & Explanation
                        </h5>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-primary px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                            AI Score: {activeQuestion.aiEvaluation.aiMarks} / {activeQuestion.maxMarks}
                          </span>
                          <span className="text-xs font-bold text-on-surface bg-surface-container px-3 py-1 rounded-full border border-outline-variant/30">
                            Confidence: {activeQuestion.aiEvaluation.confidence}%
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-on-surface leading-relaxed">
                        {activeQuestion.aiEvaluation.feedback}
                      </p>
                    </div>

                    {/* Matched Concepts & Missing Concepts Badges */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl border border-green-200/60 bg-green-50/40 dark:bg-green-950/20">
                        <h6 className="font-bold text-xs text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          Matched Concepts ({activeQuestion.matchedConcepts.length})
                        </h6>
                        <div className="flex flex-wrap gap-1.5">
                          {activeQuestion.matchedConcepts.length > 0 ? (
                            activeQuestion.matchedConcepts.map((c, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 rounded-lg text-[11px] font-bold border border-green-200"
                              >
                                ✓ {c}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-outline italic">No matched concepts detected.</span>
                          )}
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl border border-red-200/60 bg-red-50/40 dark:bg-red-950/20">
                        <h6 className="font-bold text-xs text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">cancel</span>
                          Missing Concepts ({activeQuestion.missingConcepts.length})
                        </h6>
                        <div className="flex flex-wrap gap-1.5">
                          {activeQuestion.missingConcepts.length > 0 ? (
                            activeQuestion.missingConcepts.map((c, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-1 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 rounded-lg text-[11px] font-bold border border-red-200"
                              >
                                ✗ {c}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-outline italic">No missing concepts.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Concept Comparison Table */}
                    {activeQuestion.conceptComparison.length > 0 && (
                      <div className="p-4 rounded-2xl border border-outline-variant/30 bg-surface-container">
                        <h5 className="font-bold text-xs uppercase tracking-wider text-on-surface mb-3 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-primary">table_chart</span>
                          Concept Comparison Matrix
                        </h5>
                        <div className="overflow-x-auto custom-scrollbar">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-surface-container-high text-on-surface-variant font-semibold text-[10px] uppercase border-b border-outline-variant/20">
                                <th className="px-4 py-2.5">Key Concept</th>
                                <th className="px-4 py-2.5">Reference Model Answer</th>
                                <th className="px-4 py-2.5">Student Answer Match</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/10">
                              {activeQuestion.conceptComparison.map((row, idx) => (
                                <tr key={idx} className="hover:bg-primary/5">
                                  <td className="px-4 py-2.5 font-bold text-on-surface">{row.concept}</td>
                                  <td className="px-4 py-2.5 text-green-600 font-bold">✓ Included</td>
                                  <td className="px-4 py-2.5 font-bold">
                                    {row.studentMatched ? (
                                      <span className="text-green-600">✓ Present</span>
                                    ) : (
                                      <span className="text-red-500">✗ Missing</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Historical Answer Reference Evidence (Phase 3F/3G evidence) */}
                    {activeQuestion.referenceAwareEvaluation && (
                      <div className="p-4 rounded-2xl border border-purple-200/60 bg-purple-50/40 dark:bg-purple-950/20 flex flex-col gap-2">
                        <h5 className="font-bold text-xs uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">history_edu</span>
                          Previous-Year Evaluated Answer Reference Evidence
                        </h5>
                        <p className="text-xs text-on-surface leading-relaxed">
                          {activeQuestion.referenceAwareEvaluation.analysis ||
                            'Historical reference answers evaluated by senior faculty were used as contextual evidence during borderline AI evaluation.'}
                        </p>
                      </div>
                    )}

                    {/* Phase 4B — Faculty Decision & Override Panel */}
                    <div className="p-5 rounded-2xl border border-primary/30 bg-surface-container-high/60 flex flex-col gap-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-outline-variant/20">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-xl">gavel</span>
                          <h5 className="font-extrabold text-sm text-on-surface">
                            Faculty Evaluation & Override Decision Panel — Q{activeQuestion.questionNumber}
                          </h5>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {activeQuestion.facultyEvaluation?.status === 'accepted' || activeQuestion.facultyEvaluation?.reviewType === 'accepted' ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">check_circle</span> Accepted AI
                            </span>
                          ) : activeQuestion.facultyEvaluation?.status === 'modified' || activeQuestion.facultyEvaluation?.reviewType === 'overridden' ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">edit_square</span> Faculty Override
                            </span>
                          ) : activeQuestion.facultyEvaluation?.status === 'finalized' ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">lock</span> Finalized
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">hourglass_empty</span> Pending Review
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Before vs After Summary Comparison */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-surface-container p-3.5 rounded-xl border border-outline-variant/30 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-outline block">Original AI Score</span>
                          <span className="font-extrabold text-on-surface text-sm">
                            {activeQuestion.aiEvaluation.aiMarks} / {activeQuestion.maxMarks}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-outline block">Faculty Final Score</span>
                          <span className={`font-extrabold text-sm ${
                            activeQuestion.facultyEvaluation?.finalMarks !== undefined && activeQuestion.facultyEvaluation?.finalMarks !== null && activeQuestion.facultyEvaluation.finalMarks !== activeQuestion.aiEvaluation.aiMarks
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-on-surface'
                          }`}>
                            {activeQuestion.facultyEvaluation?.finalMarks ?? activeQuestion.aiEvaluation.aiMarks} / {activeQuestion.maxMarks}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-outline block">Mark Difference</span>
                          {(() => {
                            const aiM = activeQuestion.aiEvaluation.aiMarks;
                            const facM = activeQuestion.facultyEvaluation?.finalMarks ?? aiM;
                            const diff = facM - aiM;
                            if (diff === 0) return <span className="font-bold text-outline">0.0 (No change)</span>;
                            return (
                              <span className={`font-extrabold ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                              </span>
                            );
                          })()}
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-outline block">Decision Status</span>
                          <span className="font-bold text-on-surface capitalize">
                            {activeQuestion.facultyEvaluation?.status || 'Pending'}
                          </span>
                        </div>
                      </div>

                      {/* Override details if present */}
                      {activeQuestion.facultyEvaluation?.overrideReason && (
                        <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-on-surface flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-bold">
                            <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                            Reason: {activeQuestion.facultyEvaluation.overrideReason}
                          </div>
                          {activeQuestion.facultyEvaluation.comment && (
                            <p className="text-on-surface-variant italic pl-5">
                              "{activeQuestion.facultyEvaluation.comment}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Error / Success Notifications */}
                      {actionError && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">error</span>
                          {actionError}
                        </div>
                      )}

                      {actionSuccess && (
                        <div className="p-3 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 rounded-xl text-xs font-bold flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          {actionSuccess}
                        </div>
                      )}

                      {/* Action Control Panel */}
                      {detailData.reviewStatus === 'FINALIZED' || activeQuestion.facultyEvaluation?.status === 'finalized' ? (
                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-slate-500">lock</span>
                          Question evaluation is finalized and sealed. Further modifications are locked.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {!isOverrideEditing ? (
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                disabled={actionLoading}
                                onClick={() => handleAcceptAiMarks(activeQuestion)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-sm">check</span>
                                Accept AI Marks ({activeQuestion.aiEvaluation.aiMarks})
                              </button>

                              <button
                                disabled={actionLoading}
                                onClick={() => startOverrideMode(activeQuestion)}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                                Override Marks & Justification
                              </button>

                              <button
                                disabled={actionLoading}
                                onClick={() => handleFinalizeQuestion(activeQuestion)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 ml-auto"
                              >
                                <span className="material-symbols-outlined text-sm">lock</span>
                                Finalize Question Q{activeQuestion.questionNumber}
                              </button>
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl bg-white dark:bg-surface-container border border-amber-300/50 flex flex-col gap-3 animate-fade-in">
                              <h6 className="font-extrabold text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">edit_note</span>
                                Override Question Score
                              </h6>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                                    Faculty Marks (Max: {activeQuestion.maxMarks}):
                                  </label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max={activeQuestion.maxMarks}
                                    value={facultyMarksInput}
                                    onChange={(e) => setFacultyMarksInput(e.target.value)}
                                    className="w-full px-3 py-1.5 border border-outline-variant/60 rounded-xl bg-surface-container text-xs text-on-surface font-bold focus:outline-none focus:border-primary"
                                  />
                                  {(() => {
                                    const mNum = parseFloat(facultyMarksInput);
                                    if (!isNaN(mNum)) {
                                      const diff = mNum - activeQuestion.aiEvaluation.aiMarks;
                                      return (
                                        <span className={`text-[10px] font-bold block mt-1 ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                          Difference: {diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)} marks vs AI
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>

                                <div>
                                  <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                                    Override Reason (Required):
                                  </label>
                                  <select
                                    value={overrideReasonInput}
                                    onChange={(e) => setOverrideReasonInput(e.target.value)}
                                    className="w-full px-3 py-1.5 border border-outline-variant/60 rounded-xl bg-surface-container text-xs text-on-surface font-bold focus:outline-none focus:border-primary"
                                  >
                                    {PREDEFINED_REASONS.map((r) => (
                                      <option key={r} value={r}>
                                        {r}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                                  Faculty Comment / Justification Details {overrideReasonInput === 'Other' ? '(Mandatory)' : '(Optional)'}:
                                </label>
                                <textarea
                                  rows={2}
                                  placeholder="Provide academic explanation for overriding AI evaluation..."
                                  value={facultyCommentInput}
                                  onChange={(e) => setFacultyCommentInput(e.target.value)}
                                  className="w-full p-2 border border-outline-variant/60 rounded-xl bg-surface-container text-xs text-on-surface focus:outline-none focus:border-primary"
                                />
                              </div>

                              <div className="flex items-center gap-2 justify-end pt-2 border-t border-outline-variant/20">
                                <button
                                  disabled={actionLoading}
                                  onClick={() => setIsOverrideEditing(false)}
                                  className="px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-bold text-xs rounded-xl hover:bg-surface-container transition-all"
                                >
                                  Cancel
                                </button>
                                <button
                                  disabled={actionLoading}
                                  onClick={() => handleSaveOverrideDecision(activeQuestion)}
                                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-sm">save</span>
                                  Save Override
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Modal Footer — Student Level Finalization Summary */}
                <div className="px-6 py-4 bg-surface-container-high/60 border-t border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 text-xs font-bold text-on-surface">
                    {(() => {
                      let totalAi = 0;
                      let totalFac = 0;
                      let reviewedCount = 0;
                      detailData.questions.forEach((q) => {
                        totalAi += q.aiEvaluation?.aiMarks || 0;
                        totalFac += q.facultyEvaluation?.finalMarks ?? q.aiEvaluation?.aiMarks ?? 0;
                        if (q.facultyEvaluation && q.facultyEvaluation.status !== 'pending') {
                          reviewedCount++;
                        }
                      });
                      const diff = totalFac - totalAi;
                      const diffStr = diff >= 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`;

                      return (
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface-variant">
                            Questions Reviewed: {reviewedCount} / {detailData.questions.length}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                            Total AI: {totalAi.toFixed(1)}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            Faculty Final: {totalFac.toFixed(1)} / {detailData.maxMarks}
                          </span>
                          <span className={`px-2.5 py-1 rounded-lg font-extrabold border ${
                            diff >= 0 ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'
                          }`}>
                            Net Difference: {diffStr}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-3">
                    {detailData.reviewStatus === 'FINALIZED' ? (
                      <span className="px-4 py-2 bg-blue-600 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm">
                        <span className="material-symbols-outlined text-sm">verified</span>
                        Student Evaluation Sealed & Finalized
                      </span>
                    ) : (
                      <button
                        disabled={actionLoading}
                        onClick={handleFinalizeStudentEvaluation}
                        className="px-5 py-2.5 bg-gradient-to-r from-primary to-blue-600 text-on-primary font-black text-xs rounded-xl shadow-md hover:opacity-95 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">task_alt</span>
                        Finalize Student Evaluation
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-container max-w-md w-full rounded-2xl p-6 border border-outline-variant/40 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-primary font-black text-base">
              <span className="material-symbols-outlined text-2xl">published_with_changes</span>
              {confirmModal.title}
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              {confirmModal.message}
            </p>

            {confirmModal.badgeText && (
              <div className={`p-3 rounded-xl font-mono text-xs font-bold text-center border ${confirmModal.badgeColor || 'bg-surface-container text-on-surface'}`}>
                {confirmModal.badgeText}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/20">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-surface-container-high text-on-surface font-bold text-xs rounded-xl hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-5 py-2 bg-primary text-on-primary font-black text-xs rounded-xl shadow-md hover:bg-primary/95"
              >
                Confirm Finalize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIEvaluationReviewDashboard;
