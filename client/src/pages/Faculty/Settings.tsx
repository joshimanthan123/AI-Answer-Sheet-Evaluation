import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { authService } from '../../services/auth.service';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const FacultySettings: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useNotifications();

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Mask toggles
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Sync user state if updated in context
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setProfileError('All fields are required.');
      return;
    }
    if (name.trim().length < 2) {
      setProfileError('Name must be at least 2 characters long.');
      return;
    }

    setProfileError('');
    setProfileSaving(true);
    try {
      await updateProfile(name.trim(), email.trim().toLowerCase());
      addToast('Profile updated successfully.', 'success');
      setIsEditing(false);
    } catch (err: any) {
      const msg = err?.message || 'Failed to update profile.';
      setProfileError(msg);
      addToast(msg, 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordError('');
    setPasswordSaving(true);
    try {
      await authService.changePassword(currentPassword, newPassword, confirmPassword);
      addToast('Password changed successfully.', 'success');
      // Reset fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (err: any) {
      const msg = err?.message || 'Failed to update password.';
      setPasswordError(msg);
      addToast(msg, 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not Available';
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 text-left animate-fade-in pb-12">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Faculty Account Portal</h2>
        <p className="text-sm text-on-surface-variant mt-1">Manage your administrative profile settings, password credentials, and portal configurations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Side: General Profile Summary Card */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="glass-card p-6 rounded-2xl border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col items-center text-center gap-4">
            <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-bold text-3xl text-primary select-none overflow-hidden mt-2">
              {user?.avatar ? <img src={user.avatar} className="object-cover w-full h-full" alt="Avatar" /> : user?.name?.charAt(0)}
            </div>
            
            <div className="flex flex-col gap-1 w-full">
              <h3 className="font-bold text-lg text-on-surface font-display truncate">{user?.name}</h3>
              <span className="text-xs bg-primary/15 text-primary font-bold px-3 py-1 rounded-full uppercase self-center tracking-wider max-w-fit">
                {user?.role || 'faculty'}
              </span>
            </div>

            <div className="w-full border-t border-outline-variant/20 pt-4 mt-2 flex flex-col gap-3 text-left">
              <div>
                <p className="text-[10px] text-outline font-bold uppercase tracking-wider">Lecturer ID</p>
                <p className="text-xs font-bold text-on-surface mt-0.5">{user?.lecturerId || user?.employeeId || 'FAC-001'}</p>
              </div>
              <div>
                <p className="text-[10px] text-outline font-bold uppercase tracking-wider">Member Since</p>
                <p className="text-xs font-bold text-on-surface mt-0.5">{formatDate(user?.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Screen mode quick widget */}
          <div className="glass-card p-5 rounded-2xl border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col gap-3">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Appearance Settings</span>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-on-surface">Screen Mode</p>
                <p className="text-[10px] text-outline mt-0.5">Toggle interface design.</p>
              </div>
              <button 
                type="button"
                onClick={toggleTheme}
                className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-black hover:bg-primary/20 transition-all"
              >
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Tab Options and Detail Configuration */}
        <div className="md:col-span-2 flex flex-col gap-6">
          
          {/* Section: Profile Info */}
          <div className="glass-card p-6 md:p-8 rounded-2xl border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-outline-variant/20 pb-4">
              <h3 className="font-bold text-base text-on-surface font-display">Administrative Profile Information</h3>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-1.5 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-sm hover:scale-95 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  Edit Profile
                </button>
              )}
            </div>

            {profileError && (
              <div className="p-3 bg-error-container/30 border border-error/20 text-error rounded-xl text-xs font-semibold">
                {profileError}
              </div>
            )}

            {!isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div>
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider">Full Name</p>
                  <p className="text-sm font-semibold text-on-surface mt-1">{user?.name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider">Email Address</p>
                  <p className="text-sm font-semibold text-on-surface mt-1">{user?.email}</p>
                </div>
                <div>
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider">Institutional Role</p>
                  <p className="text-sm font-semibold text-on-surface mt-1 capitalize">{user?.role}</p>
                </div>
                <div>
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider">Lecturer ID Status</p>
                  <p className="text-sm font-semibold text-on-surface mt-1 text-green-600 dark:text-green-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">verified</span> Verified & Locked
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleProfileSave} className="flex flex-col gap-5">
                <Input 
                  label="Full Name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Patel"
                  required
                />

                <Input 
                  label="Email Address" 
                  type="email"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. faculty@example.com"
                  required
                />

                <Input 
                  label="Lecturer ID (Read-only)" 
                  value={user?.lecturerId || user?.employeeId || ''} 
                  disabled
                  helperText="Official identifier numbers cannot be updated by portal users."
                />

                <div className="flex gap-3 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setName(user?.name || '');
                      setEmail(user?.email || '');
                      setProfileError('');
                    }}
                    className="px-4 py-2 border border-outline-variant/30 text-on-surface rounded-xl text-xs font-semibold hover:bg-outline-variant/10 active:scale-95 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <Button type="submit" isLoading={profileSaving} className="px-5 py-2 text-xs font-black">
                    Save Changes
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Section: Change Password /collapsible view */}
          <div className="glass-card p-6 md:p-8 rounded-2xl border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-outline-variant/20 pb-4">
              <div className="text-left">
                <h3 className="font-bold text-base text-on-surface font-display">Portal Credentials & Security</h3>
                <p className="text-[10px] text-outline mt-0.5">Regularly change passwords for security compliance.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordSection(prev => !prev);
                  setPasswordError('');
                }}
                className={`px-4 py-1.5 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  showPasswordSection
                    ? 'border-outline-variant text-outline hover:bg-outline-variant/10'
                    : 'border-primary text-primary hover:bg-primary/5'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">lock_reset</span>
                {showPasswordSection ? 'Collapse Block' : 'Change Password'}
              </button>
            </div>

            {showPasswordSection && (
              <form onSubmit={handlePasswordChange} className="flex flex-col gap-5 text-left transition-all animate-fade-in">
                {passwordError && (
                  <div className="p-3 bg-error-container/30 border border-error/20 text-error rounded-xl text-xs font-semibold">
                    {passwordError}
                  </div>
                )}

                <div className="relative">
                  <Input 
                    label="Current Password" 
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword} 
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-4 top-9 text-outline hover:text-on-surface cursor-pointer select-none"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showCurrentPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>

                <div className="relative">
                  <Input 
                    label="New Password" 
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-4 top-9 text-outline hover:text-on-surface cursor-pointer select-none"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showNewPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>

                <div className="relative">
                  <Input 
                    label="Confirm New Password" 
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-4 top-9 text-outline hover:text-on-surface cursor-pointer select-none"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showConfirmPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>

                <div className="flex gap-3 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordSection(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordError('');
                    }}
                    className="px-4 py-2 border border-outline-variant/30 text-on-surface rounded-xl text-xs font-semibold hover:bg-outline-variant/10 active:scale-95 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <Button type="submit" isLoading={passwordSaving} className="px-5 py-2 text-xs font-black">
                    Update Password
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default FacultySettings;
