import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { resultsService } from '../../services/results.service';

interface QuestionResultDetail {
  questionId: string;
  questionNumber: number;
  questionText: string;
  maxMarks: number;
  recognizedText: string;
  studentAnswer: string;
  modelAnswer: string;
  aiAwardedMarks: number;
  finalAwardedMarks: number;
  wasOverridden: boolean;
  overrideReason?: string;
  facultyComment?: string;
  feedback: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  criteriaScores: { criterion: string; marksAwarded: number; maxMarks: number }[];
}

interface ResultDetail {
  evaluationId: string;
  answerSheetId: string;
  studentIdentifier: string;
  studentName?: string;
  filename?: string;
  examId?: string;
  examTitle: string;
  examCode?: string;
  subjectName?: string;
  subjectCode?: string;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  grade?: string;
  status: string;
  finalizedAt?: string;
  strengths?: string;
  weaknesses?: string;
  suggestions?: string;
  questions: QuestionResultDetail[];
}

export const IndividualResult: React.FC = () => {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const { addToast } = useNotifications();

  const [result, setResult] = useState<ResultDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!evaluationId) return;
      try {
        setLoading(true);
        const data = await resultsService.getIndividualResult(evaluationId);
        setResult(data);
      } catch (err: any) {
        console.error('Error fetching individual result:', err);
        addToast(err.response?.data?.message || 'Failed to retrieve candidate result profile.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [evaluationId]);

  const handlePrintReport = () => {
    if (!evaluationId) return;
    resultsService.downloadIndividualReport(evaluationId);
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  if (!result) {
    return (
      <div className="glass-card p-12 text-center max-w-xl mx-auto my-12 border border-outline-variant/20 bg-white dark:bg-surface-container">
        <span className="material-symbols-outlined text-error text-4xl block mb-2">warning</span>
        <h3 className="font-bold text-sm text-on-surface">Result Profile Missing</h3>
        <p className="text-xs text-outline mt-1">Underlying details are not accessible, or you do not have permissions.</p>
        <Link to="/faculty/exams" className="mt-4 inline-block text-xs font-bold text-primary hover:underline">
          Back to Exams
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-left max-w-4xl mx-auto py-6 animate-fade-in font-sans">
      
      {/* Header section with back index */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/20 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-outline font-semibold select-none">
            <Link to="/faculty/exams" className="hover:text-primary">Exams</Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            {result.examId && (
              <>
                <Link to={`/faculty/exams/${result.examId}`} className="hover:text-primary font-bold">{result.examTitle}</Link>
                <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                <Link to={`/faculty/exams/${result.examId}/results`} className="hover:text-primary font-bold">Results & Analytics</Link>
                <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              </>
            )}
            <span className="text-on-surface">Candidate Result</span>
          </div>
          <h2 className="text-2xl font-black text-on-surface font-display mt-1">
            Candidate Result Summary
          </h2>
          <p className="text-xs text-outline">
            Detailed evaluation breakdown, handwritten transcription metrics, and feedback.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.history.back()}
            className="px-3.5 py-2 border border-outline-variant/35 text-on-surface hover:bg-surface-container-low text-xs font-bold rounded-xl transition active:scale-95"
          >
            Go Back
          </button>
          <button
            onClick={handlePrintReport}
            className="px-3.5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 hover:shadow active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">print</span>
            Print Report
          </button>
        </div>
      </div>

      {/* Metadata cards layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Candidate & Exam info profile */}
        <div className="md:col-span-1 space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container space-y-4 text-xs">
            <h3 className="text-xs font-black text-outline uppercase tracking-wider">Candidate Details</h3>
            
            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] text-outline block uppercase font-bold">Student Identifier</span>
                <span className="font-bold text-sm text-on-surface">{result.studentIdentifier}</span>
              </div>
              {result.studentName && (
                <div>
                  <span className="text-[10px] text-outline block uppercase font-bold">Candidate Name</span>
                  <span className="font-semibold text-on-surface">{result.studentName}</span>
                </div>
              )}
              {result.filename && (
                <div>
                  <span className="text-[10px] text-outline block uppercase font-bold">Uploaded File</span>
                  <span className="font-medium text-outline truncate block max-w-full" title={result.filename}>
                    {result.filename}
                  </span>
                </div>
              )}
            </div>

            <hr className="border-outline-variant/15" />

            <h3 className="text-xs font-black text-outline uppercase tracking-wider">Exam Reference</h3>
            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] text-outline block uppercase font-bold">Exam Title</span>
                <span className="font-semibold text-on-surface">{result.examTitle}</span>
              </div>
              {result.subjectName && (
                <div>
                  <span className="text-[10px] text-outline block uppercase font-bold">Subject Code / Name</span>
                  <span className="font-medium text-on-surface">
                    {result.subjectCode} - {result.subjectName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Conceptual highlights checklist */}
          <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container space-y-4 text-xs">
            <h3 className="text-xs font-black text-outline uppercase tracking-wider">Conceptual Profile</h3>
            
            {result.strengths && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 rounded-xl border border-emerald-250 select-none">
                <span className="font-bold block mb-1">🔑 Strengths</span>
                <p className="leading-relaxed text-[11px] font-medium">{result.strengths}</p>
              </div>
            )}

            {result.weaknesses && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 rounded-xl border border-rose-200 select-none">
                <span className="font-bold block mb-1">⚠️ Deficiencies</span>
                <p className="leading-relaxed text-[11px] font-medium">{result.weaknesses}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: score panel and questions list */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Main marks badge card */}
          <div className="glass-card p-6 rounded-2xl border-outline-variant/30 text-center bg-primary text-on-primary space-y-1.5 shadow select-none">
            <span className="text-[10px] text-primary-container font-black uppercase tracking-wider">Final Grade Awarded</span>
            <h3 className="text-3xl font-black">{result.obtainedMarks} / {result.totalMarks} Marks</h3>
            <p className="text-xs font-bold text-primary-container uppercase">
              Percentage: {result.percentage}% • Grade: {result.grade || 'C'}
            </p>
          </div>

          {/* Questionwise breakdown */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-outline uppercase tracking-wider">Question Wise Evaluation Details</h3>
            
            {result.questions.map((q) => (
              <div key={q.questionId} className="glass-card p-5 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container space-y-3.5">
                <div className="flex justify-between items-start border-b border-outline-variant/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-9 rounded bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">
                      Q{q.questionNumber}
                    </span>
                    {q.wasOverridden && (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[8.5px] font-black uppercase rounded">
                        Faculty Overridden
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-black text-on-surface">
                    Score: {q.finalAwardedMarks} / {q.maxMarks}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[9px] text-outline block uppercase font-bold">Question Text</span>
                    <p className="font-semibold text-on-surface leading-normal mt-0.5">{q.questionText}</p>
                  </div>

                  <div>
                    <span className="text-[9px] text-outline block uppercase font-bold">Transcription Output</span>
                    <div className="p-3 bg-surface-container-low rounded-xl font-mono text-[10.5px] border border-outline-variant/10 mt-1 whitespace-pre-wrap leading-relaxed text-on-surface">
                      {q.studentAnswer || q.recognizedText || '[No written content detected]'}
                    </div>
                  </div>

                  {q.modelAnswer && (
                    <div>
                      <span className="text-[9px] text-outline block uppercase font-bold">Model Answer Guideline</span>
                      <p className="text-outline mt-0.5 leading-relaxed">{q.modelAnswer}</p>
                    </div>
                  )}

                  {q.feedback && (
                    <div>
                      <span className="text-[9px] text-outline block uppercase font-bold">AI Rubric Critique</span>
                      <p className="text-on-surface-variant font-medium mt-0.5 leading-relaxed">{q.feedback}</p>
                    </div>
                  )}

                  {/* Rubric evaluation criteria scores */}
                  {q.criteriaScores && q.criteriaScores.length > 0 && (
                    <div className="space-y-2 mt-2">
                      <span className="text-[9.5px] text-outline block uppercase font-black tracking-wider">Evaluation Rubric Matrix</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.criteriaScores.map((crit, idx) => (
                          <div key={idx} className="bg-surface-container-low p-2 rounded-lg border border-outline-variant/5 text-[10.5px] flex justify-between items-center">
                            <span className="font-semibold text-outline truncate max-w-[130px]">{crit.criterion}</span>
                            <span className="font-black text-on-surface">{crit.marksAwarded} / {crit.maxMarks}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* NLP Keywords indicators */}
                  {(q.matchedKeywords.length > 0 || q.missingKeywords.length > 0) && (
                    <div className="pt-2 border-t border-outline-variant/10 flex flex-col gap-1.5 text-[10px]">
                      {q.matchedKeywords.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="font-bold text-emerald-700 uppercase mr-1">🌱 Matched:</span>
                          {q.matchedKeywords.map((kw, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-medium">
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                      {q.missingKeywords.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="font-bold text-rose-700 uppercase mr-1">⚠️ Missing:</span>
                          {q.missingKeywords.map((kw, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-rose-50 text-rose-800 border border-rose-250 rounded font-medium">
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {q.wasOverridden && (q.facultyComment || q.overrideReason) && (
                    <div className="p-3 bg-amber-50/50 dark:bg-amber-955/20 border-l-4 border-amber-600 rounded text-[11px] text-on-surface-variant font-medium space-y-1">
                      <span className="text-[9px] text-amber-800 dark:text-amber-500 uppercase font-black tracking-wider block">Faculty Override Justification</span>
                      {q.overrideReason && <p><b>Reason:</b> {q.overrideReason}</p>}
                      {q.facultyComment && <p><b>Comments:</b> "{q.facultyComment}"</p>}
                    </div>
                  )}

                </div>
              </div>
            ))}
          </div>

        </div>

      </div>

    </div>
  );
};

export default IndividualResult;
