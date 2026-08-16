import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Subject, Course } from '../../types';
import subjectService from '../../services/subject.service';
import adminService from '../../services/admin.service';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const FacultySubjects: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Search
  const [search, setSearch] = useState('');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    semester: 1,
    credits: 4,
    courseId: '',
    description: '',
  });
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [subjectsData, coursesData] = await Promise.all([
        subjectService.getSubjects(),
        adminService.getCourses().catch(() => []),
      ]);
      setSubjects(subjectsData);
      setCourses(coursesData);
      
      // Auto-select first course in dropdown list if available
      if (coursesData.length > 0 && !formData.courseId) {
        setFormData(prev => ({ ...prev, courseId: coursesData[0].id }));
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to load subjects data from server.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'semester' || name === 'credits' ? Number(value) : value,
    }));
  };

  const showToastSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!formData.name.trim() || !formData.code.trim() || !formData.courseId) {
      setErrorMsg('Subject Name, Code, and Department/Course are required.');
      return;
    }

    try {
      await subjectService.createSubject({
        name: formData.name,
        code: formData.code.toUpperCase(),
        semester: formData.semester,
        credits: formData.credits,
        course: formData.courseId,
        description: formData.description,
      });

      showToastSuccess('Subject created successfully.');
      setIsAddOpen(false);
      
      // Reset form
      setFormData({
        name: '',
        code: '',
        semester: 1,
        credits: 4,
        courseId: courses.length > 0 ? courses[0].id : '',
        description: '',
      });

      fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Error occurred while saving subject.');
    }
  };

  const handleEditClick = (subject: Subject) => {
    setSelectedSubject(subject);
    
    // Map course ID from target
    const courseId = typeof subject.course === 'object' ? subject.course?._id : (subject.course || '');

    setFormData({
      name: subject.name,
      code: subject.code,
      semester: subject.semester,
      credits: subject.credits || 4,
      courseId: courseId || (courses.length > 0 ? courses[0].id : ''),
      description: subject.description || '',
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!selectedSubject) return;

    if (!formData.name.trim() || !formData.code.trim()) {
      setErrorMsg('Subject Name and Code are required.');
      return;
    }

    try {
      await subjectService.updateSubject(selectedSubject.id, {
        name: formData.name,
        code: formData.code.toUpperCase(),
        semester: formData.semester,
        credits: formData.credits,
        course: formData.courseId,
        description: formData.description,
      });

      showToastSuccess('Subject updated successfully.');
      setIsEditOpen(false);
      setSelectedSubject(null);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Error occurred updating subject.');
    }
  };

  const handleDeleteClick = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSubject) return;
    setErrorMsg('');

    try {
      await subjectService.deleteSubject(selectedSubject.id);
      showToastSuccess('Subject deleted successfully.');
      setIsDeleteOpen(false);
      setSelectedSubject(null);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Warning: Failed to delete subject due to dependencies.');
      setIsDeleteOpen(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  // Local Search Filter
  const filteredSubjects = subjects.filter(
    s => s.name.toLowerCase().includes(search.toLowerCase()) || 
         s.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in relative">
      {/* Toast Alert Success */}
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 bg-green-600 text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-2 border border-green-700 animate-slide-in text-xs font-semibold">
          <span className="material-symbols-outlined">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Alert Display */}
      {errorMsg && (
        <div className="w-full bg-error-container/20 text-error rounded-xl p-4 flex items-start gap-3 border border-error/20 text-xs my-2">
          <span className="material-symbols-outlined text-lg select-none">warning</span>
          <div className="flex-grow">
            <h4 className="font-bold">An error occurred</h4>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg('')} className="hover:opacity-75 cursor-pointer">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Header View */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-on-surface font-display">Subject Management</h2>
          <p className="text-sm text-on-surface-variant mt-1">Review department subject catalogs, edit academic curriculums, and adjust parameters.</p>
        </div>
        <button 
          onClick={() => {
            setFormData({
              name: '',
              code: '',
              semester: 1,
              credits: 4,
              courseId: courses.length > 0 ? courses[0].id : '',
              description: '',
            });
            setIsAddOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary font-bold rounded-xl shadow-md cursor-pointer hover:opacity-90 active:scale-95 transition-all text-xs"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span>Add Subject</span>
        </button>
      </div>

      {/* Search filters row */}
      <div className="relative max-w-sm w-full">
        <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg select-none">search</span>
        <input 
          type="text" 
          placeholder="Search subject code or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Dynamic List Registry Table */}
      {filteredSubjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 glass-card rounded-2xl border border-outline-variant/30 bg-white dark:bg-surface-container text-center">
          <span className="material-symbols-outlined text-outline text-5xl mb-4 select-none">menu_book</span>
          <h3 className="font-bold text-on-surface text-lg">No subjects created yet</h3>
          <p className="text-xs text-outline mt-1 mb-6 max-w-xs mx-auto">Create subjects to enable digital exams, answer sheet upload evaluations, and student registers.</p>
          <button 
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 bg-primary/10 text-primary font-bold text-xs rounded-xl hover:bg-primary/20 cursor-pointer transition-colors active:scale-95"
          >
            Create Your First Subject
          </button>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm bg-white dark:bg-surface-container">
          <div className="overflow-x-auto custom-scrollbar font-display">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                  <th className="px-6 py-4">Subject Name</th>
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Semester</th>
                  <th className="px-6 py-4">Credits</th>
                  <th className="px-6 py-4">Course/Program</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-xs text-on-surface-variant">
                {filteredSubjects.map((s) => (
                  <tr key={s.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-on-surface text-sm block">{s.name}</span>
                          <span className="text-[10px] text-outline line-clamp-1">{s.description || 'No description listed'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-on-surface select-all">{s.code}</td>
                    <td className="px-6 py-4 font-semibold text-on-surface">Semester {s.semester}</td>
                    <td className="px-6 py-4 font-semibold text-outline">{s.credits} Credits</td>
                    <td className="px-6 py-4">
                      {typeof s.course === 'object' ? s.course?.name : (s.course || 'B.Tech Program')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link 
                          to={`/faculty/exams?subjectId=${s.id}`}
                          className="w-8 h-8 rounded-lg hover:bg-outline-variant/15 flex items-center justify-center text-emerald-600 cursor-pointer active:scale-95 transition-all"
                          title="View Exams"
                        >
                          <span className="material-symbols-outlined text-sm font-bold">assignment</span>
                        </Link>

                        <button 
                          onClick={() => handleEditClick(s)}
                          className="w-8 h-8 rounded-lg hover:bg-outline-variant/15 flex items-center justify-center text-primary cursor-pointer active:scale-95 transition-all"
                          title="Edit Subject"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(s)}
                          className="w-8 h-8 rounded-lg hover:bg-error/10 flex items-center justify-center text-error cursor-pointer active:scale-95 transition-all"
                          title="Delete Subject"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Subject Modal Popup */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-surface-container max-w-md w-full rounded-2xl shadow-xl overflow-hidden animate-slide-up border border-outline-variant/30 text-xs">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
              <h3 className="font-bold text-base text-on-surface">Add New Subject</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-outline hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Subject Name *</label>
                <input 
                  type="text" 
                  name="name"
                  placeholder="e.g. Data Structures"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-on-surface focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Subject Code *</label>
                  <input 
                    type="text" 
                    name="code"
                    placeholder="e.g. CE203"
                    value={formData.code}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-on-surface uppercase focus:outline-none focus:border-primary"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Semester *</label>
                  <select 
                    name="semester"
                    value={formData.semester}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-on-surface focus:outline-none focus:border-primary"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                      <option key={sem} value={sem}>Semester {sem}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Credits *</label>
                  <input 
                    type="number" 
                    name="credits"
                    min="1"
                    max="10"
                    value={formData.credits}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-on-surface focus:outline-none focus:border-primary"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Degree/Course *</label>
                  <select 
                    name="courseId"
                    value={formData.courseId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-on-surface focus:outline-none focus:border-primary"
                  >
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Description (Optional)</label>
                <textarea 
                  name="description"
                  placeholder="Optional brief description of subject topic files..."
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 border-t border-outline-variant/20 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-outline-variant/20 hover:bg-outline-variant/35 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold cursor-pointer hover:opacity-90"
                >
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Subject Modal Popup */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-surface-container max-w-md w-full rounded-2xl shadow-xl overflow-hidden animate-slide-up border border-outline-variant/30 text-xs">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
              <h3 className="font-bold text-base text-on-surface">Edit Subject</h3>
              <button 
                onClick={() => {
                  setIsEditOpen(false);
                  setSelectedSubject(null);
                }} 
                className="text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Subject Name *</label>
                <input 
                  type="text" 
                  name="name"
                  placeholder="e.g. Data Structures"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-on-surface focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Subject Code *</label>
                  <input 
                    type="text" 
                    name="code"
                    placeholder="e.g. CE203"
                    value={formData.code}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-on-surface uppercase focus:outline-none focus:border-primary"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Semester *</label>
                  <select 
                    name="semester"
                    value={formData.semester}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-on-surface focus:outline-none focus:border-primary"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                      <option key={sem} value={sem}>Semester {sem}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Credits *</label>
                  <input 
                    type="number" 
                    name="credits"
                    min="1"
                    max="10"
                    value={formData.credits}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-on-surface focus:outline-none focus:border-primary"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface">Degree/Course *</label>
                  <select 
                    name="courseId"
                    value={formData.courseId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-on-surface focus:outline-none focus:border-primary"
                  >
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface">Description (Optional)</label>
                <textarea 
                  name="description"
                  placeholder="Optional brief description..."
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 border-t border-outline-variant/20 pt-4">
                <button 
                  type="button"
                  onClick={() => {
                    setIsEditOpen(false);
                    setSelectedSubject(null);
                  }}
                  className="px-4 py-2 bg-outline-variant/20 hover:bg-outline-variant/35 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold cursor-pointer hover:opacity-90"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-surface-container max-w-sm w-full rounded-2xl shadow-xl overflow-hidden animate-slide-up border border-outline-variant/30 p-6 text-center text-xs">
            <span className="material-symbols-outlined text-5xl text-error mb-2 select-none">warning</span>
            <h3 className="font-bold text-base text-on-surface mb-2">Delete Subject?</h3>
            <p className="text-outline leading-relaxed mb-6">Are you sure you want to delete <span className="font-bold text-on-surface">"{selectedSubject?.name}" ({selectedSubject?.code})</span>? This action is permanent and cannot be undone.</p>
            
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => {
                  setIsDeleteOpen(false);
                  setSelectedSubject(null);
                }}
                className="px-4 py-2 bg-outline-variant/20 hover:bg-outline-variant/35 rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-error text-on-error rounded-xl font-bold cursor-pointer hover:bg-error-container"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultySubjects;
