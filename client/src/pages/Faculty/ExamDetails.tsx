import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { examService, Exam } from '../../services/exam.service';
import { useNotifications } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const ExamDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useNotifications();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExam = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await examService.getExamById(id);
        setExam(data);
      } catch (err: any) {
        console.error('Error fetching exam details:', err);
        addToast('Failed to load exam details from server.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchExam();
  }, [id]);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  if (!exam) {
    return (
      <div className="glass-card p-12 text-center max-w-xl mx-auto my-12 border border-outline-variant/20 bg-white dark:bg-surface-container">
        <span className="material-symbols-outlined text-error text-4xl block mb-2">warning</span>
        <h3 className="font-bold text-sm text-on-surface">Exam Not Found</h3>
        <p className="text-xs text-outline mt-1">Underlying record is missing, deleted, or you do not have permissions.</p>
        <Link to="/faculty/exams" className="mt-4 inline-block text-xs font-bold text-primary hover:underline">
          Back to Exams
        </Link>
      </div>
    );
  }

  const subjectName = typeof exam.subject === 'object' ? exam.subject?.name : '';
  const subjectCode = typeof exam.subject === 'object' ? exam.subject?.code : '';
  const semesterVal = typeof exam.subject === 'object' ? exam.subject?.semester : exam.semester;
  const examId = (exam as any)._id || exam.id;

  return (
    <div className="flex flex-col gap-6 text-left max-w-5xl mx-auto py-6 animate-fade-in">
      
      {/* Header controls block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-black text-on-surface font-display">{exam.title}</h2>
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded border ${
              exam.examStatus === 'Draft' ? 'bg-slate-100 text-slate-700 border-slate-200' :
              exam.examStatus === 'Published' ? 'bg-blue-100 text-blue-700 border-blue-200' :
              exam.examStatus === 'Active' ? 'bg-amber-100 text-amber-700 border-amber-200' :
              'bg-emerald-100 text-emerald-700 border-emerald-200'
            }`}>
              {exam.examStatus}
            </span>
          </div>

          <p className="text-xs text-on-surface-variant mt-1.5 flex items-center gap-2 flex-wrap font-semibold text-outline">
            {subjectCode && <span>Subject: {subjectCode} - {subjectName}</span>}
            {semesterVal && <span>• Semester {semesterVal}</span>}
            {exam.examCode && <span>• Code: {exam.examCode}</span>}
            <span>• Answer Key: 
              <span className={`ml-1 px-1.5 py-0.5 text-[9px] font-black uppercase rounded ${
                exam.answerKeyStatus === 'locked' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                'bg-amber-100 text-amber-700 border border-amber-200'
              }`}>
                {exam.answerKeyStatus || 'draft'}
              </span>
            </span>
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2.5">
          <Link 
            to="/faculty/exams" 
            className="px-3.5 py-2 border border-outline-variant/30 text-on-surface hover:bg-outline-variant/10 text-xs font-bold rounded-xl transition"
          >
            Back
          </Link>
          <Link 
            to={`/faculty/exams/${examId}/results`} 
            className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 hover:shadow active:scale-95"
          >
            <span className="material-symbols-outlined text-xs font-semibold">analytics</span>
            Results & Analytics
          </Link>
          <Link 
            to={`/faculty/exams/${examId}/answer-key`} 
            className={`px-3.5 py-2 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 hover:shadow active:scale-95 ${
              exam.answerKeyStatus === 'locked' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary'
            }`}
          >
            <span className="material-symbols-outlined text-xs">
              {exam.answerKeyStatus === 'locked' ? 'lock' : 'key'}
            </span>
            {exam.answerKeyStatus === 'locked' ? 'Manage Answer Key' : 'Manage Answer Key'}
          </Link>
          <Link 
            to={`/faculty/exams/${examId}/edit`} 
            className="px-3.5 py-2 bg-secondary text-white text-xs font-bold rounded-xl transition flex items-center gap-1 hover:shadow active:scale-95"
          >
            <span className="material-symbols-outlined text-xs">edit</span>
            Modify Parameters
          </Link>
        </div>
      </div>

      {/* Grid Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Exam Details */}
        <div className="md:col-span-2 space-y-6">
          
          {/* General Metadata */}
          <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container space-y-4">
            <h3 className="text-xs font-black text-outline uppercase tracking-wider">Exam Parameters</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-surface-container-low p-3 rounded-xl">
                <span className="text-[10px] text-outline block">Total Marks</span>
                <span className="text-sm font-bold text-on-surface mt-1 block">{exam.totalMarks} Points</span>
              </div>
              <div className="bg-surface-container-low p-3 rounded-xl">
                <span className="text-[10px] text-outline block">Passing Marks</span>
                <span className="text-sm font-bold text-on-surface mt-1 block">{exam.passingMarks || 40} Points</span>
              </div>
              <div className="bg-surface-container-low p-3 rounded-xl">
                <span className="text-[10px] text-outline block">Duration</span>
                <span className="text-sm font-bold text-on-surface mt-1 block">{exam.duration} Minutes</span>
              </div>
              <div className="bg-surface-container-low p-3 rounded-xl">
                <span className="text-[10px] text-outline block">Exam Date</span>
                <span className="text-sm font-bold text-on-surface mt-1 block">
                  {new Date(exam.examDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>

            {exam.instructions && (
              <div className="pt-2 text-xs">
                <span className="text-[10px] text-outline block font-black uppercase tracking-wider">Instructions Guidelines</span>
                <pre className="mt-1.5 p-3.5 bg-surface-container-low text-on-surface rounded-xl whitespace-pre-line font-sans leading-relaxed text-[11px]">
                  {exam.instructions}
                </pre>
              </div>
            )}
          </div>

          {/* Question List catalog */}
          <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container space-y-4">
            <h3 className="text-xs font-black text-outline uppercase tracking-wider">Questions Catalog ({exam.questions?.length || 0})</h3>
            
            {!exam.questions || exam.questions.length === 0 ? (
              <p className="text-xs text-outline italic py-4 text-center">No questions uploaded for this exam layout.</p>
            ) : (
              <div className="divide-y divide-outline-variant/15 text-xs text-on-surface">
                {exam.questions.map((q, idx) => (
                  <div key={q.id || idx} className="py-4 first:pt-0 last:pb-0 flex gap-3.5 items-start">
                    <span className="h-6 w-6 rounded bg-primary/10 text-primary font-black text-[10px] flex items-center justify-center shrink-0">
                      Q{q.questionNumber}
                    </span>
                    <div className="flex-grow space-y-2">
                      <div className="flex justify-between items-start gap-4">
                        <p className="font-semibold text-on-surface leading-relaxed text-xs">{q.questionText}</p>
                        <span className="text-[9px] font-black uppercase bg-surface-container-high text-outline px-2 py-0.5 rounded shrink-0 border border-outline-variant/10">
                          {q.maximumMarks} Marks ({q.questionType})
                        </span>
                      </div>

                      {q.keywords && (
                        <p className="text-[10px] text-outline font-semibold">
                          💡 <b>NLP Target Keywords:</b> <span className="italic font-normal">{q.keywords}</span>
                        </p>
                      )}

                      {q.modelAnswer && (
                        <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/10 text-[10.5px]">
                          <span className="font-bold text-outline text-[9px] block uppercase">Model Answer Guideline</span>
                          <span className="text-on-surface-variant block mt-1 leading-relaxed">{q.modelAnswer}</span>
                        </div>
                      )}

                      <div className="flex gap-2 text-[9px] font-extrabold uppercase mt-1">
                        <span className="px-2 py-0.5 bg-outline-variant/15 text-outline rounded">Difficulty: {q.difficulty}</span>
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded">Bloom: {q.bloomsLevel}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Auxiliary sidebar */}
        <div className="space-y-6">
          {/* Answer Sheets Management Card */}
          <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-outline uppercase tracking-wider">Answer Sheets</h3>
              <span className="material-symbols-outlined text-sm text-outline">description</span>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Upload candidate scans, check background OCR processing statuses, and view layout parses side-by-side.
            </p>
            <Link
              to={`/faculty/exams/${examId}/answer-sheets`}
              className="w-full py-2 bg-primary text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:shadow active:scale-95 transition"
            >
              <span className="material-symbols-outlined text-xs">file_upload</span>
              Manage Answer Sheets
            </Link>
          </div>

          {/* Rules & allowed materials */}
          <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 bg-white dark:bg-surface-container space-y-4">
            <h3 className="text-xs font-black text-outline uppercase tracking-wider">Candidate Controls</h3>

            <div className="space-y-3.5 text-xs text-on-surface">
              <div>
                <span className="text-[9px] text-outline block uppercase font-bold">Start Time Schedule</span>
                <span className="font-semibold">{exam.startTime || 'Not Configured'}</span>
              </div>
              <div>
                <span className="text-[9px] text-outline block uppercase font-bold">End Time Schedule</span>
                <span className="font-semibold">{exam.endTime || 'Not Configured'}</span>
              </div>
              <div>
                <span className="text-[9px] text-outline block uppercase font-bold">Allowed Supplies List</span>
                {!exam.allowedMaterials || exam.allowedMaterials.length === 0 ? (
                  <span className="text-outline italic">No reference items added</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {exam.allowedMaterials.map((mat, i) => (
                      <span key={i} className="px-2 py-0.5 bg-outline-variant/20 text-on-surface-variant rounded text-[9px] font-bold">
                        {mat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default ExamDetails;
