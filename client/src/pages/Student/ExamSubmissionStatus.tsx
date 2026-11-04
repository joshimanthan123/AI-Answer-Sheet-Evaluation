import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studentService } from '../../services/student.service';

export const ExamSubmissionStatus: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async (showLoading = false) => {
    if (!examId) return;
    if (showLoading) setLoading(true);
    try {
      const data = await studentService.getSubmissionStatus(examId);
      setStatusData(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || 'Failed to sync submission status.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchStatus(true);
  }, [examId]);

  // Set up 8 seconds polling loop if not terminal (i.e. not published and not failed)
  useEffect(() => {
    if (!statusData || error) return;

    const pipeline = statusData.pipeline || {};
    const isTerminal = pipeline.isTerminal || pipeline.status === 'published' || pipeline.status === 'failed';

    if (isTerminal) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchStatus(false);
    }, 8000);

    return () => {
      clearInterval(intervalId);
    };
  }, [statusData, error]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 py-10 text-left animate-pulse max-w-4xl mx-auto">
        <div className="h-6 bg-outline-variant/10 rounded w-1/4"></div>
        <div className="h-4 bg-outline-variant/10 rounded w-1/2"></div>
        <div className="h-10 bg-outline-variant/10 rounded-xl mt-6"></div>
        <div className="glass-card p-6 h-64 rounded-2xl bg-outline-variant/10 border border-outline-variant/5"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 animate-fade-in max-w-md mx-auto">
        <span className="material-symbols-outlined text-red-500 text-5xl">alert_tracker</span>
        <h3 className="text-lg font-bold text-on-surface">Unable to retrieve submission status</h3>
        <p className="text-xs text-on-surface-variant">{error}</p>
        <div className="flex gap-4 mt-2">
          <button 
            onClick={() => fetchStatus(true)}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:shadow-md hover:bg-primary/95 text-center transition-all whitespace-nowrap active:scale-95 cursor-pointer mt-2"
          >
            Retry Connection
          </button>
          <button 
            onClick={() => navigate('/student/exams')}
            className="px-6 py-2.5 bg-surface-variant text-on-surface-variant border border-outline-variant rounded-xl text-xs font-bold hover:bg-outline-variant/10 transition-all text-center whitespace-nowrap active:scale-95 cursor-pointer mt-2"
          >
            Go to Exams
          </button>
        </div>
      </div>
    );
  }

  const pipeline = statusData?.pipeline || { status: 'submitted', stage: 'Submit Exam', progress: 20, isFailed: false };
  const submittedAt = statusData?.submittedAt ? new Date(statusData.submittedAt).toLocaleString() : 'N/A';

  const pipelineSteps = [
    { label: 'Submit Exam', icon: 'send_and_archive', desc: 'Answers sent to evaluation queue.', statusKey: 'submitted', minProgress: 20 },
    { label: 'Handwriting Recognition', icon: 'component_exchange', desc: 'HWR converting strokes to text.', statusKey: 'processing', minProgress: 40 },
    { label: 'AI Evaluation', icon: 'psychology', desc: 'LLM + NLP rubric similarity grading.', statusKey: 'evaluating', minProgress: 60 },
    { label: 'Faculty Review', icon: 'rate_review', desc: 'Manual override check & validation.', statusKey: 'faculty_review', minProgress: 80 },
    { label: 'Results Published', icon: 'verified', desc: 'Grades released to student portal.', statusKey: 'published', minProgress: 100 }
  ];

  return (
    <div className="flex flex-col gap-6 py-4 text-left animate-fade-in max-w-4xl mx-auto">
      {/* Back button */}
      <div>
        <button 
          onClick={() => navigate('/student/exams')}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors bg-transparent border-0 cursor-pointer p-0"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Exams
        </button>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Evaluation Status</h2>
        <p className="text-sm text-on-surface-variant mt-1">Submitted at {submittedAt}</p>
      </div>

      {/* Status Bar */}
      <div className="glass-card p-6 rounded-2xl bg-surface border border-outline-variant/10 flex flex-col gap-6 relative overflow-hidden shadow-sm">
        {/* Dynamic color accent bar based on state */}
        <div 
          className={`absolute top-0 left-0 right-0 h-1.5 transition-all ${
            pipeline.status === 'failed' ? 'bg-red-500' :
            pipeline.status === 'published' ? 'bg-green-500' :
            'bg-primary'
          }`}
          style={{ width: '100%' }}
        />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-1">
          <div>
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
              {pipeline.status === 'failed' ? (
                <>
                  <span className="material-symbols-outlined text-red-500 animate-pulse">report</span>
                  Processing Delayed
                </>
              ) : pipeline.status === 'published' ? (
                <>
                  <span className="material-symbols-outlined text-green-500">check_circle</span>
                  Evaluation Completed
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-primary animate-spin">sync</span>
                  Evaluating Answers...
                </>
              )}
            </h3>
            <p className="text-xs text-on-surface-variant mt-1">
              Current stage: <strong className="text-on-surface">{pipeline.stage}</strong>
            </p>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Progress Percentage badge */}
            <div className={`px-4 py-2 rounded-xl font-mono text-sm font-bold flex items-center justify-center ${
              pipeline.status === 'failed' ? 'bg-red-50 text-red-700' :
              pipeline.status === 'published' ? 'bg-green-50 text-green-700' :
              'bg-primary/5 text-primary'
            }`}>
              {pipeline.progress}%
            </div>

            {/* Refresh/Retry */}
            <button 
              onClick={() => fetchStatus(true)}
              className="p-2 border border-outline-variant rounded-xl hover:bg-outline-variant/10 transition-all cursor-pointer flex items-center justify-center"
              title="Refresh Pipeline Status"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-outline-variant/10 rounded-full h-3 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-700 ${
              pipeline.status === 'failed' ? 'bg-red-500/80 progress-bar-striped animate-pulse' :
              pipeline.status === 'published' ? 'bg-green-500' :
              'bg-gradient-to-r from-primary/80 to-primary'
            }`}
            style={{ width: `${pipeline.progress}%` }}
          />
        </div>
      </div>

      {pipeline.status === 'failed' && (
        <div className="glass-card p-6 bg-red-50/10 border border-red-500/20 rounded-2xl flex items-start gap-4 animate-fade-in">
          <span className="material-symbols-outlined text-red-500 text-3xl mt-0.5">warning</span>
          <div>
            <h4 className="text-sm font-bold text-red-900">Processing Delayed</h4>
            <p className="text-xs text-red-750 mt-1 leading-relaxed">
              We are experiencing a slight delay in processing your handwriting OCR or AI evaluation. 
              Rest assured, your answer sheet has been safely recorded and locked. 
              The technical team has been notified, and faculty is reviewing the queue. Please check back later.
            </p>
          </div>
        </div>
      )}

      {/* Checklist Timeline */}
      <div className="glass-card p-6 rounded-2xl bg-surface border border-outline-variant/10 flex flex-col gap-6 shadow-sm">
        <h3 className="text-sm font-bold text-on-surface">Grading Pipeline Progress</h3>
        
        <div className="flex flex-col gap-6 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant/15">
          {pipelineSteps.map((step, idx) => {
            const isCompleted = pipeline.progress >= step.minProgress && pipeline.status !== 'failed';
            const isActive = !isCompleted && (
              (idx === 0 && pipeline.progress < 20) ||
              (idx > 0 && pipeline.progress >= pipelineSteps[idx - 1].minProgress && pipeline.progress < step.minProgress)
            );
            const isFuture = !isCompleted && !isActive;

            let iconColor = 'text-on-surface-variant/40 bg-outline-variant/10';
            if (isCompleted) {
              iconColor = 'text-green-600 bg-green-50 border border-green-200';
            } else if (isActive) {
              iconColor = 'text-primary bg-primary/5 border border-primary/20 animate-pulse';
            }

            return (
              <div key={idx} className="flex gap-4 items-start relative relative-step-container">
                {/* Timeline connector circle */}
                <div className={`absolute -left-[22px] w-3 h-3 rounded-full border-2 bg-background z-10 ${
                  isCompleted ? 'border-green-600' :
                  isActive ? 'border-primary' :
                  'border-outline-variant/40'
                }`} />

                {/* Step badge */}
                <div className={`p-2.5 rounded-xl flex items-center justify-center ${iconColor}`}>
                  <span className="material-symbols-outlined text-lg">{step.icon}</span>
                </div>

                {/* Description info */}
                <div className="text-left">
                  <h4 className={`text-xs font-bold ${
                    isCompleted ? 'text-green-905' :
                    isActive ? 'text-primary' :
                    'text-on-surface-variant'
                  }`}>
                    {step.label}
                  </h4>
                  <p className="text-xxs text-on-surface-variant mt-0.5">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pipeline.status === 'published' && (
        <div className="flex justify-center mt-2">
          <button 
            onClick={() => navigate(`/student/exams/${examId}/result`)}
            className="px-8 py-3 bg-green-600 text-white rounded-xl text-xs font-bold hover:shadow-md hover:bg-green-700 transition-all whitespace-nowrap active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">verified</span>
            View Evaluation Results
          </button>
        </div>
      )}
    </div>
  );
};

export default ExamSubmissionStatus;
