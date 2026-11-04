import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/admin.service';
import { uploadService } from '../../services/upload.service';
import { useNotifications } from '../../context/NotificationContext';
import { Subject } from '../../types';
import Dropdown from '../../components/ui/Dropdown';
import Button from '../../components/ui/Button';
import ProgressBar from '../../components/ui/ProgressBar';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const StudentUpload: React.FC = () => {
  const { addToast } = useNotifications();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedExam, setSelectedExam] = useState('exam-mid');
  const [file, setFile] = useState<File | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    adminService.getSubjects().then(data => {
      setSubjects(data);
      if (data.length > 0) setSelectedSubject(data[0].id);
      setLoading(false);
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadSuccess(false);
      setProgress(0);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedSubject) return;
    
    setUploading(true);
    setProgress(0);
    try {
      await uploadService.uploadAnswerSheet(
        file,
        selectedSubject,
        selectedExam,
        'stud-1',
        (pct) => setProgress(pct)
      );
      setUploadSuccess(true);
      addToast('Scanned Answer Sheet uploaded successfully! AI scanning started.', 'success');
      setFile(null);
    } catch (err) {
      addToast('Upload failed. Try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  const subjectOptions = subjects.map(s => ({ value: s.id, label: `${s.code} - ${s.name}` }));
  const examOptions = [
    { value: 'exam-mid', label: 'Mid-Term Examination' },
    { value: 'exam-final', label: 'Final End-Semester Examination' }
  ];

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Upload Scanned Answer Sheet</h2>
        <p className="text-sm text-on-surface-variant mt-1">Submit high-resolution scanned academic sheets for optical AI parsing.</p>
      </div>

      <div className="glass-card p-6 md:p-8 rounded-2xl border-outline-variant/30 flex flex-col gap-6">
        <form onSubmit={handleUploadSubmit} className="flex flex-col gap-6">
          <Dropdown 
            label="Select Subject" 
            options={subjectOptions} 
            value={selectedSubject} 
            onChange={(e) => setSelectedSubject(e.target.value)}
          />

          <Dropdown 
            label="Evaluation Scope" 
            options={examOptions} 
            value={selectedExam} 
            onChange={(e) => setSelectedExam(e.target.value)}
          />

          {/* Drag & Drop Zone */}
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/50 rounded-2xl p-8 bg-surface-container-low text-center hover:border-primary transition-colors cursor-pointer relative">
            <input 
              type="file" 
              accept=".pdf,image/*" 
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={uploading}
            />
            <span className="material-symbols-outlined text-primary text-5xl mb-3 font-semibold select-none">
              upload_file
            </span>
            <p className="text-sm font-bold text-on-surface">
              {file ? file.name : 'Select or Drop Answer Sheet PDF'}
            </p>
            <p className="text-xs text-outline mt-1">
              Supports scanning PDFs, high-quality images (PNG, JPEG) up to 20MB.
            </p>
          </div>

          {file && !uploading && (
            <p className="text-xs text-secondary font-semibold">
              Selected script: {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          )}

          {uploading && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-primary">Uploading student script...</span>
              <ProgressBar progress={progress} showPercentage color="primary" />
            </div>
          )}

          {uploadSuccess && (
            <div className="p-4 bg-green-50 text-green-800 rounded-xl text-xs flex items-center gap-2 border border-green-200">
              <span className="material-symbols-outlined text-green-700">check_circle</span>
              <div>
                <p className="font-bold">Evaluation scripts registered.</p>
                <p className="text-[10px] text-green-600 mt-0.5">The backend AI engine is parsing the ink scans. Check "My Evaluations" for status updates.</p>
              </div>
            </div>
          )}

          <Button 
            type="submit" 
            disabled={!file || uploading} 
            className="w-full"
          >
            Upload and Submit for Grading
          </Button>
        </form>
      </div>
    </div>
  );
};

export default StudentUpload;
