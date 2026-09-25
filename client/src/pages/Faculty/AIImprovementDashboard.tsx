import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ToastContainer from '../../components/ui/Toast';
import { useNotifications } from '../../context/NotificationContext';
import axios from 'axios';

interface OverviewCards {
  totalFeedback: number;
  totalOverrides: number;
  overrideRate: number;
  marksIncreased: number;
  marksDecreased: number;
  unchanged: number;
  totalSuggestions: number;
  pendingSuggestions: number;
  approvedSuggestions: number;
  implementedSuggestions: number;
}

interface CategoryCount {
  name: string;
  count: number;
  type: string;
}

interface PotentialImprovement {
  examId: string;
  examTitle: string;
  questionNumber: string;
  totalCorrections: number;
  topReason: string;
  topReasonCount: number;
  ocrCorrections: number;
  reviewPriority: 'High' | 'Medium' | 'Low';
  sampleComments: string[];
  suggestionNeeded: boolean;
  recommendation: string;
}

interface FeedbackItem {
  _id: string;
  examId: { _id: string; title: string };
  questionNumber: string;
  aiMarks: number;
  finalMarks: number;
  difference: number;
  feedbackType: string;
  reason: string;
  comment: string;
  aiConfidence: number;
  createdBy: { name: string; email: string; role: string };
  studentId?: { name: string; rollNo: string };
  createdAt: string;
}

interface ImprovementSuggestion {
  _id: string;
  examId: { _id: string; title: string };
  questionNumber: string;
  questionText: string;
  type: 'reference_answer' | 'rubric' | 'evaluation_rule';
  currentVersion: number;
  currentModelAnswer: string;
  currentRubric: Array<{ criterion: string; description: string; maxMarks: number }>;
  suggestedModelAnswer: string;
  suggestedRubric: Array<{ criterion: string; description: string; maxMarks: number }>;
  justification: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Implemented' | 'Archived';
  createdBy: { name: string; role: string };
  reviewedBy?: { name: string; role: string };
  reviewedAt?: string;
  reviewComment?: string;
  createdVersion?: number;
  createdAt: string;
}

interface EvidenceItem {
  feedbackId: string;
  anonymizedEvaluationId: string;
  aiMarks: number;
  finalMarks: number;
  difference: string;
  reason: string;
  comment: string;
  feedbackType: string;
  aiConfidence: string;
  createdAt: string;
}

