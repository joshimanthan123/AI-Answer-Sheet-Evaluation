import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { facultyService } from '../../services/faculty.service';
import { evaluationService } from '../../services/evaluation.service';
import { useNotifications } from '../../context/NotificationContext';
import { AnswerSheet, Evaluation, EvaluationDetail } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { AnswerSheetViewer } from '../../components/AnswerSheetViewer';

export const FacultyManualEvaluation: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useNotifications();

  const [sheet, setSheet] = useState<AnswerSheet | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [details, setDetails] = useState<EvaluationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Accordion active index
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number | null>(0);

  useEffect(() => {
    if (!id) return;
    const loadData = async () => {
      try {
        const [sheetObj, evalObj, questions] = await Promise.all([
          facultyService.getPendingEvaluations().then(list => list.find(s => s.id === id) || null),
          evaluationService.getEvaluationById('eval-1'), // use eval-1 as baseline template to populate manually
          evaluationService.getEvaluationDetails('eval-1')
        ]);
        if (sheetObj) setSheet(sheetObj);
        if (evalObj) setEvaluation(evalObj);
        if (questions) setDetails(questions);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  const handleScoreChange = (index: number, score: number) => {
    setDetails(prev => prev.map((q, idx) => {
      if (idx === index) {
        const val = Math.min(q.weight, Math.max(0, score));
        return { ...q, score: val, status: val === q.weight ? 'match' : val === 0 ? 'miss' : 'partial' };
      }
      return q;
    }));
  };

  const handleTextChange = (index: number, text: string) => {
    setDetails(prev => prev.map((q, idx) => {
      if (idx === index) {
        return { ...q, studentAnswer: text };
      }
      return q;
    }));
  };

  const getCalculatedTotal = () => {
    return details.reduce((sum, q) => sum + q.score, 0);
  };

  const handleApproveGrade = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const finalScore = getCalculatedTotal();
      await facultyService.approveGrading(id, finalScore, details);
      addToast(`Evaluation submitted and approved for student (Score: ${finalScore}/100)`, 'success');
      navigate('/faculty/pending');
    } catch (err) {
      addToast('Approval failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;
  if (!sheet) return <p className="text-error font-bold">Answer script file not found.</p>;

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in h-[calc(100vh-140px)]">
      {/* Header bar */}
      <section className="flex flex-col md:flex-row md:items-center justify-between border-b border-outline-variant/30 pb-4 shrink-0">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-semibold text-outline uppercase tracking-wider mb-1">
            <Link to="/faculty/pending" className="hover:text-primary hover:underline">Pending Audits</Link>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-primary font-bold">Evaluation Workspace</span>
          </nav>
          <h2 className="text-xl font-bold text-on-surface">Grading Workstation: {sheet.studentName}</h2>
          <p className="text-xs text-on-surface-variant">Subject: {sheet.subjectName} | Exam: {sheet.examName}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-2xl font-black text-primary font-display">{getCalculatedTotal()}</span>
            <span className="text-xs text-outline font-semibold"> / 100 Marks</span>
          </div>

          <Button 
            onClick={handleApproveGrade} 
            isLoading={saving}
            variant="primary"
            size="md"
          >
            Approve & Release
          </Button>
        </div>
      </section>

      {/* Flagship Split Workspace Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow overflow-hidden min-h-0">
        
        {/* Left Panel: Scanned Answer Sheet Viewer */}
        <div className="lg:col-span-6 flex flex-col h-full overflow-hidden">
          <AnswerSheetViewer sheetId={id || ''} isFaculty={true} />
        </div>

        {/* Right Panel: Interactive evaluation form accordions */}
        <div className="lg:col-span-6 flex flex-col border border-outline-variant/30 rounded-2xl bg-white dark:bg-surface-container overflow-hidden h-full">
          <div className="px-6 py-4 border-b border-outline-variant/30 bg-surface-container-low shrink-0 select-none">
            <h3 className="font-bold text-sm">Grading Rubric Checklist</h3>
          </div>

          <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-4">
            {details.map((q, idx) => {
              const isOpen = activeQuestionIdx === idx;
              return (
                <div key={q.id} className="border border-outline-variant/30 rounded-2xl overflow-hidden text-left bg-surface-container-low">
                  
                  {/* Accordion header button */}
                  <button 
                    onClick={() => setActiveQuestionIdx(isOpen ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between text-xs font-bold hover:bg-outline-variant/10 transition-colors cursor-pointer text-on-surface"
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isOpen ? 'bg-primary text-on-primary' : 'bg-outline-variant text-[10px]'
                      }`}>
                        Q{q.questionNumber}
                      </span>
                      <span className="truncate max-w-[200px] md:max-w-xs">{q.questionText}</span>
                    </span>

                    <div className="flex items-center gap-4">
                      {/* AI similarity threshold */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1 ${
                        q.status === 'match' ? 'bg-green-50 text-green-700' :
                        q.status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                      }`}>
                        <span className="material-symbols-outlined text-[10px] font-bold">
                          {q.status === 'match' ? 'check_circle' : q.status === 'partial' ? 'help' : 'cancel'}
                        </span>
                        {q.conceptMatch}% Match
                      </span>

                      <span className="font-display font-black text-primary text-sm">{q.score} / {q.weight}</span>
                      <span className="material-symbols-outlined text-outline">
                        {isOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </button>

                  {/* Accordion content */}
                  {isOpen && (
                    <div className="px-5 pb-5 border-t border-outline-variant/20 pt-4 flex flex-col gap-4 text-xs">
                      
                      {/* Grid flow: Student Handwriting vs OCR Recognized */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Student Handwriting (Stylus ink vector) */}
                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-[10px] text-outline uppercase select-none">Original Student Handwriting (Apple Pencil splines)</label>
                          <div className="border border-outline-variant/40 rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4 h-[120px] flex items-center justify-center relative overflow-hidden select-none">
                            {/* Stylus Ink Simulation SVG */}
                            <svg className="w-full h-full stroke-primary dark:stroke-primary-light fill-none stroke-[2] opacity-80" viewBox="0 0 400 100">
                              {q.questionNumber === 1 ? (
                                <>
                                  <path d="M 20,40 C 40,30 60,60 80,40 C 100,20 125,50 150,30" />
                                  <path d="M 160,40 C 180,30 190,50 210,40 C 230,30 250,50 270,30" />
                                  <path d="M 20,70 C 40,65 70,80 90,70 C 110,60 140,80 170,70" strokeDasharray="3 3" />
                                </>
                              ) : q.questionNumber === 2 ? (
                                <>
                                  <path d="M 10,30 Q 30,80 50,30 T 90,30" />
                                  <path d="M 110,50 C 130,40 150,60 170,40 C 190,20 210,50 230,30" />
                                </>
                              ) : (
                                <>
                                  <path d="M 30,50 C 60,30 90,70 120,50 C 150,30 180,60 210,40" />
                                  <path d="M 220,50 C 240,40 260,60 280,45" />
                                </>
                              )}
                            </svg>
                            <span className="absolute bottom-2 right-2 text-[9px] font-bold text-outline uppercase bg-surface-container px-1 py-0.2 rounded border border-outline-variant/10">Spline Stream</span>
                          </div>
                        </div>

                        {/* OCR Transcribed Student Response */}
                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-[10px] text-outline uppercase select-none">OCR Transcribed Student Response</label>
                          <textarea 
                            value={q.studentAnswer}
                            onChange={(e) => handleTextChange(idx, e.target.value)}
                            className="w-full px-4 py-3 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-xs text-on-surface-variant font-medium focus:outline-none focus:border-primary transition-colors h-[120px] leading-relaxed resize-none"
                          />
                        </div>
                      </div>

                      {/* Reference expectation */}
                      <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                        <p className="font-bold text-[10px] text-primary uppercase select-none">Model Answer (Instructor Solution Schema)</p>
                        <p className="text-on-surface-variant font-semibold mt-1 leading-relaxed">{q.expectedAnswer}</p>
                      </div>

                      {/* Similarity & Score Metrics Row */}
                      <div className="p-3 bg-surface-container rounded-xl flex flex-wrap justify-between items-center gap-4 border border-outline-variant/15 text-[11px]">
                        <div>
                          <span className="text-outline font-bold">Semantic NLP Similarity Index:</span>
                          <span className="ml-2 font-black text-secondary">{q.conceptMatch}% Match</span>
                        </div>
                        <div>
                          <span className="text-outline font-bold">Recommended AI Score:</span>
                          <span className="ml-2 font-black text-primary">{Math.round(q.weight * (q.conceptMatch / 100))} / {q.weight} Marks</span>
                        </div>
                      </div>

                      {/* Marks overwrite controls & comments comments */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                        <div className="col-span-1">
                          <Input 
                            label="Faculty Override Score"
                            type="number"
                            max={q.weight}
                            min={0}
                            value={String(q.score)}
                            onChange={(e) => handleScoreChange(idx, Number(e.target.value))}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input 
                            label="Re-evaluation Feedback Comments"
                            placeholder="Add evaluation remarks, concept notes..."
                          />
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
    </div>
  );
};

export default FacultyManualEvaluation;
