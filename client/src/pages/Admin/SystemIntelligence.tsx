import React, { useState, useEffect } from 'react';
import analyticsService from '../../services/analytics.service';
import advancedAnalyticsService, {
  AdminOverview,
  AuditLogItem,
  SystemAlertConfigData,
  SystemAlertsResponse,
  SystemMonitoringMetrics,
} from '../../services/advancedAnalytics.service';

export const SystemIntelligence: React.FC = () => {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [metrics, setMetrics] = useState<SystemMonitoringMetrics | null>(null);
  const [alertsData, setAlertsData] = useState<SystemAlertsResponse | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [userQuery, setUserQuery] = useState<string>('');
  const [actionQuery, setActionQuery] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Threshold Config Modal
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [configForm, setConfigForm] = useState<SystemAlertConfigData>({
    ocrFailureRateThreshold: 10,
    evaluationFailureRateThreshold: 5,
    pendingEvaluationCountThreshold: 20,
    highOverrideRateThreshold: 25,
  });

  // UI State
  const [loading, setLoading] = useState<boolean>(true);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [adminExams, setAdminExams] = useState<any[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [page, userQuery, actionQuery, searchQuery]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [overRes, sysRes, alertRes, examsRes] = await Promise.all([
        advancedAnalyticsService.getAdminOverview(),
        advancedAnalyticsService.getSystemMonitoringMetrics(),
        advancedAnalyticsService.getSystemAlerts(),
        analyticsService.getAdminExamsAnalytics(),
      ]);
      setOverview(overRes);
      setMetrics(sysRes);
      setAlertsData(alertRes);
      setAdminExams(examsRes || []);
      if (alertRes?.config) {
        setConfigForm(alertRes.config);
      }
    } catch (err: any) {
      console.error('Failed to load system intelligence data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await advancedAnalyticsService.getAuditLogs({
        page,
        limit: 15,
        user: userQuery || undefined,
        action: actionQuery || undefined,
        search: searchQuery || undefined,
      });
      setAuditLogs(res.logs || []);
      setTotalLogs(res.total || 0);
      setTotalPages(res.pages || 1);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
    }
  };

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      setMessage(null);
      const updated = await advancedAnalyticsService.updateAlertConfig(configForm);
      setConfigForm(updated);
      setShowConfigModal(false);
      setMessage({ type: 'success', text: 'System alert configuration updated successfully.' });
      fetchInitialData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to update alert configuration.' });
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn text-left">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/30 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-on-surface font-display">System Intelligence & Security Audit</h1>
            <span className="text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Admin Portal
            </span>
          </div>
          <p className="text-xs text-outline mt-1 font-medium">
            System overview, infrastructure health, immutable security audit logs, and alert threshold configurations.
          </p>
        </div>

        <button
          onClick={() => setShowConfigModal(true)}
          className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm hover:bg-primary/90 transition-all cursor-pointer active:scale-95 self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-sm">tune</span>
          <span>Configure Alert Thresholds</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-error/10 border-error/20 text-error'
          }`}
        >
          <span className="material-symbols-outlined text-sm">
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{message.text}</span>
        </div>
      )}

      {/* SECTION 1: System Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs">
          <p className="text-[10px] uppercase font-bold text-outline">Total Users</p>
          <p className="text-2xl font-black text-on-surface mt-1">{overview?.users?.total || 0}</p>
          <p className="text-[11px] text-outline mt-0.5">
            Students: {overview?.users?.students || 0} | Faculty: {overview?.users?.faculty || 0}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs">
          <p className="text-[10px] uppercase font-bold text-outline">Exams Created</p>
          <p className="text-2xl font-black text-primary mt-1">{overview?.exams?.total || 0}</p>
        </div>

        <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs">
          <p className="text-[10px] uppercase font-bold text-outline">Answer Sheets</p>
          <p className="text-2xl font-black text-on-surface mt-1">{overview?.submissions?.total || 0}</p>
        </div>

        <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs">
          <p className="text-[10px] uppercase font-bold text-outline">Evaluations Run</p>
          <p className="text-2xl font-black text-purple-600 mt-1">{overview?.evaluations?.total || 0}</p>
          <p className="text-[11px] text-emerald-600 font-bold mt-0.5">Finalized: {overview?.evaluations?.finalized || 0}</p>
        </div>

        <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs">
          <p className="text-[10px] uppercase font-bold text-outline">Faculty Feedback</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{overview?.feedback?.total || 0}</p>
        </div>

        <div className="p-4 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xs">
          <p className="text-[10px] uppercase font-bold text-outline">Improvement Proposals</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{overview?.improvementSuggestions?.total || 0}</p>
        </div>
      </div>

      {/* SECTION 2: System Health & Monitoring Indicators */}
      <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs space-y-6">
        <div>
          <h3 className="text-base font-extrabold text-on-surface">System Monitoring & Operational Metrics</h3>
          <p className="text-xs text-outline">Real-time health status of microservices, database, and background processing</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-surface-container-low border border-outline-variant/20 rounded-xl">
            <p className="text-[10px] font-bold text-outline uppercase">Backend API Status</p>
            <p className="text-base font-black text-emerald-600 mt-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              {metrics?.health?.backendApi || 'Healthy'}
            </p>
            <p className="text-[10px] text-outline mt-1">Uptime: {metrics?.health?.uptimeSeconds || 0} seconds</p>
          </div>

          <div className="p-4 bg-surface-container-low border border-outline-variant/20 rounded-xl">
            <p className="text-[10px] font-bold text-outline uppercase">MongoDB State</p>
            <p className="text-base font-black text-emerald-600 mt-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              {metrics?.health?.database || 'Connected'}
            </p>
          </div>

          <div className="p-4 bg-surface-container-low border border-outline-variant/20 rounded-xl">
            <p className="text-[10px] font-bold text-outline uppercase">OCR Service</p>
            <p className="text-base font-black text-emerald-600 mt-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              {metrics?.health?.ocrService || 'Operational'}
            </p>
            <p className="text-[10px] text-outline mt-1">Requests: {metrics?.ocrMetrics?.totalRequests || 0}</p>
          </div>

          <div className="p-4 bg-surface-container-low border border-outline-variant/20 rounded-xl">
            <p className="text-[10px] font-bold text-outline uppercase">AI Evaluation Engine</p>
            <p className="text-base font-black text-emerald-600 mt-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              {metrics?.health?.aiEvaluation || 'Operational'}
            </p>
            <p className="text-[10px] text-outline mt-1">Processed: {metrics?.aiMetrics?.processed || 0}</p>
          </div>
        </div>
      </div>

      {/* SECTION 2B: System-Wide Exam Performance Comparison */}
      <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">bar_chart</span>
            Exam-Level Comparative Performance Analytics
          </h3>
          <p className="text-xs text-outline">Real-time aggregate performance metrics across all course examinations</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 text-outline uppercase font-bold text-[10px] bg-surface-container-low/50">
                <th className="py-3 px-4">Exam Title</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4 text-center">Evaluated</th>
                <th className="py-3 px-4 text-right">Avg Score</th>
                <th className="py-3 px-4 text-right">Avg %</th>
                <th className="py-3 px-4 text-right">Highest</th>
                <th className="py-3 px-4 text-right">Lowest</th>
                <th className="py-3 px-4 text-center">Pass Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 font-medium">
              {adminExams.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-outline text-xs">
                    No evaluated exam analytics available.
                  </td>
                </tr>
              ) : (
                adminExams.map((ex) => (
                  <tr key={ex.examId} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-on-surface">{ex.title}</td>
                    <td className="py-3 px-4 text-outline">
                      {ex.subjectCode} — {ex.subjectName}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-primary">{ex.totalEvaluated}</td>
                    <td className="py-3 px-4 text-right font-bold text-on-surface">
                      {ex.averageMarks} / {ex.totalMarks}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-secondary">{ex.averagePercentage}%</td>
                    <td className="py-3 px-4 text-right text-green-600 font-bold">{ex.highestMarks}</td>
                    <td className="py-3 px-4 text-right text-amber-600 font-bold">{ex.lowestMarks}</td>
                    <td className="py-3 px-4 text-center">
                      {ex.passRate !== null ? (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            ex.passRate >= 70
                              ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {ex.passRate}% ({ex.passCount}/{ex.totalEvaluated})
                        </span>
                      ) : (
                        <span className="text-outline text-[10px]">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: Searchable Security & Action Audit Logs */}
      <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-on-surface">Immutable System Audit Logs</h3>
            <p className="text-xs text-outline">Search and filter system action audit trails for compliance and security</p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search user..."
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs bg-surface-container-low border border-outline-variant/40 rounded-xl focus:outline-none focus:border-primary text-on-surface w-36"
            />

            <input
              type="text"
              placeholder="Filter action (e.g. REVIEW)..."
              value={actionQuery}
              onChange={(e) => {
                setActionQuery(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs bg-surface-container-low border border-outline-variant/40 rounded-xl focus:outline-none focus:border-primary text-on-surface w-44"
            />

            <input
              type="text"
              placeholder="Search details..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs bg-surface-container-low border border-outline-variant/40 rounded-xl focus:outline-none focus:border-primary text-on-surface w-44"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 text-outline uppercase font-bold text-[10px] bg-surface-container-low/50">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 font-medium">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-outline text-xs">
                    No system audit logs match the query criteria.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3 px-4 text-outline font-medium whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-on-surface">{log.userName || 'System'}</p>
                      <span className="text-[10px] text-outline uppercase">{log.userRole}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-primary">{log.action}</td>
                    <td className="py-3 px-4 text-outline">{log.entityType}</td>
                    <td className="py-3 px-4 text-on-surface max-w-sm truncate" title={log.details}>
                      {log.details || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20 text-xs">
            <span className="text-outline">
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalLogs} logs)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 bg-surface-container-low border border-outline-variant/40 rounded-xl disabled:opacity-50 hover:bg-surface-container-high cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 bg-surface-container-low border border-outline-variant/40 rounded-xl disabled:opacity-50 hover:bg-surface-container-high cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Threshold Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 max-w-md w-full shadow-2xl text-left space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 className="font-extrabold text-base text-on-surface">Configure System Alert Thresholds</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-outline hover:text-on-surface text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-outline mb-1">OCR Failure Rate Threshold (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={configForm.ocrFailureRateThreshold}
                  onChange={(e) => setConfigForm({ ...configForm, ocrFailureRateThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-surface-container-low border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-primary font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-outline mb-1">AI Evaluation Failure Rate Threshold (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={configForm.evaluationFailureRateThreshold}
                  onChange={(e) => setConfigForm({ ...configForm, evaluationFailureRateThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-surface-container-low border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-primary font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-outline mb-1">Pending Evaluation Count Backlog Threshold</label>
                <input
                  type="number"
                  min="0"
                  value={configForm.pendingEvaluationCountThreshold}
                  onChange={(e) => setConfigForm({ ...configForm, pendingEvaluationCountThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-surface-container-low border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-primary font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-outline mb-1">High Faculty Override Rate Threshold (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={configForm.highOverrideRateThreshold}
                  onChange={(e) => setConfigForm({ ...configForm, highOverrideRateThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-surface-container-low border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-primary font-bold"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 bg-surface-container-high text-outline hover:text-on-surface rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs hover:bg-primary/90 transition-all cursor-pointer"
                >
                  {savingConfig ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemIntelligence;
