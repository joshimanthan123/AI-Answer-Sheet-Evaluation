import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { examService, Exam, Question } from '../../services/exam.service';
import { useNotifications } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const AnswerKey: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useNotifications();

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(0);

  // Active question local editing states
  const [modelAnswer, setModelAnswer] = useState('');
  const [expectedLen, setExpectedLen] = useState<'short' | 'medium' | 'long'>('medium');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  
  const [conceptualUnderstanding, setConceptualUnderstanding] = useState(0);
  const [keywordAccuracy, setKeywordAccuracy] = useState(0);
  const [completeness, setCompleteness] = useState(0);
  const [correctness, setCorrectness] = useState(0);

  const [partialRules, setPartialRules] = useState<Array<{ _id?: string; criterion: string; description?: string; marks: number }>>([]);
  const [newRuleCrit, setNewRuleCrit] = useState('');
  const [newRuleDesc, setNewRuleDesc] = useState('');
  const [newRuleMarks, setNewRuleMarks] = useState(0);

  const fetchExam = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await examService.getExamById(id);
      setExam(data);
      if (data.questions && data.questions.length > 0) {
        loadQuestionState(data.questions[0]);
      }
    } catch (err: any) {
      console.error(err);
      addToast('Failed to retrieve exam details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [id]);

  const loadQuestionState = (q: Question) => {
    setModelAnswer(q.modelAnswer || '');
    setExpectedLen(q.expectedAnswerLength || 'medium');
    
    // Parse keywords (handle array or comma-separated string)
    if (Array.isArray(q.keywords)) {
      setKeywords(q.keywords);
    } else if (typeof q.keywords === 'string') {
      setKeywords((q.keywords as string).split(',').map(k => k.trim()).filter(Boolean));
    } else {
      setKeywords([]);
    }

    setConceptualUnderstanding(q.evaluationCriteria?.conceptualUnderstanding || 0);
    setKeywordAccuracy(q.evaluationCriteria?.keywordAccuracy || 0);
    setCompleteness(q.evaluationCriteria?.completeness || 0);
    setCorrectness(q.evaluationCriteria?.correctness || 0);

    setPartialRules(q.partialMarkingRules || []);
    // Reset temp inputs
    setNewKeyword('');
    setNewRuleCrit('');
    setNewRuleDesc('');
    setNewRuleMarks(0);
  };

  const selectQuestion = (idx: number) => {
    if (!exam || !exam.questions) return;
    setActiveIdx(idx);
    loadQuestionState(exam.questions[idx]);
  };

  const handleAddKeyword = () => {
    const kw = newKeyword.trim();
    if (!kw) return;
    if (keywords.includes(kw)) {
      addToast('Keyword already exists.', 'warning');
      return;
    }
    setKeywords([...keywords, kw]);
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kwToRemove: string) => {
    setKeywords(keywords.filter(k => k !== kwToRemove));
  };

  const handleAddRule = () => {
    const crit = newRuleCrit.trim();
    if (!crit) {
      addToast('Rule criterion is required.', 'warning');
      return;
    }
    if (newRuleMarks <= 0) {
      addToast('Rule marks must be a positive number.', 'warning');
      return;
    }
    setPartialRules([...partialRules, { criterion: crit, description: newRuleDesc.trim(), marks: Number(newRuleMarks) }]);
    setNewRuleCrit('');
    setNewRuleDesc('');
    setNewRuleMarks(0);
  };

  const handleRemoveRule = (ruleIdx: number) => {
    setPartialRules(partialRules.filter((_, i) => i !== ruleIdx));
  };

  // Check sum of current question edit
  const getCriteriaSum = () => {
    return conceptualUnderstanding + keywordAccuracy + completeness + correctness;
  };

  const getPartialRulesSum = () => {
    return partialRules.reduce((sum, r) => sum + r.marks, 0);
  };

  // Helper check per question
  const isQuestionComplete = (q: Question) => {
    if (!q.modelAnswer || q.modelAnswer.trim().length === 0) return false;
    // Must have matching criteria totals
    const sumCrit = q.evaluationCriteria
      ? (q.evaluationCriteria.conceptualUnderstanding || 0) +
        (q.evaluationCriteria.keywordAccuracy || 0) +
        (q.evaluationCriteria.completeness || 0) +
        (q.evaluationCriteria.correctness || 0)
      : 0;
    const sumRules = (q.partialMarkingRules || []).reduce((sum, r) => sum + r.marks, 0);
    
    if (sumCrit > q.maximumMarks) return false;
    if (sumRules > q.maximumMarks) return false;
    
    return true;
  };

  const getCompletedCount = () => {
    if (!exam || !exam.questions) return 0;
    return exam.questions.filter(isQuestionComplete).length;
  };

  const handleSaveActiveQuestion = async () => {
    if (!exam || !exam.questions || exam.questions.length === 0 || !id) return;
    const activeQ = exam.questions[activeIdx];

    const sumCrit = getCriteriaSum();
    const sumRules = getPartialRulesSum();

    if (sumCrit > activeQ.maximumMarks) {
      addToast(`Evaluation criteria sum (${sumCrit}) cannot exceed question max marks (${activeQ.maximumMarks}).`, 'error');
      return;
    }
    if (sumRules > activeQ.maximumMarks) {
      addToast(`Partial marking rules sum (${sumRules}) cannot exceed question max marks (${activeQ.maximumMarks}).`, 'error');
      return;
    }

    try {
      setSaving(true);
      const data = {
        modelAnswer,
        expectedAnswerLength: expectedLen,
        keywords,
        evaluationCriteria: {
          conceptualUnderstanding,
          keywordAccuracy,
          completeness,
          correctness
        },
        partialMarkingRules: partialRules
      };

      const updatedExam = await examService.updateQuestionAnswerKey(id, activeQ._id || activeQ.id || '', data);
      
      // Update local state copy
      const nextQuestions = [...(exam.questions || [])];
      nextQuestions[activeIdx] = {
        ...nextQuestions[activeIdx],
        ...data,
      };
      setExam({ ...updatedExam, questions: nextQuestions });
      addToast('Question Answer Key details saved successfully.', 'success');
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to save question answer key.';
      addToast(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!id || !exam) return;
    try {
      setSaving(true);
      const updatedExam = await examService.finalizeAnswerKey(id);
      setExam(updatedExam);
      addToast('Answer Key finalized and locked.', 'success');
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to lock answer key.';
      addToast(errMsg, 'error');
      
      // If incomplete questions are returned, alert details
      if (err.response?.data?.errors) {
        console.log('Validation deficiencies:', err.response.data.errors);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUnlock = async () => {
    if (!id || !exam) return;
    try {
      setSaving(true);
      const updatedExam = await examService.unlockAnswerKey(id);
      setExam(updatedExam);
      addToast('Answer key unlocked and set to Draft.', 'success');
    } catch (err: any) {
      console.error(err);
      addToast('Failed to unlock answer key.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  if (!exam) {
    return (
      <div className="glass-card p-12 text-center max-w-xl mx-auto my-12 border border-outline-variant/20 bg-white">
        <span className="material-symbols-outlined text-error text-4xl block mb-2">warning</span>
        <h3 className="font-bold text-sm text-on-surface">Exam Not Found</h3>
        <Link to="/faculty/exams" className="mt-4 inline-block text-xs font-bold text-primary">
          Back to Exams
        </Link>
      </div>
    );
  }

  const isLocked = exam.answerKeyStatus === 'locked';
  const totalQuestions = exam.questions?.length || 0;
  const completedQuestions = getCompletedCount();
  const progressPercent = totalQuestions > 0 ? (completedQuestions / totalQuestions) * 100 : 0;
  const activeQ = exam.questions?.[activeIdx];

  return (
    <div className="flex flex-col gap-6 text-left max-w-5xl mx-auto py-6 animate-fade-in font-display">
      {/* Header controls block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-black text-on-surface font-display">Manage Answer Key</h2>
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded border ${
              isLocked 
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                : 'bg-amber-100 text-amber-700 border-amber-200'
            }`}>
              {isLocked ? '🔒 Locked' : '✏️ Draft'}
            </span>
          </div>
          <p className="text-xs text-outline mt-1.5 font-semibold">
            {exam.title} ({typeof exam.subject === 'object' ? exam.subject?.code : ''}) • Code: {exam.examCode}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            type="button"
            onClick={() => navigate(`/faculty/exams/${exam.id}`)} 
            className="px-3.5 py-2 border border-outline-variant/30 text-on-surface hover:bg-outline-variant/10 text-xs font-bold rounded-xl transition"
          >
            Back to Details
          </button>
          
          {isLocked ? (
            <button
              onClick={handleUnlock}
              disabled={saving}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 hover:shadow"
            >
              <span className="material-symbols-outlined text-xs">lock_open</span>
              Unlock Answer Key
            </button>
          ) : (
            <button
              onClick={handleFinalize}
              disabled={saving || totalQuestions === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 hover:shadow"
            >
              <span className="material-symbols-outlined text-xs">verified</span>
              Finalize & Lock Answer Key
            </button>
          )}
        </div>
      </div>

      {isLocked && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 items-center text-emerald-800 text-xs font-medium">
          <span className="material-symbols-outlined text-lg text-emerald-700">lock</span>
          <div>
            This answer key is locked/finalized. Question criteria properties are ready for AI evaluation and cannot be altered unless unlocked.
          </div>
        </div>
      )}

      {totalQuestions === 0 ? (
        <div className="glass-card p-12 text-center border border-outline-variant/20 bg-white">
          <span className="material-symbols-outlined text-outline text-4xl block mb-2">quiz</span>
          <h3 className="font-bold text-sm text-on-surface">No Questions Connected</h3>
          <p className="text-xs text-outline mt-1">Please add questions to this exam before configuring key rules.</p>
          <Link 
            to={`/faculty/exams/${exam.id}/edit`}
            className="mt-4 inline-block text-xs font-bold text-primary bg-primary/10 px-4 py-2 rounded-xl"
          >
            Go to Exam Layout Editor
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 font-sans">
          {/* Questions Navigation Left side (3 cols) */}
          <div className="md:col-span-3 space-y-4">
            <h3 className="text-xs font-black text-outline uppercase tracking-wider">Question Registry</h3>
            <div className="flex flex-col gap-2">
              {exam.questions.map((q, idx) => {
                const complete = isQuestionComplete(q);
                const active = activeIdx === idx;
                return (
                  <button
                    key={q.id || idx}
                    onClick={() => selectQuestion(idx)}
                    className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition ${
                      active 
                        ? 'bg-primary/10 border-primary text-primary shadow-sm' 
                        : 'bg-white hover:bg-outline-variant/5 border-outline-variant/20 text-on-surface'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        active ? 'bg-primary text-white' : 'bg-surface-container-high text-outline'
                      }`}>
                        {idx + 1}
                      </span>
                      <span>Question Q{q.questionNumber}</span>
                    </span>
                    <span>
                      {complete ? (
                        <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                      ) : (
                        <span className="material-symbols-outlined text-amber-500 text-sm">warning</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Overall progress indicator widget */}
            <div className="glass-card p-4 rounded-2xl border border-outline-variant/20 bg-white text-xs space-y-2">
              <span className="text-[10px] text-outline uppercase font-black block">Answer Key Progress</span>
              <div className="flex justify-between font-bold text-on-surface text-[11px] mt-1">
                <span>{completedQuestions} / {totalQuestions} Completed</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${completedQuestions === totalQuestions ? 'bg-emerald-600' : 'bg-primary'}`} 
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Active Question Editor Right side (9 cols) */}
          <div className="md:col-span-9 space-y-6">
            <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white space-y-6">
              
              {/* Question Specs Banner */}
              <div className="flex justify-between items-start gap-4 pb-4 border-b border-outline-variant/10">
                <div className="space-y-1">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded">
                    Q{activeQ?.questionNumber} • {activeQ?.questionType}
                  </span>
                  <p className="font-bold text-sm text-on-surface leading-relaxed pt-1.5">{activeQ?.questionText}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-outline font-black block uppercase">Max Marks</span>
                  <span className="text-lg font-black text-on-surface">{activeQ?.maximumMarks} Points</span>
                </div>
              </div>

              {/* Model Answer Input */}
              <div className="space-y-2">
                <label className="text-xs font-black text-outline uppercase tracking-wider block">Model Answer Reference</label>
                <textarea
                  value={modelAnswer}
                  onChange={(e) => setModelAnswer(e.target.value)}
                  disabled={isLocked || saving}
                  rows={4}
                  className="w-full text-xs p-3.5 border border-outline-variant/30 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition disabled:bg-slate-50 disabled:text-outline resize-y"
                  placeholder="Provide semantic textbook model text representing a full marks answer..."
                ></textarea>
              </div>

              {/* Expected Length & Keywords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Expected Length */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-outline uppercase tracking-wider block">Expected Answer Length</label>
                  <div className="flex gap-2">
                    {(['short', 'medium', 'long'] as const).map((len) => (
                      <button
                        key={len}
                        type="button"
                        disabled={isLocked || saving}
                        onClick={() => setExpectedLen(len)}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl border text-center transition capitalize ${
                          expectedLen === len
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white hover:bg-slate-50 border-outline-variant/30 text-on-surface'
                        }`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Keywords Tag Manager */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-outline uppercase tracking-wider block">NLP Keywords</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                      disabled={isLocked || saving}
                      placeholder="Add keyword tag..."
                      className="flex-grow text-xs px-3 border border-outline-variant/30 rounded-xl outline-none focus:border-primary transition"
                    />
                    <button
                      type="button"
                      onClick={handleAddKeyword}
                      disabled={isLocked || saving}
                      className="px-4 py-2 bg-secondary text-white font-bold text-xs rounded-xl"
                    >
                      Add
                    </button>
                  </div>
                  
                  {keywords.length === 0 ? (
                    <p className="text-[10px] text-outline italic">No keyword tags configured for semantic matcher yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {keywords.map((kw, i) => (
                        <span 
                          key={i} 
                          className="px-2.5 py-1 bg-outline-variant/10 text-on-surface rounded-lg text-[10px] font-bold flex items-center gap-1 border border-outline-variant/10"
                        >
                          {kw}
                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() => handleRemoveKeyword(kw)}
                              className="material-symbols-outlined text-[10px] hover:text-red-500 cursor-pointer"
                            >
                              close
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Evaluation Criteria Weights */}
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                  <label className="text-xs font-black text-outline uppercase tracking-wider">Evaluation Criteria Mark Allocation</label>
                  <div className="flex items-center gap-1 text-[11px] font-black uppercase">
                    <span>Weights Total:</span>
                    <span className={getCriteriaSum() === activeQ?.maximumMarks ? 'text-emerald-600 font-black' : 'text-amber-600 font-black'}>
                      {getCriteriaSum()} / {activeQ?.maximumMarks || 0} Points
                      {getCriteriaSum() === activeQ?.maximumMarks && ' ✓'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5 p-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
                    <span className="text-[10px] text-outline font-black block">Conceptual Understanding</span>
                    <input
                      type="number"
                      min={0}
                      max={activeQ?.maximumMarks || 100}
                      disabled={isLocked || saving}
                      value={conceptualUnderstanding}
                      onChange={(e) => setConceptualUnderstanding(Number(e.target.value) || 0)}
                      className="w-full text-xs font-bold text-center p-2 rounded-lg border outline-none bg-white focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1.5 p-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
                    <span className="text-[10px] text-outline font-black block">Keyword Accuracy</span>
                    <input
                      type="number"
                      min={0}
                      max={activeQ?.maximumMarks || 100}
                      disabled={isLocked || saving}
                      value={keywordAccuracy}
                      onChange={(e) => setKeywordAccuracy(Number(e.target.value) || 0)}
                      className="w-full text-xs font-bold text-center p-2 rounded-lg border outline-none bg-white focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1.5 p-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
                    <span className="text-[10px] text-outline font-black block">Completeness weight</span>
                    <input
                      type="number"
                      min={0}
                      max={activeQ?.maximumMarks || 100}
                      disabled={isLocked || saving}
                      value={completeness}
                      onChange={(e) => setCompleteness(Number(e.target.value) || 0)}
                      className="w-full text-xs font-bold text-center p-2 rounded-lg border outline-none bg-white focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1.5 p-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
                    <span className="text-[10px] text-outline font-black block">Correctness weight</span>
                    <input
                      type="number"
                      min={0}
                      max={activeQ?.maximumMarks || 100}
                      disabled={isLocked || saving}
                      value={correctness}
                      onChange={(e) => setCorrectness(Number(e.target.value) || 0)}
                      className="w-full text-xs font-bold text-center p-2 rounded-lg border outline-none bg-white focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              {/* Partial Marking Rules */}
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                  <label className="text-xs font-black text-outline uppercase tracking-wider">Partial Marking Rubric Rules</label>
                  <div className="flex items-center gap-1 text-[11px] font-black uppercase text-outline">
                    <span>Rules Aggregate:</span>
                    <span className={getPartialRulesSum() === activeQ?.maximumMarks ? 'text-emerald-600 font-black' : 'text-outline font-black'}>
                      {getPartialRulesSum()} / {activeQ?.maximumMarks || 0} Marks
                    </span>
                  </div>
                </div>

                {!isLocked && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-outline-variant/10">
                    <div className="space-y-1">
                      <span className="text-[9px] text-outline block uppercase font-bold">Rule Criterion</span>
                      <input
                        type="text"
                        placeholder="e.g. Definition stated"
                        value={newRuleCrit}
                        onChange={(e) => setNewRuleCrit(e.target.value)}
                        className="w-full text-xs p-2 border rounded-lg bg-white outline-none focus:border-primary transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-outline block uppercase font-bold">Rule Description</span>
                      <input
                        type="text"
                        placeholder="e.g. Gives partial definition details"
                        value={newRuleDesc}
                        onChange={(e) => setNewRuleDesc(e.target.value)}
                        className="w-full text-xs p-2 border rounded-lg bg-white outline-none focus:border-primary transition"
                      />
                    </div>
                    <div className="space-y-1 flex gap-2 items-end">
                      <div className="flex-grow">
                        <span className="text-[9px] text-outline block uppercase font-bold">Allocated Marks</span>
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={newRuleMarks === 0 ? '' : newRuleMarks}
                          onChange={(e) => setNewRuleMarks(Number(e.target.value) || 0)}
                          className="w-full text-xs p-2 border rounded-lg bg-white outline-none focus:border-primary transition"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddRule}
                        className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg h-9 hover:bg-primary-dark transition cursor-pointer"
                      >
                        Add Rule
                      </button>
                    </div>
                  </div>
                )}

                {partialRules.length === 0 ? (
                  <p className="text-[10px] text-outline italic text-center py-2 bg-slate-50/50 rounded-xl border border-dashed border-outline-variant/20">No partial rubrics defined. Future AI evaluations will rely solely on semantic criteria weights.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-outline-variant/15">
                    <table className="min-w-full text-left text-xs bg-white">
                      <thead className="bg-slate-50 text-[10px] text-outline uppercase font-black font-mono">
                        <tr>
                          <th className="px-4 py-3">Criterion Name</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3 text-center">Marks</th>
                          {!isLocked && <th className="px-4 py-3 w-[80px]"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                        {partialRules.map((rule, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-semibold">{rule.criterion}</td>
                            <td className="px-4 py-3 text-on-surface-variant leading-relaxed">{rule.description || '-'}</td>
                            <td className="px-4 py-3 text-center font-bold text-primary">{rule.marks}</td>
                            {!isLocked && (
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRule(i)}
                                  className="text-red-500 hover:text-red-700 font-bold ml-auto text-xs cursor-pointer block"
                                >
                                  Remove
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Action buttons footer for question editor */}
              {!isLocked && (
                <div className="flex justify-end pt-4 border-t border-outline-variant/10">
                  <button
                    type="button"
                    onClick={handleSaveActiveQuestion}
                    disabled={saving}
                    className="px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl transition flex items-center gap-1 hover:shadow active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">save</span>
                    Save Question Draft
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnswerKey;
