import React, { useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';

interface QueueItem {
  id: string;
  studentName: string;
  subjectName: string;
  submitTime: string;
  status: 'pending' | 'hwr_processing' | 'nlp_comparing' | 'llm_scoring' | 'done';
  hwrStatus: string;
  nlpStatus: string;
  scoreMatch: string;
}

export const EvaluationQueue: React.FC = () => {
  const { addToast } = useNotifications();
  const [queue, setQueue] = useState<QueueItem[]>([
    { id: 'sub-rev-1', studentName: 'Alex Johnson', subjectName: 'Data Structures and Algorithms', submitTime: '17:42:01', status: 'done', hwrStatus: 'Completed (Confidence 97%)', nlpStatus: 'Similarity 85% computed', scoreMatch: '82/100' },
    { id: 'sub-rev-2', studentName: 'Emma Watson', subjectName: 'Data Structures and Algorithms', submitTime: '18:02:11', status: 'pending', hwrStatus: 'Queued', nlpStatus: 'Pending', scoreMatch: 'N/A' },
    { id: 'sub-rev-3', studentName: 'Devon Miller', subjectName: 'Ethics and Safety in AI Systems', submitTime: '18:14:50', status: 'pending', hwrStatus: 'Queued', nlpStatus: 'Pending', scoreMatch: 'N/A' }
  ]);

  const [logs, setLogs] = useState<string[]>([
    'System: AI Evaluation Worker Service online.',
    'Worker: Listening on student digital submissions stream...',
    'Info: #sub-rev-1 - successfully compiled canvas spline coordinates.'
  ]);

  const triggerEvaluation = (itemId: string) => {
    addToast('Starting pipeline evaluation trigger...', 'success');
    
    // Simulate pipeline transitions
    setQueue(prev => prev.map(item => {
      if (item.id === itemId) return { ...item, status: 'hwr_processing', hwrStatus: 'Running stroke parser...' };
      return item;
    }));

    setLogs(prev => [...prev, `Queue: Initiated pipeline parser for submission ID: #${itemId}`]);

    // Step 1: HWR
    setTimeout(() => {
      setQueue(prev => prev.map(item => {
        if (item.id === itemId) return { ...item, status: 'nlp_comparing', hwrStatus: 'Completed (Confidence 94%)', nlpStatus: 'Extracting key phrases...' };
        return item;
      }));
      setLogs(prev => [...prev, `HWR-OCR: Extraction completed for ID: #${itemId}. Detected: "Binary Search is a search algorithm..."`]);
    }, 2000);

    // Step 2: NLP
    setTimeout(() => {
      setQueue(prev => prev.map(item => {
        if (item.id === itemId) return { ...item, status: 'llm_scoring', nlpStatus: 'Similarity 78% computed', scoreMatch: 'Calculating weights...' };
        return item;
      }));
      setLogs(prev => [...prev, `NLP-Syllabus: Match similarity scores determined for ID: #${itemId}. Concept 'divide-and-conquer': Match.`]);
    }, 4000);

    // Step 3: Finish
    setTimeout(() => {
      setQueue(prev => prev.map(item => {
        if (item.id === itemId) return { ...item, status: 'done', scoreMatch: '76/100' };
        return item;
      }));
      setLogs(prev => [...prev, `Pipeline: AI Evaluation finished for ID: #${itemId}. Overall marks: 76. Dispatched for Faculty Verification Approval.`]);
      addToast('AI Evaluation Pipeline run completed.', 'success');
    }, 6000);
  };

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">AI Evaluation Pipeline Queue</h2>
        <p className="text-sm text-on-surface-variant mt-1">Monitor digital handwriting recognition (HWR), question segmentations, and semantic NLP matches.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submissions pipeline Table */}
        <div className="lg:col-span-2 glass-card rounded-2xl border border-outline-variant/20 overflow-hidden bg-white dark:bg-surface-container">
          <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low flex justify-between items-center">
            <h3 className="font-bold text-sm">Active Submissions Queue</h3>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-secondary-container/30 text-secondary rounded">
              {queue.length} Total Submissions
            </span>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-bold border-b border-outline-variant/10 text-[10px] uppercase">
                  <th className="p-4 pl-6">Student</th>
                  <th className="p-4">Subject</th>
                  <th className="p-4">Sync Time</th>
                  <th className="p-4">Pipeline Node</th>
                  <th className="p-4 text-center">AI Marks</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {queue.map((item) => (
                  <tr key={item.id} className="hover:bg-primary/5 transition-colors">
                    <td className="p-4 pl-6 font-bold">{item.studentName}</td>
                    <td className="p-4">{item.subjectName}</td>
                    <td className="p-4 text-outline font-semibold">{item.submitTime}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 font-bold uppercase rounded text-[9px] px-1.5 py-0.2 ${
                        item.status === 'done' ? 'bg-green-100 text-green-700' :
                        item.status === 'pending' ? 'bg-outline-variant/40 text-outline' :
                        'bg-purple-100 text-purple-700 animate-pulse'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-center font-bold text-primary">{item.scoreMatch}</td>
                    <td className="p-4 pr-6 text-right">
                      {item.status === 'pending' ? (
                        <button
                          onClick={() => triggerEvaluation(item.id)}
                          className="px-3 py-1.5 bg-primary text-on-primary font-black rounded-lg hover:shadow-md transition-all active:scale-95 cursor-pointer text-[10px]"
                        >
                          Trigger AI Eval
                        </button>
                      ) : item.status !== 'done' ? (
                        <button
                          disabled
                          className="px-3 py-1.5 bg-outline-variant/20 text-outline font-bold rounded-lg text-[10px]"
                        >
                          Running...
                        </button>
                      ) : (
                        <span className="text-[10px] text-green-600 font-bold">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Logs container panel */}
        <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 flex flex-col justify-between h-[450px]">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-lg">terminal</span> Pipeline Logs Node
            </h3>
            <div className="w-full bg-slate-900 text-green-400 font-mono text-[10px] p-4 rounded-xl space-y-2 h-[340px] overflow-y-auto custom-scrollbar text-left">
              {logs.map((log, idx) => (
                <div key={idx} className="leading-relaxed border-b border-slate-800 pb-1">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EvaluationQueue;
