import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studentService } from '../../services/student.service';

export const ExamResult: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [resultData, setResultData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});

  const fetchResult = async () => {
    if (!examId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await studentService.getExamResult(examId);
      setResultData(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || 'Results are not available for download/viewing yet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResult();
  }, [examId]);

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 py-10 text-left animate-pulse max-w-4xl mx-auto">
        <div className="h-6 bg-outline-variant/10 rounded w-1/4"></div>
        <div className="h-4 bg-outline-variant/10 rounded w-1/2"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-6 h-28 rounded-2xl bg-outline-variant/10 border border-outline-variant/5"></div>
          ))}
        </div>
        <div className="glass-card p-6 h-64 rounded-2xl bg-outline-variant/10 border border-outline-variant/5"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 animate-fade-in max-w-md mx-auto">
        <span className="material-symbols-outlined text-red-500 text-5xl">lock</span>
        <h3 className="text-lg font-bold text-on-surface font-display">Evaluation Result Unavailable</h3>
        <p className="text-xs text-on-surface-variant leading-relaxed">{error}</p>
        <div className="flex gap-4 mt-2">
          <button 
            onClick={() => fetchResult()}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:shadow-md hover:bg-primary/95 text-center transition-all whitespace-nowrap active:scale-95 cursor-pointer mt-2"
          >
            Retry Fetch
          </button>
          <button 
            onClick={() => navigate('/student/exams')}
            className="px-6 py-2.5 bg-surface-variant text-on-surface-variant border border-outline-variant rounded-xl text-xs font-bold hover:bg-outline-variant/10 transition-all text-center whitespace-nowrap active:scale-95 cursor-pointer mt-2"
          >
            Go to Exams
          </button>
        </div>
      </div>
    );
  }

  const { exam = {}, result = {}, questions = [] } = resultData || {};
  const totalObtained = result.obtainedMarks ?? 0;
  const totalMax = result.totalMarks ?? 0;
  const percentage = result.percentage ?? (totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : 0);

  return (
    <div className="flex flex-col gap-6 py-4 text-left animate-fade-in max-w-4xl mx-auto">
      {/* Back button */}
      <div>
        <button 
          onClick={() => navigate('/student/exams')}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors bg-transparent border-0 cursor-pointer p-0"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Exams
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-on-surface font-display">{exam.name || 'Exam Result'}</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Subject Code: <strong className="text-on-surface">{exam.subjectCode || 'N/A'}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 font-mono text-xs font-bold rounded-xl border border-green-200">
          <span className="material-symbols-outlined text-sm">verified_user</span>
          Published
        </div>
      </div>

      {/* Bento score cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Score Card */}
        <div className="glass-card p-6 rounded-2xl bg-surface border border-outline-variant/10 relative overflow-hidden shadow-sm flex flex-col gap-1">
          <p className="text-xxs font-bold text-on-surface-variant uppercase tracking-wider">Total Score</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-black text-on-surface font-display">{totalObtained}</span>
            <span className="text-sm text-on-surface-variant">/ {totalMax} Marks</span>
          </div>
        </div>

        {/* Percentage Card */}
        <div className="glass-card p-6 rounded-2xl bg-surface border border-outline-variant/10 relative overflow-hidden shadow-sm flex flex-col gap-1">
          <p className="text-xxs font-bold text-on-surface-variant uppercase tracking-wider">Performance Percentage</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-black text-primary font-display">{percentage}%</span>
          </div>
        </div>

        {/* Grade Card */}
        <div className="glass-card p-6 rounded-2xl bg-surface border border-outline-variant/10 relative overflow-hidden shadow-sm flex flex-col gap-1">
          <p className="text-xxs font-bold text-on-surface-variant uppercase tracking-wider">Assigned Grade</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-bold text-green-600 font-display">
              {result.grade || 'Passed'}
            </span>
          </div>
        </div>
      </div>

      {/* Questions breakdowns */}
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base">analytics</span>
          Question-Wise Score breakdown
        </h3>

        <div className="flex flex-col gap-4">
          {questions.map((q: any) => {
            const isExpanded = !!expandedQuestions[q.questionId];
            return (
              <div 
                key={q.questionId}
                className="glass-card rounded-2xl bg-surface border border-outline-variant/10 overflow-hidden shadow-sm transition-all"
              >
                {/* Accordion header */}
                <div 
                  onClick={() => toggleQuestion(q.questionId)}
                  className="p-5 flex justify-between items-start gap-4 cursor-pointer hover:bg-outline-variant/5 transition-colors select-none"
                >
                  <div className="flex gap-3 items-start">
                    <span className="px-2.5 py-1 bg-outline-variant/10 rounded-lg text-xxs font-bold text-on-surface-variant font-mono">
                      Q{q.questionNumber || '#'}
                    </span>
                    <p className="text-sm font-bold text-on-surface line-clamp-1 md:line-clamp-none max-w-xl text-left">
                      {q.questionText}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-xs font-bold text-on-surface font-mono">
                      {q.obtainedMarks} / {q.maxMarks} Marks
                    </span>
                    <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-250 ${isExpanded ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Collapsible details section */}
                {isExpanded && (
                  <div className="border-t border-outline-variant/15 p-5 bg-outline-variant/3 animate-fade-in flex flex-col gap-4">
                    {/* Full Question Text */}
                    <div className="text-left">
                      <p className="text-xxs font-bold text-on-surface-variant uppercase tracking-wider">Question Context</p>
                      <p className="text-xs text-on-surface mt-1 leading-relaxed">{q.questionText}</p>
                    </div>

                    {/* Evaluation Feedback */}
                    <div className="text-left">
                      <p className="text-xxs font-bold text-on-surface-variant uppercase tracking-wider">AI/Faculty Evaluation Feedback</p>
                      <div className="mt-1.5 p-4 rounded-xl bg-surface border border-outline-variant/10">
                        {q.feedback ? (
                          <p className="text-xs text-on-surface leading-relaxed whitespace-pre-line">
                            {q.feedback}
                          </p>
                        ) : (
                          <p className="text-xs italic text-on-surface-variant">
                            No evaluative feedback comments were left for this question.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExamResult;
