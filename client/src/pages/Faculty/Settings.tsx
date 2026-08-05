import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const FacultySettings: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useNotifications();

  const [saving, setSaving] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      addToast('Faculty profile and courses assignments updated.', 'success');
    }, 600);
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Faculty Account Settings</h2>
        <p className="text-sm text-on-surface-variant mt-1">Configure profile settings, course notifications preferences, and styling sheets.</p>
      </div>

      <div className="glass-card p-6 md:p-8 rounded-2xl border-outline-variant/30 flex flex-col gap-6 bg-white dark:bg-surface-container">
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          <Input 
            label="Faculty Name" 
            value={user?.name || ''} 
            disabled 
            helperText="To modify registration names, contact administrator services."
          />

          <Input 
            label="Institutional Email" 
            value={user?.email || ''} 
            disabled
          />

          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Appearance Configurations</span>
            <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant/25">
              <div>
                <p className="text-xs font-bold font-display text-on-surface">Screen Mode</p>
                <p className="text-[10px] text-outline mt-0.5">Toggle between visual layouts.</p>
              </div>
              <button 
                type="button"
                onClick={toggleTheme}
                className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-semibold hover:bg-primary/20"
              >
                {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
              </button>
            </div>
          </div>

          <Button type="submit" isLoading={saving} className="w-full">
            Save Configuration
          </Button>
        </form>
      </div>
    </div>
  );
};

export default FacultySettings;
