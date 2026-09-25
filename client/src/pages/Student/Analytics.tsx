import React, { useEffect, useState } from 'react';
import {
  analyticsService,
  StudentMeAnalytics,
  StudentTrendItem,
  StudentExamDetails,
} from '../../services/analytics.service';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export const Analytics: React.FC = () => {
  const [summary, setSummary] = useState<StudentMeAnalytics | null>(null);
  const [trends, setTrends] = useState<StudentTrendItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [examDetails, setExamDetails] = useState<StudentExamDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [examLoading, setExamLoading] = useState(false);

  useEffect(() => {
    async function loadStudentAnalytics() {
      try {
        setLoading(true);
        const [sumData, trendData] = await Promise.all([
          analyticsService.getStudentMeAnalytics(),
          analyticsService.getStudentMeTrends(),
        ]);
        setSummary(sumData);
        setTrends(trendData);

        if (trendData.length > 0) {
          const firstExamId = trendData[0].examId;
          if (firstExamId) {
            setSelectedExamId(firstExamId);
            loadExamDetails(firstExamId);
          }
        }
      } catch (err) {
        console.error('Error loading student analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStudentAnalytics();
  }, []);

  const loadExamDetails = async (examId: string) => {
    try {
      setExamLoading(true);
      const details = await analyticsService.getStudentMeExamDetails(examId);
      setExamDetails(details);
    } catch (err) {
      console.error('Error loading exam question details:', err);
      setExamDetails(null);
    } finally {
      setExamLoading(false);
    }
  };

  const handleExamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const examId = e.target.value;
    setSelectedExamId(examId);
    if (examId) {
      loadExamDetails(examId);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="py-20" />;
  }

  if (!summary || !summary.hasResults || trends.length === 0) {
    return (
      <div className="flex flex-col gap-6 text-left animate-fade-in">
        <div>
          <h2 className="text-2xl font-black text-on-surface font-display">Performance Analytics</h2>
          <p className="text-sm text-on-surface-variant mt-1">Review historical academic grades and comparative metrics.</p>
        </div>
        <EmptyState 
          title="No analytics available" 
          description="Analytics will populate once your exam submissions have been graded and published by faculty." 
        />
      </div>
    );
  }

  // Format data for trend chart
  const chartData = trends.map((t, idx) => ({
    name: t.examTitle || `Exam ${idx + 1}`,
    percentage: t.percentage,
    obtainedMarks: t.obtainedMarks,
    totalMarks: t.totalMarks,
    subject: t.subjectCode || t.subjectName,
  }));

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">My Performance Analytics</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Dynamically calculated academic performance metrics from your published evaluations.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 flex flex-col justify-between bg-white dark:bg-surface-container shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Published Exams</span>
            <h3 className="text-3xl font-black text-primary mt-2 font-display">{summary.totalExams}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Exams evaluated and verified.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 flex flex-col justify-between bg-white dark:bg-surface-container shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Average Score</span>
            <h3 className="text-3xl font-black text-secondary mt-2 font-display">{summary.averagePercentage}%</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Mean percentage across published exams.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 flex flex-col justify-between bg-white dark:bg-surface-container shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Highest Score</span>
            <h3 className="text-3xl font-black text-green-600 mt-2 font-display">{summary.highestPercentage}%</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Your peak percentage result.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 flex flex-col justify-between bg-white dark:bg-surface-container shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Lowest Score</span>
            <h3 className="text-3xl font-black text-amber-600 mt-2 font-display">{summary.lowestPercentage}%</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Lowest recorded percentage result.</p>
        </div>
      </div>

      {/* Performance Trend Line Chart */}
      <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container shadow-sm">
        <h3 className="text-base font-bold text-on-surface mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">trending_up</span> Exam Performance Trend Over Time
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#888888" fontSize={12} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(value: any) => [`${value}%`, 'Score Percentage']}
                contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)' }}
              />
              <Line
                type="monotone"
                dataKey="percentage"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 6, fill: '#2563eb' }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Question Performance Breakdown for Selected Exam */}
      <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container shadow-sm flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">analytics</span> Question-Wise Exam Breakdown
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Select an exam to inspect detailed question scores and matched concepts.</p>
          </div>

          <div className="min-w-[220px]">
            <select
              value={selectedExamId || ''}
              onChange={handleExamChange}
              className="w-full px-3 py-2 text-sm bg-surface-container-low border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            >
              {trends.map((t) => (
                <option key={t.examId} value={t.examId || ''}>
                  {t.examTitle} ({t.percentage}%)
                </option>
              ))}
            </select>
          </div>
        </div>

        {examLoading ? (
          <LoadingSpinner size="md" className="py-12" />
        ) : examDetails && examDetails.questions && examDetails.questions.length > 0 ? (
          <div className="space-y-4">
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-primary uppercase">{examDetails.subjectCode} — {examDetails.subjectName}</span>
                <h4 className="text-lg font-black text-on-surface font-display">{examDetails.examTitle}</h4>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-primary">{examDetails.obtainedMarks} / {examDetails.totalMarks}</span>
                <p className="text-xs font-bold text-on-surface-variant">{examDetails.percentage}% ({examDetails.grade})</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {examDetails.questions.map((q, idx) => (
                <div key={idx} className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/15 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="text-sm font-bold text-on-surface">Question {q.questionNumber}</h5>
                      {q.questionText && <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5">{q.questionText}</p>}
                    </div>
                    <span className="text-sm font-black text-primary whitespace-nowrap ml-2">
                      {q.obtainedMarks} / {q.maximumMarks}
                    </span>
                  </div>

                  <div className="w-full bg-outline-variant/15 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        q.percentage >= 75 ? 'bg-green-600' : q.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(q.percentage, 100)}%` }}
                    />
                  </div>

                  {q.feedback && (
                    <p className="text-xs text-on-surface-variant italic bg-white/50 dark:bg-black/20 p-2 rounded-lg">
                      "{q.feedback}"
                    </p>
                  )}

                  {((q.matchedConcepts && q.matchedConcepts.length > 0) || (q.missingConcepts && q.missingConcepts.length > 0)) && (
                    <div className="flex flex-wrap gap-1.5 mt-1 text-[10px]">
                      {q.matchedConcepts?.map((mc, mIdx) => (
                        <span key={`mc-${mIdx}`} className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 rounded-md font-medium">
                          ✓ {mc}
                        </span>
                      ))}
                      {q.missingConcepts?.map((mic, miIdx) => (
                        <span key={`mic-${miIdx}`} className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded-md font-medium">
                          ! {mic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title="No question breakdown"
            description="Detailed question analytics for this selected exam could not be loaded."
          />
        )}
      </div>
    </div>
  );
};

export default Analytics;
