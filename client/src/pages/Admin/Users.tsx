import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/admin.service';
import { User } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';

export const AdminUsers: React.FC = () => {
  const { addToast } = useNotifications();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    adminService.getUsers().then(data => {
      setUsers(data);
      setLoading(false);
    });
  }, []);

  const handleRoleChange = async (userId: string, newRole: 'student' | 'faculty' | 'admin') => {
    try {
      await adminService.updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      addToast(`Role updated successfully for user.`, 'success');
    } catch {
      addToast('Error updating role.', 'error');
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">User Role Management</h2>
        <p className="text-sm text-on-surface-variant mt-1">Audit active profiles registrations, view assigned access scopes, and update permission roles.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg select-none">search</span>
          <input 
            type="text" 
            placeholder="Search name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm bg-white dark:bg-surface-container">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Access Persona Role</th>
                <th className="px-6 py-4 text-right font-semibold">Toggles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-xs text-on-surface-variant">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-primary/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-on-surface text-sm block">{u.name}</span>
                    <span className="text-[10px] text-outline font-semibold">ID: #{u.id.substring(0,8).toUpperCase()}</span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-on-surface">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      u.role === 'admin' ? 'bg-red-50 text-red-700 border border-red-200' :
                      u.role === 'faculty' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 
                      'bg-primary/10 text-primary border border-primary/20'
                    }`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <select 
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as any)}
                      className="px-2.5 py-1.5 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-[11px] font-bold text-on-surface cursor-pointer select-none"
                    >
                      <option value="student">Student</option>
                      <option value="faculty">Faculty</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
