import React from 'react';
import { Link } from 'react-router-dom';

export const Landing: React.FC = () => {
  return (
    <div className="bg-background min-h-screen text-on-surface font-body-md flex flex-col justify-between">
      {/* Top Header App Bar */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-outline-variant/20 h-16 flex items-center justify-between px-6 md:px-12">
        <h1 className="font-display text-2xl font-black text-primary">GradeAI</h1>
        <div className="flex items-center gap-6">
          <Link to="/auth/login" className="text-on-surface-variant hover:text-primary font-semibold text-sm transition-colors">
            Sign In
          </Link>
          <Link to="/auth/register" className="px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:shadow-md hover:bg-primary/95 transition-all active:scale-95">
            Get Started
          </Link>
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="flex-grow pt-32 pb-16 px-6 md:px-12 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 text-left">
        <div className="lg:w-1/2 flex flex-col gap-6">
          <span className="self-start px-3 py-1 bg-primary/10 text-primary text-sm font-bold rounded-full">
            Autonomous Digital Exam Grid
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-5xl font-black tracking-tight text-on-surface leading-tight">
            AI Evaluation for <span className="text-primary">iPad & Stylus Hand-written</span> Exams
          </h2>
          <p className="text-on-surface-variant text-base leading-relaxed">
            GradeAI digitizes traditional university grading. Students draft replies using Apple Pencils on canvas viewports; our automated pipelining parses handwriting vectors (HWR), executes semantic similarity model matches, and suggests grades for faculty overrides.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-2">
            <Link to="/auth/login" className="px-6 py-3 bg-primary text-on-primary text-center rounded-xl font-bold hover:shadow-lg transition-all active:scale-95 text-xs">
              Access Sandbox Portal
            </Link>
            <a href="#features" className="px-6 py-3 bg-white border border-outline-variant text-on-surface-variant text-center rounded-xl font-bold hover:bg-surface-container transition-colors text-xs">
              Explore Integration Specs
            </a>
          </div>
        </div>

        {/* Hero Interactive UI Card Mockup */}
        <div className="lg:w-1/2 w-full">
          <div className="glass-card p-6 rounded-2xl shadow-xl w-full flex flex-col gap-6 border-outline-variant/30">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-red-400 rounded-full" />
                <span className="w-3 h-3 bg-amber-400 rounded-full" />
                <span className="w-3 h-3 bg-green-400 rounded-full" />
              </div>
              <span className="text-xs text-outline font-semibold uppercase tracking-wider">Evaluation Hub</span>
            </div>

            <div className="flex flex-col gap-4 text-left">
              <div className="flex items-start gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
                <span className="material-symbols-outlined text-primary text-3xl font-black">draw</span>
                <div>
                  <h4 className="font-bold text-sm">Handwriting Recognition (HWR)</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">Apple Pencil handwriting splines are translated via cognitive models into clean text strings.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-secondary/5 rounded-xl border border-secondary/10">
                <span className="material-symbols-outlined text-secondary text-3xl font-black">analytics</span>
                <div>
                  <h4 className="font-bold text-sm">NLP Semantic Evaluation</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">Semantic evaluation matches student concepts and parameters against teacher answer templates.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-900/40">
                <span className="material-symbols-outlined text-green-700 text-3xl font-black">verified</span>
                <div>
                  <h4 className="font-bold text-sm">Faculty Review & Sign-Off</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">Review handwriting side-by-side with recognized strings and apply override scores.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-outline-variant/20 bg-surface-container-low text-center text-xs text-outline">
        <p>© 2026 GradeAI Systems Inc. Optimized for next-generation automated university evaluations.</p>
      </footer>
    </div>
  );
};

export default Landing;
