import React from 'react';

export const FacultyReports: React.FC = () => {
  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Performance analytics</h2>
        <p className="text-sm text-on-surface-variant mt-1">Review average class metrics, passing thresholds, and concepts heatmaps.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 text-left bg-white dark:bg-surface-container">
          <h3 className="font-bold text-sm text-on-surface">Subject-wise Average Marks</h3>
          <div className="h-64 flex items-end justify-around gap-6 mt-6 pb-2">
            {[
              { code: 'CS101', name: 'Data Structures', val: 78, color: 'bg-primary' },
              { code: 'MA102', name: 'Advanced Math', val: 62, color: 'bg-secondary' },
              { code: 'HU201', name: 'AI Ethics', val: 84, color: 'bg-success' }
            ].map(s => (
              <div key={s.code} className="flex flex-col items-center gap-2 flex-grow text-center">
                <div className="w-16 bg-outline-variant/15 rounded-t-lg h-44 relative">
                  <div className={`absolute bottom-0 w-full rounded-t-lg ${s.color} transition-all duration-1000`} style={{ height: `${s.val}%` }} />
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface">{s.val}%</span>
                </div>
                <span className="text-xs font-bold text-on-surface mt-1">{s.code}</span>
                <span className="text-[9px] text-outline font-medium truncate w-full">{s.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 text-left bg-white dark:bg-surface-container">
          <h3 className="font-bold text-sm text-on-surface">Concept Strength Heatmap</h3>
          <p className="text-xs text-outline mt-1 mb-6">AI-transcribed concepts matching matching models.</p>
          <div className="space-y-4">
            {[
              { label: 'Time Complexity Analysing', level: 'high', val: 88, color: 'bg-green-600' },
              { label: 'Red-Black Self Balancing properties', level: 'medium', val: 56, color: 'bg-amber-600' },
              { label: 'Adjacency list node structures', level: 'high', val: 92, color: 'bg-green-600' },
              { label: 'Graph traversal heuristics', level: 'low', val: 32, color: 'bg-rose-600' }
            ].map((c) => (
              <div key={c.label} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-on-surface">{c.label}</span>
                  <span className="text-outline">{c.val}% Average</span>
                </div>
                <div className="w-full h-2 bg-outline-variant/20 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.val}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacultyReports;
