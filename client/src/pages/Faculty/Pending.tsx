import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { facultyService } from '../../services/faculty.service';
import { AnswerSheet } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

export const FacultyPending: React.FC = () => {
  const [sheets, setSheets] = useState<AnswerSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    facultyService.getPendingEvaluations().then(data => {
      setSheets(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  const filteredSheets = sheets.filter(
    s => s.studentName.toLowerCase().includes(search.toLowerCase()) || 
         s.subjectName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Pending Audits Queue</h2>
        <p className="text-sm text-on-surface-variant mt-1">Review OCR similarity indices, match thresholds, and approve marks.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search bar */}
        <div className="relative max-w-sm w-full">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg select-none">search</span>
          <input 
            type="text" 
            placeholder="Search student or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {filteredSheets.length === 0 ? (
        <EmptyState 
          title="Audit queue cleared" 
          description="All student submissions evaluated by the AI engine are approved! Nice job." 
        />
      ) : (
        <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm bg-white dark:bg-surface-container">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Submission Details</th>
                  <th className="px-6 py-4">OCR Confidence</th>
                  <th className="px-6 py-4">Audit Status</th>
                  <th className="px-6 py-4 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-xs text-on-surface-variant">
                {filteredSheets.map((s) => (
                  <tr key={s.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-on-surface text-sm block">{s.studentName}</span>
                      <span className="text-[10px] text-outline mt-0.5">Roll: #CSE-{s.id.substring(0,4).toUpperCase()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-on-surface block">{s.subjectName}</span>
                      <span className="text-[10px] text-outline mt-0.5">{s.fileName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="font-bold text-on-surface text-xs">96% confidence</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        s.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {s.status === 'pending' ? 'Awaiting audit' : 'Reevaluation Requested'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/faculty/pending/${s.id}`} 
                        className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold font-label-md text-[11px] shadow-sm hover:bg-primary/95 transition-all text-center inline-block active:scale-95"
                      >
                        Grade Sheet
                      </Link>
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

export default FacultyPending;
