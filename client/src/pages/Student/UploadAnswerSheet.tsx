import React, { useState, useEffect } from 'react';
import studentService from '../../services/student.service';
import { mockAnswerSheets } from '../../mocks/db';


interface AttemptLog {
  id: string;
  attemptNo: number;
  fileName: string;
  fileSize: string;
  uploadStatus: 'Uploading' | 'Uploaded' | 'HWR Processing' | 'AI Evaluation' | 'Faculty Review' | 'Published' | 'Failed';
  submittedAt: string;
  obtainedMarks?: number;
  totalMarks?: number;
  grade?: string;
}

export const UploadAnswerSheet: React.FC = () => {
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Status tracking
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [attempts, setAttempts] = useState<AttemptLog[]>([]);

  // Load exams
  useEffect(() => {
    studentService.getExams().then((data) => {
      setExams(data);
      if (data.length > 0) {
        setSelectedExamId(data[0].id);
      }
    });

    // Seed mock upload attempt log
    setAttempts([
      {
        id: 'attempt-1',
        attemptNo: 1,
        fileName: 'Alex_Johnson_DSA_Attempt1_draft.pdf',
        fileSize: '3.4 MB',
        uploadStatus: 'Failed',
        submittedAt: '2026-07-31 10:15 AM'
      }
    ]);
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
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Stepper descriptions matching Mongoose uploadStatuses
  const processingSteps = [
    { label: 'Uploading', desc: 'Saving document payload to repository' },
    { label: 'HWR Processing', desc: 'Running OCR & Handwriting Recognition engines' },
    { label: 'AI Evaluation', desc: 'Calculating marks & compiling rubric alignments' },
    { label: 'Faculty Review', desc: 'Awaiting faculty model confirmation' }
  ];

  const handleSubmissionPipeline = () => {
    if (!selectedFile || !selectedExamId) return;

    setIsUploading(true);
    setActiveStep(0); // Uploading

    // Simulate flow:
    // 0: Uploading
    // 1: HWR Processing (OCR)
    // 2: AI Evaluation
    // 3: Faculty Review

    setTimeout(() => {
      setActiveStep(1); // HWR Processing
      
      setTimeout(() => {
        setActiveStep(2); // AI Evaluation
        
        setTimeout(() => {
          setActiveStep(3); // Faculty Review
          
          setTimeout(() => {
            setIsUploading(false);
            
            // Append and prepend new attempt
            const newAttemptNo = attempts.length + 1;
            const newLogItem: AttemptLog = {
              id: `attempt-${Date.now()}`,
              attemptNo: newAttemptNo,
              fileName: selectedFile.name,
              fileSize: `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`,
              uploadStatus: 'Faculty Review',
              submittedAt: new Date().toLocaleString()
            };

            // Add to mockAnswerSheets array so it is visible to Faculty
            const selectedExamObj = exams.find(ex => ex.id === selectedExamId);
            const newSheetItem: any = {
              id: `sheet-${Date.now()}`,
              studentId: 'stud-1',
              studentName: 'Alex Johnson',
              subjectId: selectedExamObj ? selectedExamObj.subjectCode : 'CS-101',
              subjectName: selectedExamObj ? selectedExamObj.subjectName : 'Data Structures and Algorithms',
              examId: selectedExamId,
              examName: selectedExamObj ? selectedExamObj.name : 'Scanned Sheet Exam',
              date: new Date().toISOString().split('T')[0],
              fileUrl: '#',
              fileName: selectedFile.name,
              status: 'pending' // Faculty reads from pending queue
            };
            mockAnswerSheets.push(newSheetItem);

            setAttempts(prev => [newLogItem, ...prev]);
            setSelectedFile(null);

          }, 1500);

        }, 1500);

      }, 1500);

    }, 1200);

  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h1 className="text-3xl font-black text-primary font-display">Upload Answer Sheet</h1>
        <p className="text-on-surface-variant/80 mt-1">
          Perform a scanned submission attempt. Files will resolve automatically through HWR transcription.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Drag & Drop Selection Pane */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-6 bg-white dark:bg-surface-container border border-outline-variant/20 rounded-2xl shadow-sm space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">cloud_upload</span>
              Submission Setup
            </h2>

            {/* Exam Select */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-outline uppercase tracking-wider block">Target Exam</label>
              <select
                className="w-full h-12 px-4 bg-background border border-outline-variant/60 rounded-xl font-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                disabled={isUploading}
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
              onClick={() => !isUploading && document.getElementById('sheet-file-upload')?.click()}
            >
              <input
                id="sheet-file-upload"
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                <span className="material-symbols-outlined text-3xl">upload_file</span>
              </div>
              <p className="text-sm font-semibold truncate max-w-full px-2">
                {selectedFile ? selectedFile.name : 'Choose or drag scanned answer sheet'}
              </p>
              <p className="text-xs text-outline mt-1">
                Supports PDF, PNG, JPG, JPEG (Max 25MB)
              </p>
            </div>

            {/* Submit Action */}
            {selectedFile && !isUploading && (
              <button
                onClick={handleSubmissionPipeline}
                className="w-full h-12 bg-primary hover:bg-primary/95 text-on-primary font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
              >
                <span className="material-symbols-outlined">send</span>
                <span>Submit Attempt</span>
              </button>
            )}

            {/* Preprocessor Stepper Tracking */}
            {isUploading && (
              <div className="space-y-4 pt-4 border-t border-outline-variant/10">
                <p className="text-xs font-bold text-outline uppercase tracking-wider">Processing Pipeline</p>
                <div className="space-y-4">
                  {processingSteps.map((step, idx) => {
                    const isDone = idx < activeStep;
                    const isCurrent = idx === activeStep;
                    return (
                      <div key={idx} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isDone 
                              ? 'bg-success text-on-primary' 
                              : isCurrent 
                                ? 'bg-primary text-on-primary shadow-sm active-step' 
                                : 'bg-outline-variant/30 text-outline'
                          }`}>
                            {isDone ? (
                              <span className="material-symbols-outlined text-xs">done</span>
                            ) : (
                              idx + 1
                            )}
                          </div>
                          {idx < processingSteps.length - 1 && (
                            <div className={`w-0.5 h-10 ${
                              isDone ? 'bg-success' : 'bg-outline-variant/20'
                            }`} />
                          )}
                        </div>
                        <div className="text-left">
                          <p className={`text-xs font-bold ${isCurrent ? 'text-primary' : 'text-on-surface'}`}>
                            {step.label}
                          </p>
                          <p className="text-[10px] text-outline">{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Session History Tables */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-surface-container border border-outline-variant/20 rounded-2xl p-6 shadow-sm space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span>
              Submission Attempt Log
            </h3>

            {attempts.length === 0 ? (
              <div className="text-center py-12 text-outline">
                <span className="material-symbols-outlined text-4xl mb-2">assignment_late</span>
                <p className="text-sm">No uploaded attempts recorded for this exam context.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/20 text-outline text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Attempt #</th>
                      <th className="py-3 px-4">Document Details</th>
                      <th className="py-3 px-4">Date Uploaded</th>
                      <th className="py-3 px-4">AI Pipeline Status</th>
                      <th className="py-3 px-4">Result Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {attempts.map((att) => (
                      <tr key={att.id} className="hover:bg-surface-container-low/45 transition-colors">
                        <td className="py-4 px-4 font-bold text-center">#{att.attemptNo}</td>
                        <td className="py-4 px-4">
                          <div className="font-semibold text-on-surface max-w-[200px] truncate" title={att.fileName}>
                            {att.fileName}
                          </div>
                          <span className="text-[10px] text-outline">{att.fileSize}</span>
                        </td>
                        <td className="py-4 px-4 text-xs text-outline">{att.submittedAt}</td>
                        <td className="py-4 px-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            att.uploadStatus === 'Published'
                              ? 'bg-success/15 text-success'
                              : att.uploadStatus === 'Failed'
                                ? 'bg-error/10 text-error'
                                : 'bg-primary/10 text-primary'
                          }`}>
                            {att.uploadStatus}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {att.obtainedMarks !== undefined && att.totalMarks !== undefined ? (
                            <span className="font-black text-primary">
                              {att.obtainedMarks}/{att.totalMarks} ({att.grade})
                            </span>
                          ) : (
                            <span className="text-outline italic text-xs">Processing...</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadAnswerSheet;
