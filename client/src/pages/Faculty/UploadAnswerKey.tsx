import React, { useState, useEffect } from 'react';
import studentService from '../../services/student.service';
import examWorkspaceImage from '../../assets/exam-workspace-demo.png'; // Using absolute or relative assets if needed

interface ParsedAnswer {
  questionId?: string;
  questionNumber: number;
  questionText: string;
  answerText: string;
  maximumMarks: number;
  rubric: { criteria: string; marks: number }[];
  keywords: string[];
}

interface AnswerKeyData {
  id?: string;
  examId: string;
  version: number;
  isActive: boolean;
  fileName: string;
  fileSize?: number;
  uploadStatus: 'Uploading' | 'Extracting Text' | 'Parsing Questions' | 'Ready for Review' | 'Approved' | 'Failed';
  extractedText: string;
  parsedAnswers: ParsedAnswer[];
}

export const UploadAnswerKey: React.FC = () => {
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Status tracking
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [answerKey, setAnswerKey] = useState<AnswerKeyData | null>(null);

  // Loaded exams list on mount
  useEffect(() => {
    studentService.getExams().then((data) => {
      setExams(data);
      if (data.length > 0) {
        setSelectedExamId(data[0].id);
      }
    });
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Simulating the backend text-extraction & parsing state flow
  const triggerMockUploadPipeline = () => {
    if (!selectedFile || !selectedExamId) return;

    setIsUploading(true);
    setUploadProgress(10);
    setCurrentStatus('Uploading File...');

    // Phase 1: Uploading
    setTimeout(() => {
      setUploadProgress(35);
      setCurrentStatus('Extracting Document Text (OCR)...');
      
      // Phase 2: Extracting Text
      setTimeout(() => {
        setUploadProgress(70);
        setCurrentStatus('Parsing Layout & Questions Structure...');
        
        // Phase 3: Parsing Questions
        setTimeout(() => {
          setUploadProgress(100);
          setCurrentStatus('Analysis Completed!');
          setIsUploading(false);

          // Build Mock parsed data based on selected exam's questions
          const targetExam = exams.find(e => e.id === selectedExamId);
          const qList = targetExam?.questions || [];
          
          const parsedAnswersMock: ParsedAnswer[] = qList.map((q: any) => ({
            questionNumber: q.number,
            questionText: q.text,
            answerText: `Extracted correct model answer key matching concepts for logic of question "${q.text}".`,
            maximumMarks: q.maxMarks,
            rubric: [
              { criteria: 'Accurate terminology matched', marks: Math.round(q.maxMarks * 0.4) },
              { criteria: 'Step-by-step logic details', marks: Math.round(q.maxMarks * 0.6) }
            ],
            keywords: q.expectedConcept.split(', ')
          }));

          setAnswerKey({
            id: `key-v${Math.floor(Math.random() * 1000)}`,
            examId: selectedExamId,
            version: 1,
            isActive: false,
            fileName: selectedFile.name,
            uploadStatus: 'Ready for Review',
            extractedText: 'Raw text dumped from parsed answer key document...',
            parsedAnswers: parsedAnswersMock
          });

        }, 1500);
      }, 1500);
    }, 1200);
  };

  const handleApproveKey = () => {
    if (!answerKey) return;
    setAnswerKey(prev => prev ? { ...prev, uploadStatus: 'Approved', isActive: true } : null);
  };

  const handleUpdateAnswerText = (index: number, newText: string) => {
    if (!answerKey) return;
    const updated = [...answerKey.parsedAnswers];
    updated[index].answerText = newText;
    setAnswerKey({ ...answerKey, parsedAnswers: updated });
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h1 className="text-3xl font-black text-primary font-display">Upload Answer Key</h1>
        <p className="text-on-surface-variant/80 mt-1">
          Scanned keys are automatically parsed and versioned into system rubrics.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side Upload Block */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-6 bg-white dark:bg-surface-container border border-outline-variant/20 rounded-2xl shadow-sm space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">cloud_upload</span>
              Selector
            </h2>

            {/* Exam Select */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-outline uppercase tracking-wider block">Target Examination</label>
              <select
                className="w-full h-12 px-4 bg-background border border-outline-variant/60 rounded-xl font-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={selectedExamId}
                onChange={(e) => {
                  setSelectedExamId(e.target.value);
                  setAnswerKey(null);
                }}
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.subjectCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Drag & Drop File Zone */}
            <div
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[220px] ${
                dragActive 
                  ? 'border-primary bg-primary/5 py-8' 
                  : 'border-outline-variant/50 hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('key-file-upload')?.click()}
            >
              <input
                id="key-file-upload"
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                <span className="material-symbols-outlined text-3xl">upload</span>
              </div>
              <p className="text-sm font-semibold truncate max-w-full px-2">
                {selectedFile ? selectedFile.name : 'Drag & drop answer key file'}
              </p>
              <p className="text-xs text-outline mt-1">
                Supports PDF, DOCX, TXT, PNG, JPG (Max 15MB)
              </p>
            </div>

            {/* Upload Action Button */}
            {selectedFile && (
              <button
                onClick={triggerMockUploadPipeline}
                disabled={isUploading}
                className="w-full h-12 bg-primary hover:bg-primary/95 text-on-primary font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
              >
                <span className="material-symbols-outlined">analytics</span>
                <span>Analyze & Extract</span>
              </button>
            )}

            {/* Upload / Extraction Status Tracker */}
            {isUploading && (
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-primary truncate">{currentStatus}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-outline-variant/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side Review Block */}
        <div className="lg:col-span-2 space-y-6">
          {!answerKey ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-surface-container border border-outline-variant/20 rounded-2xl min-h-[440px] text-outline text-center">
              <span className="material-symbols-outlined text-5xl mb-4 text-outline/50">description</span>
              <p className="font-semibold text-sm">No Active Key Document Uploaded</p>
              <p className="text-xs max-w-xs mt-1">Select an exam and drop your guidelines file to start the OCR extraction pipeline.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-surface-container border border-outline-variant/20 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-outline-variant/30">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <span>Parsed Answer Key</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      answerKey.uploadStatus === 'Approved'
                        ? 'bg-success/15 text-success' 
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {answerKey.uploadStatus}
                    </span>
                  </h3>
                  <p className="text-xs text-outline mt-1">
                    File: <span className="font-semibold">{answerKey.fileName}</span> (Ver. {answerKey.version})
                  </p>
                </div>

                {answerKey.uploadStatus !== 'Approved' && (
                  <button
                    onClick={handleApproveKey}
                    className="h-10 px-6 bg-success hover:bg-success/95 text-on-primary font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>Approve as Model Key</span>
                  </button>
                )}
              </div>

              {/* Parsed questions preview list */}
              <div className="space-y-6">
                {answerKey.parsedAnswers.map((pa, idx) => (
                  <div key={idx} className="p-4 bg-background dark:bg-surface-container-low rounded-2xl border border-outline-variant/25">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <h4 className="font-bold text-sm text-primary">Question {pa.questionNumber}</h4>
                      <span className="text-xs font-bold bg-outline-variant/40 px-2 py-0.5 rounded">
                        Max Marks: {pa.maximumMarks}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-on-surface/90 mb-3">{pa.questionText}</p>

                    <div className="space-y-4">
                      {/* Answer edit box */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-outline uppercase tracking-wider"> Extracted Model Answer</label>
                        <textarea
                          rows={3}
                          className="w-full p-3 bg-white dark:bg-surface-container border border-outline-variant/65 rounded-xl font-body-md outline-none focus:border-primary text-sm resize-y"
                          value={pa.answerText}
                          onChange={(e) => handleUpdateAnswerText(idx, e.target.value)}
                          disabled={answerKey.uploadStatus === 'Approved'}
                        />
                      </div>

                      {/* Keywords list */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-bold text-outline uppercase tracking-wider mr-1">Concept Keywords:</span>
                        {pa.keywords.map((kw, kIdx) => (
                          <span key={kIdx} className="text-xs bg-primary-light/40 text-primary font-semibold px-2 py-0.5 rounded-full">
                            {kw}
                          </span>
                        ))}
                      </div>

                      {/* Rubric metrics */}
                      <div className="space-y-1.5 pt-1 border-t border-outline-variant/10">
                        <span className="text-[10px] font-bold text-outline uppercase tracking-wider block">Evaluation Rubric Matrix</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {pa.rubric.map((rub, rIdx) => (
                            <div key={rIdx} className="flex justify-between items-center text-xs p-2 bg-white dark:bg-surface-container rounded-lg border border-outline-variant/10">
                              <span className="text-outline truncate max-w-[80%]">{rub.criteria}</span>
                              <span className="font-bold text-primary">{rub.marks} Marks</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadAnswerKey;
