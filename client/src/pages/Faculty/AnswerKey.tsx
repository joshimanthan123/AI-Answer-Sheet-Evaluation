import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { examService, Exam, Question, RubricItem } from '../../services/exam.service';
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

  // Active question state
  const [questionText, setQuestionText] = useState('');
  const [maximumMarks, setMaximumMarks] = useState<number>(5);
  const [questionType, setQuestionType] = useState<string>('descriptive');
  const [modelAnswer, setModelAnswer] = useState('');
  const [version, setVersion] = useState<number>(1);
  
  // Evaluation Rubric criteria list
  const [rubricItems, setRubricItems] = useState<RubricItem[]>([]);
  const [editingRubricIdx, setEditingRubricIdx] = useState<number | null>(null);
  
  // New / editing criterion temporary inputs
  const [newCritName, setNewCritName] = useState('');
  const [newCritDesc, setNewCritDesc] = useState('');
  const [newCritMarks, setNewCritMarks] = useState<number>(1);

  // Validation error banner message
  const [validationError, setValidationError] = useState<string | null>(null);

  // Secondary legacy fields
  const [expectedLen, setExpectedLen] = useState<'short' | 'medium' | 'long'>('medium');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');

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
    setQuestionText(q.questionText || '');
    setMaximumMarks(q.maximumMarks || 5);
    setQuestionType(q.questionType || 'descriptive');
    
    const evalConfig = q.evaluationConfig;
    setModelAnswer(evalConfig?.modelAnswer || q.modelAnswer || '');
    setVersion(evalConfig?.version || 1);

    if (evalConfig?.rubric && evalConfig.rubric.length > 0) {
      setRubricItems(evalConfig.rubric.map(r => ({
        _id: r._id,
        criterion: r.criterion,
        description: r.description || '',
        maxMarks: Number(r.maxMarks) || 0
      })));
    } else if (Array.isArray((q as any).rubricItems) && (q as any).rubricItems.length > 0) {
      setRubricItems((q as any).rubricItems.map((r: any) => ({
        _id: r._id,
        criterion: r.criterion,
        description: r.description || '',
        maxMarks: Number(r.maxMarks) || 0
      })));
    } else {
      setRubricItems([]);
    }

    setExpectedLen(q.expectedAnswerLength || 'medium');
    if (Array.isArray(q.keywords)) {
      setKeywords(q.keywords);
    } else if (typeof q.keywords === 'string') {
      setKeywords((q.keywords as string).split(',').map(k => k.trim()).filter(Boolean));
    } else {
      setKeywords([]);
    }

    setEditingRubricIdx(null);
    setNewCritName('');
    setNewCritDesc('');
    setNewCritMarks(1);
    setValidationError(null);
  };

  const selectQuestion = (idx: number) => {
    if (!exam || !exam.questions) return;
    setActiveIdx(idx);
    loadQuestionState(exam.questions[idx]);
  };

  // Rubric Total calculation
  const getRubricTotal = () => {
    return rubricItems.reduce((sum, item) => sum + (Number(item.maxMarks) || 0), 0);
  };

  const rubricTotal = getRubricTotal();
  const rubricTotalFormatted = Number(rubricTotal.toFixed(2));
  const maxMarksFormatted = Number(Number(maximumMarks).toFixed(2));

  // Add or Update Criterion in local state
  const handleSaveCriterion = () => {
    const crit = newCritName.trim();
    const desc = newCritDesc.trim();
    const marks = Number(newCritMarks);

    if (!crit) {
      setValidationError('Rubric criterion name is required.');
      return;
    }
    if (!desc) {
      setValidationError('Rubric criterion description is required.');
      return;
    }
    if (isNaN(marks) || marks <= 0) {
      setValidationError('Rubric criterion marks must be greater than 0.');
      return;
    }

    setValidationError(null);

    if (editingRubricIdx !== null) {
      // Edit existing criterion
      const updated = [...rubricItems];
      updated[editingRubricIdx] = {
        ...updated[editingRubricIdx],
        criterion: crit,
        description: desc,
        maxMarks: marks,
      };
      setRubricItems(updated);
      setEditingRubricIdx(null);
    } else {
      // Add new criterion
      setRubricItems([...rubricItems, { criterion: crit, description: desc, maxMarks: marks }]);
    }

    // Reset inputs
    setNewCritName('');
    setNewCritDesc('');
    setNewCritMarks(1);
  };

  const handleEditCriterion = (idx: number) => {
    const item = rubricItems[idx];
    setEditingRubricIdx(idx);
    setNewCritName(item.criterion);
    setNewCritDesc(item.description);
    setNewCritMarks(item.maxMarks);
  };

  const handleDeleteCriterion = (idx: number) => {
    setRubricItems(rubricItems.filter((_, i) => i !== idx));
    if (editingRubricIdx === idx) {
      setEditingRubricIdx(null);
      setNewCritName('');
      setNewCritDesc('');
      setNewCritMarks(1);
    }
  };

  const handleCancelCriterionEdit = () => {
    setEditingRubricIdx(null);
    setNewCritName('');
    setNewCritDesc('');
    setNewCritMarks(1);
  };

  // Keyword helpers
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

  // Validate question completion
  const isQuestionConfigValid = (q: Question) => {
    const cfg = q.evaluationConfig;
    if (!q.modelAnswer && !cfg?.modelAnswer) return false;
    const rItems = cfg?.rubric || (q as any).rubricItems || [];
    if (!rItems || rItems.length === 0) return false;
    const sum = rItems.reduce((acc: number, item: any) => acc + (Number(item.maxMarks) || 0), 0);
    return Math.abs(sum - q.maximumMarks) < 0.001;
  };

  const getCompletedCount = () => {
    if (!exam || !exam.questions) return 0;
    return exam.questions.filter(isQuestionConfigValid).length;
  };

  // Save full evaluation configuration
  const handleSaveEvaluationConfig = async () => {
    if (!exam || !exam.questions || exam.questions.length === 0 || !id) return;
    const activeQ = exam.questions[activeIdx];
    const qId = activeQ._id || activeQ.id || '';

    // Validate rules:
    if (!questionText.trim()) {
      setValidationError('Question text is required.');
      addToast('Question text is required.', 'error');
      return;
    }
    if (isNaN(maximumMarks) || maximumMarks <= 0) {
      setValidationError('Maximum marks must be greater than 0.');
      addToast('Maximum marks must be greater than 0.', 'error');
      return;
    }
    if (!modelAnswer.trim()) {
      setValidationError('Model answer is required when evaluation configuration is enabled.');
      addToast('Model answer is required.', 'error');
      return;
    }
    if (rubricItems.length === 0) {
      setValidationError('At least one rubric criterion is required.');
      addToast('At least one rubric criterion is required.', 'error');
      return;
    }

    for (let i = 0; i < rubricItems.length; i++) {
      const item = rubricItems[i];
      if (!item.criterion.trim()) {
        setValidationError(`Criterion #${i + 1} name is required.`);
        addToast(`Criterion #${i + 1} name is required.`, 'error');
        return;
      }
      if (!item.description.trim()) {
        setValidationError(`Criterion #${i + 1} (${item.criterion}) description is required.`);
        addToast(`Criterion #${i + 1} description is required.`, 'error');
        return;
      }
      if (item.maxMarks <= 0) {
        setValidationError(`Criterion #${i + 1} (${item.criterion}) marks must be greater than 0.`);
        addToast(`Criterion #${i + 1} marks must be > 0.`, 'error');
        return;
      }
    }

    if (rubricTotalFormatted !== maxMarksFormatted) {
      const msg = `Rubric total (${rubricTotalFormatted}) must equal maximum marks (${maxMarksFormatted}).`;
      setValidationError(msg);
      addToast(msg, 'error');
      return;
    }

    setValidationError(null);

    try {
      setSaving(true);
      const payload = {
        questionText: questionText.trim(),
        maximumMarks: Number(maximumMarks),
        questionType,
        modelAnswer: modelAnswer.trim(),
        rubric: rubricItems.map(r => ({
          criterion: r.criterion.trim(),
          description: r.description.trim(),
          maxMarks: Number(r.maxMarks)
        })),
        keywords,
        expectedAnswerLength: expectedLen
      };

      const result = await examService.saveEvaluationConfig(id, qId, payload);
      
      const newVersionNum = result.evaluationConfig?.version || result.version || (version + 1);
      setVersion(newVersionNum);

      // Update local state copy
      const nextQuestions = [...(exam.questions || [])];
      nextQuestions[activeIdx] = {
        ...nextQuestions[activeIdx],
        questionText: payload.questionText,
        maximumMarks: payload.maximumMarks,
        questionType: payload.questionType,
        modelAnswer: payload.modelAnswer,
        keywords: payload.keywords,
        evaluationConfig: result.evaluationConfig || {
          version: newVersionNum,
          modelAnswer: payload.modelAnswer,
          rubric: payload.rubric
        }
      };
      setExam({ ...exam, questions: nextQuestions });
      addToast(`Evaluation configuration saved successfully! (Version ${newVersionNum})`, 'success');
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to save evaluation configuration.';
      setValidationError(errMsg);
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
            <h2 className="text-2xl font-black text-on-surface font-display">Faculty Model Answer & Rubric Management</h2>
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded border ${
              isLocked 
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                : 'bg-amber-100 text-amber-700 border-amber-200'
            }`}>
              {isLocked ? '🔒 Locked' : '✏️ Draft Config'}
            </span>
            <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-primary/10 text-primary border border-primary/20">
              Config v{version}
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
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 hover:shadow cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">lock_open</span>
              Unlock Config
            </button>
          ) : (
            <button
              onClick={handleFinalize}
              disabled={saving || totalQuestions === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 hover:shadow cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">verified</span>
              Finalize & Lock Config
            </button>
          )}
        </div>
      </div>

      {isLocked && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 items-center text-emerald-800 text-xs font-medium">
          <span className="material-symbols-outlined text-lg text-emerald-700">lock</span>
          <div>
            This evaluation configuration is locked. Model answers and rubrics are saved and ready for the Phase 3C AI Evaluation Engine. Unlock to edit.
          </div>
        </div>
      )}

      {totalQuestions === 0 ? (
        <div className="glass-card p-12 text-center border border-outline-variant/20 bg-white">
          <span className="material-symbols-outlined text-outline text-4xl block mb-2">quiz</span>
          <h3 className="font-bold text-sm text-on-surface">No Questions Found</h3>
          <p className="text-xs text-outline mt-1">Please add questions to this exam before configuring model answers and rubrics.</p>
          <Link 
            to={`/faculty/exams/${exam.id}/edit`}
            className="mt-4 inline-block text-xs font-bold text-primary bg-primary/10 px-4 py-2 rounded-xl"
          >
            Go to Exam Question Editor
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 font-sans">
          {/* Question List Sidebar (3 cols) */}
          <div className="md:col-span-3 space-y-4">
            <h3 className="text-xs font-black text-outline uppercase tracking-wider">Question List</h3>
            <div className="flex flex-col gap-2">
              {exam.questions.map((q, idx) => {
                const complete = isQuestionConfigValid(q);
                const active = activeIdx === idx;
                const qVer = q.evaluationConfig?.version || 1;
                return (
                  <button
                    key={q.id || idx}
                    onClick={() => selectQuestion(idx)}
                    className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
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
                      <span>Q{q.questionNumber} (v{qVer})</span>
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

            {/* Overall Rubric Config Progress */}
            <div className="glass-card p-4 rounded-2xl border border-outline-variant/20 bg-white text-xs space-y-2">
              <span className="text-[10px] text-outline uppercase font-black block">Configuration Progress</span>
              <div className="flex justify-between font-bold text-on-surface text-[11px] mt-1">
                <span>{completedQuestions} / {totalQuestions} Configured</span>
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

          {/* Question Evaluation Config Editor (9 cols) */}
          <div className="md:col-span-9 space-y-6">
            <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white space-y-6">
              
              {/* Question Banner & Config Fields */}
              <div className="space-y-4 pb-4 border-b border-outline-variant/10">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-black uppercase rounded-lg">
                      Question Q{activeQ?.questionNumber}
                    </span>
                    <span className="px-2.5 py-1 bg-surface-container-high text-outline text-xs font-bold uppercase rounded-lg border border-outline-variant/10">
                      Version {version}
                    </span>
                  </div>
                </div>

                {/* View Question Text & Editable fields */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-black text-outline uppercase tracking-wider block mb-1">Question Text</label>
                    <input
                      type="text"
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      disabled={isLocked || saving}
                      className="w-full text-xs font-semibold p-3 border border-outline-variant/30 rounded-xl outline-none focus:border-primary transition disabled:bg-slate-50"
                      placeholder="Enter question prompt..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-black text-outline uppercase tracking-wider block mb-1">Question Type</label>
                      <select
                        value={questionType}
                        onChange={(e) => setQuestionType(e.target.value)}
                        disabled={isLocked || saving}
                        className="w-full text-xs font-bold p-2.5 border border-outline-variant/30 rounded-xl outline-none focus:border-primary transition bg-white disabled:bg-slate-50"
                      >
                        <option value="descriptive">Descriptive</option>
                        <option value="numerical">Numerical</option>
                        <option value="programming">Programming</option>
                        <option value="mcq">MCQ</option>
                        <option value="diagram">Diagram</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-black text-outline uppercase tracking-wider block mb-1">Maximum Marks</label>
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={maximumMarks}
                        onChange={(e) => setMaximumMarks(Number(e.target.value) || 0)}
                        disabled={isLocked || saving}
                        className="w-full text-xs font-bold p-2.5 border border-outline-variant/30 rounded-xl outline-none focus:border-primary transition bg-white disabled:bg-slate-50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Model Answer Input (Large Text Area) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-outline uppercase tracking-wider block">
                    Model Answer <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-outline italic">Required for AI evaluation engine</span>
                </div>
                <textarea
                  value={modelAnswer}
                  onChange={(e) => setModelAnswer(e.target.value)}
                  disabled={isLocked || saving}
                  rows={5}
                  className="w-full text-xs p-3.5 border border-outline-variant/30 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition disabled:bg-slate-50 disabled:text-outline resize-y font-mono leading-relaxed"
                  placeholder="Provide reference textbook model answer for full marks evaluation..."
                ></textarea>
              </div>

              {/* Evaluation Rubric Criteria Manager */}
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                  <label className="text-xs font-black text-outline uppercase tracking-wider">Evaluation Rubric</label>
                  
                  {/* Automatically Calculated Rubric Total */}
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase">
                    <span>Rubric Total:</span>
                    <span className={`px-2.5 py-1 rounded-lg border text-xs font-black ${
                      rubricTotalFormatted === maxMarksFormatted 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {rubricTotalFormatted} / {maxMarksFormatted} Marks
                      {rubricTotalFormatted === maxMarksFormatted && ' ✓'}
                    </span>
                  </div>
                </div>

                {/* Validation Error Message Banner */}
                {validationError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">error</span>
                    <span>{validationError}</span>
                  </div>
                )}

                {/* Add / Edit Rubric Criterion Form */}
                {!isLocked && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-outline-variant/15 space-y-3">
                    <span className="text-[10px] font-black text-outline uppercase tracking-wider block">
                      {editingRubricIdx !== null ? `Edit Rubric Criterion #${editingRubricIdx + 1}` : '+ Add Rubric Criterion'}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-4">
                        <label className="text-[9px] text-outline block uppercase font-bold mb-1">Criterion Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g. Scalability"
                          value={newCritName}
                          onChange={(e) => setNewCritName(e.target.value)}
                          className="w-full text-xs p-2 border rounded-lg bg-white outline-none focus:border-primary transition"
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <label className="text-[9px] text-outline block uppercase font-bold mb-1">Description <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g. Explains horizontal scaling principles"
                          value={newCritDesc}
                          onChange={(e) => setNewCritDesc(e.target.value)}
                          className="w-full text-xs p-2 border rounded-lg bg-white outline-none focus:border-primary transition"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-[9px] text-outline block uppercase font-bold mb-1">Marks <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          min={0.1}
                          step={0.1}
                          value={newCritMarks}
                          onChange={(e) => setNewCritMarks(Number(e.target.value) || 0)}
                          className="w-full text-xs p-2 border rounded-lg bg-white outline-none focus:border-primary transition"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      {editingRubricIdx !== null && (
                        <button
                          type="button"
                          onClick={handleCancelCriterionEdit}
                          className="px-3 py-1.5 border border-outline-variant/30 text-on-surface text-xs font-bold rounded-lg hover:bg-slate-100 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveCriterion}
                        className="px-4 py-1.5 bg-secondary text-white text-xs font-bold rounded-lg hover:bg-secondary-dark transition flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs">add</span>
                        {editingRubricIdx !== null ? 'Update Criterion' : 'Add Criterion'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Rubric Criteria Table */}
                {rubricItems.length === 0 ? (
                  <div className="text-[11px] text-outline italic text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-outline-variant/20">
                    No rubric criteria added yet. Add criteria above to build evaluation rubric (Rubric total must equal {maxMarksFormatted} marks).
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-outline-variant/15 shadow-sm">
                    <table className="min-w-full text-left text-xs bg-white">
                      <thead className="bg-slate-50 text-[10px] text-outline uppercase font-black">
                        <tr>
                          <th className="px-4 py-3">Criterion</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3 text-center">Marks</th>
                          {!isLocked && <th className="px-4 py-3 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                        {rubricItems.map((item, i) => (
                          <tr key={i} className={`hover:bg-slate-50 ${editingRubricIdx === i ? 'bg-primary/5 font-bold' : ''}`}>
                            <td className="px-4 py-3 font-bold text-on-surface">{item.criterion}</td>
                            <td className="px-4 py-3 text-on-surface-variant leading-relaxed">{item.description}</td>
                            <td className="px-4 py-3 text-center font-black text-primary">{item.maxMarks}</td>
                            {!isLocked && (
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditCriterion(i)}
                                    className="text-primary hover:text-primary-dark font-bold text-xs cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCriterion(i)}
                                    className="text-red-500 hover:text-red-700 font-bold text-xs cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Keywords Tag Manager (Optional Auxiliary NLP Context) */}
              <div className="space-y-2 pt-2 border-t border-outline-variant/10">
                <label className="text-xs font-black text-outline uppercase tracking-wider block">Keywords (Optional NLP Context)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                    disabled={isLocked || saving}
                    placeholder="Add keyword tag..."
                    className="flex-grow text-xs px-3 py-2 border border-outline-variant/30 rounded-xl outline-none focus:border-primary transition"
                  />
                  <button
                    type="button"
                    onClick={handleAddKeyword}
                    disabled={isLocked || saving}
                    className="px-4 py-2 bg-slate-100 text-on-surface font-bold text-xs rounded-xl hover:bg-slate-200 transition"
                  >
                    Add Tag
                  </button>
                </div>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {keywords.map((kw, i) => (
                      <span key={i} className="px-2.5 py-1 bg-slate-100 text-on-surface rounded-lg text-[10px] font-bold flex items-center gap-1">
                        {kw}
                        {!isLocked && (
                          <button type="button" onClick={() => handleRemoveKeyword(kw)} className="hover:text-red-500 cursor-pointer">✕</button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Save Evaluation Configuration Action Button */}
              {!isLocked && (
                <div className="flex justify-between items-center pt-4 border-t border-outline-variant/10">
                  <span className="text-[11px] text-outline font-semibold">
                    {rubricTotalFormatted === maxMarksFormatted 
                      ? '✓ Rubric configuration ready to save' 
                      : '⚠️ Rubric total must equal maximum marks before saving'}
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveEvaluationConfig}
                    disabled={saving || rubricTotalFormatted !== maxMarksFormatted}
                    className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">save</span>
                    Save Evaluation Configuration (v{version})
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
