import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { studentService } from '../../services/student.service';
import { AnswerSheet } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

export const StudentEvaluations: React.FC = () => {
  const [sheets, setSheets] = useState<AnswerSheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentService.getEvaluations().then(data => {
      setSheets(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in animate-duration-300">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">My Academic Evaluations</h2>
        <p className="text-sm text-on-surface-variant mt-1">Check grading history, optical scan validation thresholds, and plagiarism scores.</p>
      </div>

      {sheets.length === 0 ? (
        <EmptyState 
          title="No evaluations filed" 
          description="It looks like you have not uploaded any scanned answer scripts yet." 
        />
      ) : (
        <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm bg-white dark:bg-surface-container">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                  <th className="px-6 py-4">Submission ID</th>
                  <th className="px-6 py-4">Subject & Course</th>
                  <th className="px-6 py-4">Evaluation scope</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Ink / DPI</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-xs">
                {sheets.map((item) => (
                  <tr key={item.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4 text-outline font-semibold">#{item.id.substring(0, 8)}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-on-surface text-sm block">{item.subjectName}</span>
                      <span className="text-[10px] text-outline mt-0.5">{item.fileName}</span>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">{item.examName}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                        item.status === 'evaluated' ? 'bg-green-50 text-green-700 border border-green-200' :
                        item.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                        'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          item.status === 'evaluated' ? 'bg-green-500' :
                          item.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-outline font-medium">
                      {item.inkColor.toUpperCase()} / {item.scanDpi} DPI
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.status === 'evaluated' && item.evaluationId ? (
                        <Link 
                          to={`/student/evaluations/${item.evaluationId}`}
                          className="px-3 py-1.5 bg-primary text-on-primary rounded-xl font-bold font-label-md text-[11px] shadow-sm hover:shadow hover:bg-primary/95 transition-all text-center inline-block active:scale-95"
                        >
                          View Report
                        </Link>
                      ) : item.status === 'flagged' ? (
                        <span className="text-[11px] text-error font-bold flex items-center justify-end gap-1 select-none">
                          <span className="material-symbols-outlined text-sm">warning</span> Discrepancy
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-2 text-outline">
                          <LoadingSpinner size="sm" />
                          <span className="text-[10px] font-bold">Scanning...</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentEvaluations;
