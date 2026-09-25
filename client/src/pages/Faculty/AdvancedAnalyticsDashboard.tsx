import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import advancedAnalyticsService, {
  FilterOptions,
  CrossExamItem,
  PerformanceTrendItem,
  StudentPerformanceTrend,
  QuestionTrendItem,
  PotentialImprovementArea,
  AIEvaluationTrendItem,
  FeedbackTrendItem,
  VersionTimelineItem,
  SystemMonitoringMetrics,
  PipelineHealth,
  ReviewPriorityItem,
  SystemAlertsResponse,
} from '../../services/advancedAnalytics.service';

export const AdvancedAnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'crossexam' | 'question' | 'aitrends' | 'priority' | 'monitoring'>('crossexam');

  // Filters State
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');

  // Data State
  const [crossExamData, setCrossExamData] = useState<CrossExamItem[]>([]);
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrendItem[]>([]);
  const [questionTrends, setQuestionTrends] = useState<QuestionTrendItem[]>([]);
  const [improvementAreas, setImprovementAreas] = useState<PotentialImprovementArea[]>([]);
  const [aiTrends, setAiTrends] = useState<AIEvaluationTrendItem[]>([]);
  const [feedbackTrends, setFeedbackTrends] = useState<FeedbackTrendItem[]>([]);
  const [versionTimeline, setVersionTimeline] = useState<VersionTimelineItem[]>([]);
  const [monitoringMetrics, setMonitoringMetrics] = useState<SystemMonitoringMetrics | null>(null);
  const [pipelineHealth, setPipelineHealth] = useState<PipelineHealth | null>(null);
  const [reviewPriorities, setReviewPriorities] = useState<ReviewPriorityItem[]>([]);
  const [alertsResponse, setAlertsResponse] = useState<SystemAlertsResponse | null>(null);

  // Student Search
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [studentTrend, setStudentTrend] = useState<StudentPerformanceTrend | null>(null);
  const [loadingStudent, setLoadingStudent] = useState<boolean>(false);

  // UI State
  const [loading, setLoading] = useState<boolean>(true);
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load Filters on Mount
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const filters = await advancedAnalyticsService.getFilters();
        setFilterOptions(filters);
      } catch (err: any) {
        console.error('Failed to load filter options:', err);
      }
    };
    fetchFilters();
  }, []);

  // Fetch Analytics Data based on filters and activeTab
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        setError(null);

        const filterParams: Record<string, string> = {};
        if (selectedSubject) filterParams.subjectId = selectedSubject;
        if (selectedExam) filterParams.examId = selectedExam;

        const [crossRes, trendsRes, qTrendsRes, impRes, aiRes, fbRes, sysRes, pipeRes, alertsRes] =
          await Promise.all([
            advancedAnalyticsService.getCrossExamAnalytics(filterParams),
            advancedAnalyticsService.getPerformanceTrends(filterParams),
            advancedAnalyticsService.getQuestionTrends(filterParams),
            advancedAnalyticsService.getRepeatedCorrectionPatterns(filterParams),
            advancedAnalyticsService.getAIEvaluationTrends(filterParams),
            advancedAnalyticsService.getFeedbackTrends(filterParams),
            advancedAnalyticsService.getSystemMonitoringMetrics(),
            advancedAnalyticsService.getPipelineHealth(filterParams),
            advancedAnalyticsService.getSystemAlerts(),
          ]);

        setCrossExamData(crossRes.crossExamComparison || []);
        setPerformanceTrends(trendsRes || []);
        setQuestionTrends(qTrendsRes || []);
        setImprovementAreas(impRes || []);
        setAiTrends(aiRes || []);
        setFeedbackTrends(fbRes || []);
        setMonitoringMetrics(sysRes || null);
        setPipelineHealth(pipeRes || null);
        setAlertsResponse(alertsRes || null);

        // Fetch version history & priority queue if an exam is selected or available
        const targetExamId = selectedExam || (crossRes.crossExamComparison[0]?.examId || '');
        if (targetExamId) {
          const [verRes, prioRes] = await Promise.all([
            advancedAnalyticsService.getVersionHistoryTimeline(targetExamId),
            advancedAnalyticsService.getReviewPriorityList(targetExamId),
          ]);
          setVersionTimeline(verRes || []);
          setReviewPriorities(prioRes || []);
        }
      } catch (err: any) {
        console.error('Failed to fetch advanced analytics:', err);
        setError(err?.message || 'Failed to compile advanced analytics data.');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [selectedSubject, selectedExam]);

  // Handle Student Trend Search
  const handleStudentSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentSearchQuery.trim()) return;

    try {
      setLoadingStudent(true);
      const res = await advancedAnalyticsService.getStudentPerformanceTrends(studentSearchQuery.trim());
      setStudentTrend(res);
    } catch (err: any) {
      console.error('Failed to search student trend:', err);
    } finally {
      setLoadingStudent(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header & Export Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/30 pb-6">
        <div className="text-left">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-on-surface font-display">
              Advanced Analytics & System Intelligence
            </h1>
            <span className="text-[10px] bg-primary/10 text-primary font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Phase 5C
            </span>
          </div>
          <p className="text-xs text-outline mt-1 font-medium">
            Cross-exam trends, long-term performance, pipeline monitoring, version history, and system intelligence.
          </p>
        </div>

        {/* Global Filters & Export */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Subject Filter */}
          <div className="flex items-center gap-2 bg-surface-container border border-outline-variant/40 rounded-xl px-3 py-1.5 shadow-sm text-xs font-bold text-on-surface">
            <span className="material-symbols-outlined text-sm text-primary">menu_book</span>
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedExam('');
              }}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="">All Subjects</option>
              {(filterOptions?.subjects || []).map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.code})
                </option>
              ))}
            </select>
          </div>

          {/* Exam Filter */}
          <div className="flex items-center gap-2 bg-surface-container border border-outline-variant/40 rounded-xl px-3 py-1.5 shadow-sm text-xs font-bold text-on-surface">
            <span className="material-symbols-outlined text-sm text-primary">assignment</span>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer max-w-[180px] truncate"
            >
              <option value="">All Exams</option>
              {(filterOptions?.exams || []).map((ex) => (
                <option key={ex.id || ex._id} value={ex.id || ex._id}>
                  {ex.title}
                </option>
              ))}
            </select>
          </div>

          {/* Export Menu */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((prev) => !prev)}
              className="px-4 py-2 bg-primary text-on-primary rounded-xl font-semibold text-xs flex items-center gap-2 shadow-sm hover:bg-primary/90 transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span>Export Report</span>
              <span className="material-symbols-outlined text-xs">arrow_drop_down</span>
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-xl shadow-xl z-50 overflow-hidden text-left">
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    advancedAnalyticsService.exportPDF({ subjectId: selectedSubject, examId: selectedExam });
                  }}
                  className="w-full px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container-high flex items-center gap-2.5 font-medium border-b border-outline-variant/10 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-red-500 text-sm">picture_as_pdf</span>
                  <span>Export PDF Report</span>
                </button>
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    advancedAnalyticsService.exportExcel({ subjectId: selectedSubject, examId: selectedExam });
                  }}
                  className="w-full px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container-high flex items-center gap-2.5 font-medium border-b border-outline-variant/10 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-emerald-600 text-sm">table_chart</span>
                  <span>Export Excel (.xls)</span>
                </button>
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    advancedAnalyticsService.exportCSV({ subjectId: selectedSubject, examId: selectedExam });
                  }}
                  className="w-full px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container-high flex items-center gap-2.5 font-medium cursor-pointer"
                >
                  <span className="material-symbols-outlined text-blue-500 text-sm">csv</span>
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active System Alerts Banner */}
      {alertsResponse?.alerts && alertsResponse.alerts.length > 0 && (
        <div className="space-y-2">
          {alertsResponse.alerts.map((al, idx) => (
            <div
              key={idx}
              className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3 shadow-xs text-left"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-500 text-xl">warning</span>
                <div>
                  <p className="font-extrabold text-sm">{al.title}</p>
                  <p className="text-outline text-xs">{al.message}</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold rounded-full text-[10px] uppercase">
                Active Threshold Alert
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-outline-variant/30 text-xs font-bold gap-6 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('crossexam')}
          className={`pb-3.5 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border-b-2 ${
            activeTab === 'crossexam'
              ? 'border-primary text-primary font-black'
              : 'border-transparent text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-base">compare_arrows</span>
          <span>Cross-Exam & Trends</span>
        </button>

        <button
          onClick={() => setActiveTab('question')}
          className={`pb-3.5 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border-b-2 ${
            activeTab === 'question'
              ? 'border-primary text-primary font-black'
              : 'border-transparent text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-base">quiz</span>
          <span>Question & Version Intelligence</span>
        </button>

        <button
          onClick={() => setActiveTab('aitrends')}
          className={`pb-3.5 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border-b-2 ${
            activeTab === 'aitrends'
              ? 'border-primary text-primary font-black'
              : 'border-transparent text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-base">smart_toy</span>
          <span>AI vs Faculty Trends</span>
        </button>

        <button
          onClick={() => setActiveTab('priority')}
          className={`pb-3.5 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border-b-2 ${
            activeTab === 'priority'
              ? 'border-primary text-primary font-black'
              : 'border-transparent text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-base">priority_high</span>
          <span>Review Priority Queue</span>
          {reviewPriorities.length > 0 && (
            <span className="w-5 h-5 bg-primary/20 text-primary rounded-full flex items-center justify-center text-[10px]">
              {reviewPriorities.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('monitoring')}
          className={`pb-3.5 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border-b-2 ${
            activeTab === 'monitoring'
              ? 'border-primary text-primary font-black'
              : 'border-transparent text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-base">monitor_heart</span>
          <span>System Monitoring & Pipeline</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <div className="w-9 h-9 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-outline">Compiling intelligence metrics...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-error/10 border border-error/20 rounded-xl text-error text-xs flex items-center gap-3">
          <span className="material-symbols-outlined text-sm">error</span>
          <span>{error}</span>
        </div>
      ) : (
        <>
          {/* TAB 1: CROSS-EXAM ANALYTICS & TRENDS */}
          {activeTab === 'crossexam' && (
            <div className="space-y-8">
              {/* Cross Exam Comparison Table */}
              <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs text-left space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">Cross-Examination Comparative Analytics</h3>
                  <p className="text-xs text-outline">
                    Normalized percentage comparisons across completed examinations.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/30 text-outline uppercase font-bold text-[10px] bg-surface-container-low/50">
                        <th className="py-3 px-4">Examination</th>
                        <th className="py-3 px-4">Subject</th>
                        <th className="py-3 px-4 text-center">Exam Date</th>
                        <th className="py-3 px-4 text-center">Students</th>
                        <th className="py-3 px-4 text-right">Avg Score</th>
                        <th className="py-3 px-4 text-right">Normalized Avg %</th>
                        <th className="py-3 px-4 text-right">AI Avg %</th>
                        <th className="py-3 px-4 text-right">Override Rate %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20 font-medium">
                      {crossExamData.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-outline text-xs">
                            No finalized examination records available for cross-exam comparison.
                          </td>
                        </tr>
                      ) : (
                        crossExamData.map((item) => (
                          <tr key={item.examId} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="py-3 px-4 font-bold text-on-surface">{item.title}</td>
                            <td className="py-3 px-4 text-outline">
                              {item.subjectCode} - {item.subjectName}
                            </td>
                            <td className="py-3 px-4 text-center text-outline">
                              {new Date(item.examDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-center text-on-surface font-bold">{item.studentCount}</td>
                            <td className="py-3 px-4 text-right font-black text-on-surface">
                              {item.averageFinalMarks} <span className="text-[10px] text-outline font-normal">/ {item.totalMarks}</span>
                            </td>
                            <td className="py-3 px-4 text-right font-black text-primary">
                              {item.averagePercentage}%
                            </td>
                            <td className="py-3 px-4 text-right text-on-surface">{item.averageAIPercentage}%</td>
                            <td className="py-3 px-4 text-right text-amber-600 font-bold">{item.overrideRate}%</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Time-based Performance Trend Chart */}
              <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs text-left space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">Historical Performance Trend</h3>
                  <p className="text-xs text-outline">Chronological normalized average percentage trend over exams</p>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceTrends} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                      <XAxis dataKey="title" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Line
                        type="monotone"
                        dataKey="averagePercentage"
                        name="Average %"
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ r: 5, fill: '#2563eb' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Individual Student Performance Trend */}
              <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs text-left space-y-6">
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">Individual Candidate Performance Directory</h3>
                  <p className="text-xs text-outline">Search candidate by name, enrollment, or email to inspect historical performance trend</p>
                </div>

                <form onSubmit={handleStudentSearch} className="flex items-center gap-3">
                  <div className="relative flex-grow max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-sm text-outline">search</span>
                    <input
                      type="text"
                      placeholder="Enter candidate name, ID, or enrollment..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs bg-surface-container-low border border-outline-variant/40 rounded-xl focus:outline-none focus:border-primary text-on-surface font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl hover:bg-primary/90 transition-all cursor-pointer"
                  >
                    {loadingStudent ? 'Searching...' : 'Search Candidate'}
                  </button>
                </form>

                {studentTrend && studentTrend.student && (
                  <div className="space-y-4 pt-2 border-t border-outline-variant/20">
                    <div className="flex items-center justify-between bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/20">
                      <div>
                        <p className="text-sm font-bold text-on-surface">{studentTrend.student.name}</p>
                        <p className="text-xs text-outline">{studentTrend.student.studentIdentifier}</p>
                      </div>
                      <span className="px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-full">
                        {studentTrend.performanceTrend.length} Exams Recorded
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-outline-variant/30 text-outline uppercase font-bold text-[10px] bg-surface-container-low/50">
                            <th className="py-2.5 px-3">Examination</th>
                            <th className="py-2.5 px-3 text-center">Exam Date</th>
                            <th className="py-2.5 px-3 text-right">Obtained Marks</th>
                            <th className="py-2.5 px-3 text-right">Percentage</th>
                            <th className="py-2.5 px-3 text-center">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/20 font-medium">
                          {studentTrend.performanceTrend.map((st) => (
                            <tr key={st.evaluationId} className="hover:bg-surface-container-low/40">
                              <td className="py-2.5 px-3 font-bold text-on-surface">{st.examTitle}</td>
                              <td className="py-2.5 px-3 text-center text-outline">
                                {new Date(st.examDate).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-on-surface">
                                {st.obtainedMarks} / {st.totalMarks}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-primary">{st.percentage}%</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="px-2 py-0.5 bg-surface-container-high text-on-surface font-extrabold rounded-md text-[10px]">
                                  {st.grade}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: QUESTION & VERSION INTELLIGENCE */}
          {activeTab === 'question' && (
            <div className="space-y-8 text-left">
              {/* Question Performance Trends */}
              <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">Question Performance Analysis</h3>
                  <p className="text-xs text-outline">Detailed average scores and faculty override metrics by question</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/30 text-outline uppercase font-bold text-[10px] bg-surface-container-low/50">
                        <th className="py-3 px-4">Question</th>
                        <th className="py-3 px-4 text-right">Max Marks</th>
                        <th className="py-3 px-4 text-right">Evaluated</th>
                        <th className="py-3 px-4 text-right">Avg Final Marks</th>
                        <th className="py-3 px-4 text-right">Avg Final %</th>
                        <th className="py-3 px-4 text-right">AI Avg %</th>
                        <th className="py-3 px-4 text-right">Override Rate</th>
                        <th className="py-3 px-4 text-center">Feedback Items</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20 font-medium">
                      {questionTrends.map((q) => (
                        <tr key={q.questionKey} className="hover:bg-surface-container-low/50">
                          <td className="py-3 px-4 font-bold text-primary">Q{q.questionNumber}</td>
                          <td className="py-3 px-4 text-right text-on-surface">{q.maxMarks}</td>
                          <td className="py-3 px-4 text-right text-outline">{q.evaluatedCount}</td>
                          <td className="py-3 px-4 text-right font-bold text-on-surface">{q.averageFinalMarks}</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-600">{q.averagePercentage}%</td>
                          <td className="py-3 px-4 text-right text-on-surface">{q.aiAveragePercentage}%</td>
                          <td className="py-3 px-4 text-right text-amber-600 font-bold">{q.overrideRate}%</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 bg-surface-container-high rounded-full font-bold text-[10px]">
                              {q.ocrIssuesCount + q.referenceIssuesCount + q.rubricIssuesCount}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Repeated Correction Patterns */}
              <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">Repeated Correction Patterns</h3>
                  <p className="text-xs text-outline">
                    Identified potential improvement areas based on repeated faculty overrides and recorded issues.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {improvementAreas.length === 0 ? (
                    <div className="col-span-full p-6 text-center text-xs text-outline font-medium bg-surface-container-low rounded-xl">
                      No repeated correction patterns detected.
                    </div>
                  ) : (
                    improvementAreas.map((area, idx) => (
                      <div key={idx} className="p-4 bg-surface-container-low border border-outline-variant/30 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-sm text-primary">Question {area.questionNumber}</span>
                          <span className="px-2.5 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold rounded-full text-[10px] uppercase">
                            {area.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-outline">
                          <div>Overrides: <strong className="text-on-surface">{area.totalOverrides}</strong></div>
                          <div>OCR Issues: <strong className="text-on-surface">{area.ocrIssues}</strong></div>
                          <div>Reference Issues: <strong className="text-on-surface">{area.referenceAnswerIssues}</strong></div>
                          <div>Rubric Issues: <strong className="text-on-surface">{area.rubricIssues}</strong></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Version History Timeline */}
              <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">Configuration Version History Timeline</h3>
                  <p className="text-xs text-outline">Version tracking for active reference answers and evaluation rubrics</p>
                </div>

                <div className="space-y-3">
                  {versionTimeline.length === 0 ? (
                    <div className="p-6 text-center text-xs text-outline font-medium bg-surface-container-low rounded-xl">
                      No configuration version changes logged.
                    </div>
                  ) : (
                    versionTimeline.map((item) => (
                      <div key={item.id} className="p-4 bg-surface-container-low border border-outline-variant/20 rounded-xl flex items-center justify-between text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-on-surface">{item.type}</span>
                            <span className="px-2 py-0.5 bg-primary/10 text-primary font-black rounded-md">{item.version}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>
                              {item.status}
                            </span>
                          </div>
                          <p className="text-outline text-[11px]">{item.changeReason}</p>
                        </div>
                        <div className="text-right text-[11px] text-outline font-medium">
                          <p>Created by <strong>{item.createdBy}</strong></p>
                          <p>{new Date(item.createdDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI VS FACULTY TRENDS */}
          {activeTab === 'aitrends' && (
            <div className="space-y-8 text-left">
              {/* AI vs Faculty Score Trend Chart */}
              <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">AI Marks vs Faculty Final Marks Trend</h3>
                  <p className="text-xs text-outline">Descriptive historical comparison of raw AI average scores against faculty finalized scores</p>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aiTrends} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                      <XAxis dataKey="title" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="averageAIMarks" name="AI Average Marks" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="averageFacultyMarks" name="Faculty Final Marks" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Feedback Breakdown Trend */}
              <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">Faculty Feedback Types Breakdown</h3>
                  <p className="text-xs text-outline">Historical breakdown of recorded override feedback categories</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/30 text-outline uppercase font-bold text-[10px] bg-surface-container-low/50">
                        <th className="py-3 px-4">Examination</th>
                        <th className="py-3 px-4 text-center">OCR Issues</th>
                        <th className="py-3 px-4 text-center">Rubric Issues</th>
                        <th className="py-3 px-4 text-center">Reference Issues</th>
                        <th className="py-3 px-4 text-center">Alternative Answers</th>
                        <th className="py-3 px-4 text-center">Mark Corrections</th>
                        <th className="py-3 px-4 text-center">Total Feedback</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20 font-medium">
                      {feedbackTrends.map((fb) => (
                        <tr key={fb.examId} className="hover:bg-surface-container-low/50">
                          <td className="py-3 px-4 font-bold text-on-surface">{fb.examTitle}</td>
                          <td className="py-3 px-4 text-center font-bold text-amber-600">{fb.OCR_issue}</td>
                          <td className="py-3 px-4 text-center font-bold text-blue-600">{fb.rubric_issue}</td>
                          <td className="py-3 px-4 text-center font-bold text-purple-600">{fb.reference_answer_issue}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-600">{fb.alternative_answer}</td>
                          <td className="py-3 px-4 text-center font-bold text-on-surface">{fb.mark_correction}</td>
                          <td className="py-3 px-4 text-center font-black text-primary">{fb.totalFeedback}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: REVIEW PRIORITY QUEUE */}
          {activeTab === 'priority' && (
            <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs text-left space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-on-surface">Advanced AI Review Priority Indicator</h3>
                <p className="text-xs text-outline">
                  Calculated human review priority indicator to guide faculty review order. Purely heuristic — does NOT modify student marks or pass/fail decisions.
                </p>
              </div>

              <div className="space-y-3">
                {reviewPriorities.length === 0 ? (
                  <div className="p-8 text-center text-xs text-outline font-medium bg-surface-container-low rounded-xl">
                    No pending evaluations in the review priority queue.
                  </div>
                ) : (
                  reviewPriorities.map((item) => (
                    <div
                      key={item.evaluationId}
                      className="p-4 bg-surface-container-low border border-outline-variant/30 rounded-2xl space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-on-surface">{item.studentName}</p>
                          <p className="text-xs text-outline">{item.studentIdentifier}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full font-black text-xs uppercase ${
                            item.reviewPriority === 'High'
                              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300'
                              : item.reviewPriority === 'Medium'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                          }`}
                        >
                          Review Priority: {item.reviewPriority}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Transparent Reasons:</p>
                        <ul className="list-disc list-inside text-xs text-on-surface space-y-0.5 font-medium">
                          {item.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEM MONITORING & PIPELINE */}
          {activeTab === 'monitoring' && (
            <div className="space-y-8 text-left">
              {/* System Health Status Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs">
                  <p className="text-[10px] uppercase font-bold text-outline">OCR Service Status</p>
                  <p className="text-lg font-black text-emerald-600 mt-1 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    {monitoringMetrics?.health?.ocrService || 'Operational'}
                  </p>
                </div>

                <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs">
                  <p className="text-[10px] uppercase font-bold text-outline">Backend API</p>
                  <p className="text-lg font-black text-emerald-600 mt-1 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    {monitoringMetrics?.health?.backendApi || 'Healthy'}
                  </p>
                </div>

                <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs">
                  <p className="text-[10px] uppercase font-bold text-outline">MongoDB Connection</p>
                  <p className="text-lg font-black text-emerald-600 mt-1 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    {monitoringMetrics?.health?.database || 'Connected'}
                  </p>
                </div>

                <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs">
                  <p className="text-[10px] uppercase font-bold text-outline">AI Evaluation Engine</p>
                  <p className="text-lg font-black text-emerald-600 mt-1 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    {monitoringMetrics?.health?.aiEvaluation || 'Operational'}
                  </p>
                </div>
              </div>

              {/* Processing Pipeline Flow */}
              <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">5-Stage Evaluation Pipeline & Bottleneck Monitor</h3>
                  <p className="text-xs text-outline">Live volume progression across submission processing lifecycle</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
                  <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-1">
                    <p className="text-[10px] font-bold text-outline uppercase">1. Submitted</p>
                    <p className="text-2xl font-black text-on-surface">{pipelineHealth?.pipelineCounts?.submitted || 0}</p>
                  </div>
                  <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-1">
                    <p className="text-[10px] font-bold text-outline uppercase">2. OCR Completed</p>
                    <p className="text-2xl font-black text-blue-600">{pipelineHealth?.pipelineCounts?.ocrCompleted || 0}</p>
                  </div>
                  <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-1">
                    <p className="text-[10px] font-bold text-outline uppercase">3. AI Evaluated</p>
                    <p className="text-2xl font-black text-purple-600">{pipelineHealth?.pipelineCounts?.aiEvaluated || 0}</p>
                  </div>
                  <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-1">
                    <p className="text-[10px] font-bold text-outline uppercase">4. Reviewed</p>
                    <p className="text-2xl font-black text-amber-600">{pipelineHealth?.pipelineCounts?.facultyReviewed || 0}</p>
                  </div>
                  <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-1">
                    <p className="text-[10px] font-bold text-outline uppercase">5. Finalized</p>
                    <p className="text-2xl font-black text-emerald-600">{pipelineHealth?.pipelineCounts?.finalized || 0}</p>
                  </div>
                </div>

                {/* Bottleneck Summary */}
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-2">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Pipeline Bottlenecks:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-semibold">
                    <div>Pending OCR: <strong className="text-on-surface">{pipelineHealth?.bottleneck?.pendingOCR || 0}</strong></div>
                    <div>Pending AI: <strong className="text-on-surface">{pipelineHealth?.bottleneck?.pendingAI || 0}</strong></div>
                    <div>Pending Review: <strong className="text-on-surface">{pipelineHealth?.bottleneck?.pendingFacultyReview || 0}</strong></div>
                    <div>Pending Finalization: <strong className="text-on-surface">{pipelineHealth?.bottleneck?.pendingFinalization || 0}</strong></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdvancedAnalyticsDashboard;
