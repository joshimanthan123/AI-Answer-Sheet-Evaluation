import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { studentService } from '../../services/student.service';
import { MockExam } from '../../mocks/db';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const MyExams: React.FC = () => {
  const [exams, setExams] = useState<MockExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExams = async () => {
      try {
        const list = await studentService.getExams();
        setExams(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadExams();
  }, []);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">My Examinations</h2>
        <p className="text-sm text-on-surface-variant mt-1">View scheduled, ongoing, and completed digital exams.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.map((exam) => (
          <div 
            key={exam.id} 
            className={`glass-card p-6 rounded-2xl border flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-md ${
              exam.status === 'today' 
                ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' 
                : 'border-outline-variant/20'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] bg-outline-variant/30 text-outline font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {exam.subjectCode}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                  exam.status === 'today' ? 'bg-secondary text-on-secondary' :
                  exam.status === 'upcoming' ? 'bg-primary/20 text-primary' : 'bg-outline-variant/40 text-outline'
                }`}>
                  {exam.status.toUpperCase()}
                </span>
              </div>
              <h3 className="font-bold text-sm text-on-surface">{exam.name}</h3>
              <p className="text-xs text-on-surface-variant mt-1 truncate">{exam.subjectName}</p>

              <div className="flex flex-col gap-2 mt-4 text-[11px] text-on-surface-variant">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xs">calendar_today</span>
                  <span>{exam.date} • {exam.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xs">schedule</span>
                  <span>{exam.durationMinutes} Minutes Duration</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xs font-bold text-primary">grade</span>
                  <span>{exam.totalMarks} Total Marks</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              {exam.status === 'today' && (
                <Link 
                  to={`/student/exams/${exam.id}/instructions`}
                  className="w-full py-2 bg-primary text-on-primary rounded-xl text-xs font-bold text-center hover:shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Start Exam Workspace
                </Link>
              )}
              {exam.status === 'upcoming' && (
                <button 
                  disabled 
                  className="w-full py-2 bg-outline-variant/20 text-outline rounded-xl text-xs font-bold text-center cursor-not-allowed"
                >
                  Registering Seat...
                </button>
              )}
              {exam.status === 'completed' && (
                <div className="flex gap-2">
                  <Link 
                    to="/student/results"
                    className="flex-grow py-2 bg-primary/10 hover:bg-primary/15 text-primary rounded-xl text-xs font-bold text-center transition-all"
                  >
                    View Result
                  </Link>
                  <Link 
                    to="/student/evaluations/eval-1" 
                    className="px-3 py-2 border border-outline-variant/30 hover:bg-surface-container-low rounded-xl text-xs font-bold text-center transition-all"
                  >
                    Details
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyExams;
