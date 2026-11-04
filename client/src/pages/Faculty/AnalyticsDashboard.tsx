import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import analyticsService, {
  AccessibleExam,
  ConsolidatedAnalytics,
  ReviewCommentItem,
} from '../../services/analytics.service';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const CONFIDENCE_COLORS = ['#10b981', '#f59e0b', '#ef4444'];
const AI_FACULTY_COLORS = ['#10b981', '#ef4444'];

export const AnalyticsDashboard: React.FC = () => {
  const [exams, setExams] = useState<AccessibleExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [analytics, setAnalytics] = useState<ConsolidatedAnalytics | null>(null);
  const [loadingExams, setLoadingExams] = useState<boolean>(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Modal State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('obtainedMarks');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showReviewDetailsModal, setShowReviewDetailsModal] = useState<boolean>(false);
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);

  // Load Accessible Exams on Mount
  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoadingExams(true);
        setError(null);
        const examList = await analyticsService.getAccessibleExams();
        setExams(examList);
        if (examList.length > 0) {
          setSelectedExamId(examList[0].id || examList[0]._id);
        }
      } catch (err: any) {
        console.error('Failed to load exams for analytics:', err);
        setError(err?.message || 'Failed to load examinations list.');
      } finally {
        setLoadingExams(false);
      }
    };
    fetchExams();
  }, []);

  // Fetch Consolidated Analytics when selectedExamId changes
  useEffect(() => {
    if (!selectedExamId) return;

    const fetchAnalytics = async () => {
      try {
        setLoadingAnalytics(true);
        setError(null);
        const data = await analyticsService.getConsolidatedAnalytics(selectedExamId);
        setAnalytics(data);
      } catch (err: any) {
        console.error('Failed to load evaluation analytics:', err);
        setError(err?.message || 'Failed to compile evaluation analytics data.');
      } finally {
        setLoadingAnalytics(false);
      }
    };
    fetchAnalytics();
  }, [selectedExamId]);

  if (loadingExams) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-outline">Loading examinations for analytics...</p>
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="bg-white dark:bg-surface-container rounded-2xl p-12 text-center border border-outline-variant/30 max-w-2xl mx-auto my-12 shadow-sm">
        <span className="material-symbols-outlined text-6xl text-outline mb-4">analytics</span>
        <h2 className="text-xl font-bold text-on-surface mb-2">No Examinations Available</h2>
        <p className="text-sm text-outline mb-6">
          There are currently no active or assigned examinations available to compile evaluation analytics.
        </p>
      </div>
    );
  }

  const overview = analytics?.overview;
  const studentPerformance = analytics?.studentPerformance;
  const questionPerformance = analytics?.questionPerformance;
  const aiVsFaculty = analytics?.aiVsFaculty;
  const confidence = analytics?.confidence;
  const overrides = analytics?.overrides;

  // Formatting Student Distribution Chart Data
  const studentDistributionData = studentPerformance?.distribution
    ? Object.keys(studentPerformance.distribution).map((range) => ({
        range,
        students: studentPerformance.distribution[range as keyof typeof studentPerformance.distribution],
      }))
    : [];

  // Formatting AI vs Faculty Difference Distribution Chart Data
  const differenceDistributionData = aiVsFaculty?.differenceDistribution
    ? Object.keys(aiVsFaculty.differenceDistribution).map((category) => ({
        category,
        count: aiVsFaculty.differenceDistribution[category as keyof typeof aiVsFaculty.differenceDistribution],
      }))
    : [];

  // Formatting AI Accepted vs Overridden Pie Chart Data
  const acceptedVsOverriddenData = aiVsFaculty
    ? [
        { name: 'AI Accepted', value: aiVsFaculty.questionsAccepted },
        { name: 'Faculty Overridden', value: aiVsFaculty.questionsOverridden },
      ]
    : [];

  // Formatting Confidence Pie Chart Data
  const confidencePieData = confidence
    ? [
        { name: 'High (90-100%)', value: confidence.highConfidenceCount },
        { name: 'Moderate (75-89%)', value: confidence.moderateConfidenceCount },
        { name: 'Low (<75%)', value: confidence.lowConfidenceCount },
      ]
    : [];

  // Filter & Sort Students Table
  const filteredStudents = (studentPerformance?.students || []).filter((student) => {
    const matchesSearch =
      student.studentIdentifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.studentName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'finalized') return student.isFinalized;
    if (statusFilter === 'pending') return !student.isFinalized;
    if (statusFilter === 'pass') return student.resultStatus === 'PASS';
    if (statusFilter === 'fail') return student.resultStatus === 'FAIL';
    return true;
  });

  filteredStudents.sort((a, b) => {
    const mult = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'obtainedMarks') return (a.obtainedMarks - b.obtainedMarks) * mult;
    if (sortBy === 'percentage') return (a.percentage - b.percentage) * mult;
    if (sortBy === 'studentName') return a.studentName.localeCompare(b.studentName) * mult;
    return 0;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Header & Exam Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/30 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-on-surface font-display">Evaluation Analytics</h1>
            <span className="text-[10px] bg-primary/10 text-primary font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Phase 5A
            </span>
          </div>
          <p className="text-xs text-outline mt-1 font-medium">
            Analyze student performance, question performance, AI evaluation behavior and faculty review patterns.
          </p>
        </div>

        {/* Dropdown & Export Controls */}
        <div className="flex items-center gap-3">
          {/* Select Examination */}
          <div className="flex items-center gap-2 bg-surface-container border border-outline-variant/40 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="material-symbols-outlined text-sm text-primary">assignment</span>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="bg-transparent text-xs font-bold text-on-surface focus:outline-none cursor-pointer pr-4"
            >
              {exams.map((ex) => (
                <option key={ex.id || ex._id} value={ex.id || ex._id} className="bg-white dark:bg-surface-container text-on-surface">
                  {ex.title} {ex.subjectCode ? `(${ex.subjectCode})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((prev) => !prev)}
              className="px-4 py-2 bg-primary text-on-primary rounded-xl font-semibold text-xs flex items-center gap-2 shadow-sm hover:bg-primary/90 transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span>Export Analytics</span>
              <span className="material-symbols-outlined text-xs">arrow_drop_down</span>
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-xl shadow-xl z-50 overflow-hidden text-left">
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    analyticsService.exportPDF(selectedExamId);
                  }}
                  className="w-full px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container-high flex items-center gap-2.5 font-medium border-b border-outline-variant/10"
                >
                  <span className="material-symbols-outlined text-red-500 text-sm">picture_as_pdf</span>
                  <span>Export PDF Report</span>
                </button>
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    analyticsService.exportExcel(selectedExamId);
                  }}
                  className="w-full px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container-high flex items-center gap-2.5 font-medium border-b border-outline-variant/10"
                >
                  <span className="material-symbols-outlined text-emerald-600 text-sm">table_chart</span>
                  <span>Export Excel (.xls)</span>
                </button>
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    analyticsService.exportCSV(selectedExamId);
                  }}
                  className="w-full px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container-high flex items-center gap-2.5 font-medium"
                >
                  <span className="material-symbols-outlined text-blue-500 text-sm">csv</span>
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-error/10 border border-error/20 rounded-xl text-error text-xs flex items-center gap-3">
          <span className="material-symbols-outlined text-sm">error</span>
          <span>{error}</span>
        </div>
      )}

      {loadingAnalytics ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-outline">Compiling evaluation analytics...</p>
        </div>
      ) : analytics ? (
        <>
          {/* SECTION 1: Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs text-left">
              <p className="text-[10px] uppercase tracking-wider font-bold text-outline">Students</p>
              <p className="text-2xl font-black text-on-surface mt-1">{overview?.totalStudents || 0}</p>
            </div>

            <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs text-left">
              <p className="text-[10px] uppercase tracking-wider font-bold text-outline">Finalized</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {overview?.finalizedStudents || 0}
              </p>
            </div>

            <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs text-left">
              <p className="text-[10px] uppercase tracking-wider font-bold text-outline">Average Score</p>
              <p className="text-xl font-black text-primary mt-1">
                {overview?.averageFinalMarks || 0} <span className="text-xs text-outline font-normal">/ {overview?.totalMarks}</span>
              </p>
            </div>

            <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs text-left">
              <p className="text-[10px] uppercase tracking-wider font-bold text-outline">Average %</p>
              <p className="text-2xl font-black text-on-surface mt-1">{overview?.averagePercentage || 0}%</p>
            </div>

            <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs text-left">
              <p className="text-[10px] uppercase tracking-wider font-bold text-outline">Highest Marks</p>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {overview?.highestFinalMarks || 0} <span className="text-xs text-outline font-normal">/ {overview?.totalMarks}</span>
              </p>
            </div>

            <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs text-left">
              <p className="text-[10px] uppercase tracking-wider font-bold text-outline">Lowest Marks</p>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {overview?.lowestFinalMarks || 0} <span className="text-xs text-outline font-normal">/ {overview?.totalMarks}</span>
              </p>
            </div>

            <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs text-left">
              <p className="text-[10px] uppercase tracking-wider font-bold text-outline">Pending Review</p>
              <p className="text-2xl font-black text-amber-500 mt-1">{overview?.pendingEvaluations || 0}</p>
            </div>
          </div>

          {/* SECTION 2 & 3: Student Marks Distribution & Question Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Student Final Marks Distribution Chart */}
            <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-5 shadow-xs text-left">
              <div className="mb-4">
                <h3 className="text-sm font-extrabold text-on-surface">Student Final Marks Distribution</h3>
                <p className="text-[11px] text-outline">Distribution of finalized student scores by percentage band</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={studentDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="students" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Question Average Performance Chart */}
            <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-5 shadow-xs text-left">
              <div className="mb-4">
                <h3 className="text-sm font-extrabold text-on-surface">Average Marks by Question</h3>
                <p className="text-[11px] text-outline">Faculty final marks average vs question maximum marks</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(questionPerformance?.questions || []).map((q) => ({
                      name: `Q${q.questionNumber}`,
                      Average: q.averageMarks,
                      Max: q.maxMarks,
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Average" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Max" fill="#93c5fd" radius={[6, 6, 0, 0]} opacity={0.4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Question-Wise Performance Table & Observed Performance Indicators */}
          <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-5 shadow-xs text-left">
            <div className="mb-4">
              <h3 className="text-sm font-extrabold text-on-surface">Observed Question Performance</h3>
              <p className="text-[11px] text-outline">Question-wise faculty final marks breakdown and observed performance indicators</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-outline uppercase tracking-wider font-bold text-[10px] bg-surface-container-low/50">
                    <th className="py-3 px-4">Question</th>
                    <th className="py-3 px-4">Question Prompt</th>
                    <th className="py-3 px-4 text-right">Max Marks</th>
                    <th className="py-3 px-4 text-right">Avg Final Marks</th>
                    <th className="py-3 px-4 text-right">Avg %</th>
                    <th className="py-3 px-4 text-center">Finalized Answers</th>
                    <th className="py-3 px-4 text-center">Observed Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-medium">
                  {(questionPerformance?.questions || []).map((q) => {
                    const isHigher = q.observedPerformanceLabel.includes('Higher');
                    const isModerate = q.observedPerformanceLabel.includes('Moderate');
                    return (
                      <tr key={q.questionId} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-primary">Q{q.questionNumber}</td>
                        <td className="py-3 px-4 max-w-xs truncate text-on-surface" title={q.questionText}>
                          {q.questionText || 'Descriptive Question'}
                        </td>
                        <td className="py-3 px-4 text-right text-on-surface">{q.maxMarks}</td>
                        <td className="py-3 px-4 text-right font-bold text-on-surface">{q.averageMarks}</td>
                        <td className="py-3 px-4 text-right text-on-surface">{q.averagePercentage}%</td>
                        <td className="py-3 px-4 text-center text-outline">{q.finalizedAnswers}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                              isHigher
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : isModerate
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {q.observedPerformanceLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {questionPerformance?.lowerPerformingQuestions && questionPerformance.lowerPerformingQuestions.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs mb-2">
                  <span className="material-symbols-outlined text-base">warning</span>
                  <span>Identified Lower-Performing Questions (Avg Score &lt; 50%)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {questionPerformance.lowerPerformingQuestions.map((lpQ) => (
                    <div key={lpQ.questionId} className="p-2.5 bg-white dark:bg-surface-container rounded-lg border border-amber-200/50 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-amber-900 dark:text-amber-200">Question {lpQ.questionNumber}</span>
                        <p className="text-[11px] text-outline truncate max-w-[200px]">{lpQ.questionText}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-amber-700 dark:text-amber-400">{lpQ.averageMarks} / {lpQ.maxMarks}</span>
                        <p className="text-[10px] text-amber-600 font-bold">{lpQ.averagePercentage}% Avg</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: AI VS FACULTY EVALUATION */}
          <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs text-left space-y-6">
            <div className="border-b border-outline-variant/20 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-on-surface">AI vs Faculty Evaluation</h3>
                <p className="text-xs text-outline">
                  Descriptive statistical comparison between raw AI marks and faculty finalized marks
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="text-outline">AI Avg: <strong className="text-on-surface">{aiVsFaculty?.averageAIMarks}</strong></span>
                <span className="text-outline">Faculty Avg: <strong className="text-on-surface">{aiVsFaculty?.averageFacultyMarks}</strong></span>
                <span className="text-outline">Avg Difference: <strong className="text-primary">{aiVsFaculty?.averageDifference && aiVsFaculty.averageDifference > 0 ? `+${aiVsFaculty.averageDifference}` : aiVsFaculty?.averageDifference}</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Difference Distribution Chart */}
              <div className="lg:col-span-2 space-y-2">
                <h4 className="text-xs font-bold text-outline uppercase tracking-wider">
                  Faculty Final Marks - AI Marks Distribution
                </h4>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={differenceDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                      <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Accepted vs Overridden Pie Chart */}
              <div className="space-y-2 flex flex-col items-center">
                <h4 className="text-xs font-bold text-outline uppercase tracking-wider self-start">
                  AI Evaluation Outcomes
                </h4>
                <div className="h-48 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={acceptedVsOverriddenData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {acceptedVsOverriddenData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={AI_FACULTY_COLORS[index % AI_FACULTY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Accepted ({aiVsFaculty?.questionsAccepted})</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500"></span> Overridden ({aiVsFaculty?.questionsOverridden})</span>
                </div>
              </div>
            </div>

            {/* Mark Changes Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Marks Increased</p>
                <p className="text-xl font-black text-emerald-800 dark:text-emerald-300 mt-0.5">
                  {aiVsFaculty?.markChanges?.marksIncreased || 0}
                </p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-red-700 dark:text-red-400">Marks Decreased</p>
                <p className="text-xl font-black text-red-800 dark:text-red-300 mt-0.5">
                  {aiVsFaculty?.markChanges?.marksDecreased || 0}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-surface-container-high/40 border border-outline-variant/30 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-outline">Marks Unchanged</p>
                <p className="text-xl font-black text-on-surface mt-0.5">
                  {aiVsFaculty?.markChanges?.marksUnchanged || 0}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 5: CONFIDENCE ANALYTICS */}
          <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs text-left space-y-6">
            <div className="border-b border-outline-variant/20 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-on-surface">AI Evaluation Confidence</h3>
                <p className="text-xs text-outline">Analysis of AI confidence distribution and faculty override frequency</p>
              </div>
              <div className="px-3 py-1 bg-primary/10 rounded-xl text-primary font-black text-sm">
                Average Confidence: {confidence?.averageConfidence || 0}%
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Confidence Pie Chart */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-outline uppercase tracking-wider">Confidence Bands</h4>
                <div className="h-52 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={confidencePieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {confidencePieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CONFIDENCE_COLORS[index % CONFIDENCE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Observed Override Distribution by Confidence Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-outline uppercase tracking-wider">
                  Observed Override Distribution by Confidence
                </h4>
                <div className="overflow-x-auto border border-outline-variant/30 rounded-xl">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-outline-variant/30 text-outline uppercase font-bold text-[10px]">
                        <th className="py-2.5 px-3">Confidence Range</th>
                        <th className="py-2.5 px-3 text-right">Evaluations</th>
                        <th className="py-2.5 px-3 text-right">Overrides</th>
                        <th className="py-2.5 px-3 text-right">Override Rate %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20 font-medium">
                      {(confidence?.observedOverrideDistribution || []).map((row) => {
                        const rate = row.evaluations > 0 ? ((row.overrides / row.evaluations) * 100).toFixed(1) : '0';
                        return (
                          <tr key={row.range} className="hover:bg-surface-container-low/40">
                            <td className="py-2.5 px-3 font-bold text-on-surface">{row.range}</td>
                            <td className="py-2.5 px-3 text-right text-on-surface">{row.evaluations}</td>
                            <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400 font-bold">{row.overrides}</td>
                            <td className="py-2.5 px-3 text-right text-outline">{rate}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 6: REVIEW WORKLOAD & OVERRIDE REASONS */}
          <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs text-left space-y-6">
            <div className="border-b border-outline-variant/20 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-on-surface">Faculty Review Workload & Reasons</h3>
                <p className="text-xs text-outline">Evaluation review completion metrics and recorded override reasons</p>
              </div>

              <button
                onClick={() => setShowReviewDetailsModal(true)}
                className="px-3.5 py-1.5 bg-secondary/15 hover:bg-secondary/25 text-primary font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer self-start md:self-auto"
              >
                <span className="material-symbols-outlined text-sm">comment</span>
                <span>View Review Details</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20">
                <p className="text-[10px] font-bold text-outline uppercase">Total Evaluations</p>
                <p className="text-lg font-black text-on-surface mt-0.5">{overrides?.reviewWorkload?.totalEvaluations || 0}</p>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20">
                <p className="text-[10px] font-bold text-outline uppercase">Reviewed</p>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{overrides?.reviewWorkload?.reviewed || 0}</p>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20">
                <p className="text-[10px] font-bold text-outline uppercase">Pending</p>
                <p className="text-lg font-black text-amber-500 mt-0.5">{overrides?.reviewWorkload?.pending || 0}</p>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20">
                <p className="text-[10px] font-bold text-outline uppercase">Overridden</p>
                <p className="text-lg font-black text-red-500 mt-0.5">{overrides?.reviewWorkload?.overridden || 0}</p>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20 col-span-2 md:col-span-1">
                <p className="text-[10px] font-bold text-outline uppercase">Avg Review Time</p>
                <p className="text-lg font-black text-primary mt-0.5">
                  {overrides?.reviewWorkload?.averageReviewTimeMinutes !== null
                    ? `${overrides?.reviewWorkload?.averageReviewTimeMinutes} min`
                    : 'N/A'}
                </p>
              </div>
            </div>

            {/* Override Reasons Chart */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-outline uppercase tracking-wider">Override Reasons Analysis</h4>
              {overrides?.overrideReasons && overrides.overrideReasons.length > 0 ? (
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overrides.overrideReasons} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="reason" tick={{ fontSize: 11 }} width={140} />
                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                      <Bar dataKey="count" fill="#ec4899" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="p-6 bg-surface-container-low/40 rounded-xl text-center text-xs text-outline font-medium">
                  No faculty overrides have been recorded for this examination.
                </div>
              )}
            </div>
          </div>

          {/* SECTION 7: STUDENT PERFORMANCE TABLE */}
          <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs text-left space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-on-surface">Student Performance Directory</h3>
                <p className="text-xs text-outline">Sortable academic student performance records for the selected exam</p>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-sm text-outline">search</span>
                  <input
                    type="text"
                    placeholder="Search candidate..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-surface-container-low border border-outline-variant/40 rounded-xl focus:outline-none focus:border-primary text-on-surface w-48"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-surface-container-low border border-outline-variant/40 rounded-xl font-bold text-on-surface focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="finalized">Finalized</option>
                  <option value="pending">Pending</option>
                  {studentPerformance?.passFailAnalytics?.hasPassingRule && (
                    <>
                      <option value="pass">PASS</option>
                      <option value="fail">FAIL</option>
                    </>
                  )}
                </select>

                {/* Sort By */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-surface-container-low border border-outline-variant/40 rounded-xl font-bold text-on-surface focus:outline-none cursor-pointer"
                >
                  <option value="obtainedMarks">Sort by Marks</option>
                  <option value="percentage">Sort by Percentage</option>
                  <option value="studentName">Sort by Student Name</option>
                </select>

                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1.5 bg-surface-container-low border border-outline-variant/40 rounded-xl text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                  title="Toggle Sort Order"
                >
                  <span className="material-symbols-outlined text-sm">
                    {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                  </span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-outline uppercase font-bold text-[10px] bg-surface-container-low/50">
                    <th className="py-3 px-4">Enrollment / Identifier</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4 text-right">Final Marks</th>
                    <th className="py-3 px-4 text-right">Percentage</th>
                    <th className="py-3 px-4 text-center">Result Status</th>
                    <th className="py-3 px-4 text-center">Evaluation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-medium">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-outline text-xs">
                        No student performance records match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.answerSheetId} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-primary">{s.studentIdentifier}</td>
                        <td className="py-3 px-4 text-on-surface font-semibold">{s.studentName}</td>
                        <td className="py-3 px-4 text-right font-black text-on-surface">
                          {s.isFinalized ? (
                            <span>{s.obtainedMarks} <span className="text-[10px] text-outline font-normal">/ {s.totalMarks}</span></span>
                          ) : (
                            <span className="text-outline italic">Pending</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-on-surface">
                          {s.isFinalized ? `${s.percentage}%` : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              s.resultStatus === 'PASS'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : s.resultStatus === 'FAIL'
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                : 'bg-surface-container-high text-outline'
                            }`}
                          >
                            {s.resultStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              s.isFinalized
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 8: PASS/FAIL ANALYTICS */}
          <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs text-left">
            <h3 className="text-base font-extrabold text-on-surface mb-1">Pass / Fail Performance Analytics</h3>
            {studentPerformance?.passFailAnalytics?.hasPassingRule ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/20">
                  <p className="text-[10px] font-bold text-outline uppercase">Passing Threshold</p>
                  <p className="text-xl font-black text-on-surface mt-1">
                    {studentPerformance.passFailAnalytics.passingMarks} Marks
                  </p>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl">
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Passed Candidates</p>
                  <p className="text-xl font-black text-emerald-800 dark:text-emerald-300 mt-1">
                    {studentPerformance.passFailAnalytics.passCount}
                  </p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl">
                  <p className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase">Failed Candidates</p>
                  <p className="text-xl font-black text-red-800 dark:text-red-300 mt-1">
                    {studentPerformance.passFailAnalytics.failCount}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl">
                  <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase">Pass Rate %</p>
                  <p className="text-xl font-black text-blue-800 dark:text-blue-300 mt-1">
                    {studentPerformance.passFailAnalytics.passPercentage}%
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3">
                <span className="material-symbols-outlined text-base">info</span>
                <span>Pass/Fail analytics unavailable because no passing threshold is configured.</span>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* MODAL: Faculty Review Comments / Override Details */}
      {showReviewDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-left">
            <div className="p-5 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low">
              <div>
                <h3 className="text-base font-extrabold text-on-surface">Faculty Review Details</h3>
                <p className="text-xs text-outline">Recorded comments and justifications for faculty overrides</p>
              </div>
              <button
                onClick={() => setShowReviewDetailsModal(false)}
                className="p-1.5 text-outline hover:text-on-surface rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar flex-grow">
              {overrides?.reviewComments && overrides.reviewComments.length > 0 ? (
                overrides.reviewComments.map((item: ReviewCommentItem, idx: number) => (
                  <div key={idx} className="p-4 bg-surface-container-low/50 border border-outline-variant/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-primary">{item.studentName} ({item.studentIdentifier})</span>
                      <span className="text-[10px] text-outline font-medium">Q{item.questionNumber}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-outline">AI Marks: <strong className="text-on-surface">{item.aiMarks}</strong></span>
                      <span className="material-symbols-outlined text-xs text-outline">arrow_forward</span>
                      <span className="text-outline">Final Marks: <strong className="text-emerald-600 font-bold">{item.finalMarks}</strong></span>
                      <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded-md">
                        {item.reason}
                      </span>
                    </div>

                    {item.comment && (
                      <div className="p-2.5 bg-white dark:bg-surface-container rounded-lg border border-outline-variant/20 text-xs text-on-surface font-medium italic">
                        "{item.comment}"
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-outline">
                  No review comments or override justifications have been logged for this exam.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-outline-variant/20 text-right bg-surface-container-low">
              <button
                onClick={() => setShowReviewDetailsModal(false)}
                className="px-4 py-2 bg-primary text-on-primary font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
