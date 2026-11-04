import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const StudentSettings: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync local states if user data retrieves asynchronously
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhotoPreview(user.profilePhoto || user.avatar || '');
    }
  }, [user]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getFullPhotoUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const host = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';
    return `${host}${url}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let payload: FormData | { name: string } = { name };
      if (photoFile) {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('profilePhoto', photoFile);
        payload = formData;
      }
      
      await updateProfile(payload);
      addToast('Profile configuration preferences saved successfully.', 'success');
      setPhotoFile(null); // Clear pending upload state
    } catch (err: any) {
      console.error(err);
      addToast(err?.message || 'Failed to update profile settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Profile & Platform Settings</h2>
        <p className="text-sm text-on-surface-variant mt-1 font-semibold">Manage system configuration, notifications alerts, and screen modes.</p>
      </div>

      <div className="glass-card p-6 md:p-8 rounded-2xl border-outline-variant/30 flex flex-col gap-6">
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          {/* Avatar selector */}
          <div className="flex flex-col items-center gap-3">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-full border-2 border-primary/25 bg-primary/5 hover:border-primary/50 cursor-pointer flex items-center justify-center font-bold text-3xl text-primary overflow-hidden relative group select-none transition-all"
            >
              {photoPreview ? (
                <img src={getFullPhotoUrl(photoPreview)} className="object-cover w-full h-full" alt="Avatar preview" />
              ) : (
                name.charAt(0).toUpperCase()
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold">
                Change Photo
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handlePhotoChange} 
              className="hidden" 
              accept="image/*" 
            />
            <p className="text-[10px] text-on-surface-variant">Recommended: Square PNG/JPEG image.</p>
          </div>

          <Input 
            label="Full Name" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            required
            helperText="Editable personal displayName parameter."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Enrolled Email" 
              value={user?.email || ''} 
              disabled
            />
            
            <Input 
              label="Enrollment ID" 
              value={user?.studentId || user?.rollNo || 'N/A'} 
              disabled
              helperText="Academic registration identifier number."
            />

            <Input 
              label="Associated Department" 
              value={user?.department || 'N/A'} 
              disabled
            />

            <Input 
              label="Current Semester" 
              value={user?.semester?.toString() || 'N/A'} 
              disabled
            />
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Theme Preferences</span>
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

          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Alert Configurations</span>
            
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={emailAlerts}
                onChange={() => setEmailAlerts(prev => !prev)}
                className="w-4 h-4 rounded text-primary border-outline-variant focus:ring-primary/25"
              />
              <div>
                <p className="text-xs font-bold text-on-surface">Dispatch Grade Reports via Email</p>
                <p className="text-[10px] text-outline">Receive complete PDF solutions grading breakdowns in inbox.</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={pushAlerts}
                onChange={() => setPushAlerts(prev => !prev)}
                className="w-4 h-4 rounded text-primary border-outline-variant focus:ring-primary/25"
              />
              <div>
                <p className="text-xs font-bold text-on-surface">Push Notification Alerts</p>
                <p className="text-[10px] text-outline">Show toast alerts on the desktop browser immediately sheets are evaluated.</p>
              </div>
            </label>
          </div>

          <Button type="submit" isLoading={saving} className="w-full">
            Save Preferences
          </Button>
        </form>
      </div>
    </div>
  );
};

export default StudentSettings;
