import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { studentService } from '../../services/student.service';
import { Exam } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const Instructions: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadExam = async () => {
      if (id) {
        try {
          const detail = await studentService.getExamById(id);
          if (detail) {
            setExam(detail);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    };
    loadExam();
  }, [id]);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;
  if (!exam) return <div className="text-center py-20 text-error font-bold">Exam model not found.</div>;

  const title = exam.title || (exam as any).name || 'Examination';
  const subjectName = exam.subject || (exam as any).subjectName || '';
  const subjectCode = exam.subjectCode || '';
  const duration = exam.duration || (exam as any).durationMinutes || 0;

  return (
    <div className="flex flex-col gap-6 text-left max-w-2xl mx-auto animate-fade-in py-6">
      {/* Back button */}
      <div>
        <Link to="/student/exams" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Examinations List
        </Link>
      </div>

      <div className="glass-card p-8 rounded-2xl border border-outline-variant/20 shadow-md">
        <h2 className="text-2xl font-black text-on-surface font-display">{title}</h2>
        <p className="text-sm text-on-surface-variant font-semibold mt-1">
          {subjectName} {subjectCode ? `(${subjectCode})` : ''}
        </p>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 mt-6 p-4 bg-surface-container rounded-xl text-xs">
          <div>
            <p className="text-outline">Duration Allowed</p>
            <p className="font-bold text-on-surface mt-0.5">{duration} Minutes</p>
          </div>
          <div>
            <p className="text-outline">Total Marks Score</p>
            <p className="font-bold text-on-surface mt-0.5">{exam.totalMarks} Marks</p>
          </div>
          <div className="col-span-2 border-t border-outline-variant/10 pt-3">
            <p className="text-outline">Allowed Materials</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {Array.isArray(exam.allowedMaterials)
                ? (exam.allowedMaterials as string[]).map((mat, i) => (
                    <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
                      {mat}
                    </span>
                  ))
                : (typeof exam.allowedMaterials === 'string' && exam.allowedMaterials.trim())
                  ? exam.allowedMaterials.split(',').map((mat, i) => (
                      <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
                        {mat.trim()}
                      </span>
                    ))
                  : <span className="text-outline italic">None</span>
              }
            </div>
          </div>
        </div>

        {/* Instructions list */}
        <div className="mt-6">
          <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-lg">info</span> Important Instructions
          </h3>
          <ul className="list-decimal pl-5 text-xs text-on-surface-variant space-y-2 leading-relaxed">
            {Array.isArray(exam.instructions)
              ? (exam.instructions as string[]).map((inst, i) => <li key={i}>{inst}</li>)
              : (typeof exam.instructions === 'string' && exam.instructions.trim())
                ? exam.instructions.split('\n').map((inst, i) => <li key={i}>{inst}</li>)
                : <li>Answer all questions. Submit before the timer expires.</li>
            }
            <li>Ensure Apple Pencil or active Stylus bluetooth setting remains active. Draw and write within the predefined stroke boxes.</li>
            <li>Your answers are automatically saved to the database. An active cloud icon <span className="inline-flex items-center text-[10px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-black border border-green-500/20">Auto Saved ✓</span> indicates complete draft synchronization.</li>
          </ul>
        </div>

        {/* CTA */}
        <div className="mt-8 pt-6 border-t border-outline-variant/20 flex flex-col sm:flex-row gap-4 items-center">
          <button
            onClick={() => navigate(`/student/exams/${exam.id}/workspace`)}
            className="flex-grow w-full py-3 bg-primary text-on-primary rounded-xl font-bold hover:shadow-lg transition-all active:scale-95 text-center cursor-pointer"
          >
            Start writing Answer Sheet
          </button>
        </div>
      </div>
    </div>
  );
};

export default Instructions;
