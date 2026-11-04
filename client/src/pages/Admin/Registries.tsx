import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/admin.service';
import { Subject } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useNotifications } from '../../context/NotificationContext';

export const AdminRegistries: React.FC = () => {
  const { addToast } = useNotifications();
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    adminService.getSubjects().then(data => {
      setSubjects(data);
      setLoading(false);
    });
  }, []);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName || !newSubCode) return;
    setAdding(true);
    try {
      const sub = await adminService.createSubject({
        name: newSubName,
        code: newSubCode,
        credits: 4,
        courseId: 'course-btech-cse',
        semester: 1
      });
      setSubjects(prev => [...prev, sub]);
      addToast('Course subject successfully registered in system database.', 'success');
      setNewSubName('');
      setNewSubCode('');
    } catch {
      addToast('Error registering registry.', 'error');
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">University Registries</h2>
        <p className="text-sm text-on-surface-variant mt-1">Configure academic course registries, department mappings, and subject codes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Registry Form */}
        <div className="glass-card p-6 rounded-2xl border-outline-variant/30 text-left bg-white dark:bg-surface-container flex flex-col gap-4">
          <h3 className="font-bold text-sm text-on-surface">Add Subject Code</h3>
          <form onSubmit={handleAddSubject} className="flex flex-col gap-4">
            <Input 
              label="Subject Name" 
              value={newSubName} 
              onChange={(e) => setNewSubName(e.target.value)} 
              placeholder="e.g. Theory of Computation"
              required
            />
            <Input 
              label="Course Code" 
              value={newSubCode} 
              onChange={(e) => setNewSubCode(e.target.value)} 
              placeholder="e.g. CS202"
              required
            />
            <Button type="submit" isLoading={adding} className="w-full">
              Create Registry
            </Button>
          </form>
        </div>

        {/* Subjects list registry */}
        <div className="lg:col-span-2 glass-card rounded-2xl border border-outline-variant/30 overflow-hidden bg-white dark:bg-surface-container">
          <div className="px-6 py-4 border-b border-outline-variant/30 bg-surface-container-low select-none">
            <h3 className="font-bold text-sm">Course Registries List</h3>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                  <th className="px-6 py-3">Subject Code</th>
                  <th className="px-6 py-3">Subject Name</th>
                  <th className="px-6 py-3">Department</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-xs text-on-surface-variant">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-primary">{sub.code}</td>
                    <td className="px-6 py-4 font-semibold text-on-surface">{sub.name}</td>
                    <td className="px-6 py-4 text-outline font-medium">Computer Engineering</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminRegistries;
