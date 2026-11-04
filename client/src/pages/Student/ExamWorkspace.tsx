import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { studentService } from '../../services/student.service';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

interface Point {
  x: number;
  y: number;
  time?: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

interface Question {
  id: string;
  questionNumber: number;
  questionText: string;
  maximumMarks: number;
  required: boolean;
}

interface WorkspaceExam {
  id: string;
  title: string;
  subject: string;
  subjectCode: string;
  duration: number;
  totalMarks: number;
  startTime: string;
  endTime: string;
  instructions: string[];
}

export const ExamWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State elements
  const [exam, setExam] = useState<WorkspaceExam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // Current Question
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);

  // Digital Stroke draft arrays mapping: [questionId] -> list of strokes
  const [questionStrokes, setQuestionStrokes] = useState<Record<string, Stroke[]>>({});
  // Redo stack for each question
  const [redoStrokes, setRedoStrokes] = useState<Record<string, Stroke[]>>({});

  // Autosave status indicator
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  // Timer countdown in seconds
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);

  // Submit states
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Pencil controls
  const [pencilColor, setPencilColor] = useState('#0000FF'); // Default Blue ink
  const [pencilWidth, setPencilWidth] = useState(3);
  const [toolMode, setToolMode] = useState<'pen' | 'eraser'>('pen');

  // Canvas drawing flags
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingStrokeRef = useRef<Stroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Local storage cache keys
  const getLocalStorageKey = (subId: string) => `gradeai:draft:student:${id}:${subId}`;

  // 1. Initial Access check & Start/Resume Exam Setup
  useEffect(() => {
    const fetchWorkspaceInfo = async () => {
      if (!id) {
        setErrorHeader("No Exam Selected");
        setErrorDetail("Please select an active exam from your exam list to enter the workspace.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorHeader(null);
      setErrorDetail(null);
      try {
        // Query Workspace Access
        const workspaceData = await studentService.getExamWorkspace(id);
        setExam(workspaceData.exam);
        setQuestions(workspaceData.questions || []);

        // Calculate server time offset
        const serverTime = new Date(workspaceData.serverTime).getTime();
        const clientTime = Date.now();
        const offset = serverTime - clientTime;
        setServerTimeOffset(offset);

        // Idempotently start/resume submission
        const startResult = await studentService.startExam(id);
        const subId = startResult.id;
        setSubmissionId(subId);

        // Prepopulate workspace strokes from server answers if any
        const loadedStrokes: Record<string, Stroke[]> = {};
        if (workspaceData.submission && workspaceData.submission.answers) {
          workspaceData.submission.answers.forEach((ans: any) => {
            if (ans.handwrittenData) {
              try {
                const parsed = JSON.parse(ans.handwrittenData);
                if (parsed && parsed.strokes) {
                  loadedStrokes[ans.questionId.toString()] = parsed.strokes;
                }
              } catch (e) {
                // If not JSON, skip/initialize blank
              }
            }
          });
        }
        
        // Merge with local storage recovery copies if available
        const localKey = getLocalStorageKey(subId);
        const localCachedRaw = localStorage.getItem(localKey);
        if (localCachedRaw) {
          try {
            const localObj = JSON.parse(localCachedRaw);
            Object.keys(localObj).forEach((qId) => {
              // If local copy exists and is newer or has contents, prioritize
              if (localObj[qId] && (!loadedStrokes[qId] || loadedStrokes[qId].length === 0)) {
                loadedStrokes[qId] = localObj[qId];
              }
            });
          } catch (e) {
            console.error('Failed to parse local recovery database', e);
          }
        }
        setQuestionStrokes(loadedStrokes);

      } catch (err: any) {
        console.error('Access check failed:', err);
        const status = err?.response?.status;
        const msg = err?.response?.data?.message || err?.message || 'Access Forbidden';

        if (status === 403) {
          setErrorHeader('Exam Access Blocked');
          setErrorDetail(msg);
        } else if (status === 404) {
          setErrorHeader('Exam Not Found');
          setErrorDetail('The requested examination does not exist in the database.');
        } else {
          setErrorHeader('Network/Server Connection Error');
          setErrorDetail(msg);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchWorkspaceInfo();
  }, [id]);

  // 2. Timer Loop with offset correction and Low-time warnings
  useEffect(() => {
    if (!exam || !exam.endTime) return;
    
    const calculateTime = () => {
      const estimatedServerNow = Date.now() + serverTimeOffset;
      const endMs = new Date(exam.endTime).getTime();
      const diffSecs = Math.max(0, Math.floor((endMs - estimatedServerNow) / 1000));
      setTimeLeft(diffSecs);

      // Lock writing canvas state if timer has expired
      if (diffSecs <= 0 && saveStatus !== 'saving') {
        clearInterval(timerInterval);
      }
    };

    calculateTime();
    const timerInterval = setInterval(calculateTime, 1000);
    return () => clearInterval(timerInterval);
  }, [exam, serverTimeOffset, saveStatus]);

  // 3. Drawing Canvas Canvas Handlers (Pointer Events support Mouse/Stylus/Touch)
  const drawBgGrid = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fcfeff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Graph grid rows/columns
    ctx.strokeStyle = '#eef3f7';
    ctx.lineWidth = 0.8;
    const spacing = 25;

    for (let x = 0; x < canvas.width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  };

  const drawStrokesOnCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, strokes: Stroke[]) => {
    strokes.forEach((stroke) => {
      if (stroke.points.length === 0) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const firstPoint = stroke.points[0];
      ctx.moveTo(firstPoint.x, firstPoint.y);

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  };

  const initializeDraftBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Preserve drawing sizes on high-DPI displays
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Draw grid paper lines
    drawBgGrid(canvas, ctx);

    // Draw existing strokes for this question
    const activeQ = questions[activeQuestionIdx];
    if (activeQ) {
      const strokes = questionStrokes[activeQ.id] || [];
      drawStrokesOnCanvas(canvas, ctx, strokes);
    }
  };

  // Reinitialize when active question changes or window resizes
  useEffect(() => {
    if (!loading && questions.length > 0) {
      initializeDraftBoard();
    }
  }, [activeQuestionIdx, loading]);

  useEffect(() => {
    const handleResize = () => {
      initializeDraftBoard();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeQuestionIdx, questionStrokes, loading]);

  // Drawing event details
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const currentQId = questions[activeQuestionIdx]?.id;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Break editing if time is ended
    if (timeLeft <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setSaveStatus('idle');

    const point = getCoordinates(e);
    const color = toolMode === 'eraser' ? '#fcfeff' : pencilColor;
    const width = toolMode === 'eraser' ? 24 : pencilWidth;

    drawingStrokeRef.current = {
      points: [point],
      color,
      width,
    };

    // Draw single point node
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawingStrokeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const point = getCoordinates(e);
    drawingStrokeRef.current.points.push(point);

    ctx.strokeStyle = drawingStrokeRef.current.color;
    ctx.lineWidth = drawingStrokeRef.current.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const saveToLocalRecovery = (qId: string, strokesArr: Stroke[]) => {
    if (!submissionId) return;
    const key = getLocalStorageKey(submissionId);
    try {
      const cachedRaw = localStorage.getItem(key);
      const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
      cached[qId] = strokesArr;
      localStorage.setItem(key, JSON.stringify(cached));
    } catch (e) {
      console.error('Failed writing local recovery draft', e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (drawingStrokeRef.current && currentQId) {
      const stroke = drawingStrokeRef.current;
      drawingStrokeRef.current = null;

      setQuestionStrokes((prev) => {
        const questionStrokesCopy = { ...prev };
        const strokes = questionStrokesCopy[currentQId] ? [...questionStrokesCopy[currentQId]] : [];
        strokes.push(stroke);
        questionStrokesCopy[currentQId] = strokes;

        // Local storage cache backup
        saveToLocalRecovery(currentQId, strokes);
        return questionStrokesCopy;
      });

      // Clear redo stack on new stroke insertion
      setRedoStrokes((prev) => {
        const next = { ...prev };
        next[currentQId] = [];
        return next;
      });

      // Trigger automatic background save process (debounce will occur in separate useEffect or trigger directly)
      triggerBackgroundSave(currentQId);
    }
  };

  // 4. Background debounced Autosave engine
  const saveTimeoutRef = useRef<Record<string, any>>({});
  const inFlightSavesRef = useRef<Record<string, Promise<any> | null>>({});
  const pendingSavesRef = useRef<Record<string, boolean>>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Sync any unsaved drafts from localStorage on internet restoration
      if (submissionId) {
        const key = getLocalStorageKey(submissionId);
        const cachedRaw = localStorage.getItem(key);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw);
            Object.keys(cached).forEach((qId) => {
              triggerBackgroundSave(qId);
            });
          } catch (e) {
            console.error('Failed to restore from local backup on online event', e);
          }
        }
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [submissionId]);

  const performServerSave = async (qId: string) => {
    if (!id || !submissionId) return;

    // Reject overlapping parallel requests for the same question
    if (inFlightSavesRef.current[qId]) {
      pendingSavesRef.current[qId] = true;
      return;
    }

    setSaveStatus('saving');
    const strokes = questionStrokes[qId] || [];
    const payload = {
      questionId: qId,
      handwrittenData: {
        strokes,
      },
    };

    const promise = studentService.autosaveExamAnswer(id, payload);
    inFlightSavesRef.current[qId] = promise;

    try {
      await promise;
      setSaveStatus('saved');
    } catch (err) {
      console.error('Autosave backend update failed:', err);
      setSaveStatus('error');
    } finally {
      inFlightSavesRef.current[qId] = null;
      // If a save was queued/pending due to changes during the active transaction, execute it now
      if (pendingSavesRef.current[qId]) {
        pendingSavesRef.current[qId] = false;
        performServerSave(qId);
      }
    }
  };

  const triggerBackgroundSave = (qId: string) => {
    if (saveTimeoutRef.current[qId]) {
      clearTimeout(saveTimeoutRef.current[qId]);
    }
    setSaveStatus('idle');
    saveTimeoutRef.current[qId] = setTimeout(() => {
      performServerSave(qId);
    }, 2000); // 2 seconds debounce
  };

  // Force executing saves for a question (cancel debounce, immediate trigger)
  const forceImmediateSave = async (qId: string) => {
    if (saveTimeoutRef.current[qId]) {
      clearTimeout(saveTimeoutRef.current[qId]);
      delete saveTimeoutRef.current[qId];
    }
    await performServerSave(qId);
  };

  // 5. Digital stroke modifications (Undo, Redo, Clean Canvas)
  const handleUndo = () => {
    if (!currentQId || timeLeft <= 0) return;
    const strokes = questionStrokes[currentQId] || [];
    if (strokes.length === 0) return;

    setQuestionStrokes((prev) => {
      const cpy = { ...prev };
      const list = [...(cpy[currentQId] || [])];
      const undone = list.pop();

      if (undone) {
        setRedoStrokes((prevRedo) => {
          const redoCpy = { ...prevRedo };
          const redoList = redoCpy[currentQId] ? [...redoCpy[currentQId]] : [];
          redoList.push(undone);
          redoCpy[currentQId] = redoList;
          return redoCpy;
        });
      }

      cpy[currentQId] = list;
      saveToLocalRecovery(currentQId, list);
      return cpy;
    });

    triggerBackgroundSave(currentQId);
  };

  // Redraw whenever strokes modification state changes
  useEffect(() => {
    if (!loading && questions.length > 0) {
      initializeDraftBoard();
    }
  }, [questionStrokes]);

  const handleRedo = () => {
    if (!currentQId || timeLeft <= 0) return;
    const redoList = redoStrokes[currentQId] || [];
    if (redoList.length === 0) return;

    setQuestionStrokes((prev) => {
      const cpy = { ...prev };
      const strokesList = cpy[currentQId] ? [...cpy[currentQId]] : [];

      setRedoStrokes((prevRedo) => {
        const redoCpy = { ...prevRedo };
        const activeRedoList = [...(redoCpy[currentQId] || [])];
        const item = activeRedoList.pop();
        if (item) {
          strokesList.push(item);
        }
        redoCpy[currentQId] = activeRedoList;
        return redoCpy;
      });

      cpy[currentQId] = strokesList;
      saveToLocalRecovery(currentQId, strokesList);
      return cpy;
    });

    triggerBackgroundSave(currentQId);
  };

  const handleClearBoard = () => {
    if (!currentQId || timeLeft <= 0) return;
    if (window.confirm('Clear all drawings on this blackboard?')) {
      setQuestionStrokes((prev) => {
        const cpy = { ...prev };
        cpy[currentQId] = [];
        saveToLocalRecovery(currentQId, []);
        return cpy;
      });

      setRedoStrokes((prev) => {
        const cpy = { ...prev };
        cpy[currentQId] = [];
        return cpy;
      });

      triggerBackgroundSave(currentQId);
    }
  };

  // 6. Navigation Actions (Force save current before shifting index)
  const navigateToQuestion = async (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= questions.length || targetIdx === activeQuestionIdx) return;
    if (currentQId) {
      await forceImmediateSave(currentQId);
    }
    setActiveQuestionIdx(targetIdx);
  };

  const handleFinalSubmit = async () => {
    if (!id || !submissionId || submitting) return;
    setSubmitting(true);
    setSaveStatus('saving');
    try {
      // 1. Force save the current active question if dirty / loaded in memory
      if (currentQId) {
        await forceImmediateSave(currentQId);
      }

      // 2. Submit to backend
      await studentService.submitExam(id);

      // 3. Clear local storage recovery copies upon confirmed success
      const key = getLocalStorageKey(submissionId);
      localStorage.removeItem(key);

      // Redirect student
      navigate('/student/exams', { state: { submissionSuccess: true } });
    } catch (err: any) {
      console.error('Final exam submission failed:', err);
      alert(err.response?.data?.message || err.message || 'Submission failed. Please check network and retry.');
      setSaveStatus('error');
    } finally {
      setSubmitting(false);
      setSubmitModalOpen(false);
    }
  };

  // Clean timeouts on unmount
  useEffect(() => {
    return () => {
      Object.keys(saveTimeoutRef.current).forEach((key) => {
        clearTimeout(saveTimeoutRef.current[key]);
      });
    };
  }, []);

  // Time formatter helper
  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Answered questions progress calculation
  const getAnsweredCount = () => {
    let count = 0;
    questions.forEach((q) => {
      const strokes = questionStrokes[q.id] || [];
      if (strokes.length > 0) count++;
    });
    return count;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-xs text-outline font-semibold">Validating eligibility and preparing secure digital slate...</p>
      </div>
    );
  }

  // Workspace Access Error Panel
  if (errorHeader) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center max-w-lg mx-auto gap-4">
        <span className="material-symbols-outlined text-red-500 text-6xl">lock</span>
        <h2 className="text-xl font-black text-on-surface font-display">{errorHeader}</h2>
        <p className="text-xs text-on-surface-variant leading-relaxed">{errorDetail}</p>
        <div className="flex gap-4 mt-4">
          <Link
            to="/student/exams"
            className="px-6 py-2.5 bg-outline-variant/20 hover:bg-outline-variant/30 text-outline rounded-xl text-xs font-bold transition-all"
          >
            My Exams
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:shadow-md transition-all"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!exam || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <span className="material-symbols-outlined text-outline text-5xl">warning</span>
        <h3 className="text-sm font-bold text-on-surface">No questions found</h3>
        <p className="text-xs text-outline max-w-sm">No exam questions are currently loaded in this session.</p>
        <Link to="/student/exams" className="px-6 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold mt-2">
          Exit Workspace
        </Link>
      </div>
    );
  }

  const currentQ = questions[activeQuestionIdx];

  return (
    <div className="flex flex-col gap-6 text-left h-[calc(100vh-6.5rem)] relative animate-fade-in">
      {!isOnline && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 select-none shadow-sm animate-pulse">
          <span className="material-symbols-outlined text-base">wifi_off</span>
          <span>Working Offline. All strokes are cached locally in your browser. They will automatically sync to the server when network connection returns.</span>
        </div>
      )}
      
      {/* Exam workspace header bar */}
      <div className="glass-card p-4 rounded-2xl border border-outline-variant/20 flex flex-wrap items-center justify-between gap-4 bg-surface-container-lowest">
        <div>
          <h2 className="text-base font-black font-display text-on-surface leading-tight">{exam.title}</h2>
          <div className="flex items-center gap-3 text-[10px] text-outline font-semibold mt-1">
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded">{exam.subjectCode}</span>
            <span>{exam.subject}</span>
            <span>•</span>
            <span className={`flex items-center gap-1 font-bold ${isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`}></span>
              {isOnline ? 'Workspace Synced' : 'Offline Backup'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Save Status indicator */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            {saveStatus === 'saving' && (
              <>
                <span className="material-symbols-outlined text-sm text-outline animate-spin">sync</span>
                <span className="text-outline">Saving changes...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <span className="material-symbols-outlined text-sm text-emerald-600 font-black">cloud_done</span>
                <span className="text-emerald-700">Autosaved ✓</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <span className="material-symbols-outlined text-sm text-red-500 animate-bounce">sync_problem</span>
                <span className="text-red-600 font-bold">Network offline. recovery copy saved locally.</span>
              </>
            )}
            {saveStatus === 'idle' && (
              <>
                <span className="material-symbols-outlined text-sm text-outline">hourglass_empty</span>
                <span className="text-outline">Stroke cache ready</span>
              </>
            )}
          </div>

          {/* Clock Countdown with low limit color change */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-xs font-semibold border ${
            timeLeft < 600
              ? 'bg-red-500/10 border-red-500/30 text-red-600 animate-pulse'
              : 'bg-surface-container border-outline-variant/30 text-on-surface'
          }`}>
            <span className="material-symbols-outlined text-sm">schedule</span>
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        
        {/* Left Side Question Palette */}
        <div className="glass-card p-5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between gap-5 col-span-1 lg:max-h-full overflow-y-auto bg-surface-container-lowest">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant/10 pb-2">
              <h3 className="text-xs font-black text-outline uppercase tracking-wider">Question List</h3>
              <span className="text-[11px] font-bold text-primary">
                Done: {getAnsweredCount()} / {questions.length}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {questions.map((q, idx) => {
                const isActive = idx === activeQuestionIdx;
                const strokes = questionStrokes[q.id] || [];
                const isAnswered = strokes.length > 0;

                return (
                  <button
                    key={q.id}
                    onClick={() => navigateToQuestion(idx)}
                    className={`h-10 rounded-xl text-xs font-black transition-all active:scale-90 flex items-center justify-center cursor-pointer border ${
                      isActive
                        ? 'bg-primary text-on-primary border-primary shadow-sm'
                        : isAnswered
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15'
                          : 'bg-surface-container border-outline-variant/20 hover:bg-surface-container-high'
                    }`}
                  >
                    {q.questionNumber}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-outline-variant/25 pt-4 flex flex-col gap-3">
            <div className="flex justify-between text-[10px] text-outline font-bold">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-primary"></span>Active</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/30"></span>Answered</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-surface-container border border-outline-variant/20"></span>Empty</span>
            </div>
            
            <button
              onClick={() => setSubmitModalOpen(true)}
              type="button"
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">publish</span> Submit Exam
            </button>

            <button
              onClick={() => navigate('/student/exams')}
              className="w-full py-2.5 border border-outline-variant/40 hover:bg-surface-container-low text-on-surface rounded-xl text-xs font-bold text-center transition-all"
            >
              Exit Workspace
            </button>
            <p className="text-[9px] text-outline text-center mt-1 leading-normal italic">
              * Note: Draft responses are synchronized. Final submission occurs in the subsequent module.
            </p>
          </div>
        </div>

        {/* Right Side Digital Slate Blackboard */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0 bg-white dark:bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 shadow-sm overflow-hidden text-left">
          
          {/* Question context bar */}
          <div className="border-b border-outline-variant/15 pb-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-outline">
              <span>Question {currentQ.questionNumber} of {questions.length} {currentQ.required ? '(Required)' : ''}</span>
              <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] uppercase font-black tracking-wider">
                {currentQ.maximumMarks} Marks
              </span>
            </div>
            <h4 className="mt-2 text-sm font-bold text-on-surface leading-normal">
              {currentQ.questionText}
            </h4>
          </div>

          {/* Blackboard Tools Panel & Pointer Canvas */}
          <div className="flex-grow flex flex-col min-h-0">
            
            {/* Ink Toolbar options */}
            <div className="flex justify-between items-center gap-4 py-2 border-b border-outline-variant/10">
              <div className="flex items-center gap-3">
                {/* Tools Pen vs Eraser */}
                <button
                  onClick={() => setToolMode('pen')}
                  className={`px-3 py-1 text-[10px] font-black rounded-lg transition-colors flex items-center gap-1 ${
                    toolMode === 'pen'
                      ? 'bg-primary text-on-primary font-black'
                      : 'hover:bg-surface-container text-outline'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">edit</span> Pen
                </button>
                <button
                  onClick={() => setToolMode('eraser')}
                  className={`px-3 py-1 text-[10px] font-black rounded-lg transition-colors flex items-center gap-1 ${
                    toolMode === 'eraser'
                      ? 'bg-primary text-on-primary font-black'
                      : 'hover:bg-surface-container text-outline'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">auto_eraser</span> Eraser
                </button>
              </div>

              {/* Stroke configuration controls */}
              {toolMode === 'pen' ? (
                <div className="flex items-center gap-4">
                  {/* Colors selectors */}
                  <div className="flex items-center gap-1.5">
                    {['#0000FF', '#000000', '#FF0000'].map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          setPencilColor(color);
                          setToolMode('pen');
                        }}
                        className={`w-5.5 h-5.5 rounded-full border shadow-sm transition-transform active:scale-90 ${
                          pencilColor === color ? 'scale-110 ring-1 ring-primary' : 'opacity-80'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <span className="w-px h-4 bg-outline-variant/30" />

                  {/* Size selectors */}
                  <div className="flex items-center gap-1">
                    {[2, 3, 5, 8].map((size) => (
                      <button
                        key={size}
                        onClick={() => setPencilWidth(size)}
                        className={`w-5.5 h-5.5 rounded-lg border font-black text-[9px] flex items-center justify-center transition-colors ${
                          pencilWidth === size
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-outline-variant/30 text-outline hover:bg-surface-container'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Operation Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUndo}
                  disabled={timeLeft <= 0 || (questionStrokes[currentQ.id] || []).length === 0}
                  className="p-1 px-2 border border-outline-variant/30 hover:bg-surface-container rounded-lg disabled:opacity-40 text-outline text-[10px] font-bold flex items-center gap-0.5"
                  title="Undo"
                >
                  <span className="material-symbols-outlined text-xs">undo</span> Undo
                </button>
                <button
                  onClick={handleRedo}
                  disabled={timeLeft <= 0 || (redoStrokes[currentQ.id] || []).length === 0}
                  className="p-1 px-2 border border-outline-variant/30 hover:bg-surface-container rounded-lg disabled:opacity-40 text-outline text-[10px] font-bold flex items-center gap-0.5"
                  title="Redo"
                >
                  <span className="material-symbols-outlined text-xs">redo</span> Redo
                </button>
                <span className="w-px h-4 bg-outline-variant/30" />
                <button
                  onClick={handleClearBoard}
                  disabled={timeLeft <= 0}
                  className="px-2.5 py-1 bg-outline-variant/20 hover:bg-red-500/10 hover:text-red-600 text-[10px] rounded-lg font-black transition-colors text-outline flex items-center gap-0.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">clear</span> Clear Canvas
                </button>
              </div>
            </div>

            {/* Blackboard Pointer Canvas Drawing Target */}
            <div className="flex-grow bg-slate-50 border border-outline-variant/10 rounded-2xl overflow-hidden mt-4 relative cursor-crosshair select-none relative box-border min-h-[220px]">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="absolute inset-0 w-full h-full block bg-transparent"
                style={{ touchAction: 'none' }}
              />
              {timeLeft <= 0 && (
                <div className="absolute inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-6 text-center select-none z-10 animate-fade-in">
                  <div className="glass-card max-w-sm rounded-2xl p-6 bg-surface-container-lowest border border-outline-variant/30 text-center flex flex-col gap-2">
                    <span className="material-symbols-outlined text-error text-3xl">timer_off</span>
                    <h4 className="font-bold text-on-surface text-sm">The exam time has ended</h4>
                    <p className="text-[10px] text-outline">Editing and autosaves have been deactivated in compliance with the deadline scheduler.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Previous/Next Navigator buttons */}
          <div className="flex items-center justify-between border-t border-outline-variant/20 pt-4 mt-2">
            <button
              onClick={() => navigateToQuestion(activeQuestionIdx - 1)}
              disabled={activeQuestionIdx === 0}
              className="px-4 py-2 border border-outline-variant/30 hover:bg-surface-container rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">arrow_back_ios</span> Previous Question
            </button>
            <button
              onClick={() => navigateToQuestion(activeQuestionIdx + 1)}
              disabled={activeQuestionIdx === questions.length - 1}
              className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
            >
              Next Question <span className="material-symbols-outlined text-xs">arrow_forward_ios</span>
            </button>
          </div>

        </div>

      </div>

      {/* Submit Confirmation Modal */}
      {submitModalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-6 text-center select-none z-50 animate-fade-in">
          <div className="glass-card max-w-sm w-full rounded-2xl p-6 bg-surface-container-lowest border border-outline-variant/30 text-left flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2 text-primary font-black">
              <span className="material-symbols-outlined text-2xl text-red-650">error</span>
              <h3 className="font-display font-black text-sm text-on-surface">Submit Examination</h3>
            </div>
            
            <p className="text-xs text-outline leading-relaxed">
              Are you sure you want to finalize and submit your exam answer sheet? Once submitted, you will not be able to make any further edits.
            </p>

            <div className="p-3 bg-surface-container/30 border border-outline-variant/15 rounded-xl text-[11px] font-bold text-outline">
              <div className="flex justify-between border-b border-outline-variant/10 pb-1.5 mb-1.5">
                <span>Total Questions:</span>
                <span>{questions.length}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Answered:</span>
                <span>{getAnsweredCount()}</span>
              </div>
              <div className="flex justify-between text-amber-700 mt-1">
                <span>Unanswered:</span>
                <span>{questions.length - getAnsweredCount()}</span>
              </div>
            </div>

            {(questions.length - getAnsweredCount()) > 0 && (
              <div className="flex gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] text-amber-800 font-medium">
                <span className="material-symbols-outlined text-sm shrink-0">warning</span>
                <span>You have unanswered questions. Are you sure you want to finish now?</span>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => setSubmitModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 border border-outline-variant/40 text-on-surface rounded-xl hover:bg-surface-container-low text-xs font-bold transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold hover:shadow-md transition-all flex items-center gap-1 disabled:opacity-40"
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined text-xs animate-spin">sync</span> Submitting...
                  </>
                ) : (
                  'Yes, Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ExamWorkspace;
