import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { examService, Exam } from '../../services/exam.service';
import { subjectService } from '../../services/subject.service';
import { Subject } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const Exams: React.FC = () => {
  const { addToast } = useNotifications();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subjectIdParam = searchParams.get('subjectId');

  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubId, setSelectedSubId] = useState(subjectIdParam || '');
  const [selectedStatus, setSelectedStatus] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [examsList, subjectsList] = await Promise.all([
        examService.getExams(),
        subjectService.getSubjects()
      ]);
      setExams(examsList);
      setSubjects(subjectsList);
    } catch (err: any) {
      console.error('Failed to load exams list:', err);
      addToast('Failed to retrieve exams list from backend.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this exam? This will remove all associated questions.')) {
      return;
    }
    try {
      await examService.deleteExam(id);
      addToast('Exam deleted successfully.', 'success');
      loadData();
    } catch (err: any) {
      console.error(err);
      addToast('Failed to delete exam.', 'error');
    }
  };

  // Filter logic
  const filteredExams = exams.filter(ex => {
    const titleMatch = ex.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       (ex.examCode && ex.examCode.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Check both object and ID format of subject reference
    const examSubjectId = typeof ex.subject === 'object' ? ex.subject._id || ex.subject.id : ex.subject;
    const subjectMatch = !selectedSubId || examSubjectId === selectedSubId;
    
    const statusMatch = !selectedStatus || ex.examStatus === selectedStatus;

    return titleMatch && subjectMatch && statusMatch;
  });

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400 border-slate-200/50';
      case 'Published': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200/50';
      case 'Active': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/50';
      case 'Completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200/50';
      default: return 'bg-slate-100 text-slate-700 border-slate-200/50';
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in max-w-7xl mx-auto py-6">
      {/* Header section with Create Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-on-surface font-display">Exam Management</h2>
          <p className="text-sm text-on-surface-variant mt-1">Design exams, input custom test criteria, and track status parameters.</p>
        </div>
        <Link 
          to="/faculty/exams/create" 
          className="px-4 py-2.5 bg-primary text-on-primary font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 hover:bg-primary/95 cursor-pointer uppercase tracking-wider"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Create New Exam
        </Link>
      </div>

      {/* Filter Row */}
      <div className="glass-card p-4 rounded-2xl border border-outline-variant/20 flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-surface-container">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">search</span>
          <input
            type="text"
            placeholder="Search by Title / Code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filters select list */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <select 
            value={selectedSubId}
            onChange={(e) => setSelectedSubId(e.target.value)}
            className="px-3 py-2 border border-outline-variant/30 rounded-xl bg-surface-container text-xs text-on-surface cursor-pointer focus:outline-none"
          >
            <option value="">All Subjects</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
            ))}
          </select>

          <select 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-outline-variant/30 rounded-xl bg-surface-container text-xs text-on-surface cursor-pointer focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

      </div>

      {/* List Container */}
      {filteredExams.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl border border-outline-variant/20 text-center bg-white dark:bg-surface-container">
          <span className="material-symbols-outlined text-outline text-4xl block mb-2 font-light">assignment</span>
          <h3 className="font-bold text-sm text-on-surface">No Exams Listed</h3>
          <p className="text-xs text-outline mt-1 max-w-sm mx-auto">There are no exams matching your search parameters or subjects. Create one to begin.</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm bg-white dark:bg-surface-container">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                  <th className="px-6 py-3.5">Exam Info</th>
                  <th className="px-6 py-3.5">Subject</th>
                  <th className="px-6 py-3.5">Schedule</th>
                  <th className="px-6 py-3.5">Parameters</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-xs text-on-surface-variant">
                {filteredExams.map((ex) => {
                  const subjectName = typeof ex.subject === 'object' ? ex.subject?.name : '';
                  const subjectCode = typeof ex.subject === 'object' ? ex.subject?.code : '';
                  
                  return (
                    <tr key={ex.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-on-surface block text-sm leading-tight">{ex.title}</span>
                        {ex.examCode && (
                          <span className="text-[10px] bg-secondary/10 text-secondary border border-secondary/20 px-1.5 py-0.5 rounded font-black mt-1 inline-block uppercase">
                            Code: {ex.examCode}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {subjectCode ? (
                          <>
                            <span className="font-bold text-on-surface block">{subjectCode}</span>
                            <span className="text-[10px] text-outline truncate block max-w-[150px]">{subjectName}</span>
                          </>
                        ) : (
                          <span className="text-outline italic">Unspecified</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-on-surface block font-semibold">
                          {new Date(ex.examDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {ex.startTime && (
                          <span className="text-[10px] text-outline block mt-0.5">{ex.startTime} - {ex.endTime || 'N/A'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-on-surface font-semibold">{ex.totalMarks} Marks / {ex.duration} Mins</span>
                          <span className="text-[10px] text-outline">Q Count: {ex.questions?.length || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border ${getStatusClass(ex.examStatus)}`}>
                          {ex.examStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link 
                            to={`/faculty/exams/${ex.id}/results`}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 transition-colors flex bg-surface-container rounded-lg border border-outline-variant/20 active:scale-90"
                            title="Results & Analytics"
                          >
                            <span className="material-symbols-outlined text-sm">analytics</span>
                          </Link>

                          <Link 
                            to={`/faculty/exams/${ex.id}`}
                            className="p-1.5 text-outline hover:text-primary transition-colors flex bg-surface-container rounded-lg border border-outline-variant/20 active:scale-90"
                            title="View details"
                          >
                            <span className="material-symbols-outlined text-sm">visibility</span>
                          </Link>

                          <Link 
                            to={`/faculty/exams/${ex.id}/edit`}
                            className="p-1.5 text-outline hover:text-secondary transition-colors flex bg-surface-container rounded-lg border border-outline-variant/20 active:scale-90"
                            title="Edit exam"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </Link>

                          <button 
                            onClick={() => handleDelete(ex.id)}
                            className="p-1.5 text-error hover:bg-error/10 transition-colors flex bg-surface-container rounded-lg border border-outline-variant/20 active:scale-90 cursor-pointer"
                            title="Delete exam"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exams;
