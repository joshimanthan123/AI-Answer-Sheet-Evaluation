import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/admin.service';
import { SystemLog } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getSystemLogs().then(data => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  const filteredLogs = logs.filter(
    l => l.message.toLowerCase().includes(search.toLowerCase()) || 
         l.level.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">System Integrity Logs</h2>
        <p className="text-sm text-on-surface-variant mt-1 font-semibold">Audit security events, login locations records, and grading tasks runs.</p>
      </div>

      <div className="relative max-w-sm w-full">
        <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg select-none">search</span>
        <input 
          type="text" 
          placeholder="Filter messages or levels..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm bg-white dark:bg-surface-container">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse font-mono text-[11px] text-on-surface-variant">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant font-sans font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Priority Level</th>
                <th className="px-6 py-4">Audit Action Message</th>
                <th className="px-6 py-4 text-right">Request IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-primary/5 transition-colors">
                  <td className="px-6 py-4 text-outline">{log.timestamp}</td>
                  <td className="px-6 py-4 font-bold">
                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black ${
                      log.level === 'error' ? 'bg-red-100 text-red-700' :
                      log.level === 'warning' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {log.level.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-on-surface leading-relaxed">{log.message}</td>
                  <td className="px-6 py-4 text-right text-outline">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminLogs;
