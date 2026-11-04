import React from 'react';
import { useLocation, Link } from 'react-router-dom';

export const Success: React.FC = () => {
  const location = useLocation();
  const state = location.state as { examName?: string; subjectCode?: string; subjectName?: string } || {};

  const submitTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const submitDate = new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });

  // Submissions Pipeline state tracker (User suggestion #4)
  const steps = [
    { label: 'Submitted', desc: 'Answer vectors transmitted', status: 'completed' },
    { label: 'Handwriting Recognition', desc: 'Analyzing stylus coordinates', status: 'active' },
    { label: 'AI Evaluation', desc: 'LLM semantic similarity check', status: 'waiting' },
    { label: 'Faculty Review', desc: 'Double-sign verification override', status: 'waiting' },
    { label: 'Published', desc: 'Releasing grade stats', status: 'waiting' }
  ];

  return (
    <div className="flex flex-col gap-6 text-left max-w-xl mx-auto animate-fade-in py-10">
      <div className="glass-card p-8 rounded-2xl border border-outline-variant/20 shadow-lg text-center flex flex-col items-center gap-6">
        
        {/* Success Icon */}
        <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500 text-green-700 flex items-center justify-center font-black text-3xl animate-bounce">
          ✓
        </div>

        <div>
          <h2 className="text-xl font-black text-on-surface font-display">Exam Submitted Successfully</h2>
          <p className="text-xs text-outline mt-1">Your iPad digital answer sheet is now locked and synced.</p>
        </div>

        {/* Details Gate */}
        <div className="w-full grid grid-cols-2 gap-4 p-4 bg-surface-container rounded-xl text-xs text-left">
          <div>
            <p className="text-outline">Exam Code</p>
            <p className="font-bold text-on-surface mt-0.5">{state.examName || 'Practical Laboratory Exam'}</p>
          </div>
          <div>
            <p className="text-outline">Subject Name</p>
            <p className="font-bold text-on-surface mt-0.5">{state.subjectName || 'Advanced Machine Learning'}</p>
          </div>
          <div className="border-t border-outline-variant/10 pt-3">
            <p className="text-outline">Submission Clock</p>
            <p className="font-bold text-on-surface mt-0.5">{submitTime} • {submitDate}</p>
          </div>
          <div className="border-t border-outline-variant/10 pt-3">
            <p className="text-outline">Sync Status</p>
            <p className="font-bold text-green-700 mt-0.5">Vector Cloud Connected</p>
          </div>
        </div>

        {/* AI Progress pipeline */}
        <div className="w-full border-t border-outline-variant/20 pt-6">
          <h3 className="text-xs font-bold text-outline uppercase tracking-wider text-left mb-4">Pipeline Status</h3>
          <div className="relative pl-6 space-y-5 text-left border-l border-outline-variant/20 ml-2.5">
            {steps.map((step, idx) => (
              <div key={idx} className="relative">
                {/* Node symbol */}
                <div className={`absolute top-0.5 -left-[2.05rem] w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold ${
                  step.status === 'completed' 
                    ? 'border-green-600 bg-green-500/10 text-green-700' 
                    : step.status === 'active'
                      ? 'border-primary bg-primary/10 text-primary animate-pulse'
                      : 'border-outline bg-surface-container text-outline'
                }`}>
                  {step.status === 'completed' && '✓'}
                  {step.status === 'active' && '▶'}
                  {step.status === 'waiting' && '○'}
                </div>
                <h4 className={`text-xs font-bold ${
                  step.status === 'completed' ? 'text-green-700' :
                  step.status === 'active' ? 'text-primary' : 'text-on-surface'
                }`}>
                  {step.label}
                </h4>
                <p className="text-[10px] text-outline mt-0.5">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="w-full pt-4">
          <Link
            to="/student"
            className="block w-full py-3 bg-primary text-on-primary rounded-xl text-xs font-bold hover:shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            Return to Student Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Success;
