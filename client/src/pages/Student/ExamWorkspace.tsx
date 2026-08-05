import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studentService } from '../../services/student.service';
import { MockExam } from '../../mocks/db';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const ExamWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<MockExam | null>(null);
  const [loading, setLoading] = useState(true);

  // Active question index
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);

  // Track draft answers in memory per question (simulating canvas strokes save)
  // Store either drawing visual coordinates or text string inputs
  const [studentDrafts, setStudentDrafts] = useState<Record<number, string>>({});
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(7200); // 2 hours in seconds
  const [isSaved, setIsSaved] = useState(true);

  // Pencil configuration states
  const [pencilWidth, setPencilWidth] = useState(3);
  const [pencilColor, setPencilColor] = useState('#0000FF'); // Blue default ink
  const [stylusActive, setStylusActive] = useState(true); // Active pencil connected indicator

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Review screen overlay toggle
  const [showReviewOverlay, setShowReviewOverlay] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  // Load Exam
  useEffect(() => {
    const loadExam = async () => {
      const examId = id || 'exam-2'; // Default to today's machine learning exam
      try {
        const detail = await studentService.getExamById(examId);
        if (detail) {
          setExam(detail);
          // Set initial drafts
          const initialDrafts: Record<number, string> = {};
          detail.questions.forEach((q: any) => {
            initialDrafts[q.number] = '';
          });
          setStudentDrafts(initialDrafts);
          setTimeLeft(detail.durationMinutes * 60);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadExam();
  }, [id]);

  // Timer loop
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  // Clear Canvas and redraw grid
  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset dimensions for high resolution
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw graph paper grid (design look)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    const gridSpacing = 24;

    for (let x = 0; x < canvas.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Load any existing draft strokes (simulated text overlay)
    const activeQNo = exam?.questions[activeQuestionIdx]?.number;
    if (activeQNo && studentDrafts[activeQNo]) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 13px sans-serif';
      ctx.fillText('[Digital Handwritten Draft Rendered - Stylus Input Captured]:', 30, 45);
      ctx.fillStyle = pencilColor;
      ctx.font = 'bold 16px monospace';
      ctx.fillText(studentDrafts[activeQNo], 35, 80);
    }
  };

  // Re-draw when active question switches
  useEffect(() => {
    if (!loading && exam) {
      initializeCanvas();
    }
  }, [activeQuestionIdx, loading]);

  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setIsSaved(false);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = canvas.getBoundingClientRect();

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = canvas.getBoundingClientRect();

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = pencilColor;
    ctx.lineWidth = pencilWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);

    // Auto-save: simulate converting/storing canvas information
    const activeQNo = exam?.questions[activeQuestionIdx]?.number;
    if (activeQNo) {
      // Simulate mapping stroke coordinates to a draft answer string
      if (!studentDrafts[activeQNo]) {
        setStudentDrafts(prev => ({
          ...prev,
          [activeQNo]: `Draft response entered for question #${activeQNo} using digital stylus ink.`
        }));
      }
    }
    
    // Simulate auto-save delay
    setTimeout(() => {
      setIsSaved(true);
    }, 800);
  };

  const clearCanvas = () => {
    const activeQNo = exam?.questions[activeQuestionIdx]?.number;
    if (activeQNo) {
      setStudentDrafts(prev => ({
        ...prev,
        [activeQNo]: ''
      }));
    }
    setIsSaved(false);
    initializeCanvas();
    setTimeout(() => {
      setIsSaved(true);
    }, 600);
  };

  // Navigate Questions
  const handlePrev = () => {
    if (activeQuestionIdx > 0) {
      setActiveQuestionIdx(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (exam && activeQuestionIdx < exam.questions.length - 1) {
      setActiveQuestionIdx(prev => prev + 1);
    }
  };

  // Submit flow
  const triggerSaveDraft = () => {
    setIsSaved(false);
    setTimeout(() => {
      setIsSaved(true);
    }, 400);
  };

  const handleSubmitExam = () => {
    // Show validation checklist first
    setShowReviewOverlay(true);
  };

  const executeFinalSubmit = () => {
    setShowReviewOverlay(false);
    setShowConfirmSubmit(false);
    navigate('/student/success', { 
      state: { 
        examName: exam?.name,
        subjectCode: exam?.subjectCode,
        subjectName: exam?.subjectName
      } 
    });
  };

  // Helpers to structure time formatting
  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;
  if (!exam) return <div className="text-center py-20 text-error font-bold">Exam workspace error.</div>;

  const currentQuestion = exam.questions[activeQuestionIdx];

  return (
    <div className="flex flex-col gap-6 text-left h-[calc(100vh-6.5rem)] relative animate-fade-in">
      
      {/* Dynamic Action Toolbar */}
      <div className="glass-card p-4 rounded-xl border border-outline-variant/20 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black font-display text-on-surface truncate pr-4">{exam.name}</h2>
          <div className="flex items-center gap-3 text-xs text-outline mt-0.5">
            <span>{exam.subjectName} ({exam.subjectCode})</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold text-green-700 bg-green-500/10 px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-ping"></span>
              {stylusActive ? 'Stylus / Apple Pencil Connected' : 'No Stylus input detected'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Auto Safe indicator */}
          <div className="flex items-center gap-1.5 text-xs text-outline font-bold">
            <span className="material-symbols-outlined text-sm text-green-600">cloud_done</span>
            {isSaved ? (
              <span className="text-green-700">Auto Saved ✓</span>
            ) : (
              <span className="text-amber-600 animate-pulse">Saving strokes...</span>
            )}
          </div>

          {/* Remaining Timer */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm font-semibold border ${
            timeLeft < 600 
              ? 'bg-error/10 border-error/20 text-error animate-pulse' 
              : 'bg-surface-container border-outline-variant/30 text-on-surface'
          }`}>
            <span className="material-symbols-outlined text-base">timer</span>
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Workspace Panel layout */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        
        {/* Sidebar Question Palette */}
        <div className="glass-card p-4 rounded-xl border border-outline-variant/20 flex flex-col justify-between gap-4 col-span-1 lg:max-h-full overflow-y-auto custom-scrollbar">
          <div>
            <h3 className="text-xs font-bold text-outline uppercase tracking-wider mb-3">Question Palette</h3>
            <div className="grid grid-cols-5 gap-2">
              {exam.questions.map((q, idx) => {
                const isAttempted = !!studentDrafts[q.number];
                const isActive = idx === activeQuestionIdx;
                return (
                  <button
                    key={q.number}
                    onClick={() => {
                      triggerSaveDraft();
                      setActiveQuestionIdx(idx);
                    }}
                    className={`h-10 rounded-lg text-xs font-bold transition-all active:scale-90 flex items-center justify-center cursor-pointer ${
                      isActive 
                        ? 'bg-primary text-on-primary shadow-sm'
                        : isAttempted
                          ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-950/40 dark:text-green-300'
                          : 'bg-surface-container border border-outline-variant/20 hover:bg-surface-container-high'
                    }`}
                  >
                    Q{q.number}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-outline-variant/20 pt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-primary"></span>Active</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-100 border border-green-300"></span>Written</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-surface-container"></span>Empty</span>
            </div>
            <button 
              onClick={handleSubmitExam}
              className="mt-2 w-full py-2.5 bg-error text-on-error hover:bg-error/95 rounded-xl text-xs font-black transition-all active:scale-95 text-center cursor-pointer"
            >
              Submit Exam Sheet
            </button>
          </div>
        </div>

        {/* Writing Board (Question Viewer + Stylus Canvas) */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0 bg-white dark:bg-surface-container rounded-xl border border-outline-variant/20 p-6 shadow-sm overflow-hidden">
          
          {/* Question text */}
          <div className="border-b border-outline-variant/20 pb-4">
            <div className="flex items-center justify-between text-xs font-bold text-outline">
              <span>Question {currentQuestion.number} of {exam.questions.length}</span>
              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded">{currentQuestion.maxMarks} Marks</span>
            </div>
            <h4 className="mt-2 text-sm font-semibold text-on-surface leading-relaxed">
              {currentQuestion.text}
            </h4>
            <p className="text-[10px] text-outline mt-1 italic">Blooms level: {currentQuestion.bloomsLevel} • Difficulty: {currentQuestion.difficulty}</p>
          </div>

          {/* Slate Drawing Workspace */}
          <div className="flex-grow flex flex-col min-h-0 relative">
            
            {/* Canvas Custom Options */}
            <div className="flex justify-between items-center gap-4 py-2 border-b border-outline-variant/10">
              <span className="text-[10px] font-bold text-outline flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">gesture</span> iPad Ink canvas
              </span>
              <div className="flex items-center gap-3">
                {/* Pencil sizes */}
                <div className="flex items-center gap-1">
                  {[2, 3, 5, 8].map(size => (
                    <button
                      key={size}
                      onClick={() => setPencilWidth(size)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center border font-bold text-[8px] transition-colors ${
                        pencilWidth === size 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-outline-variant-variant/40 hover:bg-outline-variant-variant/15 text-outline'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {/* Colors */}
                <div className="flex items-center gap-1.5">
                  {['#0000FF', '#000000', '#FF0000'].map(color => (
                    <button
                      key={color}
                      onClick={() => setPencilColor(color)}
                      className="w-5 h-5 rounded-full border border-white dark:border-surface shadow-sm active:scale-90"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <button 
                  onClick={clearCanvas}
                  className="px-2 py-1 bg-outline-variant/20 hover:bg-error/10 hover:text-error text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">delete</span> Clear Board
                </button>
              </div>
            </div>

            {/* Drawing Canvas Board */}
            <div className="flex-grow bg-slate-50 dark:bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden mt-3 cursor-crosshair select-none relative">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="absolute inset-0 w-full h-full block bg-transparent"
              />
              {/* Apple pencil user hint info */}
              <div className="absolute bottom-3 right-3 text-[9px] bg-white/70 dark:bg-surface-container-high/70 backdrop-blur px-2.5 py-1 rounded text-outline font-bold shadow-sm pointer-events-none">
                Write/Draw with Apple Pencil or Stylus inside the grid bounds
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between border-t border-outline-variant/20 pt-4 mt-2">
            <button
              onClick={handlePrev}
              disabled={activeQuestionIdx === 0}
              className="px-4 py-2 border border-outline-variant/30 hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span> Previous Question
            </button>
            <button
              onClick={handleNext}
              disabled={activeQuestionIdx === exam.questions.length - 1}
              className="px-4 py-2 bg-primary/10 hover:bg-primary/15 text-primary disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              Next Question <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>

        </div>

      </div>

      {/* Review Attempt Answers Overlay (User Suggestion #9 & #2) */}
      {showReviewOverlay && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-container p-6 rounded-2xl border border-outline-variant/30 shadow-2xl max-w-lg w-full text-left flex flex-col gap-5 animate-scale-up">
            <div>
              <h3 className="text-lg font-black font-display text-on-surface">Review Answers Checklist</h3>
              <p className="text-xs text-outline mt-0.5">Please check attempted status of digital responses before finishing.</p>
            </div>

            <div className="space-y-2 border border-outline-variant/20 p-4 rounded-xl max-h-48 overflow-y-auto custom-scrollbar">
              {exam.questions.map((q) => {
                const isAttempted = !!studentDrafts[q.number];
                return (
                  <div key={q.number} className="flex justify-between items-center text-xs text-on-surface py-1">
                    <span className="font-semibold">Question {q.number} ({q.maxMarks} Marks)</span>
                    {isAttempted ? (
                      <span className="flex items-center gap-1 font-bold text-green-700 bg-green-500/10 px-2 py-0.5 rounded text-[10px]">
                        <span className="material-symbols-outlined text-xs">done</span> Attempted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-bold text-error bg-error/10 px-2 py-0.5 rounded text-[10px]">
                        <span className="material-symbols-outlined text-xs">warning</span> Not Attempted
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-outline leading-relaxed bg-surface-container p-3 rounded-lg border border-outline-variant/10">
              ⚡ <b>Evaluation Pipeline Transmit Gate:</b> Clicking <i>Submit</i> wraps vector canvas coordinates. AI models execute Handwriting Recognition (HWR) and semantic analyses. Details are then sent to faculty for manual double-check review.
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                onClick={() => setShowReviewOverlay(false)}
                className="px-4 py-2 border border-outline-variant/30 hover:bg-surface-container rounded-xl text-xs font-bold leading-normal transition-all"
              >
                Back to Editing
              </button>
              <button 
                onClick={() => {
                  setShowReviewOverlay(false);
                  setShowConfirmSubmit(true);
                }}
                className="px-5 py-2 bg-primary text-on-primary rounded-xl text-xs font-black hover:shadow-lg transition-all active:scale-95"
              >
                Proceed to Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-container p-6 rounded-2xl border border-outline-variant/30 shadow-2xl max-w-sm w-full text-center flex flex-col gap-4">
            <span className="material-symbols-outlined text-error text-4xl animate-bounce">warning</span>
            <div>
              <h3 className="font-bold text-base text-on-surface">Submit Answer Sheet?</h3>
              <p className="text-xs text-outline mt-1 leading-relaxed">
                You cannot edit answers after submission. Your handwritten responses will log immediately to the AI OCR evaluations server.
              </p>
            </div>
            <div className="flex gap-2.5 justify-center pt-2">
              <button 
                onClick={() => setShowConfirmSubmit(false)}
                className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={executeFinalSubmit}
                className="px-5 py-2 bg-error text-on-error hover:bg-error/95 rounded-xl text-xs font-black transition-all active:scale-95"
              >
                Yes, Submit Exam
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ExamWorkspace;
