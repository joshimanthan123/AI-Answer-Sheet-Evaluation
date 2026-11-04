import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { subjectService } from '../../services/subject.service';
import { examService } from '../../services/exam.service';
import { Subject } from '../../types';

export interface RubricItemInput {
  _id?: string;
  criterion: string;
  description: string;
  maxMarks: number;
}

interface QuestionInput {
  tempId: string;
  questionNumber: number;
  questionText: string;
  maximumMarks: number;
  questionType: 'Descriptive' | 'Short Answer' | 'Long Answer' | 'MCQ' | 'True/False';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  bloomsLevel: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
  keywords: string;
  rubric: string;
  rubricItems?: RubricItemInput[];
  modelAnswer: string;
  isCollapsed: boolean;
}

// Simulated active pool of question bank questions for importing
const mockBankQuestions = [
  { id: 'q-ds-1', text: 'Define Time Complexity and give an example of O(n log n) runtime complexity.', weight: 10, expectedConcept: 'Computational time, Heap/Merge sort example', bloomsLevel: 'Remember', difficulty: 'Easy', questionType: 'Descriptive' },
  { id: 'q-ds-2', text: 'Explain the structural differences between a Stack and a Queue.', weight: 10, expectedConcept: 'LIFO vs FIFO structures', bloomsLevel: 'Understand', difficulty: 'Easy', questionType: 'Descriptive' },
  { id: 'q-ds-3', text: 'Write a pseudocode for Binary Search on a sorted array.', weight: 15, expectedConcept: 'Divide & Conquer binary search indices', bloomsLevel: 'Apply', difficulty: 'Medium', questionType: 'Long Answer' },
  { id: 'q-ds-4', text: 'Which data structure uses LIFO order?', weight: 5, expectedConcept: 'Stack, push, pop', bloomsLevel: 'Remember', difficulty: 'Easy', questionType: 'MCQ' },
  { id: 'q-ds-5', text: 'A binary tree has at most two children per node.', weight: 5, expectedConcept: 'Binary tree definition', bloomsLevel: 'Remember', difficulty: 'Easy', questionType: 'True/False' },
];

