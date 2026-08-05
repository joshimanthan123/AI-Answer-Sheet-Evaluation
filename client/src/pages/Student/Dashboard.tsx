import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { studentService } from '../../services/student.service';
import { MockExam } from '../../mocks/db';
import { AnswerSheet } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const StudentDashboard: React.FC = () => {
  const [exams, setExams] = useState<MockExam[]>([]);
  const [sheets, setSheets] = useState<AnswerSheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [examList, sheetList] = await Promise.all([
          studentService.getExams(),
          studentService.getEvaluations()
        ]);
        setExams(examList);
        setSheets(sheetList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  const upcomingCount = exams.filter(e => e.status === 'upcoming').length;
  const todayCount = exams.filter(e => e.status === 'today').length;
  const completedCount = exams.filter(e => e.status === 'completed').length;
  
  // Calculate average marks from mock evaluations
  const averageMarks = 84.8;
  const latestResult = {
    subjectName: 'Data Structures and Algorithms',
    score: 85,
    total: 100,
    grade: 'A-'
  };

  // Student AI pipeline steps representation
  const pipelineSteps = [
    { label: 'Student Writes on iPad', icon: 'draw', desc: 'Handwritten ink inputs captured.' },
    { label: 'Submit Exam', icon: 'send_and_archive', desc: 'Answers sent to evaluation queue.' },
    { label: 'Handwriting Recognition', icon: 'component_exchange', desc: 'HWR converting strokes to text.' },
    { label: 'AI Evaluation', icon: 'psychology', desc: 'LLM + NLP rubric similarity grading.' },
    { label: 'Faculty Review', icon: 'rate_review', desc: 'Manual override check & validation.' },
    { label: 'Results Published', icon: 'verified', desc: 'Grades released to student portal.' }
  ];

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in">
      {/* Intro Header */}
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">iPad Student Portal</h2>
        <p className="text-sm text-on-surface-variant mt-1">Write digital exams with Stylus / Apple Pencil and track automated AI/NLP marking workflows.</p>
      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between border border-outline-variant/20 hover:shadow-md transition-shadow">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Today's Active Exams</span>
            <h3 className="text-3xl font-black text-secondary mt-2 font-display">{todayCount}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Required handwritten canvas input. </p>
        </div>

        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between border border-outline-variant/20 hover:shadow-md transition-shadow">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Upcoming Scheduled</span>
            <h3 className="text-3xl font-black text-primary mt-2 font-display">{upcomingCount}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4 font-semibold">
            <Link to="/student/exams" className="text-primary hover:underline">View Scheduled Exams →</Link>
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between border border-outline-variant/20 hover:shadow-md transition-shadow">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Completed / Evaluated</span>
            <h3 className="text-3xl font-black text-green-700 mt-2 font-display">{completedCount}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Transmitted for AI evaluations.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between border border-outline-variant/20 hover:shadow-md transition-shadow">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Average Marks</span>
            <h3 className="text-3xl font-black text-amber-600 mt-2 font-display">{averageMarks}%</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Calculated across verified subjects.</p>
        </div>
      </div>

      {/* Pipeline Status Flow Card */}
      <div className="glass-card p-6 rounded-2xl border border-outline-variant/20">
        <h3 className="text-base font-bold text-on-surface mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">analytics</span> iPad to AI Grading Pipeline Workflow
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {pipelineSteps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center text-center p-3 rounded-xl bg-surface-container-low border border-outline-variant/10 relative">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                <span className="material-symbols-outlined">{step.icon}</span>
              </div>
              <h4 className="text-xs font-bold text-on-surface">{step.label}</h4>
              <p className="text-[10px] text-outline mt-1 leading-snug">{step.desc}</p>
              {idx < 5 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 -translate-y-1/2 text-outline-variant z-10 font-bold text-lg">
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Splitted Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Result Card */}
        <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Latest Published Result</span>
            <div className="mt-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary text-primary flex items-center justify-center font-black text-xl font-display">
                {latestResult.grade}
              </div>
              <div>
                <h4 className="text-sm font-bold text-on-surface truncate max-w-[180px]">{latestResult.subjectName}</h4>
                <p className="text-xs text-outline">{latestResult.score}/{latestResult.total} Marks Obtained</p>
              </div>
            </div>
          </div>
          <Link 
            to="/student/results" 
            className="mt-6 w-full py-2.5 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl text-xs font-bold transition-all text-center"
          >
            Open Results Dashboard
          </Link>
        </div>

        {/* Today's Active Exam Gate */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-outline-variant/20 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Today's Active Exams Gate</span>
            {exams.filter(e => e.status === 'today').map((exam) => (
              <div key={exam.id} className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10 gap-4">
                <div>
                  <h4 className="text-sm font-bold text-on-surface">{exam.name}</h4>
                  <p className="text-xs text-on-surface-variant">{exam.subjectName} ({exam.subjectCode})</p>
                  <p className="text-[10px] text-outline mt-1">Duration: {exam.durationMinutes} Minutes • Total: {exam.totalMarks} Marks</p>
                </div>
                <Link 
                  to={`/student/exams/${exam.id}/instructions`}
                  className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:shadow-md hover:bg-primary/95 text-center transition-all whitespace-nowrap active:scale-95 cursor-pointer"
                >
                  Enter Exam Workspace
                </Link>
              </div>
            ))}
            {exams.filter(e => e.status === 'today').length === 0 && (
              <p className="text-xs text-outline mt-4">No examinations scheduled for today.</p>
            )}
          </div>
          <Link to="/student/exams" className="text-xs text-primary font-bold hover:underline mt-6 inline-block text-left">
            View full exams listings and calendar →
          </Link>
        </div>
      </div>

      {/* Notifications Panel */}
      <div className="glass-card rounded-2xl border border-outline-variant/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low flex justify-between items-center">
          <h3 className="font-bold text-sm">System Alerts & Notifications</h3>
        </div>
        <div className="p-6 flex flex-col gap-4 text-xs">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-on-surface">
            <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
            <div>
              <p className="font-semibold">AI Evaluation Finished</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">Your answer sheet for Data Structures (CS-101) has been annotated. Click to view detailed grading rubric matches.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-on-surface">
            <span className="material-symbols-outlined text-amber-600 text-lg">info</span>
            <div>
              <p className="font-semibold">Upcoming Exam Preparation</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">Make sure your iPad Apple Pencil / Stylus is charged and connected before joining the CS-402-AI examination session.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
