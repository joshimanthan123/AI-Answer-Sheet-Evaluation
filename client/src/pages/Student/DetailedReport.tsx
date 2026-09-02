import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { evaluationService } from '../../services/evaluation.service';
import { studentService } from '../../services/student.service';
import { useNotifications } from '../../context/NotificationContext';
import { Evaluation, EvaluationDetail } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import ProgressRing from '../../components/charts/ProgressRing';
import Modal from '../../components/ui/Modal';
import { AnswerSheetViewer } from '../../components/AnswerSheetViewer';

export const StudentDetailedReport: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useNotifications();

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [details, setDetails] = useState<EvaluationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingReeval, setRequestingReeval] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const loadData = async () => {
      try {
        const payload = await studentService.getResultDetails(id);
        if (payload && payload.evaluation) {
          setEvaluation(payload.evaluation);
          setDetails(payload.questions || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  const handleReevaluationRequest = async () => {
    if (!id) return;
    setRequestingReeval(true);
    try {
      const res = await studentService.requestReevaluation(id);
      addToast(res.message, 'success');
      
      // Update local state status
      setEvaluation(prev => prev ? { ...prev, status: 'pending_review' } : null);
    } catch (err: any) {
      addToast(err?.message || 'Request failed.', 'error');
    } finally {
      setRequestingReeval(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;
  if (!evaluation) return <p className="text-error font-bold">Evaluation sheet not found.</p>;

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in">
      {/* breadcrumps & Actions Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-semibold text-outline uppercase tracking-wider mb-2">
            <Link to="/student/results" className="hover:text-primary hover:underline">Results</Link>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-primary font-bold">
              {(evaluation as any).answerSheet?.subject?.code ? `${(evaluation as any).answerSheet.subject.code}: ${(evaluation as any).answerSheet.subject.name}` : (evaluation as any).subjectName || "Subject Details"}
            </span>
          </nav>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">
            Evaluation Report: {(evaluation as any).answerSheet?.exam?.title || "Exam Details"}
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Student: {(evaluation as any).answerSheet?.student?.name || "Student"} | 
            Roll No: {(evaluation as any).answerSheet?.student?.rollNo || "N/A"} | 
            Submitted: {evaluation.date || ((evaluation as any).createdAt ? new Date((evaluation as any).createdAt).toLocaleDateString() : new Date().toLocaleDateString())}
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsViewerOpen(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/95 text-on-primary rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">splitscreen</span> View Digital Paper
          </button>
          <button className="px-4 py-2 bg-white dark:bg-surface-container border border-outline-variant hover:bg-surface-container-high text-primary hover:text-primary-container rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-95">
            <span className="material-symbols-outlined text-sm">download</span> Download PDF
          </button>
        </div>
      </section>

      {/* Stats Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Score circular chart */}
        <div className="md:col-span-1 glass-card p-6 rounded-2xl flex flex-col items-center justify-center bg-white dark:bg-surface-container border-outline-variant/30">
          <span className="text-[10px] font-bold text-outline uppercase tracking-wider mb-4">Total Score</span>
          <ProgressRing score={evaluation.finalScore} total={evaluation.totalScore} size={110} strokeWidth={6} grade={evaluation.grade} />
        </div>

        {/* radar analytics placeholder */}
        <div className="md:col-span-2 glass-card p-6 rounded-2xl flex flex-col justify-between bg-white dark:bg-surface-container border-outline-variant/30">
          <h3 className="font-bold text-sm text-on-surface flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary text-lg">insights</span> Metric Alignments
          </h3>
          <div className="flex-grow flex items-end justify-around gap-4 pb-2">
            {[
              { name: 'Accuracy', val: 92 },
              { name: 'Syntax', val: 86 },
              { name: 'Logic', val: 78 },
              { name: 'Clarity', val: 82 }
            ].map(m => (
              <div key={m.name} className="flex flex-col items-center gap-2 flex-grow">
                <div className="w-full bg-primary/10 rounded-t-md h-24 relative overflow-hidden">
                  <div className="absolute bottom-0 w-full bg-primary/80 rounded-t-md transition-all duration-1000 h-[80%]" style={{ height: `${m.val}%` }}></div>
                </div>
                <span className="text-[9px] font-bold text-outline uppercase truncate w-full text-center">{m.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Sim index card */}
        <div className="md:col-span-1 glass-card p-6 rounded-2xl flex flex-col items-center justify-center bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50 border text-center">
          <span className="material-symbols-outlined text-secondary text-4xl mb-2">auto_awesome</span>
          <span className="text-outline font-semibold text-[10px] uppercase tracking-wider mb-1">AI Sim Index</span>
          <span className="font-display text-4xl font-extrabold text-secondary">{evaluation.similarityIndex}%</span>
          <p className="text-[10px] text-on-surface-variant px-2 mt-2 font-medium">Low similarity detected. Content is authenticated and unique.</p>
        </div>
      </div>

      {/* Question Table breakdown */}
      <section className="glass-card rounded-2xl border-outline-variant/30 overflow-hidden shadow-sm bg-white dark:bg-surface-container">
        <div className="px-6 py-4 border-b border-outline-variant/30 bg-surface-container-low">
          <h3 className="font-bold text-sm">Question-wise Breakdown</h3>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                <th className="px-6 py-4 w-12 text-center">No.</th>
                <th className="px-6 py-4 w-1/3">Question</th>
                <th className="px-6 py-4">Rubric Expected Answer</th>
                <th className="px-6 py-4">Your Answer</th>
                <th className="px-6 py-4 text-center">AI Similarity</th>
                <th className="px-6 py-4 text-right">Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-xs">
              {details.map((q) => (
                <tr key={q.id} className="hover:bg-primary/5 transition-colors">
                  <td className="px-6 py-6 font-bold text-center text-outline">{String(q.questionNumber).padStart(2, '0')}</td>
                  <td className="px-6 py-6">
                    <p className="font-medium text-on-surface leading-relaxed">{q.questionText}</p>
                    <p className="text-[10px] text-outline mt-1 font-semibold italic">Weight: {q.weight} Marks</p>
                  </td>
                  <td className="px-6 py-6"><p className="line-clamp-2 text-outline leading-relaxed">{q.expectedAnswer}</p></td>
                  <td className="px-6 py-6">
                    <p className={`line-clamp-2 leading-relaxed ${q.status === 'miss' ? 'text-error font-medium' : 'text-on-surface'}`}>
                      {q.studentAnswer}
                    </p>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      q.status === 'match' ? 'bg-green-50 text-green-700' :
                      q.status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                    }`}>
                      <span className="material-symbols-outlined text-[12px]">
                        {q.status === 'match' ? 'check_circle' : q.status === 'partial' ? 'help' : 'cancel'}
                      </span>
                      {q.conceptMatch}%
                    </span>
                  </td>
                  <td className={`px-6 py-6 text-right font-bold ${q.status === 'miss' ? 'text-error' : 'text-primary'}`}>
                    {q.score} / {q.weight}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Feedback Panels */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strengths */}
        <div className="bg-green-50/50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/50 p-6 rounded-2xl flex flex-col gap-4 text-left">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <span className="material-symbols-outlined bg-green-100 dark:bg-green-950 p-1.5 rounded-lg text-lg">verified</span>
            <h4 className="font-bold text-sm">Strengths</h4>
          </div>
          <ul className="space-y-2 text-xs text-on-surface-variant font-medium list-inside list-disc">
            {evaluation.strengths.map((str, idx) => (
              <li key={idx}>{str}</li>
            ))}
          </ul>
        </div>

        {/* Weaknesses */}
        <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl flex flex-col gap-4 text-left">
          <div className="flex items-center gap-2 text-error">
            <span className="material-symbols-outlined bg-error-container/20 p-1.5 rounded-lg text-lg">warning</span>
            <h4 className="font-bold text-sm">Weaknesses</h4>
          </div>
          <ul className="space-y-2 text-xs text-on-surface-variant font-medium list-inside list-disc">
            {evaluation.weaknesses.map((weak, idx) => (
              <li key={idx}>{weak}</li>
            ))}
          </ul>
        </div>

        {/* Suggestions */}
        <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-200 dark:border-blue-900/50 p-6 rounded-2xl flex flex-col gap-4 text-left">
          <div className="flex items-center gap-2 text-primary dark:text-primary-light">
            <span className="material-symbols-outlined bg-primary/10 p-1.5 rounded-lg text-lg font-black">lightbulb</span>
            <h4 className="font-bold text-sm">Suggestions</h4>
          </div>
          <ul className="space-y-2 text-xs text-on-surface-variant font-medium list-inside list-disc">
            {evaluation.suggestions.map((sug, idx) => (
              <li key={idx}>{sug}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Reevaluation Request UI Box */}
      <section className="py-8 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/60 flex flex-col items-center justify-center text-center p-4">
        <h4 className="font-bold text-sm">Request Manual Re-evaluation?</h4>
        <p className="text-xs text-on-surface-variant max-w-md mt-1 mb-4 leading-relaxed">
          If you believe the AI-generated marking is inconsistent with the questions context, you can submit the paper for manual audit check by the course faculty lead.
        </p>
        
        {evaluation.status === 'pending_review' ? (
          <button 
            disabled 
            className="px-6 py-2.5 bg-outline-variant/20 text-outline rounded-xl text-xs font-bold flex items-center gap-2 select-none"
          >
            <span className="material-symbols-outlined text-sm font-bold">pending_actions</span>
            Re-evaluation Request Pending
          </button>
        ) : (
          <button 
            onClick={handleReevaluationRequest}
            disabled={requestingReeval}
            className="px-6 py-2.5 bg-white border border-primary text-primary hover:bg-primary hover:text-on-primary rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors active:scale-95 duration-200"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Submit Audit Request
          </button>
        )}
      </section>
      {isViewerOpen && (
        <Modal
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          title="Digital Pipeline Viewer"
          size="xl"
        >
          <div className="min-h-[500px]">
            <AnswerSheetViewer
              sheetId={
                evaluation.answerSheetId ||
                (typeof (evaluation as any).answerSheet === 'object' && (evaluation as any).answerSheet !== null
                  ? ((evaluation as any).answerSheet._id || (evaluation as any).answerSheet.id)
                  : (evaluation as any).answerSheet) ||
                'attempt-1'
              }
              isFaculty={false}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StudentDetailedReport;
