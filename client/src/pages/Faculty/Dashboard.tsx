import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { facultyService } from '../../services/faculty.service';
import { adminService } from '../../services/admin.service';
import { AnswerSheet, Subject } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const FacultyDashboard: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubId, setSelectedSubId] = useState('');
  const [pendingSheets, setPendingSheets] = useState<AnswerSheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [subs, pending] = await Promise.all([
          adminService.getSubjects(),
          facultyService.getPendingEvaluations()
        ]);
        setSubjects(subs);
        if (subs.length > 0) setSelectedSubId(subs[0].id);
        setPendingSheets(pending);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  const filteredPending = pendingSheets.filter(
    s => !selectedSubId || s.subjectId === selectedSubId
  );

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in">
      {/* Intro & filter header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-on-surface font-display">Faculty Evaluator Panel</h2>
          <p className="text-sm text-on-surface-variant mt-1">Manage semantic OCR model solutions and approve student feedback.</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-outline uppercase tracking-wider">Focus Subject:</span>
          <select 
            value={selectedSubId}
            onChange={(e) => setSelectedSubId(e.target.value)}
            className="px-3 py-1.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-xs font-bold text-on-surface cursor-pointer focus:outline-none focus:border-primary"
          >
            <option value="">All Subjects</option>
            {subjects.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.code} - {sub.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bento Grid Analytics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Average Class Marks</span>
            <h3 className="text-3xl font-black text-primary mt-2 font-display">74.2%</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Across active subjects.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Pending Reviews</span>
            <h3 className="text-3xl font-black text-secondary mt-2 font-display">{pendingSheets.length}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Awaiting grading verification.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Model Answers Loaded</span>
            <h3 className="text-3xl font-black text-green-700 mt-2 font-display">6</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Reference sheets configuration.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Discrepancy Flags</span>
            <h3 className="text-3xl font-black text-orange-600 mt-2 font-display">1</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Required manual review checks.</p>
        </div>
      </div>

      {/* Distribution charts rendering block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class distribution metrics bars representative */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border-outline-variant/30">
          <h3 className="text-base font-bold text-on-surface mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">analytics</span> Mark Distribution Ranges
          </h3>
          <div className="h-44 flex items-end justify-between px-6 pb-2">
            {[
              { label: '<40%', amt: 2, color: 'bg-red-500' },
              { label: '40-60%', amt: 8, color: 'bg-amber-500' },
              { label: '60-80%', amt: 21, color: 'bg-primary' },
              { label: '80-100%', amt: 12, color: 'bg-green-600' }
            ].map((d) => {
              const max = 22;
              const heightPct = (d.amt / max) * 100;
              return (
                <div key={d.label} className="flex flex-col items-center gap-2 flex-grow">
                  <div className="w-12 bg-outline-variant/10 rounded-t-lg h-32 relative">
                    <div 
                      className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-1000 ease-out ${d.color}`}
                      style={{ height: `${heightPct}%` }}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface">
                        {d.amt}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-outline uppercase mt-1">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Panel Quick launch */}
        <div className="flex flex-col gap-4">
          <div className="glass-card p-4 rounded-2xl flex flex-col justify-between border-outline-variant/30 text-left bg-primary/5 border border-primary/10 flex-grow">
            <div>
              <span className="material-symbols-outlined text-primary text-2xl font-black">draw</span>
              <h4 className="font-bold text-xs text-on-surface mt-2">Model Answers Configuration</h4>
              <p className="text-[10px] text-on-surface-variant mt-1 leading-relaxed">
                Configure answer key schemas and specify semantic text grading guidelines.
              </p>
            </div>
            <Link 
              to="/faculty/model-answers" 
              className="w-full py-2 bg-primary text-on-primary font-bold text-[10px] text-center rounded-xl hover:bg-primary/95 transition-all shadow-sm block active:scale-95 mt-3"
            >
              Configure Schema
            </Link>
          </div>

          <div className="glass-card p-4 rounded-2xl flex flex-col justify-between border-outline-variant/30 text-left bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 flex-grow">
            <div>
              <span className="material-symbols-outlined text-secondary text-2xl font-black">playlist_play</span>
              <h4 className="font-bold text-xs text-on-surface mt-2">AI Evaluation Pipeline Queue</h4>
              <p className="text-[10px] text-on-surface-variant mt-1 leading-relaxed">
                Trigger worker tasks, trace recognition splines, and inspect concepts matching.
              </p>
            </div>
            <Link 
              to="/faculty/evaluation-queue" 
              className="w-full py-2 bg-secondary text-on-secondary font-bold text-[10px] text-center rounded-xl hover:shadow-md transition-all shadow-sm block active:scale-95 mt-3"
            >
              Run Pipeline Simulator
            </Link>
          </div>
        </div>
      </div>

      {/* Pending Evaluations list table */}
      <div className="glass-card rounded-2xl border-outline-variant/30 overflow-hidden shadow-sm bg-white dark:bg-surface-container">
        <div className="px-6 py-4 border-b border-outline-variant/30 bg-surface-container-low flex justify-between items-center">
          <h3 className="font-bold text-sm">Actionable Review Queue</h3>
          <Link to="/faculty/pending" className="text-xs text-primary font-bold hover:underline">
            All pending ({pendingSheets.length})
          </Link>
        </div>

        {filteredPending.length === 0 ? (
          <p className="p-8 text-xs text-outline text-center">No pending answer sheets flagged for review under selected subject filter.</p>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                  <th className="px-6 py-3">Student Name</th>
                  <th className="px-6 py-3">Subject code</th>
                  <th className="px-6 py-3">OCR confidence</th>
                  <th className="px-6 py-3">Similarity</th>
                  <th className="px-6 py-3 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-xs text-on-surface-variant">
                {filteredPending.slice(0, 3).map((s) => (
                  <tr key={s.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-on-surface block">{s.studentName}</span>
                      <span className="text-[10px] text-outline mt-0.5">{s.fileName}</span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-on-surface">{s.subjectName}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="font-semibold text-on-surface">94%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-outline font-semibold">12% match</td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/faculty/pending/${s.id}`} 
                        className="px-3 py-1.5 bg-secondary text-white rounded-xl font-bold font-label-md text-[11px]"
                      >
                        Grade & Verify
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyDashboard;