export const CreateExam: React.FC = () => {
  const { addToast } = useNotifications();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  // Core Form State
  const [name, setName] = useState('');
  const [examCode, setExamCode] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [department, setDepartment] = useState('Computer Science');
  const [semester, setSemester] = useState('5');
  const [examType, setExamType] = useState('Mid-Term');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState(180);
  const [totalMarks, setTotalMarks] = useState(100);
  const [instructions, setInstructions] = useState('1. All answers must be hand-written on the digital canvas.\n2. iPad Stylus/Apple Pencil ONLY allowed.\n3. Make sure to review calculations before submitting.');
  const [passingMarks, setPassingMarks] = useState(40);
  const [status, setStatus] = useState<'Draft' | 'Published' | 'Active' | 'Completed'>('Draft');

  // Allowed Materials
  const [allowedMaterials, setAllowedMaterials] = useState<string[]>(['Apple Pencil ONLY']);
  const [materialInput, setMaterialInput] = useState('');

  // Questions State
  const [questions, setQuestions] = useState<QuestionInput[]>([
    {
      tempId: 'q-init-1',
      questionNumber: 1,
      questionText: 'Explain the working of Merge Sort and derive its time complexity.',
      maximumMarks: 20,
      questionType: 'Descriptive',
      difficulty: 'Medium',
      bloomsLevel: 'Analyze',
      keywords: 'Divide and conquer, recursion, O(n log n)',
      rubric: '5 marks for divide method, 10 marks for merge logic, 5 marks for complexity proof.',
      modelAnswer: 'Merge sort divides the array recursively and merges sorted sub-arrays...',
      isCollapsed: false,
    }
  ]);

  // UI state
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [isImportDrawerOpen, setIsImportDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [lastAutoSave, setLastAutoSave] = useState<string | null>(null);
  const [showBackupBanner, setShowBackupBanner] = useState(false);

  // Load subjects & load exam details if in edit mode
  useEffect(() => {
    subjectService.getSubjects().then((subs) => {
      setSubjects(subs);
      if (subs.length > 0 && !isEditMode) setSubjectId(subs[0].id);
    });

    if (isEditMode) {
      examService.getExamById(id!).then((ex) => {
        setName(ex.title);
        setExamCode(ex.examCode || '');
        const subId = typeof ex.subject === 'object' ? ex.subject?._id || ex.subject?.id : ex.subject;
        setSubjectId(subId || '');
        setDepartment(ex.department || 'Computer Science');
        setSemester(ex.semester || '5');
        setExamType(ex.examType || 'Mid-Term');
        if (ex.examDate) {
          setDate(ex.examDate.split('T')[0]);
        }
        if (ex.startTime) {
          const dateObj = new Date(ex.startTime);
          const hh = String(dateObj.getHours()).padStart(2, '0');
          const mm = String(dateObj.getMinutes()).padStart(2, '0');
          setStartTime(`${hh}:${mm}`);
        } else {
          setStartTime('');
        }
        if (ex.endTime) {
          const dateObj = new Date(ex.endTime);
          const hh = String(dateObj.getHours()).padStart(2, '0');
          const mm = String(dateObj.getMinutes()).padStart(2, '0');
          setEndTime(`${hh}:${mm}`);
        } else {
          setEndTime('');
        }
        setDuration(ex.duration || 180);
        setTotalMarks(ex.totalMarks || 100);
        setInstructions(ex.instructions || '');
        setPassingMarks(ex.passingMarks || 40);
        setStatus(ex.examStatus || 'Draft');
        
        let materialsVal = ex.allowedMaterials;
        if (typeof materialsVal === 'string') {
          materialsVal = (materialsVal as string).split(',').map((m: string) => m.trim()).filter(Boolean);
        }
        setAllowedMaterials(materialsVal || []);

        if (ex.questions && ex.questions.length > 0) {
          const qs = ex.questions.map((q: any, idx: number) => ({
            tempId: q._id || q.id || `q-loaded-${idx}`,
            questionNumber: q.questionNumber,
            questionText: q.questionText,
            maximumMarks: q.maximumMarks,
            questionType: q.questionType,
            difficulty: q.difficulty,
            bloomsLevel: q.bloomsLevel,
            keywords: Array.isArray(q.keywords) ? q.keywords.join(', ') : (q.keywords || ''),
            rubric: q.rubric || '',
            modelAnswer: q.modelAnswer || '',
            isCollapsed: true,
          }));
          setQuestions(qs);
        }
      }).catch((err) => {
        console.error('Failed to pre-load exam info:', err);
        addToast('Failed to load exam details for editing.', 'error');
      });
    } else {
      const backup = localStorage.getItem('exam_draft_backup');
      if (backup) {
        setShowBackupBanner(true);
      }
    }
  }, [id, isEditMode]);

  // Sync auto-save every 45 seconds if changes occurred
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      setLastAutoSave(timeStr);
      // Save locally to simulate backup
      localStorage.setItem('exam_draft_backup', JSON.stringify({
        name, subjectId, department, semester, examType, date, startTime, endTime, duration, totalMarks, instructions, passingMarks, allowedMaterials, questions
      }));
    }, 45000);
    return () => clearInterval(interval);
  }, [name, subjectId, department, semester, examType, date, startTime, endTime, duration, totalMarks, instructions, passingMarks, allowedMaterials, questions]);

  const handleRestoreBackup = () => {
    try {
      const backupStr = localStorage.getItem('exam_draft_backup');
      if (backupStr) {
        const data = JSON.parse(backupStr);
        if (data.name) setName(data.name);
        if (data.subjectId) setSubjectId(data.subjectId);
        if (data.department) setDepartment(data.department);
        if (data.semester) setSemester(data.semester);
        if (data.examType) setExamType(data.examType);
        if (data.date) setDate(data.date);
        if (data.startTime) setStartTime(data.startTime);
        if (data.endTime) setEndTime(data.endTime);
        if (data.duration !== undefined) setDuration(data.duration);
        if (data.totalMarks !== undefined) setTotalMarks(data.totalMarks);
        if (data.instructions) setInstructions(data.instructions);
        if (data.passingMarks !== undefined) setPassingMarks(data.passingMarks);
        if (data.allowedMaterials) setAllowedMaterials(data.allowedMaterials);
        if (data.questions) setQuestions(data.questions);

        setShowBackupBanner(false);
        addToast('Draft exam backup restored successfully!', 'success');
      }
    } catch (err) {
      console.error(err);
      addToast('Failed to parse draft backup.', 'error');
    }
  };

  const handleDismissBackup = () => {
    setShowBackupBanner(false);
  };

  // Computations
  const allocatedMarks = questions.reduce((sum, q) => sum + (q.maximumMarks || 0), 0);
  const remainingMarks = totalMarks - allocatedMarks;

  // Handlers for Allowed Materials
  const handleAddMaterial = () => {
    if (materialInput.trim()) {
      setAllowedMaterials([...allowedMaterials, materialInput.trim()]);
      setMaterialInput('');
    }
  };
  const handleRemoveMaterial = (index: number) => {
    setAllowedMaterials(allowedMaterials.filter((_, i) => i !== index));
  };

  // Handlers for Questions CRUD
  const handleAddQuestion = () => {
    const nextNum = questions.length + 1;
    const newQ: QuestionInput = {
      tempId: `q-temp-${Date.now()}-${nextNum}`,
      questionNumber: nextNum,
      questionText: '',
      maximumMarks: 10,
      questionType: 'Descriptive',
      difficulty: 'Medium',
      bloomsLevel: 'Understand',
      keywords: '',
      rubric: '',
      modelAnswer: '',
      isCollapsed: false,
    };
    setQuestions([...questions, newQ]);
  };

  const handleUpdateQuestion = (tempId: string, updates: Partial<QuestionInput>) => {
    setQuestions(questions.map(q => q.tempId === tempId ? { ...q, ...updates } : q));
  };

  const handleDeleteQuestion = (tempId: string) => {
    const updated = questions.filter(q => q.tempId !== tempId).map((q, index) => ({
      ...q,
      questionNumber: index + 1
    }));
    setQuestions(updated);
  };

  const handleDuplicateQuestion = (qToDup: QuestionInput) => {
    const newQ: QuestionInput = {
      ...qToDup,
      tempId: `q-temp-${Date.now()}-${questions.length + 1}`,
      questionNumber: questions.length + 1,
      isCollapsed: false
    };
    setQuestions([...questions, newQ]);
    addToast('Question duplicated.', 'success');
  };

  // Move Questions
  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const newQs = [...questions];
    const temp = newQs[index];
    newQs[index] = newQs[targetIdx];
    newQs[targetIdx] = temp;

    // Rescale numbers
    const finalQs = newQs.map((q, idx) => ({
      ...q,
      questionNumber: idx + 1
    }));
    setQuestions(finalQs);
  };

  // Warnings / Duplicate text check
  const duplicateTextWarnings = questions.map((q) => {
    if (!q.questionText.trim()) return false;
    const matched = questions.filter(
      other => other.tempId !== q.tempId && other.questionText.trim().toLowerCase() === q.questionText.trim().toLowerCase()
    );
    return matched.length > 0;
  });

  // Question Import Handler
  const handleImportSelected = () => {
    const selections = mockBankQuestions.filter(q => selectedImportIds.includes(q.id));
    const importedQs: QuestionInput[] = selections.map((sq, idx) => ({
      tempId: `q-import-${sq.id}-${questions.length + idx}`,
      questionNumber: questions.length + idx + 1,
      questionText: sq.text,
      maximumMarks: sq.weight,
      questionType: sq.questionType as any,
      difficulty: sq.difficulty as any,
      bloomsLevel: sq.bloomsLevel as any,
      keywords: sq.expectedConcept,
      rubric: '',
      modelAnswer: '',
      isCollapsed: false,
    }));
    setQuestions([...questions, ...importedQs]);
    setIsImportDrawerOpen(false);
    setSelectedImportIds([]);
    addToast(`${importedQs.length} questions successfully imported into exam!`, 'success');
  };

  // Publish Checklist validations
  const checklist = {
    titleValid: name.trim().length > 0,
    subjectSelected: subjectId.length > 0,
    durationValid: duration > 0,
    marksSet: totalMarks > 0,
    hasQuestions: questions.length > 0,
    marksMatch: allocatedMarks === totalMarks,
    dateSelected: date.length > 0,
  };

  const isPublishEnabled = Object.values(checklist).every(v => v);

  // Submit Exam Creation
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (status === 'Published' && !isPublishEnabled) {
      addToast('Cannot publish exam. Please complete all checklist requirements.', 'error');
      return;
    }

    if (!name || !date || !examCode) {
      addToast('Please input title, code, and schedule date.', 'error');
      return;
    }

    // Validate questions and rubric totals
    for (const q of questions) {
      if (!q.questionText || !q.questionText.trim()) {
        addToast(`Question Q${q.questionNumber}: Question text is required.`, 'error');
        return;
      }
      if (!q.maximumMarks || q.maximumMarks <= 0) {
        addToast(`Question Q${q.questionNumber}: Maximum marks must be greater than 0.`, 'error');
        return;
      }
      if (Array.isArray(q.rubricItems) && q.rubricItems.length > 0) {
        const rubricTotal = q.rubricItems.reduce((sum, r) => sum + (Number(r.maxMarks) || 0), 0);
        if (rubricTotal !== q.maximumMarks) {
          addToast(
            `Question Q${q.questionNumber}: Total rubric marks (${rubricTotal}) must equal maximum marks (${q.maximumMarks}).`,
            'error'
          );
          return;
        }
      }
    }

    const payload: any = {
      title: name,
      examCode: examCode,
      subject: subjectId,
      department,
      semester,
      examType,
      examDate: date,
      startTime: startTime ? new Date(`${date}T${startTime}`).toISOString() : undefined,
      endTime: endTime ? new Date(`${date}T${endTime}`).toISOString() : undefined,
      duration,
      totalMarks,
      passingMarks,
      instructions,
      allowedMaterials: allowedMaterials.join(', '),
      examStatus: status,
      questions: questions.map((q) => ({
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        maximumMarks: q.maximumMarks,
        maxMarks: q.maximumMarks,
        questionType: q.questionType,
        difficulty: q.difficulty,
        bloomsLevel: q.bloomsLevel,
        keywords: q.keywords ? (typeof q.keywords === 'string' ? q.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : q.keywords) : [],
        rubric: q.rubric,
        rubricItems: q.rubricItems || [],
        modelAnswer: q.modelAnswer,
      })),
    };

    try {
      if (isEditMode) {
        await examService.updateExam(id!, payload);
        addToast('Exam configuration updated successfully!', 'success');
      } else {
        await examService.createExam(payload);
        // Clear local backup
        localStorage.removeItem('exam_draft_backup');
        addToast(
          status === 'Published'
            ? 'Exam scheduled, questions integrated, and published successfully!'
            : 'Exam draft created successfully in registry.',
          'success'
        );
      }
      navigate('/faculty/exams');
    } catch (err: any) {
      console.error('Save exam failed:', err);
      const errMsg = err.response?.data?.message || err.message || 'Server error occurred.';
      addToast(`Failed to save exam: ${errMsg}`, 'error');
    }
  };

  // Simulated Answer Key file pick
  const handleAnswerKeyDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setAnswerKeyFile(e.dataTransfer.files[0]);
      addToast(`Reference Answer Key file attached: ${e.dataTransfer.files[0].name}`, 'success');
    }
  };

  // Filter bank questions
  const filteredBank = mockBankQuestions.filter(q => {
    const matchesSearch = q.text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDiff = !selectedDifficulty || q.difficulty === selectedDifficulty;
    return matchesSearch && matchesDiff;
  });

  return (
    <div className="flex flex-col gap-6 text-left max-w-5xl mx-auto py-6 animate-fade-in relative">
      
      {/* Header Info */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-black text-on-surface font-display">Create Digital Exam Workspace</h2>
          <p className="text-sm text-on-surface-variant mt-1">Configure parameters, insert questions inline, and define model answers.</p>
        </div>

        {/* AutoSave Indicator */}
        <div className="flex items-center gap-2 bg-primary/5 text-primary text-xs font-bold px-3 py-1.5 rounded-xl border border-primary/10">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{lastAutoSave ? `Draft Auto-saved at ${lastAutoSave}` : 'Auto-save Active'}</span>
        </div>
      </div>

      {/* Backup recovery banner */}
      {showBackupBanner && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-amber-800 dark:text-amber-300 animate-fade-in z-20">
          <div className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 mt-0.5">restore_page</span>
            <div>
              <p className="font-bold">Auto-saved draft exam detected</p>
              <p className="text-[10px] opacity-90 mt-0.5">You have an unsaved draft exam from your previous session. Would you like to restore it?</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button 
              type="button" 
              onClick={handleRestoreBackup} 
              className="px-3 py-1.5 bg-amber-600 dark:bg-amber-500 hover:bg-amber-700 text-white font-bold rounded-xl transition text-[10px]"
            >
              Restore Draft
            </button>
            <button 
              type="button" 
              onClick={handleDismissBackup} 
              className="px-3 py-1.5 border border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold rounded-xl transition text-[10px]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/20 -mb-2 z-10">
        <button
          onClick={() => setTab('edit')}
          className={`px-6 py-2.5 font-bold text-xs border-b-2 transition-all ${
            tab === 'edit' 
              ? 'border-primary text-primary font-black' 
              : 'border-transparent text-outline hover:text-on-surface'
          }`}
        >
          Form Editor
        </button>
        <button
          onClick={() => setTab('preview')}
          className={`px-6 py-2.5 font-bold text-xs border-b-2 transition-all ${
            tab === 'preview' 
              ? 'border-primary text-primary font-black' 
              : 'border-transparent text-outline hover:text-on-surface'
          }`}
        >
          Student Preview Mode
        </button>
      </div>

      {tab === 'preview' ? (
        /* Preview Tab */
        <div className="glass-card p-8 rounded-2xl border border-outline-variant/20 shadow-md space-y-8 bg-white dark:bg-surface-container">
          <div className="border-b border-outline-variant/30 pb-6 text-center">
            <h1 className="text-2xl font-black text-on-surface uppercase tracking-wider">{name || 'Mid-Term Examination'}</h1>
            <div className="flex flex-wrap gap-4 justify-center mt-3 text-xs text-outline font-semibold">
              <span className="px-2.5 py-1 bg-outline-variant/25 rounded-md">Subject Code: {subjects.find(s => s.id === subjectId)?.code || 'CS-101'}</span>
              <span className="px-2.5 py-1 bg-outline-variant/25 rounded-md">Duration: {duration} Minutes</span>
              <span className="px-2.5 py-1 bg-outline-variant/25 rounded-md">Total Marks: {totalMarks}</span>
              <span className="px-2.5 py-1 bg-outline-variant/25 rounded-md">Passing Marks: {passingMarks}</span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-outline uppercase tracking-wider">Candidate Instructions</h3>
            <pre className="p-4 bg-surface-container rounded-xl text-xs whitespace-pre-line text-on-surface-variant font-sans leading-relaxed">
              {instructions}
            </pre>
          </div>

          <div className="space-y-6 pt-4">
            <h3 className="text-xs font-bold text-outline uppercase tracking-wider">Questions Catalog ({questions.length})</h3>
            <div className="divide-y divide-outline-variant/20">
              {questions.map((q) => (
                <div key={q.tempId} className="py-6 flex gap-4 items-start">
                  <span className="h-7 w-7 rounded-lg bg-primary/15 text-primary text-xs font-black flex items-center justify-center shrink-0">
                    Q{q.questionNumber}
                  </span>
                  <div className="flex-grow space-y-2">
                    <div className="flex justify-between items-start gap-4">
                      <h4 className="text-xs font-bold text-on-surface leading-loose">
                        {q.questionText || <span className="italic text-outline">[Empty Question text]</span>}
                      </h4>
                      <span className="text-[10px] uppercase font-bold text-outline bg-surface-container px-2 py-0.5 rounded shrink-0">
                        {q.maximumMarks} Marks ({q.questionType})
                      </span>
                    </div>

                    <div className="flex gap-2 text-[9px] font-bold text-outline">
                      <span className="px-2 py-0.5 bg-outline-variant/15 rounded">Difficulty: {q.difficulty}</span>
                      <span className="px-2 py-0.5 bg-outline-variant/15 rounded">Bloom: {q.bloomsLevel}</span>
                    </div>

                    {/* Canvas drawing box representative */}
                    <div className="h-32 border border-dashed border-outline-variant/40 rounded-xl bg-slate-50/50 flex items-center justify-center text-[10px] text-outline italic">
                      [iPad Canvas Drawing Area]
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Form Editor View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Main Config Form */}
          <form onSubmit={handleSaveExam} className="lg:col-span-2 space-y-6">
            
            {/* Section 1: General Details */}
            <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 shadow-md space-y-4">
              <h3 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">description</span>
                Section 1 – Exam Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Exam Title *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. OOP & DSA Final Exam"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Exam Code *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. DSA-M2026"
                    value={examCode}
                    onChange={(e) => setExamCode(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Subject *</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Department</label>
                  <input 
                    type="text" 
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Semester</label>
                  <input 
                    type="text" 
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Exam Type</label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                  >
                    <option value="Quiz">Quiz / Test</option>
                    <option value="Mid-Term">Mid-Term</option>
                    <option value="Final-Semester">Final Examination</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Exam Date *</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Start Time</label>
                  <input 
                    type="time" 
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">End Time</label>
                  <input 
                    type="time" 
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Duration (Min)</label>
                  <input 
                    type="number" 
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Marks score</label>
                  <input 
                    type="number" 
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(Number(e.target.value))}
                    className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Passing Marks</label>
                  <input 
                    type="number" 
                    value={passingMarks}
                    onChange={(e) => setPassingMarks(Number(e.target.value))}
                    className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Allowed materials list</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="e.g. Formula Sheets"
                      value={materialInput}
                      onChange={(e) => setMaterialInput(e.target.value)}
                      className="flex-grow px-3 py-1.5 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                    />
                    <button 
                      type="button" 
                      onClick={handleAddMaterial}
                      className="px-3 py-1.5 bg-primary text-on-primary font-bold text-[10px] rounded-xl hover:bg-primary-dark transition-all"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {allowedMaterials.map((mat, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-bold border border-primary/20 rounded">
                        {mat}
                        <button type="button" onClick={() => handleRemoveMaterial(i)} className="text-error font-black hover:text-error/80">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Instructions Guidelines</label>
                <textarea 
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={2}
                  className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                />
              </div>
            </div>

            {/* Section 2: Inline Question Editor */}
            <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 shadow-md space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">menu_book</span>
                  Section 2 – Question Management ({questions.length})
                </h3>

                <button 
                  type="button" 
                  onClick={() => setIsImportDrawerOpen(true)}
                  className="px-3 py-1.5 bg-secondary/10 hover:bg-secondary/15 text-secondary border border-secondary/20 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Import Question Bank
                </button>
              </div>

              {questions.length === 0 ? (
                <div className="p-8 border border-dashed border-outline-variant/30 rounded-xl text-center">
                  <span className="material-symbols-outlined text-outline text-3xl font-light">info</span>
                  <p className="text-xs text-outline mt-2">No questions added yet. Click Add Question to start editing exam.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((q, index) => (
                    <div 
                      key={q.tempId} 
                      className={`border rounded-xl transition-all ${
                        duplicateTextWarnings[index] ? 'border-orange-300 bg-orange-50/10' : 'border-outline-variant/20 bg-surface-container-low'
                      }`}
                    >
                      {/* Accordion Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/15 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <button 
                            type="button" 
                            onClick={() => handleUpdateQuestion(q.tempId, { isCollapsed: !q.isCollapsed })}
                            className="text-outline hover:text-on-surface flex"
                          >
                            <span className="material-symbols-outlined text-lg">
                              {q.isCollapsed ? 'expand_more' : 'expand_less'}
                            </span>
                          </button>
                          
                          <span className="h-6 w-6 rounded bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">
                            Q{q.questionNumber}
                          </span>

                          <span className="text-xs font-black text-on-surface uppercase tracking-wider truncate max-w-[150px]">
                            {q.questionType} Question
                          </span>

                          {duplicateTextWarnings[index] && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 text-[8px] font-extrabold uppercase rounded animate-pulse">
                              ⚠️ Duplicate content check
                            </span>
                          )}
                        </div>

                        {/* Reordering and card controllers */}
                        <div className="flex items-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => moveQuestion(index, 'up')}
                            disabled={index === 0}
                            className="h-7 w-7 rounded-lg border border-outline-variant/20 flex items-center justify-center hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <span className="material-symbols-outlined text-xs">arrow_upward</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => moveQuestion(index, 'down')}
                            disabled={index === questions.length - 1}
                            className="h-7 w-7 rounded-lg border border-outline-variant/20 flex items-center justify-center hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <span className="material-symbols-outlined text-xs">arrow_downward</span>
                          </button>

                          <button 
                            type="button" 
                            onClick={() => handleDuplicateQuestion(q)}
                            className="h-7 w-7 rounded-lg border border-outline-variant/20 flex items-center justify-center hover:bg-surface-container text-primary"
                            title="Duplicate question"
                          >
                            <span className="material-symbols-outlined text-xs">content_copy</span>
                          </button>

                          <button 
                            type="button" 
                            onClick={() => handleDeleteQuestion(q.tempId)}
                            className="h-7 w-7 rounded-lg border border-outline-variant/20 flex items-center justify-center hover:bg-red-50 text-error"
                            title="Delete question"
                          >
                            <span className="material-symbols-outlined text-xs">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Accordion Content */}
                      {!q.isCollapsed && (
                        <div className="p-4 space-y-4 text-xs">
                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-outline tracking-wider uppercase text-[9px]">Question Body text *</label>
                            <textarea
                              placeholder="Type query / instructions detail..."
                              value={q.questionText}
                              onChange={(e) => handleUpdateQuestion(q.tempId, { questionText: e.target.value })}
                              rows={2}
                              className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 focus:outline-none"
                            />
                            {duplicateTextWarnings[index] && (
                              <p className="text-[10px] text-orange-600 font-medium">Similar description exists in this exam layout. Make sure it is unique.</p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="font-bold text-outline tracking-wider uppercase text-[9px]">Scope Type</label>
                              <select
                                value={q.questionType}
                                onChange={(e) => handleUpdateQuestion(q.tempId, { questionType: e.target.value as any })}
                                className="px-2.5 py-1.5 bg-surface-container rounded-lg border border-outline-variant/30"
                              >
                                <option value="Descriptive">Descriptive</option>
                                <option value="Short Answer">Short Answer</option>
                                <option value="Long Answer">Long Answer</option>
                                <option value="MCQ">MCQ</option>
                                <option value="True/False">True/False</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="font-bold text-outline tracking-wider uppercase text-[9px]">Max marks *</label>
                              <input 
                                type="number" 
                                value={q.maximumMarks}
                                onChange={(e) => handleUpdateQuestion(q.tempId, { maximumMarks: Number(e.target.value) })}
                                className="px-2.5 py-1.5 bg-surface-container rounded-lg border border-outline-variant/30"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="font-bold text-outline tracking-wider uppercase text-[9px]">Bloom's Level</label>
                              <select
                                value={q.bloomsLevel}
                                onChange={(e) => handleUpdateQuestion(q.tempId, { bloomsLevel: e.target.value as any })}
                                className="px-2.5 py-1.5 bg-surface-container rounded-lg border border-outline-variant/30"
                              >
                                <option value="Remember">Remember</option>
                                <option value="Understand">Understand</option>
                                <option value="Apply">Apply</option>
                                <option value="Analyze">Analyze</option>
                                <option value="Evaluate">Evaluate</option>
                                <option value="Create">Create</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="font-bold text-outline tracking-wider uppercase text-[9px]">Difficulty</label>
                              <select
                                value={q.difficulty}
                                onChange={(e) => handleUpdateQuestion(q.tempId, { difficulty: e.target.value as any })}
                                className="px-2.5 py-1.5 bg-surface-container rounded-lg border border-outline-variant/30"
                              >
                                <option value="Easy">Easy</option>
                                <option value="Medium">Medium</option>
                                <option value="Hard">Hard</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="font-bold text-outline tracking-wider uppercase text-[9px]">Model Answer (Reference Text for AI Evaluation)</label>
                            <textarea
                              placeholder="Expected model answer detail..."
                              value={q.modelAnswer}
                              onChange={(e) => handleUpdateQuestion(q.tempId, { modelAnswer: e.target.value })}
                              rows={2}
                              className="px-3 py-1.5 bg-surface-container rounded-xl border border-outline-variant/30 focus:outline-none"
                            />
                          </div>

                          {/* Structured Rubric Criteria Editor */}
                          <div className="space-y-3 pt-2 border-t border-outline-variant/20">
                            <div className="flex flex-wrap justify-between items-center gap-2">
                              <div className="flex items-center gap-2">
                                <label className="font-bold text-outline tracking-wider uppercase text-[9px]">Structured Rubric Criteria</label>
                                {q.rubricItems && q.rubricItems.length > 0 && (
                                  <span className={`px-2 py-0.5 text-[9px] font-black rounded border ${
                                    q.rubricItems.reduce((sum, r) => sum + (Number(r.maxMarks) || 0), 0) === q.maximumMarks
                                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                      : 'bg-red-100 text-red-700 border-red-300 animate-pulse'
                                  }`}>
                                    {q.rubricItems.reduce((sum, r) => sum + (Number(r.maxMarks) || 0), 0) === q.maximumMarks
                                      ? `✓ Rubric total matches Max Marks (${q.maximumMarks})`
                                      : `⚠️ Rubric total (${q.rubricItems.reduce((sum, r) => sum + (Number(r.maxMarks) || 0), 0)}) must equal Max Marks (${q.maximumMarks})`}
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const currentItems = q.rubricItems || [];
                                  const newItem: RubricItemInput = {
                                    criterion: '',
                                    description: '',
                                    maxMarks: 5
                                  };
                                  handleUpdateQuestion(q.tempId, { rubricItems: [...currentItems, newItem] });
                                }}
                                className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold rounded-lg transition border border-primary/20 flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-xs">add</span>
                                Add Rubric Criterion
                              </button>
                            </div>

                            {(!q.rubricItems || q.rubricItems.length === 0) ? (
                              <p className="text-[10px] text-outline italic">No rubric criteria added yet. Click "Add Rubric Criterion" to define structured evaluation rules.</p>
                            ) : (
                              <div className="space-y-2">
                                {q.rubricItems.map((rItem, rIdx) => (
                                  <div key={rIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 bg-surface-container rounded-xl border border-outline-variant/20 items-center">
                                    <div className="sm:col-span-4 flex flex-col gap-0.5">
                                      <span className="text-[8px] font-bold uppercase text-outline">Criterion *</span>
                                      <input
                                        type="text"
                                        placeholder="e.g. Correct formula derivation"
                                        value={rItem.criterion}
                                        onChange={(e) => {
                                          const nextItems = [...(q.rubricItems || [])];
                                          nextItems[rIdx] = { ...nextItems[rIdx], criterion: e.target.value };
                                          handleUpdateQuestion(q.tempId, { rubricItems: nextItems });
                                        }}
                                        className="px-2 py-1 bg-white rounded border border-outline-variant/30 text-xs"
                                      />
                                    </div>
                                    <div className="sm:col-span-5 flex flex-col gap-0.5">
                                      <span className="text-[8px] font-bold uppercase text-outline">Description</span>
                                      <input
                                        type="text"
                                        placeholder="Details/key points required"
                                        value={rItem.description}
                                        onChange={(e) => {
                                          const nextItems = [...(q.rubricItems || [])];
                                          nextItems[rIdx] = { ...nextItems[rIdx], description: e.target.value };
                                          handleUpdateQuestion(q.tempId, { rubricItems: nextItems });
                                        }}
                                        className="px-2 py-1 bg-white rounded border border-outline-variant/30 text-xs"
                                      />
                                    </div>
                                    <div className="sm:col-span-2 flex flex-col gap-0.5">
                                      <span className="text-[8px] font-bold uppercase text-outline">Max Marks *</span>
                                      <input
                                        type="number"
                                        min={0}
                                        value={rItem.maxMarks}
                                        onChange={(e) => {
                                          const nextItems = [...(q.rubricItems || [])];
                                          nextItems[rIdx] = { ...nextItems[rIdx], maxMarks: Number(e.target.value) || 0 };
                                          handleUpdateQuestion(q.tempId, { rubricItems: nextItems });
                                        }}
                                        className="px-2 py-1 bg-white rounded border border-outline-variant/30 text-xs font-bold text-center"
                                      />
                                    </div>
                                    <div className="sm:col-span-1 flex items-center justify-center pt-2 sm:pt-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextItems = (q.rubricItems || []).filter((_, i) => i !== rIdx);
                                          handleUpdateQuestion(q.tempId, { rubricItems: nextItems });
                                        }}
                                        className="text-error hover:text-error/80 text-xs font-bold p-1"
                                        title="Remove criterion"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button 
                type="button" 
                onClick={handleAddQuestion}
                className="w-full py-3 bg-surface-container hover:bg-surface-container-high border border-dashed border-outline-variant/50 rounded-xl text-xs font-bold text-primary transition-all flex items-center justify-center gap-1.5 mt-4 group"
              >
                <span className="material-symbols-outlined text-sm group-hover:scale-110 transition-transform">add</span>
                Add Question Card
              </button>
            </div>

            {/* Section 4: Upload Answer Key pdf (Optional) */}
            <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 shadow-md space-y-4">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">upload_file</span>
                Section 4 – Upload Official Answer Key (Optional)
              </h3>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                If you prefer not to type model answers manually for each question, upload an official document (PDF/Image). 
                The AI Pipeline will extract questions and compare them.
              </p>

              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleAnswerKeyDrop}
                className="border-2 border-dashed border-outline-variant/40 rounded-2xl p-8 hover:bg-primary/5 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-center cursor-pointer relative"
              >
                <span className="material-symbols-outlined text-3xl text-outline mb-1">cloud_upload</span>
                <span className="text-xs font-black text-on-surface">Drag & Drop official solutions sheet here</span>
                <span className="text-[10px] text-outline">Supported format: PDF, DOCX, TXT, PNG, JPG</span>

                <input 
                  type="file" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setAnswerKeyFile(e.target.files[0]);
                      addToast(`File attached: ${e.target.files[0].name}`, 'success');
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />

                {answerKeyFile && (
                  <div className="mt-4 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-[10px] font-bold text-primary flex items-center gap-2 z-10">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    <span>{answerKeyFile.name} ({(answerKeyFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                )}
              </div>
            </div>

          </form>

          {/* Right sidebar: Live Marks & Publish checklist */}
          <div className="space-y-6 lg:sticky lg:top-24">
            
            {/* Live Marks Card */}
            <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 shadow-md text-center bg-surface-container-low">
              <h4 className="text-xs font-black text-outline uppercase tracking-wider mb-2">Live Marks Allocation</h4>
              
              <div className="mt-4 space-y-1">
                <div className="text-3xl font-black text-on-surface font-display">{allocatedMarks} / {totalMarks}</div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Marks distributed</p>
              </div>

              {/* Status Banner */}
              <div className="mt-4">
                {remainingMarks === 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-green-100 text-green-700 text-[10px] font-extrabold uppercase border border-green-200">
                    ✓ All Marks Allocated
                  </span>
                ) : remainingMarks > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-100 text-amber-700 text-[10px] font-extrabold uppercase border border-amber-200">
                    ⚠️ {remainingMarks} Marks Remaining
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-red-100 text-red-700 text-[10px] font-extrabold uppercase border border-red-200">
                    🚨 {Math.abs(remainingMarks)} Marks Over Limit
                  </span>
                )}
              </div>
            </div>

            {/* Publish Checklist Card */}
            <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 shadow-md bg-white dark:bg-surface-container flex flex-col gap-4">
              <h4 className="text-xs font-black text-outline uppercase tracking-wider border-b border-outline-variant/10 pb-2">Publish Requirements</h4>
              
              <ul className="space-y-2.5 text-xs text-on-surface-variant">
                <li className="flex items-center gap-2.5">
                  <span className={`material-symbols-outlined text-sm font-bold ${checklist.titleValid ? 'text-green-600' : 'text-outline/40'}`}>
                    {checklist.titleValid ? 'check_circle' : 'cancel'}
                  </span>
                  <span>Exam Title filled</span>
                </li>

                <li className="flex items-center gap-2.5">
                  <span className={`material-symbols-outlined text-sm font-bold ${checklist.subjectSelected ? 'text-green-600' : 'text-outline/40'}`}>
                    {checklist.subjectSelected ? 'check_circle' : 'cancel'}
                  </span>
                  <span>Subject specified</span>
                </li>

                <li className="flex items-center gap-2.5">
                  <span className={`material-symbols-outlined text-sm font-bold ${checklist.durationValid ? 'text-green-600' : 'text-outline/40'}`}>
                    {checklist.durationValid ? 'check_circle' : 'cancel'}
                  </span>
                  <span>Duration is positive</span>
                </li>

                <li className="flex items-center gap-2.5">
                  <span className={`material-symbols-outlined text-sm font-bold ${checklist.dateSelected ? 'text-green-600' : 'text-outline/40'}`}>
                    {checklist.dateSelected ? 'check_circle' : 'cancel'}
                  </span>
                  <span>Schedule date selected</span>
                </li>

                <li className="flex items-center gap-2.5">
                  <span className={`material-symbols-outlined text-sm font-bold ${checklist.hasQuestions ? 'text-green-600' : 'text-outline/40'}`}>
                    {checklist.hasQuestions ? 'check_circle' : 'cancel'}
                  </span>
                  <span>At least 1 question added</span>
                </li>

                <li className="flex items-center gap-2.5">
                  <span className={`material-symbols-outlined text-sm font-bold ${checklist.marksMatch ? 'text-green-600' : 'text-outline/40'}`}>
                    {checklist.marksMatch ? 'check_circle' : 'cancel'}
                  </span>
                  <span>Marks sum matches Exam totalMarks</span>
                </li>
              </ul>

              {/* Status input */}
              <div className="flex flex-col gap-1.5 pt-3 border-t border-outline-variant/15">
                <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Publication Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-surface-container rounded-lg border border-outline-variant/30 text-xs font-semibold text-on-surface"
                >
                  <option value="Draft">Draft (Save & Tweak later)</option>
                  <option value="Published">Published (Lock & Release)</option>
                  <option value="Active">Active (Session Ongoing)</option>
                  <option value="Completed">Completed (Grading / Review)</option>
                </select>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={handleSaveExam}
                  className="w-full py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl hover:shadow-md transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                  disabled={status === 'Published' && !isPublishEnabled}
                >
                  <span className="material-symbols-outlined text-sm font-bold">check</span>
                  Save & Schedule
                </button>

                <button 
                  type="button" 
                  onClick={() => navigate('/faculty')}
                  className="w-full py-2 border border-outline-variant/30 hover:bg-surface-container-low transition-all font-bold text-xs rounded-xl text-center"
                >
                  Cancel
                </button>
              </div>
            </div>

          </div>

          {/* Import Question Bank Side-Drawer / Overlay */}
          {isImportDrawerOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex justify-end animate-fade-in">
              <div className="w-full max-w-lg bg-white dark:bg-surface-container p-6 flex flex-col gap-4 shadow-2xl h-full overflow-hidden text-xs">
                
                {/* Drawer Header */}
                <div className="flex justify-between items-center border-b border-outline-variant/20 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">Import Questions from Bank</h3>
                    <p className="text-[10px] text-outline">Search previously configured questions below.</p>
                  </div>
                  <button type="button" onClick={() => setIsImportDrawerOpen(false)} className="text-outline hover:text-on-surface">
                    <span className="material-symbols-outlined font-black">close</span>
                  </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="Search by keywords..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-1.5 bg-surface-container rounded-lg border border-outline-variant/30"
                  />

                  <select
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
                    className="px-3 py-1.5 bg-surface-container rounded-lg border border-outline-variant/30"
                  >
                    <option value="">All Difficulties</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                {/* List body */}
                <div className="flex-grow overflow-y-auto divide-y divide-outline-variant/10 pr-1.5 custom-scrollbar">
                  {filteredBank.length === 0 ? (
                    <div className="p-8 text-center text-outline">No questions match filter criteria.</div>
                  ) : (
                    filteredBank.map(bq => {
                      const isSel = selectedImportIds.includes(bq.id);
                      return (
                        <div 
                          key={bq.id} 
                          onClick={() => {
                            if (isSel) {
                              setSelectedImportIds(selectedImportIds.filter(id => id !== bq.id));
                            } else {
                              setSelectedImportIds([...selectedImportIds, bq.id]);
                            }
                          }}
                          className={`p-4 gap-3 flex cursor-pointer transition-colors ${
                            isSel ? 'bg-primary/5 hover:bg-primary/10 border-l-2 border-primary' : 'hover:bg-slate-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={isSel} 
                            onChange={() => {}} // handled by row click 
                            className="mt-1"
                          />
                          <div className="space-y-1">
                            <h4 className="font-bold text-on-surface leading-relaxed text-[11px]">{bq.text}</h4>
                            <div className="flex gap-2 text-[9px] font-extrabold uppercase text-outline">
                              <span className="px-1.5 py-0.5 bg-outline-variant/20 rounded">{bq.weight} Marks</span>
                              <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded">{bq.bloomsLevel}</span>
                              <span className="px-1.5 py-0.5 bg-secondary/15 text-secondary rounded">{bq.difficulty}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer action */}
                <div className="pt-3 border-t border-outline-variant/20 flex gap-2 justify-end">
                  <button 
                    type="button" 
                    onClick={() => setIsImportDrawerOpen(false)}
                    className="px-4 py-2 border border-outline-variant/30 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    onClick={handleImportSelected}
                    disabled={selectedImportIds.length === 0}
                    className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Import Selected ({selectedImportIds.length})
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default CreateExam;
