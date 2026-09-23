import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { evaluationService } from '../../services/evaluation.service';
import answerSheetService from '../../services/answerSheet.service';
import { examService, Exam } from '../../services/exam.service';
import { useNotifications } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { AnswerSheetViewer } from '../../components/AnswerSheetViewer';

interface EvaluationQuestionDetail {
  _id?: string;
  questionId: string;
  recognizedText: string;
  studentAnswer: string;
  modelAnswer: string;
  similarityScore: number;
  aiMarks: number;
  finalAwardedMarks?: number;
  feedback: string;
  confidence?: number;
  criteriaScores?: Array<{
    criterion: string;
    marksAwarded: number;
    maxMarks: number;
  }>;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  wasOverridden?: boolean;
  facultyComment?: string;
  // Resolved info from Exam
  questionNumber?: number;
  questionText?: string;
  maxMarks?: number;
  status?: string;
  evaluationStatus?: string;
  errorMessage?: string;
  aiEvaluation?: {
    confidence?: number;
    matchedConcepts?: string[];
    missingConcepts?: string[];
    criteria?: Array<any>;
    feedback?: string;
  };
}

export const FacultyManualEvaluation: React.FC = () => {
  const { id: sheetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useNotifications();

  const [sheet, setSheet] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [questions, setQuestions] = useState<EvaluationQuestionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);

  // Accordion active index
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number | null>(0);

  // Form states matching current active question
  const [overrideScore, setOverrideScore] = useState<string>('');
  const [facultyFeedback, setFacultyFeedback] = useState<string>('');

  const loadData = async () => {
    if (!sheetId) return;
    try {
      setLoading(true);
      const sheetRes = await answerSheetService.getFacultySheetDetail(sheetId);
      const sheetObj = sheetRes.data || sheetRes;
      setSheet(sheetObj);

      if (sheetObj && sheetObj.exam) {
        const examId = typeof sheetObj.exam === 'object' ? sheetObj.exam._id || sheetObj.exam.id : sheetObj.exam;
        const examObj = await examService.getExamById(examId);

        const evalObj = await evaluationService.getEvaluationByAnswerSheetId(sheetId);
        setEvaluation(evalObj);

        if (evalObj && evalObj.questions) {
          const resolvedQuestions = evalObj.questions.map((q: any) => {
            const matchQ = examObj.questions.find((eq: any) => eq._id.toString() === q.questionId.toString());
            return {
              ...q,
              questionNumber: matchQ ? matchQ.questionNumber : undefined,
              questionText: matchQ ? matchQ.questionText : 'Question details not found.',
              maxMarks: matchQ ? matchQ.maximumMarks : 10,
            };
          });
          // Sort by question number
          resolvedQuestions.sort((a: any, b: any) => (a.questionNumber || 0) - (b.questionNumber || 0));
          setQuestions(resolvedQuestions);

          // Populate initial form inputs for the first question
          if (resolvedQuestions.length > 0) {
            const first = resolvedQuestions[0];
            setOverrideScore(String(first.finalAwardedMarks !== undefined ? first.finalAwardedMarks : first.aiMarks));
            setFacultyFeedback(first.facultyComment || '');
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.message || 'Failed to load evaluation details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sheetId]);

  // Sync inputs when changing active question accordion
  useEffect(() => {
    if (activeQuestionIdx !== null && questions[activeQuestionIdx]) {
      const q = questions[activeQuestionIdx];
      setOverrideScore(String(q.finalAwardedMarks !== undefined ? q.finalAwardedMarks : q.aiMarks));
      setFacultyFeedback(q.facultyComment || '');
    }
  }, [activeQuestionIdx, questions]);

  const handleSaveQuestionReview = async (idx: number) => {
    if (!evaluation) return;
    const q = questions[idx];
    const scoreVal = Number(overrideScore);
    const maxVal = q.maxMarks || 10;

    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > maxVal) {
      addToast(`Please award valid marks between 0 and maximum allowed marks (${maxVal})`, 'warning');
      return;
    }

    try {
      setSavingId(q.questionId);
      const res = await evaluationService.reviewQuestion(
        evaluation._id, 
        q.questionId, 
        scoreVal, 
        facultyFeedback
      );
      
      addToast(`Saved marks override for Question ${q.questionNumber || idx + 1}.`, 'success');
      
      // Update local state
      setQuestions(prev => prev.map((item, i) => {
        if (i === idx) {
          return {
            ...item,
            finalAwardedMarks: scoreVal,
            facultyComment: facultyFeedback,
            wasOverridden: true
          };
        }
        return item;
      }));

      // Update evaluation obtainedMarks locally
      if (res && res.obtainedMarks !== undefined) {
        setEvaluation((prev: any) => ({
          ...prev,
          obtainedMarks: res.obtainedMarks,
          percentage: res.percentage,
          grade: res.grade
        }));
      }
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.message || 'Failed to override question marks.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleFinalize = async () => {
    if (!evaluation) return;
    try {
      setFinalizing(true);
      await evaluationService.finalizeEvaluation(evaluation._id);
      addToast('Evaluation scores locked and finalized successfully.', 'success');
      // Navigate back to the exam's answer sheets list
      const examId = typeof sheet.exam === 'object' ? sheet.exam._id || sheet.exam.id : sheet.exam;
      navigate(`/faculty/exams/${examId}/answer-sheets`);
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.message || 'Failed to finalize evaluation.', 'error');
    } finally {
      setFinalizing(false);
    }
  };

  const handleReEvaluate = async () => {
    if (!sheetId) return;
    if (!window.confirm('Are you sure you want to reset all overrides and trigger AI re-evaluation?')) return;
    try {
      setReEvaluating(true);
      await evaluationService.reEvaluate(sheetId);
      addToast('AI re-evaluation triggered. Reloading workspace in a moment...', 'success');
      setTimeout(() => {
        loadData();
        setReEvaluating(false);
      }, 3000);
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.message || 'Failed to trigger re-evaluation.', 'error');
      setReEvaluating(false);
    }
  };

  const getCalculatedTotal = () => {
    return questions.reduce((sum, q) => sum + (q.finalAwardedMarks !== undefined ? q.finalAwardedMarks : q.aiMarks), 0);
  };

  const getMaxTotalMarks = () => {
    return questions.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;
  if (!sheet) return <p className="text-error font-bold p-8">Answer sheet details not found.</p>;

  const examTitle = typeof sheet.exam === 'object' ? sheet.exam.title : 'Exam Layout';
  const studentName = sheet.student ? sheet.student.name : sheet.studentIdentifier || 'Candidate';

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in h-[calc(100vh-140px)]">
      {/* Header bar */}
      <section className="flex flex-col md:flex-row md:items-center justify-between border-b border-outline-variant/30 pb-4 shrink-0 font-sans">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-semibold text-outline uppercase tracking-wider mb-1">
            <Link to="/faculty/exams" className="hover:text-primary hover:underline">Exams</Link>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <Link to={`/faculty/exams/${typeof sheet.exam === 'object' ? sheet.exam._id : sheet.exam}/answer-sheets`} className="hover:text-primary hover:underline">Answer Sheets</Link>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-primary font-bold">Review Workspace</span>
          </nav>
          <h2 className="text-xl font-bold text-on-surface">Review Workstation: {studentName}</h2>
          <p className="text-xs text-on-surface-variant">Exam: {examTitle} {sheet.student?.rollNo ? `| Student Roll: ${sheet.student.rollNo}` : ''}</p>
        </div>

        <div className="flex items-center gap-4 mt-2 md:mt-0">
          <div className="text-right">
            <span className="text-2xl font-black text-primary font-display">{getCalculatedTotal()}</span>
            <span className="text-xs text-outline font-semibold"> / {getMaxTotalMarks()} Marks</span>
            {evaluation && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-primary/10 text-primary border border-primary/20">
                GRADE {evaluation.grade || 'F'}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleReEvaluate}
              isLoading={reEvaluating}
              variant="outline"
              size="md"
              title="Reset manual overrides and re-evaluate via AI"
            >
              Re-Evaluate
            </Button>
            <Button 
              onClick={handleFinalize} 
              isLoading={finalizing}
              variant="primary"
              size="md"
              disabled={!evaluation || evaluation.evaluationStatus === 'finalized'}
            >
              {evaluation?.evaluationStatus === 'finalized' ? 'Finalized' : 'Finalize & Lock'}
            </Button>
          </div>
        </div>
      </section>

      {/* Flagship Split Workspace Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow overflow-hidden min-h-0">
        
        {/* Left Panel: Scanned Answer Sheet Viewer */}
        <div className="lg:col-span-6 flex flex-col h-full overflow-hidden">
          <AnswerSheetViewer sheetId={sheetId || ''} isFaculty={true} />
        </div>

        {/* Right Panel: Interactive evaluation form accordions */}
        <div className="lg:col-span-6 flex flex-col border border-outline-variant/30 rounded-2xl bg-white dark:bg-surface-container overflow-hidden h-full font-sans">
          <div className="px-6 py-4 border-b border-outline-variant/30 bg-surface-container-low shrink-0 select-none flex justify-between items-center">
            <h3 className="font-bold text-xs uppercase tracking-wider text-outline">Interactive Audit Rubric</h3>
            {evaluation && (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border ${
                evaluation.evaluationStatus === 'finalized'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                {evaluation.evaluationStatus}
              </span>
            )}
          </div>

          <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-4">
            {questions.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <span className="material-symbols-outlined text-3xl text-outline-variant">error_outline</span>
                <p className="text-xs text-outline italic">No question-wise AI evaluation results found.</p>
              </div>
            ) : (
              questions.map((q, idx) => {
                const isOpen = activeQuestionIdx === idx;
                const activeScore = q.finalAwardedMarks !== undefined ? q.finalAwardedMarks : q.aiMarks;
                return (
                  <div key={q.questionId} className="border border-outline-variant/30 rounded-2xl overflow-hidden text-left bg-surface-container-low">
                    
                    {/* Accordion header button */}
                    <button 
                      onClick={() => setActiveQuestionIdx(isOpen ? null : idx)}
                      className="w-full px-5 py-4 flex items-center justify-between text-xs font-bold hover:bg-outline-variant/10 transition-colors cursor-pointer text-on-surface"
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isOpen ? 'bg-primary text-on-primary' : 'bg-outline-variant text-[10px]'
                        }`}>
                          Q{q.questionNumber || idx + 1}
                        </span>
                        <span className="truncate max-w-[200px] md:max-w-xs">{q.questionText}</span>
                      </span>

                      <div className="flex items-center gap-4">
                        {q.wasOverridden && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] bg-amber-100 text-amber-800 uppercase font-black">
                            Overridden
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1 ${
                          q.similarityScore >= 60 ? 'bg-green-50 text-green-700' :
                          q.similarityScore >= 30 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {q.similarityScore}% Match
                        </span>

                        <span className="font-display font-black text-primary text-sm">{activeScore} / {q.maxMarks || 10}</span>
                        <span className="material-symbols-outlined text-outline">
                          {isOpen ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </button>

                    {/* Accordion content */}
                    {isOpen && (
                      <div className="px-5 pb-5 border-t border-outline-variant/20 pt-4 flex flex-col gap-4 text-xs">
                        
                        {/* Student Handwriting vs OCR Recognized */}
                        <div className="grid grid-cols-1 gap-4">
                          {/* OCR Transcribed Student Response */}
                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-[10px] text-outline uppercase select-none">OCR Digitized Text</label>
                            <div className="w-full px-4 py-3 border border-outline-variant/30 rounded-xl bg-surface-container-lowest text-xs text-on-surface-variant font-semibold leading-relaxed min-h-[60px]">
                              {(() => {
                                const qObj: any = q;
                                const qIdStr = String(qObj.questionId?._id || qObj.questionId || '');
                                const sheetAns = sheet?.answers?.find((a: any) => 
                                  String(a.questionId?._id || a.questionId || '') === qIdStr ||
                                  String(a.questionNumber || a.question_number || '') === String(qObj.questionNumber || '')
                                ) || sheet?.digital_answers?.find((da: any) =>
                                  String(da.question_id?._id || da.question_id || da.questionId || '') === qIdStr ||
                                  String(da.question_number || da.questionNumber || '') === String(qObj.questionNumber || '')
                                );
                                const rawTxt = (
                                  qObj.recognizedText ||
                                  qObj.studentAnswer ||
                                  qObj.text ||
                                  qObj.answer_text ||
                                  sheetAns?.recognizedText ||
                                  sheetAns?.extractedText ||
                                  sheetAns?.text ||
                                  sheetAns?.answer_text ||
                                  ''
                                ).trim();
                                if (rawTxt) return `"${rawTxt}"`;
                                const status = String(sheet?.processing_status || sheet?.processingStatus || sheet?.ocrStatus || '').toUpperCase();
                                const isProcessing = ['QUEUED', 'PROCESSING', 'PREPROCESSING', 'OCR_PROCESSING', 'SEGMENTING', 'HWR PROCESSING', 'UPLOADED'].includes(status);
                                if (isProcessing) {
                                  return <span className="text-primary not-italic font-sans animate-pulse">Loading OCR text...</span>;
                                }
                                return <span className="italic text-outline">No OCR text available for this answer.</span>;
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Reference expectation */}
                        <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                          <p className="font-bold text-[10px] text-primary uppercase select-none">Instructor Model Answer</p>
                          <p className="text-on-surface-variant font-semibold mt-1 leading-relaxed">{q.modelAnswer || 'No model answer provided.'}</p>
                        </div>

                        {/* Concept Keyword Mapping List */}
                        {(() => {
                          const matched = q.aiEvaluation?.matchedConcepts || q.matchedKeywords || [];
                          const missing = q.aiEvaluation?.missingConcepts || q.missingKeywords || [];
                          if (matched.length === 0 && missing.length === 0) return null;
                          return (
                            <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/15 space-y-2">
                              <p className="font-bold text-[9px] text-outline uppercase select-none">Concept Keyword Audits</p>
                              <div className="flex flex-wrap gap-1.5">
                                {matched.map((kw: string, i: number) => (
                                  <span key={`match-${i}`} className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    ✓ {kw}
                                  </span>
                                ))}
                                {missing.map((kw: string, i: number) => (
                                  <span key={`miss-${i}`} className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-50 text-rose-800 border border-rose-200">
                                    ✗ {kw}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Criteria Breakdown list */}
                        {(() => {
                          const criteriaList = q.aiEvaluation?.criteria || q.criteriaScores || [];
                          if (criteriaList.length === 0) return null;
                          return (
                            <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/15 space-y-2">
                              <p className="font-bold text-[9px] text-outline uppercase select-none">Grading Rubric Criteria Breakdown</p>
                              <div className="space-y-2">
                                {criteriaList.map((cs: any, i: number) => {
                                  const status = cs.status || (cs.marksAwarded >= cs.maxMarks && cs.maxMarks > 0 ? "matched" : cs.marksAwarded > 0 ? "partial" : "missing");
                                  const badgeBg =
                                    status === "matched" || status === "met"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : status === "partial"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-rose-50 text-rose-700 border-rose-200";
                                  return (
                                    <div key={i} className="flex flex-col gap-1 text-[10px] p-2 bg-white dark:bg-surface-container-low rounded-lg border border-outline-variant/20">
                                      <div className="flex justify-between items-center font-bold">
                                        <span className="flex items-center gap-2">
                                          <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-black border ${badgeBg}`}>
                                            {status}
                                          </span>
                                          <span className="text-on-surface">{cs.criterion}</span>
                                        </span>
                                        <span className="text-primary font-black">{cs.marksAwarded} / {cs.maxMarks} Marks</span>
                                      </div>
                                      {cs.reason && (
                                        <p className="text-outline text-[9px] italic ml-1">{cs.reason}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Recommended AI Score and justification */}
                        <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/15 text-[11px] space-y-1">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-outline font-bold">Evaluation Status:</span>
                              <span className="ml-2 font-black text-secondary uppercase text-[10px]">
                                {q.status || q.evaluationStatus || (q.errorMessage ? "FAILED" : "COMPLETED")}
                              </span>
                            </div>
                            <div>
                              <span className="text-outline font-bold">AI Confidence:</span>
                              <span className="ml-2 font-black text-secondary">
                                {Math.round(((q.aiEvaluation?.confidence !== undefined ? q.aiEvaluation.confidence : q.confidence) || 0.85) * 100)}%
                              </span>
                            </div>
                          </div>
                          <div className="mt-1">
                            <span className="text-outline font-bold">Academic Feedback:</span>
                            <p className="text-on-surface-variant font-medium mt-1 leading-normal italic">
                              {q.aiEvaluation?.feedback || q.feedback || (q.errorMessage ? `Error: ${q.errorMessage}` : 'Evaluated against model answer.')}
                            </p>
                          </div>
                        </div>


                        {/* Marks override inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mt-2 pt-2 border-t border-outline-variant/20">
                          <div className="col-span-1">
                            <Input 
                              label="Faculty Marks Override"
                              type="number"
                              max={q.maxMarks}
                              min={0}
                              step="0.5"
                              value={overrideScore}
                              onChange={(e) => setOverrideScore(e.target.value)}
                              disabled={evaluation?.evaluationStatus === 'finalized'}
                            />
                          </div>
                          <div className="col-span-2 flex gap-2 items-end">
                            <div className="flex-grow">
                              <Input 
                                label="Override Justification Comment"
                                placeholder="State reason or grading remark..."
                                value={facultyFeedback}
                                onChange={(e) => setFacultyFeedback(e.target.value)}
                                disabled={evaluation?.evaluationStatus === 'finalized'}
                              />
                            </div>
                            <Button 
                              onClick={() => handleSaveQuestionReview(idx)}
                              isLoading={savingId === q.questionId}
                              disabled={evaluation?.evaluationStatus === 'finalized'}
                              variant="outline"
                              size="md"
                            >
                              Save Review
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default FacultyManualEvaluation;
