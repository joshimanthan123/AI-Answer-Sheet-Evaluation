import React, { useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { mockModelAnswers, mockSubjects } from '../../mocks/db';

export const ModelAnswers: React.FC = () => {
  const { addToast } = useNotifications();
  const [models, setModels] = useState(mockModelAnswers);

  const [subjectId, setSubjectId] = useState('sub-ds');
  const [examName, setExamName] = useState('');
  const [fileName, setFileName] = useState('');
  const [comments, setComments] = useState('');

  const handleRegisterModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName || !fileName) {
      addToast('Please fill out model definition metrics.', 'warning');
      return;
    }

    const selectedSubject = mockSubjects.find(s => s.id === subjectId);

    const newModel = {
      id: `model-${models.length + 1}`,
      subjectId,
      subjectName: selectedSubject?.name || 'Subject',
      examId: `exam-gen-${models.length + 1}`,
      examName,
      courseCode: selectedSubject?.code || 'GEN-101',
      fileUrl: '#',
      fileName,
      uploadDate: new Date().toISOString().split('T')[0],
      comments,
      facultyName: 'Dr. Sarah Jenkins'
    };

    setModels([newModel, ...models]);
    setExamName('');
    setFileName('');
    setComments('');
    addToast('Model solution key successfully registered in NLP matcher.', 'success');
  };

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Model Answer Solutions</h2>
        <p className="text-sm text-on-surface-variant mt-1">Register official model solution answer sheets for NLP comparing and evaluation thresholds.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left hand add model answers Form */}
        <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 h-fit">
          <h3 className="text-sm font-bold text-on-surface mb-4">Register Model Sheet</h3>
          <form onSubmit={handleRegisterModel} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Target Course Subject *</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
              >
                {mockSubjects.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Exam Title *</label>
              <input 
                type="text" 
                placeholder="e.g. Mid-Term Examination 2026"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Model Answers File Base Name *</label>
              <input 
                type="text" 
                placeholder="e.g. DSA_Midterm_Model_Solutions.txt"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-outline uppercase tracking-wider font-semibold">Teacher Comments & Hints</label>
              <textarea 
                placeholder="Guideline criteria weights..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
              />
            </div>

            <button 
              type="submit"
              className="w-full py-2.5 bg-primary text-on-primary rounded-xl text-xs font-black transition-all hover:bg-primary/95 active:scale-95 cursor-pointer"
            >
              Upload Model solutions
            </button>
          </form>
        </div>

        {/* Right lists showing loaded model answer records */}
        <div className="lg:col-span-2 glass-card rounded-2xl border border-outline-variant/20 overflow-hidden bg-white dark:bg-surface-container">
          <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low">
            <h3 className="font-bold text-sm">Active Model Solution Records</h3>
          </div>
          <div className="divide-y divide-outline-variant/10 text-left text-xs p-6 space-y-4">
            {models.map(m => (
              <div key={m.id} className="p-4 bg-surface-container rounded-xl border border-outline-variant/15 flex hover:shadow-sm transition-all gap-4">
                <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">description</span>
                </div>
                <div className="flex-grow space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-on-surface">{m.subjectName}</h4>
                    <span className="text-[9px] bg-outline-variant/30 text-outline font-extrabold px-1.5 py-0.2 rounded uppercase mb-1">
                      {m.courseCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant font-semibold">Exam: {m.examName}</p>
                  <p className="text-[10px] text-outline">File: {m.fileName} • Uploaded {m.uploadDate}</p>
                  {m.comments && (
                    <p className="text-[10px] text-outline font-medium italic mt-2">"{m.comments}"</p>
                  )}
                  <p className="text-[9px] text-outline-variant mt-1">Uploaded by: {m.facultyName || 'Course Chair'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ModelAnswers;
