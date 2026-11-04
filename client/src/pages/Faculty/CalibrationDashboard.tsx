import React, { useEffect, useState } from 'react';
import {
  calibrationService,
  CalibrationSummary,
  QuestionCalibrationItem,
  ConfidenceVsCorrectionItem,
  ReferenceEffectAnalysis,
  CalibrationInsights,
  LearningFeedbackItem,
} from '../../services/calibration.service';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

export const CalibrationDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'confidence' | 'dataset'>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Calibration state data
  const [summary, setSummary] = useState<CalibrationSummary | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionCalibrationItem[]>([]);
  const [confidenceStats, setConfidenceStats] = useState<{ hasData: boolean; message?: string; ranges: ConfidenceVsCorrectionItem[] }>({
    hasData: false,
    ranges: [],
  });
  const [referenceImpact, setReferenceImpact] = useState<ReferenceEffectAnalysis | null>(null);
  const [insightsData, setInsightsData] = useState<CalibrationInsights | null>(null);

  // Learning Dataset Pagination & Filter state
  const [feedbackDataset, setFeedbackDataset] = useState<LearningFeedbackItem[]>([]);
  const [datasetTotal, setDatasetTotal] = useState<number>(0);
  const [datasetPage, setDatasetPage] = useState<number>(1);
  const [datasetTotalPages, setDatasetTotalPages] = useState<number>(1);
  const [approvedFilter, setApprovedFilter] = useState<string>('all'); // 'all', 'approved', 'unapproved'
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Selected feedback record for review detail modal
  const [selectedRecord, setSelectedRecord] = useState<LearningFeedbackItem | null>(null);

  useEffect(() => {
    fetchAllCalibrationData();
  }, []);

  useEffect(() => {
    fetchLearningDataset(datasetPage, approvedFilter);
  }, [datasetPage, approvedFilter]);

  const fetchAllCalibrationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, qRes, confRes, refRes, insRes] = await Promise.all([
        calibrationService.getSummary(),
        calibrationService.getByQuestion(),
        calibrationService.getByConfidence(),
        calibrationService.getReferenceImpact(),
        calibrationService.getInsights(),
      ]);

      setSummary(sumRes);
      setQuestionStats(qRes.questions || []);
      setConfidenceStats(confRes);
      setReferenceImpact(refRes);
      setInsightsData(insRes);
    } catch (err: any) {
      console.error('Failed to load calibration analytics:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load calibration analytics.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLearningDataset = async (page: number, filter: string) => {
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (filter === 'approved') params.approvedForLearning = 'true';
      if (filter === 'unapproved') params.approvedForLearning = 'false';

      const res = await calibrationService.getLearningFeedback(params);
      setFeedbackDataset(res.items || []);
      setDatasetTotal(res.total || 0);
      setDatasetPage(res.page || 1);
      setDatasetTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load learning feedback dataset:', err);
    }
  };

  const handleToggleApproval = async (item: LearningFeedbackItem) => {
    setUpdatingId(item._id);
    try {
      const updated = await calibrationService.updateLearningApproval(item._id, !item.approvedForLearning);
      setFeedbackDataset((prev) =>
        prev.map((i) => (i._id === item._id ? { ...i, approvedForLearning: updated.approvedForLearning } : i))
      );
      if (selectedRecord && selectedRecord._id === item._id) {
        setSelectedRecord({ ...selectedRecord, approvedForLearning: updated.approvedForLearning });
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update approval status.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="py-24" />;
  }

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-on-surface font-display">Faculty Review Calibration & Learning</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold uppercase tracking-wider border border-primary/20">
              Phase 7C
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            Descriptive analytics on AI-vs-Faculty mark differences, prompt calibration suggestions, and controlled learning datasets.
          </p>
        </div>

        <button
          onClick={fetchAllCalibrationData}
          className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start md:self-auto border border-outline-variant/40 shadow-sm"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Refresh Calibration
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Summary Analytics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="glass-card p-4 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">Total Reviewed</span>
          <span className="text-2xl font-black text-on-surface font-display mt-2">{summary?.totalReviewed || 0}</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">Approved AI</span>
          <span className="text-2xl font-black text-green-600 font-display mt-2">{summary?.approvedCount || 0}</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">Modified Marks</span>
          <span className="text-2xl font-black text-amber-600 font-display mt-2">{summary?.modifiedCount || 0}</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">Avg AI Marks</span>
          <span className="text-2xl font-black text-primary font-display mt-2">{summary?.averageAiMarks || 0}</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">Avg Faculty Marks</span>
          <span className="text-2xl font-black text-indigo-600 font-display mt-2">{summary?.averageFacultyMarks || 0}</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col justify-between shadow-sm">
          <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">Modification Rate</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-black text-on-surface font-display">{summary?.modificationRate || 0}%</span>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-outline-variant/20 overflow-x-auto pb-1 custom-scrollbar">
        {[
          { id: 'overview', label: 'Calibration Overview & Insights', icon: 'insights' },
          { id: 'questions', label: 'Question-Level Calibration', icon: 'format_list_bulleted' },
          { id: 'confidence', label: 'Confidence vs Correction', icon: 'analytics' },
          { id: 'dataset', label: 'Learning Feedback Dataset', icon: 'dataset' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 font-bold text-xs rounded-t-2xl transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/40'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & INSIGHTS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Factual Data Insights Card */}
          <div className="glass-card p-6 rounded-3xl border border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary text-xl">psychology</span>
                <h3 className="text-base font-black text-on-surface font-display">Data-Driven Calibration Insights</h3>
              </div>
              <p className="text-xs text-on-surface-variant mb-4">
                Descriptive observations automatically generated from real faculty override records.
              </p>

              {insightsData?.insights && insightsData.insights.length > 0 ? (
                <div className="space-y-3">
                  {insightsData.insights.map((ins, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-surface-container/60 border border-outline-variant/20 text-xs font-semibold text-on-surface flex items-start gap-2.5"
                    >
                      <span className="material-symbols-outlined text-primary text-sm mt-0.5 select-none">check_circle</span>
                      <span>{ins}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-outline italic">No calibration insights recorded yet.</p>
              )}
            </div>

            {/* Prompt Calibration Recommendations */}
            <div className="mt-6 pt-6 border-t border-outline-variant/20">
              <h4 className="text-xs font-extrabold text-on-surface uppercase tracking-wider mb-3">
                Prompt Calibration Recommendations
              </h4>
              {insightsData?.recommendations && insightsData.recommendations.length > 0 ? (
                <div className="space-y-2">
                  {insightsData.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs font-medium flex items-start gap-2"
                    >
                      <span className="material-symbols-outlined text-amber-600 text-sm mt-0.5">lightbulb</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-outline italic">No recurring calibration recommendations at this time.</p>
              )}
            </div>
          </div>

          {/* Reference Effect Analysis Card */}
          <div className="glass-card p-6 rounded-3xl border border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-indigo-500 text-xl">auto_stories</span>
                <h3 className="text-base font-black text-on-surface font-display">Reference Answer Impact</h3>
              </div>
              <p className="text-xs text-on-surface-variant mb-6">
                Observed Faculty modification rate comparing reference-assisted vs standard AI evaluations.
              </p>

              {referenceImpact?.hasData ? (
                <div className="space-y-6">
                  {/* Reference Used */}
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs text-indigo-900 dark:text-indigo-200">
                        Reference Sheet Used
                      </span>
                      <span className="text-xs font-black text-indigo-600">
                        {referenceImpact.referenceUsed.modificationRate}% Modified
                      </span>
                    </div>
                    <div className="w-full bg-indigo-200/50 dark:bg-indigo-900/50 rounded-full h-2 overflow-hidden mb-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${referenceImpact.referenceUsed.modificationRate}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold">
                      <span>{referenceImpact.referenceUsed.reviewed} Reviewed</span>
                      <span>{referenceImpact.referenceUsed.modified} Overridden</span>
                    </div>
                  </div>

                  {/* Reference Not Used */}
                  <div className="p-4 rounded-2xl bg-surface-container/60 border border-outline-variant/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs text-on-surface">Standard Evaluation (No Reference)</span>
                      <span className="text-xs font-black text-on-surface-variant">
                        {referenceImpact.referenceNotUsed.modificationRate}% Modified
                      </span>
                    </div>
                    <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden mb-2">
                      <div
                        className="bg-outline-variant h-2 rounded-full transition-all duration-500"
                        style={{ width: `${referenceImpact.referenceNotUsed.modificationRate}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-semibold">
                      <span>{referenceImpact.referenceNotUsed.reviewed} Reviewed</span>
                      <span>{referenceImpact.referenceNotUsed.modified} Overridden</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-outline italic py-8 text-center">
                  {referenceImpact?.message || 'Insufficient data for reference impact analysis.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUESTION-LEVEL CALIBRATION */}
      {activeTab === 'questions' && (
        <div className="glass-card rounded-3xl border border-outline-variant/30 overflow-hidden bg-white dark:bg-surface-container shadow-sm">
          <div className="p-6 border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-on-surface font-display">Question-Level Calibration Metrics</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Detailed comparison of AI marks vs Faculty final marks grouped by exam question.
              </p>
            </div>
          </div>

          {questionStats.length === 0 ? (
            <EmptyState
              title="No question calibration data"
              description="Question-level statistics will populate as Faculty reviews and accepts or modifies marks."
            />
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                    <th className="px-6 py-4">Exam / Question</th>
                    <th className="px-6 py-4">Total Reviews</th>
                    <th className="px-6 py-4">Avg AI Marks</th>
                    <th className="px-6 py-4">Avg Faculty Marks</th>
                    <th className="px-6 py-4">Avg Difference</th>
                    <th className="px-6 py-4 text-right">Modification Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-xs text-on-surface-variant">
                  {questionStats.map((q, idx) => (
                    <tr key={idx} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-on-surface text-sm block">Question {q.questionNumber}</span>
                        <span className="text-[11px] text-outline">{q.examTitle}</span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-bold text-on-surface">{q.totalReviews}</span>
                        <span className="text-[10px] text-outline block">
                          ({q.approvedCount} approved, {q.modifiedCount} modified)
                        </span>
                      </td>

                      <td className="px-6 py-4 font-extrabold text-primary">{q.aiAverageMarks}</td>
                      <td className="px-6 py-4 font-extrabold text-indigo-600">{q.facultyAverageMarks}</td>

                      <td className="px-6 py-4">
                        <span
                          className={`font-extrabold ${
                            q.averageDifference > 0
                              ? 'text-green-600'
                              : q.averageDifference < 0
                              ? 'text-amber-600'
                              : 'text-on-surface-variant'
                          }`}
                        >
                          {q.averageDifference > 0 ? `+${q.averageDifference}` : q.averageDifference}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-surface-container-high border border-outline-variant/30 text-on-surface">
                          {q.modificationRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONFIDENCE VS CORRECTION */}
      {activeTab === 'confidence' && (
        <div className="glass-card rounded-3xl border border-outline-variant/30 p-6 bg-white dark:bg-surface-container shadow-sm flex flex-col gap-6">
          <div>
            <h3 className="text-base font-black text-on-surface font-display">AI Confidence vs Modification Analysis</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Tracks how AI confidence levels correlate with Faculty override rates.
            </p>
          </div>

          {!confidenceStats.hasData ? (
            <div className="p-12 text-center bg-surface-container/40 rounded-2xl border border-outline-variant/30">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">analytics</span>
              <p className="text-sm font-bold text-on-surface">{confidenceStats.message || 'Insufficient review data.'}</p>
              <p className="text-xs text-on-surface-variant mt-1">
                At least 3 reviewed evaluations are required to render confidence distribution curves.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {confidenceStats.ranges.map((r, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-surface-container/60 border border-outline-variant/30 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-primary">{r.confidenceRange}</span>
                    <span className="text-[10px] font-bold text-outline uppercase">Confidence</span>
                  </div>
                  <div className="my-3">
                    <span className="text-2xl font-black text-on-surface font-display">{r.modificationRate}%</span>
                    <span className="text-[11px] text-outline block mt-0.5">Modification Rate</span>
                  </div>
                  <div className="text-[11px] font-semibold text-on-surface-variant pt-2 border-t border-outline-variant/20 flex justify-between">
                    <span>{r.reviews} Reviews</span>
                    <span>{r.modified} Modified</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LEARNING FEEDBACK DATASET */}
      {activeTab === 'dataset' && (
        <div className="glass-card rounded-3xl border border-outline-variant/30 overflow-hidden bg-white dark:bg-surface-container shadow-sm flex flex-col">
          {/* Filter Header */}
          <div className="p-6 border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-on-surface font-display">Approved Learning Feedback Dataset</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Curated dataset of faculty feedback for future model/prompt calibration without automatic retraining.
              </p>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center gap-1.5 bg-surface-container-high p-1 rounded-2xl border border-outline-variant/30 self-start sm:self-auto">
              {[
                { id: 'all', label: 'All Feedback' },
                { id: 'approved', label: 'Approved Only' },
                { id: 'unapproved', label: 'Unapproved' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setApprovedFilter(f.id);
                    setDatasetPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    approvedFilter === f.id
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Table */}
          {feedbackDataset.length === 0 ? (
            <EmptyState
              title="No feedback records found"
              description="Feedback items recorded during Faculty review will appear here for controlled dataset management."
            />
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                    <th className="px-6 py-4">Question</th>
                    <th className="px-6 py-4">Marks (AI vs Faculty)</th>
                    <th className="px-6 py-4">Category & Reason</th>
                    <th className="px-6 py-4">Reference Used</th>
                    <th className="px-6 py-4">Approved for Learning</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-xs text-on-surface-variant">
                  {feedbackDataset.map((item) => {
                    const diff = item.difference !== undefined ? item.difference : (item.finalMarks - item.aiMarks);
                    const isApprovedForLearning = item.approvedForLearning;

                    return (
                      <tr key={item._id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-extrabold text-on-surface text-sm block">Q{item.questionNumber}</span>
                          <span className="text-[11px] text-outline">
                            {item.examId?.title || 'Exam'}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-on-surface">
                              AI: {item.aiMarks} → Final: {item.finalMarks}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                diff === 0
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="font-bold text-on-surface block">{item.reviewCategory || item.reason}</span>
                          {item.comment && (
                            <span className="text-[11px] text-outline block line-clamp-1">{item.comment}</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {item.referenceUsed ? (
                            <span className="inline-flex items-center gap-1 text-indigo-600 font-bold text-[11px]">
                              <span className="material-symbols-outlined text-sm">menu_book</span> Yes
                            </span>
                          ) : (
                            <span className="text-outline text-[11px]">No</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              isApprovedForLearning
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-surface-container-high text-on-surface-variant border-outline-variant/40'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isApprovedForLearning ? 'bg-green-500' : 'bg-outline'
                              }`}
                            />
                            {isApprovedForLearning ? 'Approved' : 'Not Approved'}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            disabled={updatingId === item._id}
                            onClick={() => handleToggleApproval(item)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 ml-auto shadow-sm ${
                              isApprovedForLearning
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-primary text-on-primary hover:bg-primary/95'
                            }`}
                          >
                            {updatingId === item._id ? (
                              <LoadingSpinner size="sm" />
                            ) : isApprovedForLearning ? (
                              'Unapprove'
                            ) : (
                              'Approve for Learning'
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {datasetTotalPages > 1 && (
            <div className="p-4 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant bg-surface-container/30">
              <span>
                Showing page {datasetPage} of {datasetTotalPages} ({datasetTotal} total items)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={datasetPage <= 1}
                  onClick={() => setDatasetPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-surface-container-high text-on-surface rounded-xl font-bold disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={datasetPage >= datasetTotalPages}
                  onClick={() => setDatasetPage((p) => p + 1)}
                  className="px-3 py-1.5 bg-surface-container-high text-on-surface rounded-xl font-bold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CalibrationDashboard;