export const AIImprovementDashboard: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const toast = {
    error: (msg: string) => addToast(msg, 'error'),
    success: (msg: string) => addToast(msg, 'success'),
    info: (msg: string) => addToast(msg, 'info'),
  };
  const [activeTab, setActiveTab] = useState<'analytics' | 'history' | 'suggestions'>('analytics');

  // State
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewCards | null>(null);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [patterns, setPatterns] = useState<PotentialImprovement[]>([]);
  
  // Feedback History state
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [accessibleExams, setAccessibleExams] = useState<Array<{ _id: string; title: string }>>([]);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([]);
  const [suggestionsTotal, setSuggestionsTotal] = useState(0);
  const [suggestionsStatusFilter, setSuggestionsStatusFilter] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [evidenceModalData, setEvidenceModalData] = useState<{
    suggestion: ImprovementSuggestion | null;
    comparison: any;
    evidence: EvidenceItem[];
    evidenceCount?: number;
  } | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  // New suggestion form state
  const [createExamId, setCreateExamId] = useState('');
  const [createQNum, setCreateQNum] = useState('');
  const [createType, setCreateType] = useState<'reference_answer' | 'rubric' | 'evaluation_rule'>('reference_answer');
  const [createSuggestedAns, setCreateSuggestedAns] = useState('');
  const [createJustification, setCreateJustification] = useState('');
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);

  // Review modal state
  const [reviewModalSuggestion, setReviewModalSuggestion] = useState<ImprovementSuggestion | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchAccessibleExams();
    fetchAnalytics();
    fetchFeedbackHistory();
    fetchSuggestions();
  }, []);

  const fetchAccessibleExams = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/analytics/exams', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.data) {
        setAccessibleExams(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch accessible exams', err);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/improvements/analytics${selectedExamId ? `?examId=${selectedExamId}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.data) {
        setOverview(res.data.data.overviewCards);
        setCategories(res.data.data.categoryCounts || []);
        setPatterns(res.data.data.potentialImprovements || []);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load AI improvement analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedbackHistory = async (page = 1) => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (selectedExamId) params.append('examId', selectedExamId);
      if (selectedReason) params.append('feedbackType', selectedReason);

      const res = await axios.get(`/api/feedback?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.data) {
        setFeedbackList(res.data.data);
        setFeedbackTotal(res.data.meta?.total || 0);
        setFeedbackPage(page);
      }
    } catch (err: any) {
      console.error('Failed to load feedback history', err);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (selectedExamId) params.append('examId', selectedExamId);
      if (suggestionsStatusFilter) params.append('status', suggestionsStatusFilter);

      const res = await axios.get(`/api/improvements/suggestions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.data) {
        setSuggestions(res.data.data);
        setSuggestionsTotal(res.data.meta?.total || 0);
      }
    } catch (err: any) {
      console.error('Failed to load suggestions', err);
    }
  };

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const token = localStorage.getItem('token');
    const url = `/api/feedback/export/${format}?token=${token}`;
    window.open(url, '_blank');
  };

  const handleOpenCreateSuggestion = (pattern?: PotentialImprovement) => {
    if (pattern) {
      setCreateExamId(pattern.examId);
      setCreateQNum(pattern.questionNumber);
      setCreateJustification(`Suggested based on ${pattern.totalCorrections} repeated faculty corrections (Top reason: ${pattern.topReason}).`);
    } else {
      setCreateExamId(accessibleExams[0]?._id || '');
      setCreateQNum('1');
      setCreateJustification('');
    }
    setCreateType('reference_answer');
    setCreateSuggestedAns('');
    setIsCreateModalOpen(true);
  };

  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createExamId || !createQNum || !createJustification) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmittingSuggestion(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        '/api/improvements/suggestions',
        {
          examId: createExamId,
          questionNumber: createQNum,
          type: createType,
          suggestedModelAnswer: createSuggestedAns,
          justification: createJustification,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Improvement suggestion submitted successfully (Status: Pending)');
      setIsCreateModalOpen(false);
      fetchSuggestions();
      fetchAnalytics();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit suggestion');
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  const handleViewEvidence = async (suggestion: ImprovementSuggestion) => {
    setLoadingEvidence(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/improvements/suggestions/${suggestion._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.data) {
        setEvidenceModalData(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load evidence');
    } finally {
      setLoadingEvidence(false);
    }
  };

  const handleOpenReviewModal = (suggestion: ImprovementSuggestion, action: 'approve' | 'reject') => {
    setReviewModalSuggestion(suggestion);
    setReviewAction(action);
    setReviewComment('');
  };

  const handleSubmitReview = async () => {
    if (!reviewModalSuggestion) return;
    setSubmittingReview(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `/api/improvements/suggestions/${reviewModalSuggestion._id}/review`,
        {
          action: reviewAction,
          reviewComment,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(res.data?.message || `Suggestion ${reviewAction}d successfully`);
      setReviewModalSuggestion(null);
      fetchSuggestions();
      fetchAnalytics();
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to ${reviewAction} suggestion`);
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left pb-12 animate-fade-in">
      <ToastContainer />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">auto_fix_high</span>
            <h1 className="text-2xl font-black text-on-surface font-display">
              AI Evaluation Improvement & Feedback Learning
            </h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            System learns from faculty overrides to identify patterns, generate suggestions, and version evaluation configs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenCreateSuggestion()}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-sm hover:bg-primary/95 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">add_comment</span>
            Create Improvement Suggestion
          </button>
        </div>
      </div>

      {/* Exam Filter Dropdown */}
      <div className="flex items-center gap-3 bg-surface-container p-3 rounded-2xl border border-outline-variant/30">
        <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-primary">filter_alt</span>
          Filter Exam Scope:
        </span>
        <select
          value={selectedExamId}
          onChange={(e) => {
            setSelectedExamId(e.target.value);
            fetchAnalytics();
            fetchFeedbackHistory(1);
            fetchSuggestions();
          }}
          className="px-3 py-1.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container-high text-xs text-on-surface font-bold focus:outline-none focus:border-primary min-w-[240px]"
        >
          <option value="">All Accessible Exams</option>
          {accessibleExams.map((ex) => (
            <option key={ex._id} value={ex._id}>
              {ex.title}
            </option>
          ))}
        </select>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="glass-card p-4 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Overrides</span>
            <span className="text-2xl font-black text-on-surface mt-1">{overview.totalOverrides}</span>
            <span className="text-[10px] text-outline mt-1">Override Rate: {overview.overrideRate}%</span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-green-200/60 bg-green-50/40 dark:bg-green-950/20 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-green-700 dark:text-green-300 uppercase tracking-wider">Marks Increased</span>
            <span className="text-2xl font-black text-green-700 dark:text-green-300 mt-1">+{overview.marksIncreased}</span>
            <span className="text-[10px] text-green-600/80 mt-1">Faculty upgraded score</span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-red-200/60 bg-red-50/40 dark:bg-red-950/20 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">Marks Decreased</span>
            <span className="text-2xl font-black text-red-700 dark:text-red-300 mt-1">-{overview.marksDecreased}</span>
            <span className="text-[10px] text-red-600/80 mt-1">Faculty downgraded score</span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Suggestions</span>
            <span className="text-2xl font-black text-primary mt-1">{overview.totalSuggestions}</span>
            <span className="text-[10px] text-outline mt-1">Total Improvement Ideas</span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">Pending Approval</span>
            <span className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">{overview.pendingSuggestions}</span>
            <span className="text-[10px] text-amber-600/80 mt-1">Requires Admin/Faculty Review</span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-blue-200/60 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Approved / Active</span>
            <span className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">{overview.approvedSuggestions}</span>
            <span className="text-[10px] text-blue-600/80 mt-1">Upgraded to New Version</span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-outline-variant/30">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-5 py-2.5 font-bold text-xs transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'analytics'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-sm">insights</span>
          Pattern Analysis & AI Feedback Insights
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-2.5 font-bold text-xs transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-sm">history</span>
          Faculty Override Feedback History ({feedbackTotal})
        </button>

        <button
          onClick={() => setActiveTab('suggestions')}
          className={`px-5 py-2.5 font-bold text-xs transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'suggestions'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-sm">lightbulb</span>
          Improvement Suggestions & Versioning ({suggestionsTotal})
        </button>
      </div>

      {/* Tab 1: Pattern Analysis & AI Feedback Insights */}
      {activeTab === 'analytics' && (
        <div className="flex flex-col gap-6">
          {/* Category Breakdown & OCR Issue Detection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feedback Categories */}
            <div className="p-5 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container shadow-sm flex flex-col gap-3">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary">pie_chart</span>
                Faculty Override Feedback Categories
              </h3>

              {categories.length === 0 ? (
                <p className="text-xs text-outline py-6 text-center">No faculty feedback recorded yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {categories.map((cat) => (
                    <div key={cat.type} className="flex items-center justify-between text-xs p-2 rounded-xl bg-surface-container-low">
                      <span className="font-semibold text-on-surface">{cat.name}</span>
                      <span className="font-black px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px]">
                        {cat.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Review Priority Guidance */}
            <div className="p-5 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container shadow-sm flex flex-col gap-3">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-amber-500">smart_toy</span>
                Human-in-the-Loop Review Priority & Strategy
              </h3>

              <div className="text-xs text-on-surface-variant space-y-2 leading-relaxed">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-on-surface">
                  <span className="font-bold text-amber-700 dark:text-amber-300 block mb-0.5">High Review Priority Guidelines:</span>
                  Questions combining low AI confidence (&lt; 70%) and repeated faculty mark overrides automatically trigger a high priority badge for human review.
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-on-surface">
                  <span className="font-bold text-blue-700 dark:text-blue-300 block mb-0.5">No Automatic Mark Correction:</span>
                  Finalized exam marks are never altered automatically. All reference answer upgrades require human admin/faculty review and version approval.
                </div>
              </div>
            </div>
          </div>

          {/* Potential Improvement Patterns */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-black text-on-surface font-display flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">travel_explore</span>
              Identified Potential Improvement Areas
            </h3>

            {patterns.length === 0 ? (
              <div className="p-8 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container text-center text-xs text-outline">
                No repeated correction patterns detected yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patterns.map((p, idx) => (
                  <div key={idx} className="p-5 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container shadow-sm flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-xs text-primary uppercase tracking-wider">
                          {p.examTitle} — Q{p.questionNumber}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          p.reviewPriority === 'High'
                            ? 'bg-red-100 text-red-700 border-red-300'
                            : 'bg-amber-100 text-amber-700 border-amber-300'
                        }`}>
                          {p.reviewPriority} Priority
                        </span>
                      </div>

                      <p className="text-xs text-on-surface font-semibold mb-2">
                        {p.recommendation}
                      </p>

                      <div className="flex flex-wrap gap-2 text-[11px] text-outline mb-3">
                        <span className="bg-surface-container-high px-2 py-1 rounded-md">Total Corrections: {p.totalCorrections}</span>
                        <span className="bg-surface-container-high px-2 py-1 rounded-md">Top Reason: {p.topReason} ({p.topReasonCount})</span>
                        {p.ocrCorrections > 0 && (
                          <span className="bg-amber-500/10 text-amber-700 px-2 py-1 rounded-md">OCR Corrections: {p.ocrCorrections}</span>
                        )}
                      </div>

                      {p.sampleComments.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-surface-container-low text-[11px] text-on-surface-variant italic border border-outline-variant/20">
                          "{p.sampleComments[0]}"
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleOpenCreateSuggestion(p)}
                      className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">edit_note</span>
                      Create Improvement Suggestion
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Faculty Override Feedback History */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-4">
          {/* Controls & Export Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container p-3 rounded-2xl border border-outline-variant/30">
            <div className="flex items-center gap-2">
              <select
                value={selectedReason}
                onChange={(e) => {
                  setSelectedReason(e.target.value);
                  fetchFeedbackHistory(1);
                }}
                className="px-3 py-1.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container-high text-xs text-on-surface font-bold focus:outline-none"
              >
                <option value="">All Feedback Types</option>
                <option value="alternative_answer">Valid Alternative Answer</option>
                <option value="mark_correction">AI Underestimated / Mark Correction</option>
                <option value="rubric_issue">Rubric Issue</option>
                <option value="OCR_issue">OCR Issue</option>
                <option value="reference_answer_issue">Reference Answer Issue</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-outline">Export Feedback Report:</span>
              <button
                onClick={() => handleExport('csv')}
                className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-bold text-xs transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm text-green-600">csv</span> CSV
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-bold text-xs transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm text-blue-600">table_chart</span> Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-bold text-xs transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm text-red-600">picture_as_pdf</span> HTML/PDF
              </button>
            </div>
          </div>

          {/* Table */}
          {feedbackList.length === 0 ? (
            <div className="p-12 text-center text-xs text-outline glass-card rounded-2xl">
              No faculty override feedback recorded yet.
            </div>
          ) : (
            <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden bg-white dark:bg-surface-container shadow-sm">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                      <th className="px-5 py-3.5">Exam</th>
                      <th className="px-5 py-3.5">Question</th>
                      <th className="px-5 py-3.5">AI Marks</th>
                      <th className="px-5 py-3.5">Final Marks</th>
                      <th className="px-5 py-3.5">Difference</th>
                      <th className="px-5 py-3.5">Override Reason</th>
                      <th className="px-5 py-3.5">Faculty Comment</th>
                      <th className="px-5 py-3.5">Faculty</th>
                      <th className="px-5 py-3.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {feedbackList.map((f) => (
                      <tr key={f._id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-on-surface">{f.examId?.title || 'Exam'}</td>
                        <td className="px-5 py-3.5 font-extrabold text-primary">Q{f.questionNumber}</td>
                        <td className="px-5 py-3.5 font-bold">{f.aiMarks}</td>
                        <td className="px-5 py-3.5 font-bold">{f.finalMarks}</td>
                        <td className="px-5 py-3.5 font-extrabold">
                          <span className={f.difference >= 0 ? 'text-green-600' : 'text-red-500'}>
                            {f.difference >= 0 ? `+${f.difference}` : f.difference}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-on-surface">{f.reason}</td>
                        <td className="px-5 py-3.5 text-on-surface-variant max-w-xs truncate">
                          {f.comment || '-'}
                        </td>
                        <td className="px-5 py-3.5 font-medium">{f.createdBy?.name || 'Faculty'}</td>
                        <td className="px-5 py-3.5 text-outline text-[11px]">
                          {new Date(f.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Improvement Suggestions & Versioning */}
      {activeTab === 'suggestions' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-on-surface font-display">
              AI Improvement Suggestions Workflow
            </h3>

            <div className="flex items-center gap-2">
              <select
                value={suggestionsStatusFilter}
                onChange={(e) => {
                  setSuggestionsStatusFilter(e.target.value);
                  fetchSuggestions();
                }}
                className="px-3 py-1.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-xs text-on-surface font-bold focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {suggestions.length === 0 ? (
            <div className="p-12 text-center text-xs text-outline glass-card rounded-2xl">
              No improvement suggestions recorded yet. Click "Create Improvement Suggestion" to propose a reference answer or rubric update.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((s) => (
                <div key={s._id} className="p-5 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container shadow-sm flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs text-primary uppercase tracking-wider">
                        {s.examId?.title || 'Exam'} — Q{s.questionNumber} ({s.type.replace('_', ' ')})
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          s.status === 'Approved'
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : s.status === 'Rejected'
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>

                    <p className="text-xs text-on-surface font-bold mb-2">
                      Justification: "{s.justification}"
                    </p>

                    <div className="text-[11px] text-outline mb-2">
                      Current Version: v{s.currentVersion} {s.createdVersion ? `→ Created Active Version: v${s.createdVersion}` : ''}
                    </div>

                    {s.suggestedModelAnswer && (
                      <div className="p-2.5 rounded-xl bg-surface-container-low text-[11px] text-on-surface leading-relaxed border border-outline-variant/20 max-h-24 overflow-y-auto">
                        <span className="font-bold text-primary block mb-0.5">Proposed Reference Addition:</span>
                        "{s.suggestedModelAnswer}"
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20">
                    <button
                      onClick={() => handleViewEvidence(s)}
                      className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">find_in_page</span>
                      View Evidence & Compare
                    </button>

                    {s.status === 'Pending' && (user?.role === 'admin' || user?.role === 'faculty') && (
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => handleOpenReviewModal(s, 'approve')}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <span className="material-symbols-outlined text-sm">check</span>
                          Approve
                        </button>
                        <button
                          onClick={() => handleOpenReviewModal(s, 'reject')}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Create Improvement Suggestion */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-container max-w-xl w-full rounded-3xl border border-outline-variant/40 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 className="text-lg font-black text-on-surface font-display flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">edit_note</span>
                Create AI Improvement Suggestion
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-outline hover:text-on-surface p-1 rounded-full"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitSuggestion} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="font-bold text-on-surface block mb-1">Target Exam:</label>
                <select
                  value={createExamId}
                  onChange={(e) => setCreateExamId(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant/60 rounded-xl bg-surface-container text-on-surface font-bold focus:outline-none"
                  required
                >
                  {accessibleExams.map((ex) => (
                    <option key={ex._id} value={ex._id}>
                      {ex.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-on-surface block mb-1">Question Code / Number:</label>
                  <input
                    type="text"
                    value={createQNum}
                    onChange={(e) => setCreateQNum(e.target.value)}
                    placeholder="e.g. 1 or Q3"
                    className="w-full px-3 py-2 border border-outline-variant/60 rounded-xl bg-surface-container text-on-surface font-bold focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-on-surface block mb-1">Suggestion Type:</label>
                  <select
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-outline-variant/60 rounded-xl bg-surface-container text-on-surface font-bold focus:outline-none"
                  >
                    <option value="reference_answer">Reference Answer Update</option>
                    <option value="rubric">Rubric Item Update</option>
                    <option value="evaluation_rule">Evaluation Logic Rule</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-on-surface block mb-1">
                  Suggested Content Addition / Update:
                </label>
                <textarea
                  rows={4}
                  value={createSuggestedAns}
                  onChange={(e) => setCreateSuggestedAns(e.target.value)}
                  placeholder="Provide alternative explanation, missing key concept, or refined wording for reference answer..."
                  className="w-full p-2.5 border border-outline-variant/60 rounded-xl bg-surface-container text-on-surface font-mono leading-relaxed focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-on-surface block mb-1">Academic Justification:</label>
                <textarea
                  rows={2}
                  value={createJustification}
                  onChange={(e) => setCreateJustification(e.target.value)}
                  placeholder="Explain why this suggestion is valid based on student performance evidence..."
                  className="w-full p-2 border border-outline-variant/60 rounded-xl bg-surface-container text-on-surface focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-surface-container-high text-on-surface font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSuggestion}
                  className="px-5 py-2 bg-primary text-on-primary font-bold rounded-xl shadow-sm hover:bg-primary/95 flex items-center gap-1.5"
                >
                  {submittingSuggestion ? <LoadingSpinner size="sm" /> : 'Submit Suggestion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Evidence & Comparison View */}
      {evidenceModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-surface-container max-w-4xl w-full rounded-3xl border border-outline-variant/40 shadow-2xl p-6 flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div>
                <h3 className="text-lg font-black text-on-surface font-display">
                  Suggestion Evidence & Side-by-Side Comparison — Q{evidenceModalData.suggestion?.questionNumber}
                </h3>
                <p className="text-xs text-outline">
                  Exam: {evidenceModalData.suggestion?.examId?.title} | Status: {evidenceModalData.suggestion?.status}
                </p>
              </div>
              <button
                onClick={() => setEvidenceModalData(null)}
                className="text-outline hover:text-on-surface p-1 rounded-full"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Comparison view */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low flex flex-col gap-2">
                <h4 className="font-extrabold text-outline uppercase tracking-wider">
                  Current Version (v{evidenceModalData.comparison.currentVersion})
                </h4>
                <div className="p-3 rounded-xl bg-white dark:bg-surface-container font-mono text-on-surface leading-relaxed border border-outline-variant/20">
                  {evidenceModalData.comparison.currentModelAnswer || '[Default model answer]'}
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-primary/40 bg-primary/5 flex flex-col gap-2">
                <h4 className="font-extrabold text-primary uppercase tracking-wider">
                  Faculty Proposed Addition / Update
                </h4>
                <div className="p-3 rounded-xl bg-white dark:bg-surface-container font-mono text-on-surface leading-relaxed border border-primary/20">
                  {evidenceModalData.comparison.suggestedModelAnswer || '[No text change]'}
                </div>
              </div>
            </div>

            {/* Evidence Table */}
            <div className="flex flex-col gap-2">
              <h4 className="font-bold text-xs text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary">verified_user</span>
                Faculty Override Evidence Records ({evidenceModalData.evidenceCount ?? evidenceModalData.evidence.length})
              </h4>

              {evidenceModalData.evidence.length === 0 ? (
                <p className="text-xs text-outline italic">No explicit override evidence attached.</p>
              ) : (
                <div className="border border-outline-variant/30 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container text-on-surface-variant font-semibold text-[10px] uppercase border-b border-outline-variant/20">
                        <th className="px-4 py-2.5">Evaluation Code</th>
                        <th className="px-4 py-2.5">AI Marks</th>
                        <th className="px-4 py-2.5">Faculty Marks</th>
                        <th className="px-4 py-2.5">Difference</th>
                        <th className="px-4 py-2.5">Reason</th>
                        <th className="px-4 py-2.5">Faculty Comment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {evidenceModalData.evidence.map((ev, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2.5 font-bold font-mono">{ev.anonymizedEvaluationId}</td>
                          <td className="px-4 py-2.5 font-bold">{ev.aiMarks}</td>
                          <td className="px-4 py-2.5 font-bold">{ev.finalMarks}</td>
                          <td className="px-4 py-2.5 font-extrabold text-green-600">{ev.difference}</td>
                          <td className="px-4 py-2.5">{ev.reason}</td>
                          <td className="px-4 py-2.5 italic text-on-surface-variant">{ev.comment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end border-t border-outline-variant/20 pt-3">
              <button
                onClick={() => setEvidenceModalData(null)}
                className="px-5 py-2 bg-primary text-on-primary font-bold text-xs rounded-xl"
              >
                Close Evidence View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Approve / Reject Review Modal */}
      {reviewModalSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-container max-w-md w-full rounded-3xl border border-outline-variant/40 shadow-2xl p-6 flex flex-col gap-4">
            <h3 className="text-lg font-black text-on-surface font-display flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">gavel</span>
              {reviewAction === 'approve' ? 'Approve Suggestion & Version Config' : 'Reject Suggestion'}
            </h3>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              {reviewAction === 'approve'
                ? `Approving will upgrade Question Q${reviewModalSuggestion.questionNumber} to Version ${reviewModalSuggestion.currentVersion + 1} and set it Active for future evaluations. Previously finalized evaluations will remain unchanged.`
                : `Rejecting will maintain Version ${reviewModalSuggestion.currentVersion} as Active without modifying evaluation config.`}
            </p>

            <div className="text-xs">
              <label className="font-bold text-on-surface block mb-1">Review Comment / Audit Log Reason:</label>
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Enter justification for audit log..."
                className="w-full p-2.5 border border-outline-variant/60 rounded-xl bg-surface-container text-on-surface focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
              <button
                onClick={() => setReviewModalSuggestion(null)}
                className="px-4 py-2 bg-surface-container-high text-on-surface font-bold text-xs rounded-xl"
              >
                Cancel
              </button>

              <button
                disabled={submittingReview}
                onClick={handleSubmitReview}
                className={`px-5 py-2 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 ${
                  reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submittingReview ? <LoadingSpinner size="sm" /> : reviewAction === 'approve' ? 'Approve & Activate Version' : 'Reject Suggestion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIImprovementDashboard;
