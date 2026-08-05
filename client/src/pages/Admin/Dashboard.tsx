import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/admin.service';
import { SystemLog, User } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usrList, logList] = await Promise.all([
          adminService.getUsers(),
          adminService.getSystemLogs()
        ]);
        setUsers(usrList);
        setLogs(logList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  const facultyCount = users.filter(u => u.role === 'faculty').length;
  const studentCount = users.filter(u => u.role === 'student').length;

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in">
      {/* Intro Header */}
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Administrative Console</h2>
        <p className="text-sm text-on-surface-variant mt-1">Configure student stylus coordinate splines HWR, verify database health, and adjust AI models.</p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Active Users</span>
            <h3 className="text-3xl font-black text-primary mt-2 font-display">{users.length}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">{studentCount} Students / {facultyCount} Faculty</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">AI Grading Engine</span>
            <h3 className="text-3xl font-black text-green-700 mt-2 font-display flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-green-500 animate-pulse" /> Active
            </h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">API Latency: 240ms</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">HWR Spline Buffer Queue</span>
            <h3 className="text-3xl font-black text-secondary mt-2 font-display">Normal</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Average queue time: ~4s</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">System Errors logged</span>
            <h3 className="text-3xl font-black text-on-surface mt-2 font-display">0</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">SLA uptime: 99.98%</p>
        </div>
      </div>

      {/* Main split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Logs preview */}
        <div className="lg:col-span-2 glass-card rounded-2xl border-outline-variant/30 overflow-hidden bg-white dark:bg-surface-container">
          <div className="px-6 py-4 border-b border-outline-variant/30 bg-surface-container-low flex justify-between items-center select-none">
            <h3 className="font-bold text-sm">Real-time Activity Logs</h3>
            <Link to="/admin/logs" className="text-xs text-primary font-bold hover:underline">
              System Audit Trails
            </Link>
          </div>
          <div className="p-4 space-y-3 font-mono text-[10px] text-on-surface-variant max-h-64 overflow-y-auto custom-scrollbar text-left divide-y divide-outline-variant/10">
            {logs.slice(0, 5).map(log => (
              <div key={log.id} className="pt-2 flex justify-between gap-4">
                <div>
                  <span className="text-outline">[{log.timestamp}]</span>{' '}
                  <span className={`font-bold ${log.level === 'error' ? 'text-error' : log.level === 'warning' ? 'text-amber-600' : 'text-primary'}`}>
                    {log.level.toUpperCase()}
                  </span>{' '}
                  <span>{log.message}</span>
                </div>
                <span className="text-[9px] text-outline italic truncate">{log.ipAddress}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI threshold configurator card link */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between border-outline-variant/30 text-left bg-secondary/5 border border-secondary/10">
          <div>
            <span className="material-symbols-outlined text-secondary text-4xl mb-4">settings_suggest</span>
            <h4 className="font-bold text-sm text-on-surface">HWR & AI Config Thresholds</h4>
            <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
              Alter margins, keyword weighting values, and NLP verification bounds.
            </p>
          </div>
          <Link 
            to="/admin/ai-config" 
            className="w-full py-2.5 bg-secondary text-white font-bold text-xs text-center rounded-xl hover:bg-secondary/95 transition-all shadow-sm block active:scale-95 mt-6"
          >
            Configure Thresholds
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
