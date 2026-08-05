import React, { useEffect, useState } from 'react';
import { facultyService } from '../../services/faculty.service';
import { Student } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const FacultyStudents: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Standard mock list query
    facultyService.getStudentsList().then(data => {
      setStudents(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  const filteredStudents = students.filter(
    s => s.name.toLowerCase().includes(search.toLowerCase()) || 
         s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Student Roll registry</h2>
        <p className="text-sm text-on-surface-variant mt-1">Review student roster profile files, check scores averages, and enrollment stats.</p>
      </div>

      <div className="relative max-w-sm w-full">
        <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg select-none">search</span>
        <input 
          type="text" 
          placeholder="Search roll name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm bg-white dark:bg-surface-container">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Enrolled Course</th>
                <th className="px-6 py-4">Attendance</th>
                <th className="px-6 py-4">Average Grade</th>
                <th className="px-6 py-4 text-right">Class Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-xs text-on-surface-variant">
              {filteredStudents.map((s) => (
                <tr key={s.id} className="hover:bg-primary/5 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-on-surface text-sm block">{s.name}</span>
                      <span className="text-[10px] text-outline">{s.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-on-surface">B.Tech Computer Science</td>
                  <td className="px-6 py-4 text-outline font-medium">92% attendance</td>
                  <td className="px-6 py-4 font-bold text-primary">{s.avgScore}%</td>
                  <td className="px-6 py-4 text-right font-semibold text-on-surface-variant">{s.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FacultyStudents;
