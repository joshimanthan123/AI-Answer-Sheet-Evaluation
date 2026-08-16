import React, { useEffect, useState } from 'react';
import { studentService } from '../../services/student.service';
import { Evaluation } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { Link } from 'react-router-dom';

export const StudentResults: React.FC = () => {
  const [results, setResults] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentService.getResults().then(data => {
      setResults(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Published Results</h2>
        <p className="text-sm text-on-surface-variant mt-1">Check grading cards, faculty status details, and final report cards.</p>
      </div>

      {results.length === 0 ? (
        <EmptyState 
          title="No results published" 
          description="Grading has not been finalized for any subject yet." 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {results.map((res: any) => {
            const subjectName = res.subjectName || res.examName || 'Subject';
            const percentage = ((res.finalScore / res.totalScore) * 100).toFixed(1);
            return (
              <div key={res.id} className="glass-card p-6 rounded-2xl border border-outline-variant/20 flex flex-col justify-between bg-white dark:bg-surface-container hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start gap-4">
                  <div className="text-left flex-grow">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">
                      Grade {res.grade}
                    </span>
                    <h4 className="text-base font-bold text-on-surface mt-2 font-display">
                      {subjectName} {res.subjectCode ? `(${res.subjectCode})` : ''}
                    </h4>
                    <p className="text-xs text-outline mt-1 font-semibold">Evaluation ID: #{res.id}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-2xl font-black text-primary font-display">{res.finalScore}</span>
                    <span className="text-xs text-outline font-semibold"> / {res.totalScore}</span>
                    <p className="text-[10px] text-outline font-bold mt-1">{percentage}% Score</p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-outline-variant/15 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col gap-1 text-[11px] text-on-surface-variant">
                    <p className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">calendar_today</span>
                      Published: {res.date}
                    </p>
                    <p className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">verified_user</span>
                      Faculty Status: 
                      <span className={`font-bold uppercase text-[9px] px-1.5 py-0.2 ml-1 rounded ${
                        res.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {res.status === 'approved' ? 'Verified' : 'Pending Review'}
                      </span>
                    </p>
                  </div>

                  <Link 
                    to={`/student/evaluations/${res.id}`}
                    className="px-4 py-2 border border-primary hover:bg-primary/5 text-primary rounded-xl text-xs font-black transition-all text-center flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                  >
                    View Detailed Report <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentResults;
