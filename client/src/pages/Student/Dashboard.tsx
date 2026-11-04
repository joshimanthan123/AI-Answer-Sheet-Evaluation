import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { studentService } from '../../services/student.service';

export const StudentDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await studentService.getDashboardData();
      setDashboardData(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || 'Unable to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-8 py-6 text-left animate-pulse">
        {/* Header Skeleton */}
        <div>
          <div className="h-8 bg-outline-variant/10 rounded w-1/4"></div>
          <div className="h-4 bg-outline-variant/10 rounded w-1/2 mt-2"></div>
        </div>

        {/* Bento Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-6 h-28 rounded-2xl bg-outline-variant/10 border border-outline-variant/5"></div>
          ))}
        </div>

        {/* Pipeline Skeleton */}
        <div className="glass-card p-6 h-48 rounded-2xl bg-outline-variant/10 border border-outline-variant/5"></div>

        {/* Bottom grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 h-44 rounded-2xl bg-outline-variant/10 border border-outline-variant/5"></div>
          <div className="lg:col-span-2 glass-card p-6 h-44 rounded-2xl bg-outline-variant/10 border border-outline-variant/5"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 animate-fade-in">
        <span className="material-symbols-outlined text-red-500 text-5xl">error</span>
        <h3 className="text-lg font-bold text-on-surface">Unable to load dashboard data.</h3>
        <p className="text-xs text-on-surface-variant max-w-md">{error}</p>
        <button 
          onClick={fetchDashboard}
          className="px-6 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:shadow-md hover:bg-primary/95 text-center transition-all whitespace-nowrap active:scale-95 cursor-pointer mt-2"
        >
          Try Again
        </button>
      </div>
    );
  }

  const {
    activeExams = 0,
    upcomingExams = 0,
    completedExams = 0,
    averageMarks = null,
    activeExam = null,
    latestResult = null,
    pipeline = { submissionId: null, status: 'idle', currentStage: null, progress: 0 }
  } = dashboardData || {};

  // Student AI pipeline steps representation
  const pipelineSteps = [
    { label: 'Student Writes on iPad', icon: 'draw', desc: 'Handwritten ink inputs captured.', progressVal: 0 },
    { label: 'Submit Exam', icon: 'send_and_archive', desc: 'Answers sent to evaluation queue.', progressVal: 20 },
    { label: 'Handwriting Recognition', icon: 'component_exchange', desc: 'HWR converting strokes to text.', progressVal: 40 },
    { label: 'AI Evaluation', icon: 'psychology', desc: 'LLM + NLP rubric similarity grading.', progressVal: 60 },
    { label: 'Faculty Review', icon: 'rate_review', desc: 'Manual override check & validation.', progressVal: 80 },
    { label: 'Results Published', icon: 'verified', desc: 'Grades released to student portal.', progressVal: 100 }
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
            <h3 className="text-3xl font-black text-secondary mt-2 font-display">{activeExams}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Required handwritten canvas input. </p>
        </div>

        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between border border-outline-variant/20 hover:shadow-md transition-shadow">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Upcoming Scheduled</span>
            <h3 className="text-3xl font-black text-primary mt-2 font-display">{upcomingExams}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4 font-semibold">
            {upcomingExams > 0 ? (
              <Link to="/student/exams" className="text-primary hover:underline">View Scheduled Exams →</Link>
            ) : (
              <span className="text-outline-variant font-normal">No upcoming exams</span>
            )}
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between border border-outline-variant/20 hover:shadow-md transition-shadow">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Completed / Evaluated</span>
            <h3 className="text-3xl font-black text-green-700 mt-2 font-display">{completedExams}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Transmitted for AI evaluations.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between border border-outline-variant/20 hover:shadow-md transition-shadow">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Average Marks</span>
            <h3 className="text-3xl font-black text-amber-600 mt-2 font-display">
              {averageMarks !== null ? `${averageMarks}%` : '—'}
            </h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">
            {averageMarks !== null ? 'Calculated across verified subjects.' : 'No published results yet'}
          </p>
        </div>
      </div>

      {/* Pipeline Status Flow Card */}
      <div className="glass-card p-6 rounded-2xl border border-outline-variant/20">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-base font-bold text-on-surface flex items-center gap-2 m-0">
            <span className="material-symbols-outlined text-primary">analytics</span> iPad to AI Grading Pipeline Workflow
          </h3>
          {pipeline.submissionId && (
            <Link 
              to={`/student/exams/${pipeline.submissionId}/submission-status`}
              className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer font-sans"
            >
              Track Live Status
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </Link>
          )}
        </div>
        {pipeline.status === 'idle' ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <span className="material-symbols-outlined text-outline text-3xl">hourglass_empty</span>
            <p className="text-xs text-outline mt-2">No submissions currently being processed</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {pipelineSteps.map((step, idx) => {
              const isCompleted = pipeline.progress >= step.progressVal;
              const isActive = pipeline.progress === step.progressVal;

              return (
                <div 
                  key={idx} 
                  className={`flex flex-col items-center text-center p-3 rounded-xl bg-surface-container-low border transition-all ${
                    isActive ? 'border-primary shadow-sm bg-primary/5 ring-1 ring-primary/30' : 
                    isCompleted ? 'border-green-600/30 bg-green-500/5' : 'border-outline-variant/10'
                  } relative`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${
                    isActive ? 'bg-primary text-on-primary animate-pulse' :
                    isCompleted ? 'bg-green-600/10 text-green-700' : 'bg-outline-variant/20 text-outline'
                  }`}>
                    <span className="material-symbols-outlined">{step.icon}</span>
                  </div>
                  <h4 className={`text-xs font-bold ${
                    isActive ? 'text-primary' :
                    isCompleted ? 'text-green-700' : 'text-on-surface'
                  }`}>{step.label}</h4>
                  <p className="text-[10px] text-outline mt-1 leading-snug">{step.desc}</p>
                  {idx < 5 && (
                    <div className={`hidden lg:block absolute top-1/2 -right-3 -translate-y-1/2 z-10 font-bold text-lg ${
                      isCompleted && pipeline.progress >= pipelineSteps[idx+1].progressVal ? 'text-green-600' : 'text-outline-variant'
                    }`}>
                      →
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Splitted Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Result Card */}
        <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 flex flex-col justify-between">
          {latestResult ? (
            <>
              <div>
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Latest Published Result</span>
                <div className="mt-4 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary text-primary flex items-center justify-center font-black text-xl font-display">
                    {latestResult.grade}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-on-surface truncate max-w-[180px]">{latestResult.examTitle}</h4>
                    <p className="text-xs text-outline">{latestResult.subjectCode}</p>
                    <p className="text-xs text-outline-variant mt-0.5">{latestResult.marksObtained}/{latestResult.totalMarks} Marks ({latestResult.percentage}%)</p>
                  </div>
                </div>
              </div>
              <Link 
                to={`/student/exams/${latestResult.examId}/result`} 
                className="mt-6 w-full py-2.5 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl text-xs font-bold transition-all text-center cursor-pointer font-sans"
              >
                View Result Details
              </Link>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center h-full">
              <span className="material-symbols-outlined text-outline text-3xl">sentiment_dissatisfied</span>
              <p className="text-xs text-outline mt-2">No published results yet</p>
            </div>
          )}
        </div>

        {/* Today's Active Exam Gate */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-outline-variant/20 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Today's Active Exams Gate</span>
            {activeExam ? (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10 gap-4">
                <div>
                  <h4 className="text-sm font-bold text-on-surface">{activeExam.title}</h4>
                  <p className="text-xs text-on-surface-variant">{activeExam.subject} ({activeExam.subjectCode})</p>
                  <p className="text-[10px] text-outline mt-1 font-semibold">
                    Duration: {activeExam.duration} Minutes • End Time: {new Date(activeExam.endTime).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
                {activeExam.submissionStatus === 'submitted' ? (
                  <span className="px-4 py-2 bg-outline-variant/30 text-outline rounded-xl text-xs font-bold text-center select-none">
                    Submitted
                  </span>
                ) : (
                  <Link 
                    to={`/student/exams/${activeExam.id}/instructions`}
                    className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:shadow-md hover:bg-primary/95 text-center transition-all whitespace-nowrap active:scale-95 cursor-pointer"
                  >
                    {activeExam.submissionStatus === 'in_progress' ? 'Resume Exam Workspace' : 'Enter Exam Workspace'}
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <span className="material-symbols-outlined text-outline text-3xl">event_busy</span>
                <p className="text-xs text-outline mt-2">No active exams today</p>
              </div>
            )}
          </div>
          <Link to="/student/exams" className="text-xs text-primary font-bold hover:underline mt-6 inline-block text-left">
            View full exams listings and calendar →
          </Link>
        </div>
      </div>

      {/* System Alerts */}
      <div className="glass-card rounded-2xl border border-outline-variant/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low flex justify-between items-center">
          <h3 className="font-bold text-sm">System Alerts & Notifications</h3>
        </div>
        <div className="p-6 flex flex-col gap-4 text-xs font-normal">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-on-surface">
            <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
            <div>
              <p className="font-semibold text-left">AI Evaluation Engine Online</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5 text-left">All evaluation services and neural handwriting models are running normally.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
