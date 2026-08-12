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

  // Fetch sheet details
  useEffect(() => {
    const fetchSheetData = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchMethod = isFaculty 
          ? answerSheetService.getFacultySheetDetail 
          : answerSheetService.getStudentSheetDetail;
          
        const response: any = await fetchMethod(sheetId);
        if (response.success && response.data) {
          setSheet(response.data);
          setCurrentPage(1);
        } else {
          throw new Error('Answer sheet data unavailable.');
        }
      } catch (err: any) {
        console.error('API connection failed:', err);
        setError(err.detail || err.message || 'Answer sheet data unavailable.');
      } finally {
        setLoading(false);
      }
    };
    fetchSheetData();
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

  // Render original viewer pane
  const renderOriginalPane = (isSplit = false) => {
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

        {/* Scanned Image container */}
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
            />
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
    
    if (answers.length === 0) {
      return (
        <div className="text-center py-16 bg-white dark:bg-surface-container border border-outline-variant/20 rounded-2xl">
          <span className="material-symbols-outlined text-6xl text-outline mb-4">description</span>
          <h4 className="text-lg font-bold">Digital answer not available yet.</h4>
        </div>
      );
    }

    return (
      <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-2 text-left">
        {answers.map((ans: any, idx: number) => {
          // Verify if this matches current page for split view highlighting
          const isCurrentPageMatch = ans.page_number === currentPage;
          
          return (
            <div
              key={idx}
              className={`card p-5 bg-white dark:bg-surface-container border rounded-2xl transition-all shadow-xs ${
                isSplit && isCurrentPageMatch
                  ? 'border-primary ring-2 ring-primary/25 shadow-md scale-[1.01]'
                  : 'border-outline-variant/30 hover:border-primary/40'
              }`}
            >
              {/* Question Header */}
              <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                <button
                  onClick={() => handleSyncQuestion(ans.page_number, isSplit ? undefined : 'side-by-side')}
                  className="group flex items-center gap-2 text-lg font-black text-primary font-display hover:underline"
                  title="Click to locate on scanned sheet"
                >
                  <span>Question {ans.question_number}</span>
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

              {/* Transcribed Text */}
              <div className="bg-surface-container-flat dark:bg-surface-container-flat p-4 rounded-xl border border-outline-variant/10">
                <p className="text-on-surface font-body-md whitespace-pre-wrap leading-relaxed select-text font-serif italic text-base">
                  "{ans.text}"
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
          <span className="text-[10px] text-primary uppercase font-bold tracking-widest">Document Ingest Complete</span>
          <h2 className="text-2xl font-black text-on-surface font-display mt-1">
            {sheet.original_filename}
          </h2>
          <p className="text-xs text-outline mt-1 font-body-sm">
            Exam ID: <span className="font-semibold text-on-surface">{sheet.exam_id}</span> • 
            Submitted: <span className="font-semibold">{new Date(sheet.uploaded_at).toLocaleString()}</span>
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
          {(['side-by-side', 'original', 'digital'] as const).map((tab) => (
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
