import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { resultsService, ResultSummary, ExamAnalytics } from '../../services/results.service';
import { examService, Exam } from '../../services/exam.service';

export const ResultsDashboard: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const { addToast } = useNotifications();

  const [exam, setExam] = useState<Exam | null>(null);
  const [analytics, setAnalytics] = useState<ExamAnalytics | null>(null);
  const [results, setResults] = useState<ResultSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters, Sorting & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  const fetchExamAndAnalytics = async () => {
    if (!examId) return;
    try {
      const examData = await examService.getExamById(examId);
      setExam(examData);

      const analyticsData = await resultsService.getExamAnalytics(examId);
      setAnalytics(analyticsData);
    } catch (err: any) {
      console.error('Error loading data:', err);
      addToast(err.response?.data?.message || 'Failed to retrieve analytics data.', 'error');
    }
  };

  const fetchResults = async () => {
    if (!examId) return;
    try {
      const query = {
        page,
        limit,
        search,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        sortBy,
        order
      };
      const res = await resultsService.getExamResults(examId, query);
      setResults(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      console.error('Error fetching results:', err);
      addToast('Failed to load exam results table.', 'error');
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchExamAndAnalytics();
      await fetchResults();
      setLoading(false);
    };
    init();
  }, [examId]);

  useEffect(() => {
    fetchResults();
  }, [page, statusFilter, sortBy, order]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchResults();
  };

  const clearSearch = () => {
    setSearch('');
    setPage(1);
    // Fetch immediately
    setTimeout(() => {
      fetchResults();
    }, 0);
  };

  const handleCSVExport = () => {
    if (!examId) return;
    resultsService.exportExamResultsCSV(examId);
    addToast('Results CSV file export initiated.', 'success');
  };

  const handleSummaryReport = () => {
    if (!examId) return;
    resultsService.downloadExamSummaryReport(examId);
  };

  const getDifficultyBadge = (difficulty: 'easy' | 'moderate' | 'difficult') => {
    switch (difficulty) {
      case 'easy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-250';
      case 'difficult':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  const passingMarks = exam?.passingMarks || Math.round((exam?.totalMarks || 0) * 0.4);

  return (
    <div className="flex flex-col gap-6 text-left max-w-5xl mx-auto py-6 animate-fade-in font-sans">
      
      {/* Breadcrumb Navigation header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/20 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-outline font-semibold">
            <Link to="/faculty/exams" className="hover:text-primary">Exams</Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            {exam && <Link to={`/faculty/exams/${exam._id}`} className="hover:text-primary">{exam.title}</Link>}
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-on-surface">Exam Analytics & Reports</span>
          </div>
          <h2 className="text-2xl font-black text-on-surface font-display mt-1">Results & Analytics</h2>
          <p className="text-xs text-outline">Verify candidate evaluation performance distributions and download audit reports.</p>
        </div>

        {/* Action downloads buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCSVExport}
            className="px-3.5 py-2 border border-outline-variant/35 text-on-surface hover:bg-surface-container-low text-xs font-bold rounded-xl transition flex items-center gap-1.5 active:scale-95"
            title="Download class scores as CSV"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export CSV
          </button>
          <button
            onClick={handleSummaryReport}
            className="px-3.5 py-2 bg-primary text-on-primary hover:bg-primary-dark text-xs font-bold rounded-xl transition flex items-center gap-1.5 hover:shadow active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">print</span>
            Summary Report
          </button>
        </div>
      </div>

      {exam && analytics && (
        <>
          {/* Dashboard Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 rounded-xl border border-outline-variant/25 bg-white dark:bg-surface-container text-left space-y-1">
              <span className="text-[10px] text-outline uppercase font-black tracking-wide">Ingested Sheets</span>
              <p className="text-2xl font-black text-on-surface">{analytics.totalAnswerSheets}</p>
              <div className="text-[9px] text-outline flex justify-between">
                <span>Finalized: {analytics.finalizedResults}</span>
                <span>Failed: {analytics.failed}</span>
              </div>
            </div>

            <div className="glass-card p-4 rounded-xl border border-outline-variant/25 bg-white dark:bg-surface-container text-left space-y-1">
              <span className="text-[10px] text-outline uppercase font-black tracking-wide">Class Average</span>
              <p className="text-2xl font-black text-primary">{analytics.averagePercentage}%</p>
              <div className="text-[9px] text-outline">
                <span>Average Marks: {analytics.averageMarks} / {exam.totalMarks}</span>
              </div>
            </div>

            <div className="glass-card p-4 rounded-xl border border-outline-variant/25 bg-white dark:bg-surface-container text-left space-y-1">
              <span className="text-[10px] text-outline uppercase font-black tracking-wide">Highest & Lowest</span>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-500">
                {analytics.highestScore} <span className="text-sm font-normal text-outline">/ {analytics.lowestScore}</span>
              </p>
              <div className="text-[9px] text-outline">
                <span>Score Range Spread</span>
              </div>
            </div>

            <div className="glass-card p-4 rounded-xl border border-outline-variant/25 bg-white dark:bg-surface-container text-left space-y-1">
              <span className="text-[10px] text-outline uppercase font-black tracking-wide">Passing Rate</span>
              <p className="text-2xl font-black text-on-surface">{analytics.passPercentage}%</p>
              <div className="text-[9px] text-outline flex justify-between">
                <span>Passed: {analytics.passCount}</span>
                <span>Fail count: {analytics.failCount}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Score Ranges Distribution chart (custom CSS widget) */}
            <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container space-y-4">
              <h3 className="text-xs font-black text-outline uppercase tracking-wider">Score Distribution</h3>
              
              <div className="space-y-3.5">
                {Object.entries(analytics.distribution).map(([range, count]) => {
                  const percent = analytics.finalizedResults > 0
                    ? Math.round((count / analytics.finalizedResults) * 100)
                    : 0;
                  return (
                    <div key={range} className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold text-on-surface">
                        <span>{range} Range</span>
                        <span className="text-outline">{count} student(s) ({percent}%)</span>
                      </div>
                      <div className="w-full bg-outline-variant/15 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-primary h-2.5 rounded-full transition-all duration-500" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Class passing definition marker */}
              <div className="border-t border-outline-variant/10 pt-4 flex gap-1.5 text-[10.5px] items-center text-outline">
                <span className="material-symbols-outlined text-xs">info</span>
                <span>Passing status resolved on score threshold of <b>{passingMarks} / {exam.totalMarks} Marks</b></span>
              </div>
            </div>

            {/* Performance Insights block */}
            <div className="md:col-span-2 glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-outline uppercase tracking-wider">Statistical Performance Insights</h3>
                <ul className="space-y-3">
                  {analytics.insights.map((insight, idx) => (
                    <li key={idx} className="flex gap-2.5 text-xs text-on-surface leading-normal">
                      <span className="text-primary mt-0.5 select-none font-bold">▶</span>
                      <span className="font-semibold">{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {analytics.finalizedResults === 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded-xl border border-amber-200/50 text-xs flex gap-2 items-start mt-2">
                  <span className="material-symbols-outlined text-sm mt-0.5">warning</span>
                  <div>
                    <strong className="block mb-0.5">No Finalized Records</strong>
                    Please review student transcripts and click "Finalize & Lock" inside Pending Evaluations.
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Question-wise analytics performance list */}
          <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container space-y-4">
            <h3 className="text-xs font-black text-outline uppercase tracking-wider">Question Wise Analytics</h3>
            {analytics.questionAnalytics.length === 0 ? (
              <p className="text-xs text-outline italic text-center py-6">No question layout data found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {analytics.questionAnalytics.map((q) => (
                  <div key={q.questionId} className="border border-outline-variant/25 rounded-xl p-4 bg-surface-container-low space-y-3 font-sans">
                    <div className="flex justify-between items-center select-none">
                      <span className="h-6 w-9 rounded-md bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">
                        Q{q.questionNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${getDifficultyBadge(q.performanceDifficulty)}`}>
                        {q.performanceDifficulty}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-outline">
                        <span>Max Marks:</span>
                        <span className="font-bold text-on-surface">{q.maxMarks} Points</span>
                      </div>
                      <div className="flex justify-between text-outline">
                        <span>Average Marks:</span>
                        <span className="font-bold text-primary">{q.averageMarks} ({q.averagePercentage}%)</span>
                      </div>
                      <div className="flex justify-between text-outline">
                        <span>Score Spreads:</span>
                        <span className="font-semibold text-on-surface">High: {q.highestMarks} / Low: {q.lowestMarks}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-outline border-t border-outline-variant/10 pt-2">
                        <span>Perfect Scores: {q.fullMarksCount}</span>
                        <span>Zeros: {q.zeroCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Results details table panel */}
      <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container space-y-4">
        
        {/* Status filtering tabs list */}
        <div className="flex flex-wrap items-center justify-between gap-4 select-none border-b border-outline-variant/10 pb-3">
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'All Results', count: analytics?.totalAnswerSheets || 0 },
              { id: 'finalized', label: 'Finalized', count: analytics?.finalizedResults || 0 },
              { id: 'pending_finalization', label: 'Pending Review', count: analytics?.pendingReview || 0 },
              { id: 'processing', label: 'Processing', count: analytics?.processing || 0 },
              { id: 'failed', label: 'Failed', count: analytics?.failed || 0 }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl font-bold uppercase text-[9.5px] transition flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'border border-outline-variant/35 text-on-surface hover:bg-surface-container-low'
                }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                  statusFilter === tab.id ? 'bg-primary-dark text-white' : 'bg-surface-container-high text-outline'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-xs w-full">
            <div className="relative w-full">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Student ID..."
                className="w-full text-xs pl-8 pr-7 py-2.5 rounded-xl border border-outline-variant/35 bg-surface-container-lowest focus:border-primary focus:outline-none transition font-semibold"
              />
              <span className="material-symbols-outlined text-[14px] text-outline absolute left-2.5 top-1/2 -translate-y-1/2">
                search
              </span>
              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-rose-600 text-outline inline-flex"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-3 py-2 bg-secondary text-white text-[10px] font-black uppercase rounded-xl hover:shadow"
            >
              Search
            </button>
          </form>
        </div>

        {/* Results Data Table */}
        {results.length === 0 ? (
          <div className="text-center py-16 space-y-2 select-none">
            <span className="material-symbols-outlined text-3xl text-outline-variant">find_in_page</span>
            <p className="text-xs text-outline italic">No finalized evaluation results match these filters.</p>
            {statusFilter === 'finalized' && (
              <Link 
                to="/faculty/review-evaluations"
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary font-bold hover:underline"
              >
                <span className="material-symbols-outlined text-[12px]">rate_review</span>
                Go to Pending Evaluations Queue
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse font-sans">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-[10px] font-black uppercase text-outline tracking-wider select-none">
                    <th className="py-2.5">
                      <button 
                        onClick={() => { setSortBy('studentIdentifier'); setOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
                        className="hover:text-primary inline-flex items-center gap-0.5"
                      >
                        Student ID
                        <span className="material-symbols-outlined text-[10px]">swap_vert</span>
                      </button>
                    </th>
                    <th className="py-2.5">Candidate Name</th>
                    <th className="py-2.5">File Reference</th>
                    <th className="py-2.5 text-right">
                      <button 
                        onClick={() => { setSortBy('obtainedMarks'); setOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
                        className="hover:text-primary inline-flex items-center gap-0.5"
                      >
                        Final Marks
                        <span className="material-symbols-outlined text-[10px]">swap_vert</span>
                      </button>
                    </th>
                    <th className="py-2.5 text-right">
                      <button 
                        onClick={() => { setSortBy('percentage'); setOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
                        className="hover:text-primary inline-flex items-center gap-0.5"
                      >
                        Percentage
                        <span className="material-symbols-outlined text-[10px]">swap_vert</span>
                      </button>
                    </th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                  {results.map((r) => (
                    <tr key={r.evaluationId} className="align-middle hover:bg-surface-container-lowest/30 transition">
                      <td className="py-3 font-bold text-xs">{r.studentIdentifier}</td>
                      <td className="py-3 font-semibold text-xs">{r.studentName}</td>
                      <td className="py-3 text-[11px] text-outline font-medium max-w-[150px] truncate" title={r.filename}>
                        {r.filename}
                      </td>
                      <td className="py-3 text-right font-black text-on-surface">{r.obtainedMarks} / {r.totalMarks}</td>
                      <td className="py-3 text-right font-bold text-on-surface">{r.percentage}%</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border ${
                          r.status === 'finalized'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : r.status === 'failed'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : ['pending', 'queued', 'processing'].includes(r.status)
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {r.status === 'finalized' ? 'Finalized' : r.status === 'failed' ? 'Failed' : ['pending', 'queued', 'processing'].includes(r.status) ? 'Processing' : 'Pending Review'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {r.status === 'finalized' ? (
                          <Link
                            to={`/faculty/results/${r.evaluationId}`}
                            className="px-2 py-1 bg-emerald-600 text-white rounded font-bold uppercase text-[9px] hover:bg-emerald-700 hover:shadow transition inline-flex items-center gap-0.5"
                          >
                            <span className="material-symbols-outlined text-[10px]">visibility</span>
                            View Result
                          </Link>
                        ) : (
                          <Link
                            to={`/faculty/pending/${r.answerSheetId}`}
                            className="px-2 py-1 border border-outline-variant/35 text-on-surface rounded font-bold uppercase text-[9px] hover:bg-surface-container-low transition inline-flex items-center gap-0.5"
                          >
                            <span className="material-symbols-outlined text-[10px]">rate_review</span>
                            Grade Audit
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-outline-variant/10 pt-4 select-none">
                <span className="text-[11px] text-outline font-semibold">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2 py-1.5 hover:bg-surface-container-low disabled:opacity-35 text-[10px] font-black uppercase text-on-surface border border-outline-variant/30 rounded-xl transition inline-flex items-center"
                  >
                    <span className="material-symbols-outlined text-xs">chevron_left</span>
                    Prev
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2 py-1.5 hover:bg-surface-container-low disabled:opacity-35 text-[10px] font-black uppercase text-on-surface border border-outline-variant/30 rounded-xl transition inline-flex items-center"
                  >
                    Next
                    <span className="material-symbols-outlined text-xs">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default ResultsDashboard;
