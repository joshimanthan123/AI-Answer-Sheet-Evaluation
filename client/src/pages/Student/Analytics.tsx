import React from 'react';

export const Analytics: React.FC = () => {
  const semesters = [
    { sem: 'Semester 1', gradePoint: 8.2, percentage: 78 },
    { sem: 'Semester 2', gradePoint: 8.5, percentage: 81 },
    { sem: 'Semester 3', gradePoint: 8.6, percentage: 82 },
    { sem: 'Semester 4', gradePoint: 8.9, percentage: 85 },
    { sem: 'Semester 5 (Current)', gradePoint: 9.2, percentage: 88 }
  ];

  const subjects = [
    { name: 'Data Structures and Algorithms', code: 'CS-101', avg: 85, cohortAvg: 74 },
    { name: 'Advanced Machine Learning', code: 'CS-402-AI', avg: 78, cohortAvg: 70 },
    { name: 'Ethics and Safety in AI Systems', code: 'CS-302', avg: 64, cohortAvg: 68 },
    { name: 'Advanced Mathematics II', code: 'MA-201', avg: 82, cohortAvg: 75 }
  ];

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Performance Analytics</h2>
        <p className="text-sm text-on-surface-variant mt-1">Review historical academic grades and comparative cohort metrics.</p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Overall GPA Point</span>
            <h3 className="text-3xl font-black text-primary mt-2 font-display">8.68 / 10</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Weighted average across five terms.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Average Exams Score</span>
            <h3 className="text-3xl font-black text-secondary mt-2 font-display">82.3%</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Above cohort standard (74.2%).</p>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Graded Questions</span>
            <h3 className="text-3xl font-black text-green-700 mt-2 font-display">24 Responses</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-4">Annotated and approved by faculty.</p>
        </div>
      </div>

      {/* Grid containing Semester performance and Subject analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Semester-wise chart bar progress */}
        <div className="glass-card p-6 rounded-2xl border border border-outline-variant/20">
          <h3 className="text-sm font-bold text-on-surface mb-6 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary">trending_up</span> Semester Progress Trend
          </h3>
          <div className="space-y-4">
            {semesters.map((s, idx) => (
              <div key={idx} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs font-semibold text-on-surface">
                  <span>{s.sem}</span>
                  <span>{s.gradePoint} GPA ({s.percentage}%)</span>
                </div>
                <div className="w-full bg-outline-variant/10 rounded-full h-3">
                  <div 
                    className="bg-primary h-3 rounded-full transition-all duration-1000"
                    style={{ width: `${s.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subject-Wise relative metrics */}
        <div className="glass-card p-6 rounded-2xl border border border-outline-variant/20">
          <h3 className="text-sm font-bold text-on-surface mb-6 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary">bar_chart</span> Subject-wise Performance vs Cohort
          </h3>
          <div className="space-y-4">
            {subjects.map((sub, idx) => {
              return (
                <div key={idx} className="p-3 bg-surface-container rounded-xl border border-outline-variant/10">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-on-surface truncate pr-2 max-w-[200px]">{sub.name}</h4>
                      <p className="text-[10px] text-outline mt-0.5">{sub.code}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-primary">{sub.avg}% Score</span>
                      <p className="text-[9px] text-outline mt-0.5">Class Average: {sub.cohortAvg}%</p>
                    </div>
                  </div>
                  {/* Small double slider bars */}
                  <div className="mt-3 flex flex-col gap-1">
                    <div className="w-full bg-outline-variant/10 rounded-full h-1.5 relative">
                      <div 
                        className="bg-primary h-1.5 rounded-full absolute left-0 top-0"
                        style={{ width: `${sub.avg}%` }}
                      />
                    </div>
                    <div className="w-full bg-outline-variant/10 rounded-full h-1 relative">
                      <div 
                        className="bg-secondary/40 h-1 rounded-full absolute left-0 top-0"
                        style={{ width: `${sub.cohortAvg}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
