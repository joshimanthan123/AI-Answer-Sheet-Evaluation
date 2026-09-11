import React, { useState, useEffect, useRef } from 'react';
import answerSheetService from '../services/answerSheet.service';

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
                    return <span className="text-outline not-italic font-sans">No OCR text available.</span>;
                  })()}
                </p>
              </div>
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
    </div>
  );
};
