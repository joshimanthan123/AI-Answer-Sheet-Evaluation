import React, { useState, useEffect, useRef } from 'react';
import answerSheetService from '../services/answerSheet.service';
import historicalEvaluationService from '../services/historicalEvaluation.service';

interface AnswerSheetViewerProps {
  sheetId: string;
  isFaculty?: boolean;
}



export const AnswerSheetViewer: React.FC<AnswerSheetViewerProps> = ({
  sheetId,
  isFaculty = false,
}) => {
  const [sheet, setSheet] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Navigation & Zoom states
  const [activeTab, setActiveTab] = useState<'original' | 'digital' | 'side-by-side'>('side-by-side');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [fitToScreen, setFitToScreen] = useState<boolean>(false);
  
  // Faculty Review State
  const [reviewState, setReviewState] = useState<{
    [qId: string]: {
      finalMarks: string;
      comment: string;
      submitting: boolean;
      error: string | null;
      success: string | null;
    };
  }>({});
  const [reEvalModalQId, setReEvalModalQId] = useState<string | null>(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false);
  const [finalizing, setFinalizing] = useState<boolean>(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // Phase 3F — Historical Evaluation Reference States
  const [showHistModal, setShowHistModal] = useState<boolean>(false);
  const [histStep, setHistStep] = useState<'select' | 'preview'>('select');
  const [selectedQIds, setSelectedQIds] = useState<string[]>([]);
  const [submittingHist, setSubmittingHist] = useState<boolean>(false);
  const [histError, setHistError] = useState<string | null>(null);
  const [histSuccess, setHistSuccess] = useState<string | null>(null);

  // Phase 3G — Reference-Aware Evaluation States
  const [refModalQId, setRefModalQId] = useState<string | null>(null);
  const [refEvidenceData, setRefEvidenceData] = useState<any | null>(null);
  const [loadingRefEvidence, setLoadingRefEvidence] = useState<boolean>(false);
  const [runningRefEval, setRunningRefEval] = useState<boolean>(false);
  const [refError, setRefError] = useState<string | null>(null);

  // Cache of page Object URLs to prevent multi-fetches of the same image
  const [pageUrls, setPageUrls] = useState<{ [page: number]: string }>({});
  const pageUrlsRef = useRef(pageUrls);

  // Sync ref
  useEffect(() => {
    pageUrlsRef.current = pageUrls;
  }, [pageUrls]);

  // Fetch sheet details with polling for background OCR completion
  useEffect(() => {
    let timerId: any = null;

    const fetchSheetData = async (isInitial = false) => {
      if (isInitial) setLoading(true);
      setError(null);
      try {
        const fetchMethod = isFaculty 
          ? answerSheetService.getFacultySheetDetail 
          : answerSheetService.getStudentSheetDetail;
          
        const response: any = await fetchMethod(sheetId);
        if (response.success && response.data) {
          const sheetData = response.data;
          console.log('[AnswerSheetViewer] Received sheet data:', sheetData);
          console.log('[AnswerSheetViewer] Normalized digital_answers:', sheetData.digital_answers);
          setSheet(sheetData);
          if (isInitial) setCurrentPage(1);
          if (!sheetData.pages || sheetData.pages.length === 0) {
            setActiveTab('digital');
          }

          // Check if processing is still in progress
          const status = String(sheetData.processing_status || sheetData.processingStatus || sheetData.ocrStatus || sheetData.uploadStatus || '').toUpperCase();
          const subStatus = String(sheetData.submissionStatus || '').toUpperCase();
          const inProgressStatuses = ['QUEUED', 'PROCESSING', 'PREPROCESSING', 'OCR_PROCESSING', 'SEGMENTING', 'HWR PROCESSING', 'UPLOADED', 'IN_PROGRESS'];
          
          const isBackgroundOcrActive = inProgressStatuses.includes(status) || (subStatus === 'SUBMITTED' && status !== 'COMPLETED' && status !== 'FAILED');

          if (isBackgroundOcrActive) {
            timerId = setTimeout(() => fetchSheetData(false), 2500);
          }
        } else {
          throw new Error('Answer sheet data unavailable.');
        }
      } catch (err: any) {
        console.error('API connection failed:', err);
        setError(err.detail || err.message || 'Answer sheet data unavailable.');
      } finally {
        if (isInitial) setLoading(false);
      }
    };

    fetchSheetData(true);

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [sheetId, isFaculty]);

  // Fetch image page blob whenever currentPage changes and is not cached
  useEffect(() => {
    if (!sheet || !sheet.pages || sheet.pages.length === 0) return;
    
    // Check if URL is already cached
    if (pageUrls[currentPage]) return;

    const fetchPageImage = async () => {
      try {
        const objectUrl = await answerSheetService.getPageImageObjectURL(sheetId, currentPage, isFaculty, 'original');
        setPageUrls((prev) => ({ ...prev, [currentPage]: objectUrl }));
      } catch (err) {
        console.warn(`Failed to fetch page ${currentPage} blob.`);
        setPageUrls((prev) => ({ ...prev, [currentPage]: 'error' }));
      }
    };

    fetchPageImage();
  }, [currentPage, sheet, sheetId, isFaculty, pageUrls]);

  // Cleanup ObjectURLs on unmount
  useEffect(() => {
    return () => {
      Object.values(pageUrlsRef.current).forEach((url) => {
        if (url && url !== 'error') {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-outline animate-pulse">Running Digital Pipeline Ingestion...</p>
      </div>
    );
  }

  if (error || !sheet) {
    return (
      <div className="card p-8 text-center bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl">
        <span className="material-symbols-outlined text-error text-5xl mb-4">error</span>
        <h3 className="text-xl font-bold text-on-surface mb-2">Failed to display answer sheet</h3>
        <p className="text-sm text-outline max-w-md mx-auto mb-6">{error || 'Answer sheet metadata could not be fetched.'}</p>
      </div>
    );
  }

  const totalPages = sheet.page_count || 1;
  const currentImage = pageUrls[currentPage];

  // Sync click helper: changes page and shifts tab if needed
  const handleSyncQuestion = (pageNumber: number, targetTab?: 'original' | 'side-by-side') => {
    setCurrentPage(pageNumber);
    if (targetTab) {
      setActiveTab(targetTab);
    }
  };

  const zoomIn = () => setZoom((prev) => Math.min(prev + 20, 200));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 20, 50));
  const resetZoom = () => {
    setZoom(100);
    setFitToScreen(false);
  };

// Interactive Canvas renderer for digital handwritten strokes
const StrokeCanvas: React.FC<{ strokes: any[]; questionNumber?: string; height?: number }> = ({
  strokes,
  questionNumber = '1',
  height = 240,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!strokes || strokes.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Calculate stroke bounds to auto-fit inside canvas
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    strokes.forEach((stroke) => {
      if (stroke.points && Array.isArray(stroke.points)) {
        stroke.points.forEach((pt: any) => {
          if (pt.x < minX) minX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y > maxY) maxY = pt.y;
        });
      }
    });

    const padding = 20;
    const contentWidth = (maxX > minX && isFinite(maxX)) ? maxX - minX + padding * 2 : 600;
    const contentHeight = (maxY > minY && isFinite(maxY)) ? maxY - minY + padding * 2 : height;

    canvas.width = Math.max(700, contentWidth);
    canvas.height = Math.max(height, contentHeight);

    // Background paper styling
    ctx.fillStyle = '#fcfeff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Graph grid background
    ctx.strokeStyle = '#eef3f7';
    ctx.lineWidth = 0.8;
    for (let x = 0; x < canvas.width; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Render strokes
    strokes.forEach((stroke) => {
      if (!stroke.points || stroke.points.length === 0) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color || '#0000FF';
      ctx.lineWidth = stroke.width || 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  }, [strokes, height]);

  if (!strokes || strokes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-dashed border-outline-variant/30 rounded-xl text-outline text-xs italic">
        <span className="material-symbols-outlined text-outline/50 text-2xl mb-1">draw</span>
        <span>No handwritten canvas drawing recorded for Question {questionNumber}</span>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto bg-slate-50 border border-outline-variant/20 rounded-xl p-2 select-none">
      <div className="flex justify-between items-center px-2 pb-1 text-[10px] text-outline font-bold">
        <span>Handwritten Digital Canvas Stroke Data ({strokes.length} strokes)</span>
        <span className="text-primary font-mono">Q{questionNumber} Vector Canvas</span>
      </div>
      <canvas ref={canvasRef} className="block rounded-lg shadow-xs bg-white border border-outline-variant/10 max-w-full" />
    </div>
  );
};

  // Render original viewer pane
  const renderOriginalPane = (isSplit = false) => {
    if (!sheet.pages || sheet.pages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-surface-container border border-outline-variant/20 rounded-2xl text-center shadow-xs min-h-[350px]">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4">
            <span className="material-symbols-outlined text-3xl">edit_note</span>
          </div>
          <h4 className="text-base font-bold text-on-surface">Digital Exam Slate Submission</h4>
          <p className="text-xs text-outline max-w-md mt-1.5 leading-relaxed">
            This candidate response was created directly on the interactive digital slate. No physical paper scans exist. Inspect the handwritten stroke canvas drawings and OCR text under the <strong>Digital</strong> view.
          </p>
          <button
            onClick={() => setActiveTab('digital')}
            className="mt-5 px-5 py-2.5 bg-primary hover:bg-primary/95 text-on-primary font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">subtitles</span>
            View Digital Answers & Strokes
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-surface-container-flat dark:bg-surface-container-flat border border-outline-variant/20 rounded-2xl overflow-hidden shadow-sm">
        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white dark:bg-surface-container border-b border-outline-variant/15">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1}
              className="p-2 text-on-surface hover:bg-surface-container-high rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            <span className="text-xs font-bold px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="p-2 text-on-surface hover:bg-surface-container-high rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={zoomOut}
              disabled={fitToScreen}
              className="p-2 text-on-surface hover:bg-surface-container-high rounded-lg disabled:opacity-30"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined text-lg">zoom_out</span>
            </button>
            <span className="text-xs font-bold min-w-[36px] text-center">
              {fitToScreen ? 'Fit' : `${zoom}%`}
            </span>
            <button
              onClick={zoomIn}
              disabled={fitToScreen}
              className="p-2 text-on-surface hover:bg-surface-container-high rounded-lg disabled:opacity-30"
              title="Zoom In"
            >
              <span className="material-symbols-outlined text-lg">zoom_in</span>
            </button>
            <div className="w-px h-6 bg-outline-variant/30 mx-1" />
            <button
              onClick={() => setFitToScreen(!fitToScreen)}
              className={`p-2 rounded-lg flex items-center justify-center ${
                fitToScreen ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-container-high'
              }`}
              title="Fit to Screen"
            >
              <span className="material-symbols-outlined text-lg">fit_screen</span>
            </button>
            <button
              onClick={resetZoom}
              className="p-2 text-on-surface hover:bg-surface-container-high rounded-lg"
              title="Reset Zoom"
            >
              <span className="material-symbols-outlined text-lg">restart_alt</span>
            </button>
          </div>
        </div>

        {/* Scanned Image / Document container */}
        <div className="flex-1 overflow-auto p-4 flex justify-center items-start min-h-[350px] max-h-[72vh] bg-surface-container-low/40">
          {currentImage === 'error' ? (
            <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl max-w-sm mx-auto my-auto shadow-sm">
              <span className="material-symbols-outlined text-error text-4xl mb-2">broken_image</span>
              <p className="text-sm font-bold text-on-surface text-center">Unable to load scanned page.</p>
              <button
                onClick={() => {
                  setPageUrls((prev) => {
                    const copy = { ...prev };
                    delete copy[currentPage];
                    return copy;
                  });
                }}
                className="mt-3 px-4 py-2 bg-primary hover:bg-primary/95 text-on-primary font-semibold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs">refresh</span>
                <span>Retry</span>
              </button>
            </div>
          ) : currentImage ? (
            (() => {
              const isPdf = sheet.original_format === 'PDF' ||
                            sheet.fileType === 'application/pdf' ||
                            (sheet.original_filename && sheet.original_filename.toLowerCase().endsWith('.pdf')) ||
                            (sheet.uploadedFileName && sheet.uploadedFileName.toLowerCase().endsWith('.pdf')) ||
                            (typeof currentImage === 'string' && currentImage.includes('.pdf'));

              if (isPdf && currentImage.startsWith('blob:')) {
                return (
                  <iframe
                    src={`${currentImage}#toolbar=0&navpanes=0`}
                    title={`PDF Page ${currentPage}`}
                    className="w-full h-[64vh] rounded-lg border border-outline-variant/15 shadow-sm"
                  />
                );
              }

              return (
                <img
                  src={currentImage}
                  alt={`Answer Sheet Page ${currentPage}`}
                  className={`transition-all rounded-lg shadow-sm border border-outline-variant/15 select-none ${
                    fitToScreen ? 'max-w-full max-h-[66vh] object-contain' : ''
                  }`}
                  style={
                    fitToScreen
                      ? undefined
                      : {
                          width: `${zoom}%`,
                          maxWidth: 'none',
                          transformOrigin: 'top center',
                         }
                  }
                  onError={() => {
                    // If <img> tag fails on URL, fallback to error state
                    setPageUrls((prev) => ({ ...prev, [currentPage]: 'error' }));
                  }}
                />
              );
            })()
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16 text-outline">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs">Loading page scan...</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render digital answers pane
  const renderDigitalPane = (isSplit = false) => {
    const answers = sheet.digital_answers || [];
    const status = String(sheet.processing_status || sheet.processingStatus || sheet.uploadStatus || '').toUpperCase();
    const isProcessing = ['QUEUED', 'PROCESSING', 'PREPROCESSING', 'OCR_PROCESSING', 'SEGMENTING', 'HWR PROCESSING', 'UPLOADED'].includes(status);
    
    if (answers.length === 0) {
      return (
        <div className="text-center py-16 bg-white dark:bg-surface-container border border-outline-variant/20 rounded-2xl flex flex-col items-center justify-center space-y-3">
          {isProcessing ? (
            <>
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <h4 className="text-base font-bold text-on-surface">Digitizing OCR & Handwriting...</h4>
              <p className="text-xs text-outline max-w-sm">Transcribing handwritten text and segmenting answer blocks from uploaded sheet scan.</p>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-6xl text-outline mb-2">description</span>
              <h4 className="text-lg font-bold">Digital answer not available yet.</h4>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-2 text-left">
        {answers.map((ans: any, idx: number) => {
          const isCurrentPageMatch = ans.page_number === currentPage;
          const strokesList = ans.strokes || [];
          
          return (
            <div
              key={idx}
              className={`card p-5 bg-white dark:bg-surface-container border rounded-2xl transition-all shadow-xs space-y-3 ${
                isSplit && isCurrentPageMatch
                  ? 'border-primary ring-2 ring-primary/25 shadow-md scale-[1.01]'
                  : 'border-outline-variant/30 hover:border-primary/40'
              }`}
            >
              {/* Question Header */}
              <div className="flex flex-wrap justify-between items-center gap-2">
                <button
                  onClick={() => handleSyncQuestion(ans.page_number, isSplit ? undefined : 'side-by-side')}
                  className="group flex items-center gap-2 text-base font-black text-primary font-display hover:underline"
                  title="Click to locate on scanned sheet"
                >
                  <span>Question {ans.question_number}</span>
                  {ans.max_marks && (
                    <span className="text-[10px] text-outline font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded">
                      ({ans.max_marks} Marks)
                    </span>
                  )}
                  <span className="material-symbols-outlined text-sm text-outline opacity-0 group-hover:opacity-100 transition-opacity">
                    gps_fixed
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-outline bg-surface-container-high px-2 py-0.5 rounded-full font-bold">
                    Page {ans.page_number}
                  </span>
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      ans.confidence >= 0.85
                        ? 'bg-success/15 text-success'
                        : ans.confidence >= 0.70
                        ? 'bg-warning/15 text-warning font-bold'
                        : 'bg-error/15 text-error font-bold'
                    }`}
                  >
                    {Math.round(ans.confidence * 100)}% Confidence
                  </span>
                </div>
              </div>

              {/* Question Text if present */}
              {ans.question_text && (
                <p className="text-xs font-bold text-on-surface leading-normal border-l-2 border-primary pl-2.5 py-0.5">
                  {ans.question_text}
                </p>
              )}

              {/* Handwritten Canvas Drawing Renderer */}
              {strokesList && strokesList.length > 0 && (
                <StrokeCanvas strokes={strokesList} questionNumber={ans.question_number} />
              )}

              {/* Transcribed Text */}
              <div className="bg-surface-container-flat dark:bg-surface-container-flat p-4 rounded-xl border border-outline-variant/10">
                <span className="text-[10px] font-bold text-outline block uppercase mb-1">OCR Digitized Text</span>
                <p className="text-on-surface font-body-md whitespace-pre-wrap leading-relaxed select-text font-serif italic text-sm">
                  {(() => {
                    const rawTxt = (ans.text || ans.answer_text || ans.recognizedText || ans.extracted_text || ans.extractedText || '').trim();
                    if (rawTxt.length > 0) {
                      return `"${rawTxt}"`;
                    }
                    if (isProcessing) {
                      return <span className="text-primary not-italic font-sans animate-pulse flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>Loading OCR text...</span>;
                    }
                    return <span className="text-outline not-italic font-sans">No OCR text available for this answer.</span>;
                  })()}
                </p>
              </div>

              {/* AI Evaluation Card & Faculty Review Panel */}
              {(() => {
                const aiEval = ans.evaluation?.aiEvaluation || ans.aiEvaluation || ans.evaluation || {};
                const facEval = ans.evaluation?.facultyEvaluation || ans.facultyEvaluation || {};
                const qId = ans.question_id || ans.questionId || ans._id || String(ans.question_number);

                return (
                  <div className="mt-4 border-t border-outline-variant/20 pt-4 space-y-4 text-left">
                    {/* AI Evaluation Card */}
                    <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-xl border border-primary/20 space-y-3">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
                          <h5 className="text-xs font-black uppercase text-primary tracking-wider">AI Evaluation Breakdown</h5>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-on-surface bg-white dark:bg-surface-container px-2.5 py-1 rounded-lg border border-primary/20">
                            AI Score: <strong className="text-primary text-sm font-black">{aiEval.marksAwarded ?? aiEval.marks ?? ans.aiMarks ?? 0}</strong> / {ans.max_marks || 10}
                          </span>
                          <span className="text-xs font-bold text-outline bg-surface-container-high px-2 py-0.5 rounded-full">
                            Confidence: {Math.round(((aiEval.confidence ?? ans.confidence) || 0.9) * 100)}%
                          </span>
                        </div>
                      </div>

                      {/* Criteria Breakdown */}
                      {Array.isArray(aiEval.criteria) && aiEval.criteria.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-outline uppercase block">Rubric Criteria Breakdown</span>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-outline-variant/30 text-outline font-bold">
                                  <th className="py-1 pr-2">Criterion</th>
                                  <th className="py-1 px-2">Score</th>
                                  <th className="py-1 px-2">Status</th>
                                  <th className="py-1 pl-2">Reason</th>
                                </tr>
                              </thead>
                              <tbody>
                                {aiEval.criteria.map((c: any, cIdx: number) => (
                                  <tr key={cIdx} className="border-b border-outline-variant/10">
                                    <td className="py-1.5 pr-2 font-semibold text-on-surface">{c.criterion}</td>
                                    <td className="py-1.5 px-2 font-bold">{c.marksAwarded ?? c.marks ?? 0} / {c.maxMarks}</td>
                                    <td className="py-1.5 px-2">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                        c.status === 'matched' ? 'bg-success/15 text-success' : c.status === 'partial' ? 'bg-warning/15 text-warning' : 'bg-error/15 text-error'
                                      }`}>
                                        {c.status}
                                      </span>
                                    </td>
                                    <td className="py-1.5 pl-2 text-outline text-[11px]">{c.reason || c.description || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Matched Concepts & Missing Concepts */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {Array.isArray(aiEval.matchedConcepts) && aiEval.matchedConcepts.length > 0 && (
                          <div className="bg-success/10 p-2.5 rounded-lg border border-success/20">
                            <span className="text-[10px] font-extrabold uppercase text-success block mb-1">Matched Concepts</span>
                            <ul className="space-y-0.5 text-on-surface">
                              {aiEval.matchedConcepts.map((mc: string, mIdx: number) => (
                                <li key={mIdx} className="flex items-center gap-1 text-[11px]">
                                  <span className="material-symbols-outlined text-success text-xs">check_circle</span>
                                  <span>{mc}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {Array.isArray(aiEval.missingConcepts) && aiEval.missingConcepts.length > 0 && (
                          <div className="bg-warning/10 p-2.5 rounded-lg border border-warning/20">
                            <span className="text-[10px] font-extrabold uppercase text-warning block mb-1">Missing Concepts</span>
                            <ul className="space-y-0.5 text-on-surface">
                              {aiEval.missingConcepts.map((mc: string, mIdx: number) => (
                                <li key={mIdx} className="flex items-center gap-1 text-[11px]">
                                  <span className="material-symbols-outlined text-warning text-xs">info</span>
                                  <span>{mc}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* AI Feedback */}
                      {aiEval.feedback && (
                        <div className="bg-white dark:bg-surface-container p-3 rounded-lg border border-outline-variant/20 text-xs">
                          <span className="text-[10px] font-bold text-outline uppercase block mb-1">AI Evaluation Feedback</span>
                          <p className="text-on-surface leading-relaxed italic">{aiEval.feedback}</p>
                        </div>
                      )}
                    </div>

                    {/* Faculty Review Panel */}
                    <div className="bg-white dark:bg-surface-container p-4 rounded-xl border border-outline-variant/30 space-y-3">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-xl">rate_review</span>
                          <h5 className="text-xs font-black uppercase text-on-surface tracking-wider">Faculty Evaluation Review</h5>
                        </div>

                        {/* Review Status Badge */}
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                          facEval.status === 'approved'
                            ? 'bg-success/20 text-success'
                            : facEval.status === 'modified'
                            ? 'bg-secondary/20 text-secondary font-extrabold'
                            : facEval.status === 're_evaluation_requested'
                            ? 'bg-warning/20 text-warning font-bold'
                            : 'bg-outline-variant/30 text-outline'
                        }`}>
                          {facEval.status === 'approved'
                            ? '✓ AI Marks Approved'
                            : facEval.status === 'modified'
                            ? '✎ Faculty Marks Overridden'
                            : facEval.status === 're_evaluation_requested'
                            ? '↻ Re-evaluation Requested'
                            : 'Pending Faculty Review'}
                        </span>
                      </div>

                      {/* Dynamic Status messages */}
                      {reviewState[qId]?.error && (
                        <div className="bg-error/15 border border-error/30 text-error p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">error</span>
                          <span>{reviewState[qId].error}</span>
                        </div>
                      )}
                      {reviewState[qId]?.success && (
                        <div className="bg-success/15 border border-success/30 text-success p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>{reviewState[qId].success}</span>
                        </div>
                      )}

                      {/* Marks Input & Comment Controls */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                        <div>
                          <label className="text-[10px] font-extrabold text-outline uppercase block mb-1">
                            AI Suggested Marks
                          </label>
                          <div className="h-10 px-3 flex items-center bg-surface-container-high rounded-lg text-sm font-black text-outline">
                            {aiEval.marksAwarded ?? ans.aiMarks ?? 0} / {ans.max_marks || 10}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-extrabold text-on-surface uppercase block mb-1">
                            Final Faculty Marks <span className="text-error">*</span>
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={ans.max_marks || 10}
                            value={reviewState[qId]?.finalMarks ?? facEval.finalMarks ?? aiEval.marksAwarded ?? 0}
                            onChange={(e) =>
                              setReviewState((prev) => ({
                                ...prev,
                                [qId]: { ...(prev[qId] || {}), finalMarks: e.target.value, error: null },
                              }))
                            }
                            className="w-full h-10 px-3 bg-white dark:bg-surface-container border border-outline-variant rounded-lg text-sm font-bold text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-extrabold text-on-surface uppercase block mb-1">
                            Faculty Comment {facEval.status === 'modified' && <span className="text-error">(Required)</span>}
                          </label>
                          <input
                            type="text"
                            placeholder="Reason for override or review comment..."
                            value={reviewState[qId]?.comment ?? facEval.comment ?? ''}
                            onChange={(e) =>
                              setReviewState((prev) => ({
                                ...prev,
                                [qId]: { ...(prev[qId] || {}), comment: e.target.value, error: null },
                              }))
                            }
                            className="w-full h-10 px-3 bg-white dark:bg-surface-container border border-outline-variant rounded-lg text-xs font-semibold text-on-surface focus:border-primary"
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
                        <button
                          type="button"
                          disabled={reviewState[qId]?.submitting}
                          onClick={async () => {
                            const currentState = reviewState[qId] || {
                              finalMarks: String(facEval.finalMarks ?? aiEval.marksAwarded ?? 0),
                              comment: facEval.comment || '',
                              submitting: false,
                              error: null,
                              success: null,
                            };
                            setReviewState((prev) => ({
                              ...prev,
                              [qId]: { ...currentState, submitting: true, error: null, success: null },
                            }));
                            try {
                              const res: any = await answerSheetService.reviewAnswer(sheetId, {
                                action: 'approve',
                                questionId: qId,
                                finalMarks: aiEval.marksAwarded ?? ans.aiMarks ?? 0,
                                comment: currentState.comment,
                              });
                              if (res.data || res.success) {
                                setReviewState((prev) => ({
                                  ...prev,
                                  [qId]: { ...currentState, submitting: false, error: null, success: 'AI Marks approved!' },
                                }));
                                const refreshed: any = await (isFaculty ? answerSheetService.getFacultySheetDetail(sheetId) : answerSheetService.getStudentSheetDetail(sheetId));
                                if (refreshed.data) setSheet(refreshed.data);
                              }
                            } catch (err: any) {
                              const msg = err.response?.data?.message || err.message || 'Approval failed';
                              setReviewState((prev) => ({
                                ...prev,
                                [qId]: { ...currentState, submitting: false, error: msg, success: null },
                              }));
                            }
                          }}
                          className="px-4 py-2 bg-success text-on-primary hover:bg-success/90 font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">task_alt</span>
                          <span>Approve AI Marks</span>
                        </button>

                        <button
                          type="button"
                          disabled={reviewState[qId]?.submitting}
                          onClick={async () => {
                            const currentState = reviewState[qId] || {
                              finalMarks: String(facEval.finalMarks ?? aiEval.marksAwarded ?? 0),
                              comment: facEval.comment || '',
                              submitting: false,
                              error: null,
                              success: null,
                            };
                            setReviewState((prev) => ({
                              ...prev,
                              [qId]: { ...currentState, submitting: true, error: null, success: null },
                            }));
                            try {
                              const res: any = await answerSheetService.reviewAnswer(sheetId, {
                                action: 'modify',
                                questionId: qId,
                                finalMarks: Number(currentState.finalMarks),
                                comment: currentState.comment,
                              });
                              if (res.data || res.success) {
                                setReviewState((prev) => ({
                                  ...prev,
                                  [qId]: { ...currentState, submitting: false, error: null, success: 'Faculty override marks saved!' },
                                }));
                                const refreshed: any = await (isFaculty ? answerSheetService.getFacultySheetDetail(sheetId) : answerSheetService.getStudentSheetDetail(sheetId));
                                if (refreshed.data) setSheet(refreshed.data);
                              }
                            } catch (err: any) {
                              const msg = err.response?.data?.message || err.message || 'Override failed';
                              setReviewState((prev) => ({
                                ...prev,
                                [qId]: { ...currentState, submitting: false, error: msg, success: null },
                              }));
                            }
                          }}
                          className="px-4 py-2 bg-primary text-on-primary hover:bg-primary/95 font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                          <span>Save Override Marks</span>
                        </button>

                        <button
                          type="button"
                          disabled={reviewState[qId]?.submitting}
                          onClick={() => setReEvalModalQId(qId)}
                          className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-extrabold text-xs rounded-xl border border-outline-variant/30 cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">sync</span>
                          <span>Re-evaluate with AI</span>
                        </button>

                        {/* Phase 3G — Historical Reference Evidence Action */}
                        <button
                          type="button"
                          onClick={async () => {
                            setRefModalQId(qId);
                            setLoadingRefEvidence(true);
                            setRefError(null);
                            try {
                              const res: any = await historicalEvaluationService.getQuestionReferenceEvidence(sheetId, qId);
                              setRefEvidenceData(res.data || res);
                            } catch (err: any) {
                              setRefError(err.response?.data?.message || err.message || 'Failed to fetch reference evidence');
                            } finally {
                              setLoadingRefEvidence(false);
                            }
                          }}
                          className="px-4 py-2 bg-secondary/15 hover:bg-secondary/25 text-secondary font-extrabold text-xs rounded-xl border border-secondary/30 cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">history_edu</span>
                          <span>View Reference Evidence</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Meta Info Header */}
      <div className="card p-6 bg-white dark:bg-surface-container border border-outline-variant/20 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
        <div>
          <span className="text-[10px] text-primary uppercase font-bold tracking-widest">Candidate Answer Sheet</span>
          <h2 className="text-2xl font-black text-on-surface font-display mt-1 flex flex-wrap items-center gap-3">
            <span>{sheet.student?.name || sheet.student_name || sheet.studentIdentifier || 'Candidate'}</span>
            {sheet.student?.rollNo && (
              <span className="text-xs font-bold px-2.5 py-1 bg-primary/10 text-primary rounded-lg font-mono">
                Roll: {sheet.student.rollNo}
              </span>
            )}
          </h2>
          <p className="text-xs text-outline mt-1.5 font-body-sm">
            {sheet.student?.email && <span className="mr-3">Email: <span className="font-semibold text-on-surface">{sheet.student.email}</span></span>}
            File: <span className="font-semibold text-on-surface">{sheet.original_filename || sheet.uploadedFileName || 'Answer Sheet'}</span> • 
            Exam: <span className="font-semibold text-on-surface">{sheet.exam?.title || sheet.exam_id}</span> • 
            Submitted: <span className="font-semibold">{sheet.uploaded_at || sheet.createdAt ? new Date(sheet.uploaded_at || sheet.createdAt).toLocaleString() : 'N/A'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-outline font-bold uppercase">Pipeline State</p>
            <p className="text-sm font-semibold text-success font-display">Ingestion Active</p>
          </div>
          <span className="text-xs font-black bg-success/15 text-success px-4 py-1.5 rounded-full uppercase tracking-wider">
            {sheet.processing_status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Phase 3E: Evaluation Summary Panel & Finalization Banner (Faculty View) */}
      {(() => {
        const answers = sheet.digital_answers || [];
        const totalQCount = answers.length || sheet.totalQuestions || 0;

        let totalObtained = 0;
        let maxTotal = 0;
        let aiTotal = 0;
        let reviewedCount = 0;
        let pendingCount = 0;
        let unansweredCount = 0;
        let modifiedCount = 0;

        answers.forEach((ans: any) => {
          const qMax = ans.max_marks || 10;
          maxTotal += qMax;

          const aiEval = ans.evaluation?.aiEvaluation || ans.aiEvaluation || {};
          const facEval = ans.evaluation?.facultyEvaluation || ans.facultyEvaluation || {};

          aiTotal += (aiEval.marksAwarded ?? ans.aiMarks ?? 0);

          if (facEval.status === 'modified' || ans.wasOverridden) {
            modifiedCount++;
          }

          if (ans.status === 'unanswered' || ans.isUnanswered) {
            unansweredCount++;
            reviewedCount++;
          } else if ((facEval.status === 'approved' || facEval.status === 'modified') && typeof facEval.finalMarks === 'number') {
            reviewedCount++;
            totalObtained += facEval.finalMarks;
          } else {
            pendingCount++;
          }
        });

        const calcPercentage = maxTotal > 0 ? Math.round((totalObtained / maxTotal) * 10000) / 100 : 0;
        const aiPercentage = maxTotal > 0 ? Math.round((aiTotal / maxTotal) * 10000) / 100 : 0;
        const progressPercent = totalQCount > 0 ? Math.round((reviewedCount / totalQCount) * 100) : 0;
        const isFinalized = sheet.evaluationStatus === 'finalized' || sheet.finalEvaluation?.status === 'finalized' || sheet.submissionStatus === 'Published';
        const diffMarks = Math.round((totalObtained - aiTotal) * 100) / 100;

        return (
          <div className="card p-6 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-3xl shadow-sm space-y-4 text-left">
            {/* Header & Finalization Badge */}
            <div className="flex flex-wrap justify-between items-center gap-3 border-b border-outline-variant/15 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-primary tracking-widest block">Phase 3E — Answer Sheet Evaluation Summary</span>
                <h3 className="text-xl font-black text-on-surface font-display">Faculty Marks Aggregation & Finalization</h3>
              </div>
              <div>
                {isFinalized ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black bg-success/15 text-success px-4 py-2 rounded-full uppercase tracking-wider border border-success/30">
                    <span className="material-symbols-outlined text-base">verified</span>
                    <span>Evaluation Finalized</span>
                  </span>
                ) : (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider border ${
                    pendingCount === 0 ? 'bg-primary/15 text-primary border-primary/30' : 'bg-warning/15 text-warning border-warning/30'
                  }`}>
                    <span className="material-symbols-outlined text-base">{pendingCount === 0 ? 'rule' : 'pending_actions'}</span>
                    <span>{pendingCount === 0 ? 'Ready for Finalization' : 'Review In Progress'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Summary Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-primary/5 p-3 rounded-2xl border border-primary/15">
                <span className="text-[10px] font-extrabold uppercase text-outline block mb-0.5">Faculty Final Total</span>
                <p className="text-xl font-black text-primary font-mono">{totalObtained} <span className="text-xs text-outline font-normal">/ {maxTotal}</span></p>
              </div>

              <div className="bg-primary/5 p-3 rounded-2xl border border-primary/15">
                <span className="text-[10px] font-extrabold uppercase text-outline block mb-0.5">Final Percentage</span>
                <p className="text-xl font-black text-primary font-mono">{calcPercentage}%</p>
              </div>

              <div className="bg-surface-container-flat p-3 rounded-2xl border border-outline-variant/15">
                <span className="text-[10px] font-extrabold uppercase text-outline block mb-0.5">Questions Reviewed</span>
                <p className="text-xl font-black text-on-surface font-mono">{reviewedCount} <span className="text-xs text-outline font-normal">/ {totalQCount}</span></p>
              </div>

              <div className="bg-surface-container-flat p-3 rounded-2xl border border-outline-variant/15">
                <span className="text-[10px] font-extrabold uppercase text-outline block mb-0.5">Pending Review</span>
                <p className={`text-xl font-black font-mono ${pendingCount > 0 ? 'text-warning' : 'text-success'}`}>{pendingCount}</p>
              </div>

              <div className="bg-surface-container-flat p-3 rounded-2xl border border-outline-variant/15">
                <span className="text-[10px] font-extrabold uppercase text-outline block mb-0.5">Unanswered Qs</span>
                <p className="text-xl font-black text-on-surface font-mono">{unansweredCount}</p>
              </div>

              <div className="bg-surface-container-flat p-3 rounded-2xl border border-outline-variant/15">
                <span className="text-[10px] font-extrabold uppercase text-outline block mb-0.5">Faculty Modified</span>
                <p className="text-xl font-black text-on-surface font-mono">{modifiedCount}</p>
              </div>
            </div>

            {/* AI vs Faculty Comparison & Progress Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Progress Bar */}
              <div className="space-y-1.5 bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/15">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-on-surface">Review Completion Progress</span>
                  <span className="text-primary font-mono">{reviewedCount} / {totalQCount} Questions ({progressPercent}%)</span>
                </div>
                <div className="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* AI vs Faculty Comparison Box */}
              <div className="flex justify-between items-center bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/15 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-outline uppercase block">AI Suggested Score</span>
                  <span className="font-mono font-bold text-on-surface text-sm">{aiTotal} / {maxTotal} ({aiPercentage}%)</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-outline uppercase block">Faculty Difference</span>
                  <span className={`font-mono font-black text-sm px-2.5 py-0.5 rounded-full ${
                    diffMarks > 0 ? 'bg-success/15 text-success' : diffMarks < 0 ? 'bg-warning/15 text-warning' : 'bg-surface-container-high text-outline'
                  }`}>
                    {diffMarks > 0 ? `+${diffMarks} marks` : diffMarks < 0 ? `${diffMarks} marks` : '0 (Matches AI)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Finalization Action Bar */}
            {isFaculty && (
              <div className="flex flex-wrap justify-between items-center gap-3 pt-3 border-t border-outline-variant/15">
                {isFinalized ? (
                  <div className="flex flex-wrap justify-between items-center w-full gap-3">
                    <div className="text-xs text-outline font-semibold">
                      Finalized by <span className="font-bold text-on-surface">{sheet.finalizedBy?.name || 'Authorized Faculty'}</span> on{' '}
                      <span className="font-bold text-on-surface">{sheet.finalizedAt ? new Date(sheet.finalizedAt).toLocaleString() : 'N/A'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedQIds(answers.map((ans: any) => ans.question_id || ans.questionId || ans._id || String(ans.question_number)));
                        setHistStep('select');
                        setHistError(null);
                        setHistSuccess(null);
                        setShowHistModal(true);
                      }}
                      className="px-5 py-2 bg-secondary text-on-secondary hover:bg-secondary/90 font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">bookmarks</span>
                      <span>Add as Historical Reference</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-outline font-semibold">
                    {pendingCount > 0 ? (
                      <span className="text-warning font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        {pendingCount} question(s) still require faculty review before finalization.
                      </span>
                    ) : (
                      <span className="text-success font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        All questions reviewed. Answer sheet is ready to be finalized.
                      </span>
                    )}
                  </div>
                )}

                {!isFinalized && (
                  <button
                    type="button"
                    disabled={pendingCount > 0}
                    onClick={() => setShowFinalizeModal(true)}
                    className="px-6 py-2.5 bg-primary text-on-primary hover:bg-primary/95 font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">verified</span>
                    <span>Finalize Answer Sheet Evaluation</span>
                  </button>
                )}
              </div>
            )}

            {/* Phase 3F — Historical Evaluation Reference Modal */}
            {showHistModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-surface-container card p-6 max-w-2xl w-full rounded-2xl shadow-xl space-y-4 text-left border border-outline-variant/30 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-outline-variant/15 pb-3">
                    <div className="flex items-center gap-2 text-secondary">
                      <span className="material-symbols-outlined text-2xl">bookmarks</span>
                      <h4 className="text-base font-black text-on-surface">
                        {histStep === 'select' ? 'Select Reference Answers' : 'Historical Reference Preview'}
                      </h4>
                    </div>
                    <button
                      onClick={() => setShowHistModal(false)}
                      className="text-outline hover:text-on-surface p-1 rounded-lg"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>

                  {histError && (
                    <div className="p-3 bg-error/10 border border-error/20 text-error text-xs rounded-xl font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">error</span>
                      <span>{histError}</span>
                    </div>
                  )}

                  {histSuccess && (
                    <div className="p-3 bg-success/10 border border-success/20 text-success text-xs rounded-xl font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      <span>{histSuccess}</span>
                    </div>
                  )}

                  {histStep === 'select' && (
                    <div className="space-y-4">
                      <p className="text-xs text-outline leading-relaxed">
                        Select individual finalized question evaluations from this answer sheet to store as reference evidence repository entries.
                      </p>

                      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                        {answers.map((ans: any, idx: number) => {
                          const qId = ans.question_id || ans.questionId || ans._id || String(ans.question_number);
                          const isChecked = selectedQIds.includes(qId);
                          const facMarks = ans.evaluation?.facultyEvaluation?.finalMarks ?? ans.facultyEvaluation?.finalMarks ?? ans.finalAwardedMarks ?? ans.evaluation?.aiEvaluation?.marksAwarded ?? 0;

                          return (
                            <label
                              key={idx}
                              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                                isChecked
                                  ? 'bg-secondary/10 border-secondary/40 shadow-xs'
                                  : 'bg-surface-container-low border-outline-variant/20 hover:border-outline-variant/40'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedQIds([...selectedQIds, qId]);
                                  } else {
                                    setSelectedQIds(selectedQIds.filter((id) => id !== qId));
                                  }
                                }}
                                className="mt-1 rounded border-outline-variant text-secondary focus:ring-secondary"
                              />
                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-extrabold text-on-surface">
                                    Q{ans.question_number} — {ans.question_text || `Question ${ans.question_number}`}
                                  </span>
                                  <span className="font-black font-mono text-secondary px-2 py-0.5 bg-secondary/15 rounded-md">
                                    Faculty Final: {facMarks} / {ans.max_marks || 10}
                                  </span>
                                </div>
                                <p className="text-[11px] text-outline line-clamp-2 italic font-serif">
                                  "{ans.text || ans.answer_text || ans.recognizedText || 'No text'}"
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/20">
                        <button
                          type="button"
                          onClick={() => setShowHistModal(false)}
                          className="px-4 py-2 text-xs font-bold text-outline hover:bg-surface-container-high rounded-xl"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={selectedQIds.length === 0}
                          onClick={() => setHistStep('preview')}
                          className="px-5 py-2 bg-secondary text-on-secondary font-extrabold text-xs rounded-xl shadow-sm hover:bg-secondary/90 flex items-center gap-1.5 disabled:opacity-40"
                        >
                          <span>Continue ({selectedQIds.length} Selected)</span>
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {histStep === 'preview' && (
                    <div className="space-y-4">
                      <p className="text-xs text-outline leading-relaxed">
                        Verify the reference snapshot data below before creating records in historical repository.
                      </p>

                      <div className="space-y-4 max-h-[52vh] overflow-y-auto pr-1">
                        {answers
                          .filter((ans: any) => {
                            const qId = ans.question_id || ans.questionId || ans._id || String(ans.question_number);
                            return selectedQIds.includes(qId);
                          })
                          .map((ans: any, idx: number) => {
                            const facMarks = ans.evaluation?.facultyEvaluation?.finalMarks ?? ans.facultyEvaluation?.finalMarks ?? ans.finalAwardedMarks ?? ans.evaluation?.aiEvaluation?.marksAwarded ?? 0;
                            const aiEval = ans.evaluation?.aiEvaluation || ans.aiEvaluation || {};

                            return (
                              <div key={idx} className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-2.5 text-xs">
                                <div className="flex justify-between items-center font-extrabold border-b border-outline-variant/20 pb-2">
                                  <span className="text-secondary font-display text-sm">Question Q{ans.question_number}</span>
                                  <span className="bg-secondary/15 text-secondary px-2.5 py-1 rounded-lg font-mono font-black">
                                    Faculty Final Marks: {facMarks} / {ans.max_marks || 10}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[10px] font-bold text-outline uppercase block">Question</span>
                                  <p className="text-on-surface font-semibold">{ans.question_text || `Question ${ans.question_number}`}</p>
                                </div>

                                <div>
                                  <span className="text-[10px] font-bold text-outline uppercase block">Student Answer / OCR Text</span>
                                  <p className="text-on-surface italic font-serif bg-white dark:bg-surface-container p-2.5 rounded-lg border border-outline-variant/20">
                                    "{ans.text || ans.answer_text || ans.recognizedText || 'No text'}"
                                  </p>
                                </div>

                                {aiEval.criteria && Array.isArray(aiEval.criteria) && aiEval.criteria.length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-bold text-outline uppercase block mb-1">Rubric Criteria Snapshot</span>
                                    <div className="space-y-1">
                                      {aiEval.criteria.map((c: any, cIdx: number) => (
                                        <div key={cIdx} className="flex justify-between text-[11px] bg-white dark:bg-surface-container p-1.5 px-2.5 rounded border border-outline-variant/15">
                                          <span>{c.criterion}</span>
                                          <span className="font-bold">{c.marksAwarded ?? c.marks ?? 0} / {c.maxMarks}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-2 text-[10px] text-outline font-semibold pt-1">
                                  <div>Subject: <span className="text-on-surface font-bold">{sheet.subject?.name || 'Subject'}</span></div>
                                  <div>Exam: <span className="text-on-surface font-bold">{sheet.exam?.title || 'CIE'}</span></div>
                                  <div>Academic Year: <span className="text-on-surface font-bold">{sheet.exam?.academicYear || '2025-26'}</span></div>
                                  <div>Status: <span className="text-warning font-bold">pending_review</span></div>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-outline-variant/20">
                        <button
                          type="button"
                          disabled={submittingHist}
                          onClick={() => setHistStep('select')}
                          className="px-4 py-2 text-xs font-bold text-outline hover:bg-surface-container-high rounded-xl flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">arrow_back</span>
                          <span>Back to Selection</span>
                        </button>

                        <button
                          type="button"
                          disabled={submittingHist}
                          onClick={async () => {
                            setSubmittingHist(true);
                            setHistError(null);
                            setHistSuccess(null);
                            try {
                              const res = await historicalEvaluationService.createReference(sheetId, selectedQIds);
                              if (res.success || res.data) {
                                setHistSuccess('Historical evaluation references created successfully (Status: pending_review).');
                                setTimeout(() => {
                                  setShowHistModal(false);
                                }, 1500);
                              } else {
                                throw new Error(res.message || 'Failed to create historical reference');
                              }
                            } catch (err: any) {
                              const msg = err.response?.data?.message || err.message || 'Failed to create reference';
                              setHistError(msg);
                            } finally {
                              setSubmittingHist(false);
                            }
                          }}
                          className="px-6 py-2 bg-secondary text-on-secondary font-extrabold text-xs rounded-xl shadow-md hover:bg-secondary/90 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {submittingHist ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-sm">check</span>
                              <span>Confirm & Add References</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Phase 3G — Reference-Aware Evaluation Evidence Modal */}
            {refModalQId && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-surface-container card p-6 max-w-3xl w-full rounded-2xl shadow-xl space-y-4 text-left border border-outline-variant/30 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-outline-variant/15 pb-3">
                    <div className="flex items-center gap-2 text-secondary">
                      <span className="material-symbols-outlined text-2xl">history_edu</span>
                      <div>
                        <h4 className="text-base font-black text-on-surface">
                          Phase 3G — Historical Reference Evidence & Borderline Analysis
                        </h4>
                        <p className="text-[11px] text-outline">
                          Approved historical evaluations used for contextual evidence calibration
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setRefModalQId(null)}
                      className="text-outline hover:text-on-surface p-1 rounded-lg"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>

                  {refError && (
                    <div className="p-3 bg-error/10 border border-error/20 text-error text-xs rounded-xl font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">error</span>
                      <span>{refError}</span>
                    </div>
                  )}

                  {loadingRefEvidence ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-3">
                      <span className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-bold text-outline">Retrieving approved historical evidence...</p>
                    </div>
                  ) : refEvidenceData ? (
                    <div className="space-y-5">
                      {/* Borderline Status Banner */}
                      <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                        refEvidenceData.borderlineEvaluation?.isBorderline
                          ? 'bg-warning/10 border-warning/30 text-warning'
                          : 'bg-success/10 border-success/30 text-success'
                      }`}>
                        <span className="material-symbols-outlined text-xl">
                          {refEvidenceData.borderlineEvaluation?.isBorderline ? 'warning' : 'check_circle'}
                        </span>
                        <div className="space-y-1">
                          <h5 className="text-xs font-black uppercase tracking-wider">
                            {refEvidenceData.borderlineEvaluation?.isBorderline
                              ? '⚠ Borderline Answer Sheet Evaluation Detected'
                              : 'Standard Confidence Evaluation'}
                          </h5>
                          {refEvidenceData.borderlineEvaluation?.reasons?.length > 0 && (
                            <p className="text-[11px] leading-relaxed">
                              Signals: <span className="font-bold">{refEvidenceData.borderlineEvaluation.reasons.join(', ')}</span> (Confidence: {refEvidenceData.borderlineEvaluation.confidence})
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 3-Way Comparison Grid */}
                      <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary block">
                          3-Way Marks Comparison Grid
                        </span>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-white dark:bg-surface-container p-3 rounded-xl border border-outline-variant/30">
                            <span className="text-[10px] font-extrabold text-outline uppercase block mb-1">
                              Normal AI Marks
                            </span>
                            <p className="text-lg font-black text-on-surface font-mono">
                              {refEvidenceData.aiEvaluation?.marksAwarded ?? 0} / {refEvidenceData.aiEvaluation?.maxMarks || 10}
                            </p>
                          </div>

                          <div className="bg-secondary/10 p-3 rounded-xl border border-secondary/30">
                            <span className="text-[10px] font-black text-secondary uppercase block mb-1">
                              Reference-Aware AI Marks
                            </span>
                            <p className="text-lg font-black text-secondary font-mono">
                              {refEvidenceData.referenceAwareEvaluation?.marksAwarded !== undefined
                                ? `${refEvidenceData.referenceAwareEvaluation.marksAwarded} / ${refEvidenceData.referenceAwareEvaluation.maxMarks}`
                                : 'Not Evaluated'}
                            </p>
                          </div>

                          <div className="bg-primary/10 p-3 rounded-xl border border-primary/30">
                            <span className="text-[10px] font-black text-primary uppercase block mb-1">
                              Faculty Final Marks
                            </span>
                            <p className="text-lg font-black text-primary font-mono">
                              {refEvidenceData.facultyEvaluation?.finalMarks !== undefined && refEvidenceData.facultyEvaluation?.finalMarks !== null
                                ? `${refEvidenceData.facultyEvaluation.finalMarks}`
                                : 'Pending'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Historical Reference Cards */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-black uppercase text-on-surface tracking-wider">
                          Retrieved Approved Historical Evidence ({refEvidenceData.references?.length || 0})
                        </h5>

                        {(!refEvidenceData.references || refEvidenceData.references.length === 0) ? (
                          <div className="p-4 bg-surface-container-low border border-outline-variant/20 rounded-xl text-xs text-outline italic text-center">
                            No approved historical references found for this subject/question. Normal evaluation applies.
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
                            {refEvidenceData.references.map((ref: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-3.5 bg-white dark:bg-surface-container rounded-xl border border-outline-variant/20 space-y-2 text-xs"
                              >
                                <div className="flex justify-between items-center font-bold">
                                  <span className="text-secondary font-mono">
                                    Reference #{idx + 1} — Academic Year {ref.academicYear}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-secondary/15 text-secondary rounded-md font-mono text-[10px]">
                                      Similarity: {(ref.similarity * 100).toFixed(0)}%
                                    </span>
                                    <span className="px-2 py-0.5 bg-success/15 text-success rounded-md font-mono text-[10px]">
                                      Faculty Awarded: {ref.marksAwarded} / {ref.maxMarks}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-[11px] text-outline italic font-serif bg-surface-container-low p-2 rounded-lg">
                                  "{ref.studentAnswer || ref.ocrText || 'No student answer recorded'}"
                                </p>
                                <p className="text-[10px] text-outline font-sans">
                                  {ref.relevanceSummary}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/20">
                        <button
                          type="button"
                          onClick={() => setRefModalQId(null)}
                          className="px-4 py-2 text-xs font-bold text-outline hover:bg-surface-container-high rounded-xl"
                        >
                          Close
                        </button>

                        <button
                          type="button"
                          disabled={runningRefEval}
                          onClick={async () => {
                            setRunningRefEval(true);
                            setRefError(null);
                            try {
                              const res: any = await historicalEvaluationService.triggerReferenceAwareEvaluation(sheetId, refModalQId);
                              if (res.data || res.success) {
                                // Refresh modal data and sheet data
                                const evRes: any = await historicalEvaluationService.getQuestionReferenceEvidence(sheetId, refModalQId);
                                setRefEvidenceData(evRes.data || evRes);
                                const refreshed: any = await (isFaculty ? answerSheetService.getFacultySheetDetail(sheetId) : answerSheetService.getStudentSheetDetail(sheetId));
                                if (refreshed.data) setSheet(refreshed.data);
                              }
                            } catch (err: any) {
                              setRefError(err.response?.data?.message || err.message || 'Reference-aware evaluation failed');
                            } finally {
                              setRunningRefEval(false);
                            }
                          }}
                          className="px-5 py-2 bg-secondary text-on-secondary font-extrabold text-xs rounded-xl shadow-md hover:bg-secondary/90 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {runningRefEval ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Evaluating...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-sm">auto_awesome</span>
                              <span>Run Reference-Aware AI Evaluation</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Finalization Confirmation Modal */}
            {showFinalizeModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-surface-container card p-6 max-w-md w-full rounded-2xl shadow-xl space-y-4 text-left border border-outline-variant/30">
                  <div className="flex justify-between items-center border-b border-outline-variant/15 pb-2">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="material-symbols-outlined text-2xl">verified</span>
                      <h4 className="text-base font-black text-on-surface">Confirm Answer Sheet Finalization</h4>
                    </div>
                    <button
                      onClick={() => setShowFinalizeModal(false)}
                      className="text-outline hover:text-on-surface p-1 rounded-lg"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>

                  <p className="text-xs text-outline leading-relaxed">
                    You are about to finalize this answer sheet evaluation. The final total score will be locked in database records.
                  </p>

                  <div className="bg-primary/5 p-3.5 rounded-xl border border-primary/20 space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold">
                      <span>Total Marks:</span>
                      <span className="font-mono text-primary text-sm font-black">{totalObtained} / {maxTotal}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Final Percentage:</span>
                      <span className="font-mono text-primary text-sm font-black">{calcPercentage}%</span>
                    </div>
                    <div className="flex justify-between text-outline">
                      <span>Evaluated Questions:</span>
                      <span>{reviewedCount} / {totalQCount}</span>
                    </div>
                  </div>

                  {finalizeError && (
                    <div className="p-2.5 bg-error/10 text-error text-xs rounded-lg font-semibold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">error</span>
                      <span>{finalizeError}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                    <button
                      type="button"
                      disabled={finalizing}
                      onClick={() => setShowFinalizeModal(false)}
                      className="px-4 py-2 text-xs font-bold text-outline hover:bg-surface-container-high rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={finalizing}
                      onClick={async () => {
                        setFinalizing(true);
                        setFinalizeError(null);
                        try {
                          const res: any = await answerSheetService.finalizeAnswerSheet(sheetId);
                          if (res.success || res.data) {
                            setShowFinalizeModal(false);
                            const refreshed: any = await (isFaculty 
                              ? answerSheetService.getFacultySheetDetail(sheetId) 
                              : answerSheetService.getStudentSheetDetail(sheetId));
                            if (refreshed.data) setSheet(refreshed.data);
                          } else {
                            throw new Error(res.message || 'Finalization failed.');
                          }
                        } catch (err: any) {
                          const msg = err.response?.data?.message || err.message || 'Finalization failed.';
                          setFinalizeError(msg);
                        } finally {
                          setFinalizing(false);
                        }
                      }}
                      className="px-5 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md hover:bg-primary/95 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {finalizing ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Finalizing...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">check</span>
                          <span>Confirm & Finalize</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tabs Toolbar */}
      <div className="flex justify-between items-center border-b border-outline-variant/20 pb-1">
        <div className="flex gap-2">
          {(sheet.pages && sheet.pages.length > 0
            ? (['side-by-side', 'original', 'digital'] as const)
            : (['digital'] as const)
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-11 px-5 text-sm font-bold capitalize transition-all border-b-2 rounded-t-xl -mb-1.5 flex items-center gap-2 cursor-pointer ${
                activeTab === tab
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-outline hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {tab === 'side-by-side' ? 'splitscreen' : tab === 'original' ? 'image' : 'subtitles'}
              </span>
              <span>{tab.replace('-', ' ')}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Panels */}
      <div className="tab-panels transition-all duration-300">
        {activeTab === 'original' && renderOriginalPane()}

        {activeTab === 'digital' && renderDigitalPane()}

        {activeTab === 'side-by-side' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left page image */}
            <div className="flex-1">
              <h4 className="text-sm font-bold text-outline uppercase tracking-wider mb-2 text-left">Scanned Source File</h4>
              {renderOriginalPane(true)}
            </div>
            
            {/* Right transcribed answer sheets */}
            <div className="flex-1">
              <h4 className="text-sm font-bold text-outline uppercase tracking-wider mb-2 text-left">Digitized Structure</h4>
              {renderDigitalPane(true)}
            </div>
          </div>
        )}
      </div>

      {/* Re-evaluation Confirmation Modal */}
      {reEvalModalQId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-surface-container card p-6 max-w-md w-full rounded-2xl shadow-xl space-y-4 text-left border border-outline-variant/30">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-warning">
                <span className="material-symbols-outlined text-2xl">sync</span>
                <h4 className="text-base font-black text-on-surface">Confirm AI Re-evaluation</h4>
              </div>
              <button
                onClick={() => setReEvalModalQId(null)}
                className="text-outline hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-outline leading-relaxed">
              Re-evaluating will run the Phase 3C LLM semantic pipeline to re-grade this answer.
              <strong className="text-on-surface block mt-1">Previous AI evaluations and faculty review history will be preserved in the audit log and version history.</strong>
            </p>

            <div>
              <label className="text-[10px] font-bold text-outline uppercase block mb-1">
                Reason / Note for Re-evaluation (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Model answer updated or re-grading requested"
                value={reviewState[reEvalModalQId]?.comment || ''}
                onChange={(e) =>
                  setReviewState((prev) => ({
                    ...prev,
                    [reEvalModalQId]: {
                      finalMarks: prev[reEvalModalQId]?.finalMarks || '0',
                      comment: e.target.value,
                      submitting: false,
                      error: null,
                      success: null,
                    },
                  }))
                }
                className="w-full px-3 py-2 text-xs border border-outline-variant rounded-lg bg-surface-container-low"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setReEvalModalQId(null)}
                className="px-4 py-2 text-xs font-bold text-outline hover:bg-surface-container-high rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const qId = reEvalModalQId;
                  setReEvalModalQId(null);
                  if (!qId) return;

                  const currentState = reviewState[qId] || { finalMarks: '0', comment: '', submitting: false, error: null, success: null };
                  setReviewState((prev) => ({
                    ...prev,
                    [qId]: { ...currentState, submitting: true, error: null, success: null },
                  }));

                  try {
                    const res: any = await answerSheetService.reviewAnswer(sheetId, {
                      action: 're_evaluate',
                      questionId: qId,
                      comment: currentState.comment,
                    });
                    if (res.data || res.success) {
                      setReviewState((prev) => ({
                        ...prev,
                        [qId]: { ...currentState, submitting: false, error: null, success: 'AI Re-evaluation queued successfully!' },
                      }));
                      const refreshed: any = await (isFaculty ? answerSheetService.getFacultySheetDetail(sheetId) : answerSheetService.getStudentSheetDetail(sheetId));
                      if (refreshed.data) setSheet(refreshed.data);
                    }
                  } catch (err: any) {
                    const msg = err.response?.data?.message || err.message || 'Re-evaluation request failed';
                    setReviewState((prev) => ({
                      ...prev,
                      [qId]: { ...currentState, submitting: false, error: msg, success: null },
                    }));
                  }
                }}
                className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-xs hover:bg-primary/95"
              >
                Confirm Re-evaluate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
