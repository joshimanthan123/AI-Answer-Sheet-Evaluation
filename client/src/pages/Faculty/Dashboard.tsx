import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { facultyService } from '../../services/faculty.service';
import subjectService from '../../services/subject.service';
import { AnswerSheet, Subject } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubId, setSelectedSubId] = useState('');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorRec, setErrorRec] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dash, subs] = await Promise.all([
          facultyService.getDashboardData(),
          subjectService.getSubjects().catch(() => [])
        ]);
        setDashboardData(dash);
        setSubjects(subs);
        if (subs.length > 0) setSelectedSubId(subs[0].id);
      } catch (err: any) {
        console.error('Faculty Dashboard Data Retrieval Error:', err);
        const status = err.response?.status || err.statusCode || (err.message && err.message.includes('Network') ? 'Network Error' : '');
        if (status === 401) {
          setErrorRec('Authentication error. Session expired or invalid details.');
        } else if (status === 403) {
          setErrorRec('Access Denied. You do not have faculty authorization.');
        } else if (status === 404) {
          setErrorRec('Endpoint not found (404). Please check route registration.');
        } else {
          setErrorRec(`Failed to retrieve server data. Error: ${err.message || err.toString()}`);
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  const stats = dashboardData?.statistics || {
    totalSubjects: 0,
    totalExams: 0,
    totalAnswerSheets: 0,
    pendingEvaluations: 0,
    completedEvaluations: 0,
    discrepancyFlags: 0,
    averageClassMarks: '0'
  };

  const distributionData = dashboardData?.chartData?.markDistribution || [
    { label: '<40%', amt: 0, color: 'bg-red-500' },
    { label: '40-60%', amt: 0, color: 'bg-amber-500' },
    { label: '60-80%', amt: 0, color: 'bg-primary' },
    { label: '80-100%', amt: 0, color: 'bg-green-600' }
  ];

  const hasChartData = distributionData.some((d: any) => d.amt > 0);

  const filteredPending = (dashboardData?.recentSubmissions || []).filter(
    (s: any) => !selectedSubId || s.subject?._id === selectedSubId || s.subject === selectedSubId
  );

  const formatActivityTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in pb-12">
      {/* Intro & filter header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-on-surface font-display">
            Welcome back, {user?.name || 'Evaluator'}
          </h2>
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

      {errorRec && (
        <div className="p-4 bg-error-container/30 border border-error/20 text-error rounded-xl text-xs font-semibold">
          {errorRec}
        </div>
      )}

      {/* Bento Grid Analytics (5 slots) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between bg-white dark:bg-surface-container">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Subjects</span>
            <h3 className="text-3xl font-black text-primary mt-2 font-display">{stats.totalSubjects}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Assigned to your profile.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between bg-white dark:bg-surface-container">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Exams</span>
            <h3 className="text-3xl font-black text-secondary mt-2 font-display">{stats.totalExams}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Active and draft evaluations.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between bg-white dark:bg-surface-container">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Answer Sheets</span>
            <h3 className="text-3xl font-black text-green-700 mt-2 font-display">{stats.totalAnswerSheets}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Total students upload items.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between bg-white dark:bg-surface-container">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Pending Evaluations</span>
            <h3 className="text-3xl font-black text-orange-600 mt-2 font-display">{stats.pendingEvaluations}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Verification queues pending.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between bg-white dark:bg-surface-container">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Average Class marks</span>
            <h3 className="text-3xl font-black text-purple-700 mt-2 font-display">{stats.averageClassMarks}%</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Across published exams.</p>
        </div>
      </div>

      {/* Distribution charts rendering block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Class distribution metrics bars representative */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border-outline-variant/30 bg-white dark:bg-surface-container">
          <h3 className="text-base font-bold text-on-surface mb-6 flex items-center gap-2 font-display">
            <span className="material-symbols-outlined text-primary text-xl">analytics</span> Mark Distribution Ranges
          </h3>
          
          {!hasChartData ? (
            <div className="h-44 flex flex-col items-center justify-center text-xs text-outline gap-2">
              <span className="material-symbols-outlined text-3xl text-outline/50">bar_chart</span>
              No data available yet
            </div>
          ) : (
            <div className="h-44 flex items-end justify-between px-6 pb-2">
              {distributionData.map((d: any) => {
                // Find maximum amount to render scale height
                const maxVal = Math.max(...distributionData.map((x: any) => x.amt), 1);
                const heightPct = (d.amt / maxVal) * 80 + 5; // offset slightly for appearance
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
          )}
        </div>

        {/* Action Panel and Logs split */}
        <div className="flex flex-col gap-4">
          
          {/* Recent Activity Log */}
          <div className="glass-card p-5 rounded-2xl border-outline-variant/30 text-left bg-white dark:bg-surface-container flex flex-col gap-4 flex-grow max-h-[170px] overflow-y-auto custom-scrollbar">
            <h4 className="font-bold text-xs text-on-surface flex items-center gap-1.5 font-display uppercase tracking-wider">
              <span className="material-symbols-outlined text-[16px] text-primary">history</span> Recent Activity
            </h4>
            
            {!dashboardData?.recentActivity || dashboardData.recentActivity.length === 0 ? (
              <p className="text-[11px] text-outline italic py-4 text-center">No recent activity</p>
            ) : (
              <div className="flex flex-col gap-3">
                {dashboardData.recentActivity.map((act: any, idx: number) => (
                  <div key={idx} className="flex gap-2.5 text-[11px] items-start border-l-2 border-primary/20 pl-2">
                    <div className="flex-grow">
                      <p className="text-on-surface font-semibold leading-tight">{act.message}</p>
                      <span className="text-[9px] text-outline mt-0.5 block">{formatActivityTime(act.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <Link 
              to="/faculty/model-answers" 
              className="flex-1 py-3 bg-primary/10 text-primary border border-primary/20 font-black text-[10px] text-center rounded-xl hover:bg-primary/20 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1 uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-sm">draw</span> Configure Schema
            </Link>
            
            <Link 
              to="/faculty/evaluation-queue" 
              className="flex-1 py-3 bg-secondary text-on-secondary font-black text-[10px] text-center rounded-xl hover:shadow-md transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1 uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-sm">pipeline</span> Queue Simulator
            </Link>
          </div>
        </div>
      </div>

      {/* Pending Evaluations list table */}
      <div className="glass-card rounded-2xl border-outline-variant/30 overflow-hidden shadow-sm bg-white dark:bg-surface-container">
        <div className="px-6 py-4 border-b border-outline-variant/30 bg-surface-container-low flex justify-between items-center">
          <h3 className="font-bold text-sm">Actionable Review Queue</h3>
          <Link to="/faculty/evaluation-queue" className="text-xs text-primary font-bold hover:underline">
            All pending Submissions ({stats.pendingEvaluations})
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
                  <th className="px-6 py-3">Subject ID</th>
                  <th className="px-6 py-3">Submission status</th>
                  <th className="px-6 py-3 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-xs text-on-surface-variant">
                {filteredPending.map((s: any) => (
                  <tr key={s._id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-on-surface block">{s.student?.name}</span>
                      <span className="text-[10px] text-outline mt-0.5">{s.uploadedFileName || 'Scanned file'}</span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-on-surface">{s.subject?.code || s.subject || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${s.submissionStatus === 'Faculty Review' ? 'bg-orange-500' : 'bg-green-500'}`} />
                        <span className="font-semibold text-on-surface">{s.submissionStatus}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/faculty/pending/${s._id}`} 
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
