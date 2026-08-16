import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { studentService } from '../../services/student.service';

interface Exam {
  id: string;
  title: string;
  subject: string;
  subjectCode: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalMarks: number;
  status: 'upcoming' | 'active' | 'in_progress' | 'submitted' | 'processing' | 'reviewed' | 'published' | 'expired';
  submissionStatus: 'not_started' | 'in_progress' | 'submitted';
  canEnter: boolean;
  reason?: string | null;
}

export const MyExams: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [timeNow, setTimeNow] = useState(new Date());

  // Countdown timer refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const qStatus = activeTab === 'all' ? '' : activeTab;
      const res = await studentService.getExams({
        status: qStatus,
        search: searchQuery,
        page,
        limit: 9,
      });

      if (res && res.success) {
        setExams(res.exams || []);
        if (res.pagination) {
          setPage(res.pagination.page || 1);
          setTotalPages(res.pagination.totalPages || 1);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || 'Unable to load exams. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [activeTab, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchExams();
  };

  const getCountdownString = (startTimeStr: string) => {
    const start = new Date(startTimeStr);
    const diffMs = start.getTime() - timeNow.getTime();
    if (diffMs <= 0) return 'Starts now';

    const secs = Math.floor(diffMs / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `Starts in ${days} ${days === 1 ? 'day' : 'days'}`;
    }

    const hh = String(hours % 24).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return `Starts in ${hh}:${mm}:${ss}`;
  };

  // Custom visual components for Status Badges
  const renderStatusBadge = (status: Exam['status']) => {
    let colorClasses = 'bg-outline-variant/30 text-outline';
    let label = status.toUpperCase();

    switch (status) {
      case 'active':
        colorClasses = 'bg-red-500 text-white animate-pulse';
        label = 'LIVE / ACTIVE';
        break;
      case 'in_progress':
        colorClasses = 'bg-amber-500 text-on-surface font-black';
        label = 'IN PROGRESS';
        break;
      case 'upcoming':
        colorClasses = 'bg-primary/20 text-primary';
        label = 'UPCOMING';
        break;
      case 'submitted':
        colorClasses = 'bg-green-600 text-white';
        label = 'SUBMITTED';
        break;
      case 'processing':
        colorClasses = 'bg-cyan-600 text-white animate-pulse';
        label = 'AI EVALUATION';
        break;
      case 'reviewed':
        colorClasses = 'bg-indigo-600 text-white';
        label = 'UNDER REVIEW';
        break;
      case 'published':
        colorClasses = 'bg-green-800 text-white';
        label = 'PUBLISHED';
        break;
      case 'expired':
        colorClasses = 'bg-outline-variant/50 text-outline';
        label = 'CLOSED';
        break;
    }

    return (
      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full tracking-wide ${colorClasses}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in relative min-h-[500px]">
      {/* Intro Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-on-surface font-display">My Examinations</h2>
          <p className="text-sm text-on-surface-variant mt-1">View assigned subjects, start eligible exams, and verify submitted paper results.</p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search subject / title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-outline-variant/30 rounded-xl bg-surface-container-low text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary w-48 sm:w-64"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:shadow-md active:scale-95 transition-all"
          >
            Search
          </button>
        </form>
      </div>

      {/* Tabs list filter */}
      <div className="flex flex-wrap border-b border-outline-variant/20 gap-2 mb-2">
        {[
          { id: 'all', label: 'All Exams' },
          { id: 'active', label: 'Active / Live' },
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'in_progress', label: 'In Progress' },
          { id: 'submitted', label: 'Submitted / Grading' },
          { id: 'published', label: 'Published' },
          { id: 'expired', label: 'Expired' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
            className={`px-4 py-2.5 text-xs font-black transition-all border-b-2 -mb-[2px] ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-outline hover:text-on-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Primary body */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card p-6 h-60 rounded-2xl bg-outline-variant/10 border border-outline-variant/5"></div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <span className="material-symbols-outlined text-red-500 text-5xl">report</span>
          <h3 className="text-lg font-bold text-on-surface">Unable to load exams</h3>
          <p className="text-xs text-on-surface-variant max-w-md">{error}</p>
          <button
            onClick={fetchExams}
            className="px-6 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:shadow-md transition-all mt-2 active:scale-95"
          >
            Retry
          </button>
        </div>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-outline-variant/10 rounded-3xl bg-surface-container-low max-w-4xl mx-auto w-full">
          <span className="material-symbols-outlined text-outline text-5xl">assignment_late</span>
          <h3 className="text-base font-bold text-on-surface mt-4">
            {activeTab === 'all' ? 'No exams available' : 
             activeTab === 'upcoming' ? 'No upcoming exams scheduled' :
             activeTab === 'active' ? 'No active exams right now' :
             activeTab === 'in_progress' ? 'No in-progress drafts found' :
             'No exams matching this category'}
          </h3>
          <p className="text-xs text-outline mt-1 max-w-sm">
            Contact your department administration or faculty head if you believe you should have subject access here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => {
              const start = new Date(exam.startTime);
              const formattedDate = start.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
              const formattedTime = `${start.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
              })} - ${new Date(exam.endTime).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
              })}`;

              return (
                <div
                  key={exam.id}
                  className={`glass-card p-6 rounded-2xl border flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-md ${
                    exam.status === 'active' || exam.status === 'in_progress'
                      ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/10'
                      : 'border-outline-variant/20 bg-surface-container-lowest'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4 gap-2">
                      <span className="text-[10px] bg-outline-variant/30 text-outline font-black px-2 py-0.5 rounded-full uppercase tracking-wider truncate max-w-[120px]">
                        {exam.subjectCode || 'SUBJECT'}
                      </span>
                      {renderStatusBadge(exam.status)}
                    </div>
                    
                    <h3 className="font-bold text-sm text-on-surface line-clamp-2" title={exam.title}>{exam.title}</h3>
                    <p className="text-xs text-on-surface-variant mt-1 truncate">{exam.subject}</p>

                    <div className="flex flex-col gap-2 mt-4 text-[11px] text-on-surface-variant">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-xs">calendar_today</span>
                        <span>{formattedDate} • {formattedTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-xs">schedule</span>
                        <span>{exam.duration} Minutes Duration</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-xs font-bold text-primary">grade</span>
                        <span>{exam.totalMarks} Total Marks</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-2">
                    {/* Render action button depending on state */}
                    {exam.status === 'upcoming' && (
                      <div className="flex flex-col gap-1.5 w-full">
                        <div className="text-[10px] font-semibold text-primary text-center">
                          {getCountdownString(exam.startTime)}
                        </div>
                        <button
                          onClick={() => setSelectedExam(exam)}
                          className="w-full py-2 bg-outline-variant/20 hover:bg-outline-variant/30 text-outline rounded-xl text-xs font-bold text-center transition-all"
                        >
                          View Details
                        </button>
                      </div>
                    )}

                    {exam.status === 'active' && (
                      <Link
                        to={`/student/exams/${exam.id}/instructions`}
                        className="w-full py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold text-center hover:shadow-md transition-all active:scale-95 cursor-pointer"
                      >
                        Enter Exam
                      </Link>
                    )}

                    {exam.status === 'in_progress' && (
                      <Link
                        to={`/student/exams/${exam.id}/workspace`}
                        className="w-full py-2.5 bg-amber-500 text-on-surface rounded-xl text-xs font-black text-center hover:shadow-md transition-all active:scale-95 cursor-pointer"
                      >
                        Continue Exam
                      </Link>
                    )}

                    {(exam.status === 'submitted' || exam.status === 'processing' || exam.status === 'reviewed') && (
                      <div className="flex gap-2 w-full font-sans">
                        <Link
                          to={`/student/exams/${exam.id}/submission-status`}
                          className="flex-grow py-2.5 bg-primary/10 hover:bg-primary/15 text-primary rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs animate-spin-slow">sync</span>
                          Track Progress
                        </Link>
                        <Link
                          to={`/student/evaluations/${exam.id}`}
                          className="px-3 py-2.5 border border-outline-variant/30 hover:bg-outline-variant/10 rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center cursor-pointer"
                          title="View Digital Slate"
                        >
                          <span className="material-symbols-outlined text-xs">draw</span>
                        </Link>
                      </div>
                    )}

                    {exam.status === 'published' && (
                      <div className="flex gap-2 w-full font-sans">
                        <Link
                          to={`/student/exams/${exam.id}/result`}
                          className="flex-grow py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">verified</span>
                          View Result
                        </Link>
                        <Link
                          to={`/student/evaluations/${exam.id}`}
                          className="px-3 py-2.5 border border-outline-variant/30 hover:bg-outline-variant/10 rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center cursor-pointer"
                          title="View Digital Slate"
                        >
                          <span className="material-symbols-outlined text-xs">draw</span>
                        </Link>
                      </div>
                    )}

                    {exam.status === 'expired' && (
                      <button
                        disabled
                        className="w-full py-2 bg-outline-variant/10 text-outline-variant rounded-xl text-xs font-bold text-center cursor-not-allowed border border-outline-variant/5"
                      >
                        Exam Closed
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Simple Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 border border-outline-variant/30 rounded-lg text-xs font-bold hover:bg-surface-container-low disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="text-xs text-outline font-semibold">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 border border-outline-variant/30 rounded-lg text-xs font-bold hover:bg-surface-container-low disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Details Dialog Modal */}
      {selectedExam && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-card max-w-lg w-full rounded-3xl p-6 bg-surface-container-lowest border border-outline-variant/20 shadow-2xl flex flex-col gap-4 text-left animate-zoom-in">
            <div className="flex items-start justify-between border-b border-outline-variant/20 pb-3">
              <div>
                <span className="text-[10px] bg-primary/10 text-primary font-black px-2 py-0.5 rounded-full uppercase">
                  {selectedExam.subjectCode}
                </span>
                <h3 className="font-bold text-base text-on-surface mt-1">{selectedExam.title}</h3>
              </div>
              <button
                onClick={() => setSelectedExam(null)}
                className="w-8 h-8 rounded-full border border-outline-variant/20 flex items-center justify-center hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs text-on-surface-variant">
              <div>
                <span className="font-semibold text-outline tracking-wide text-[10px] uppercase">Subject Description</span>
                <p className="mt-1 font-normal leading-relaxed">{selectedExam.subject} examination session.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 mt-2">
                <div>
                  <span className="text-[9px] text-outline font-bold uppercase">Date & Duration</span>
                  <p className="font-bold text-on-surface mt-0.5 text-[11px]">
                    {new Date(selectedExam.startTime).toLocaleDateString()} ({selectedExam.duration} min)
                  </p>
                </div>
                <div>
                  <span className="text-[9px] text-outline font-bold uppercase">Timer Windows</span>
                  <p className="font-bold text-on-surface mt-0.5 text-[11px]">
                    {new Date(selectedExam.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(selectedExam.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>

              <div className="mt-2 text-[10px] text-outline p-3 border border-primary/20 rounded-xl bg-primary/5 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5">info</span>
                <div>
                  <p className="font-semibold text-primary">Instructions</p>
                  <p className="text-[9px] mt-0.5 leading-normal">
                    This is a digital exam that requires stylus input. Make sure your iPad or digital drawing screen is connected and authenticated before entering.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedExam(null)}
              className="mt-4 w-full py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold text-center hover:shadow-md transition-all active:scale-95"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyExams;
