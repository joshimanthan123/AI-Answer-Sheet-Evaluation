import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import ToastContainer from '../components/ui/Toast';

export const StudentLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount, notifications, markAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  const getFullPhotoUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const host = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';
    return `${host}${url}`;
  };

  const menuItems = [
    { name: 'Dashboard', path: '/student', icon: 'home' },
    { name: 'My Exams', path: '/student/exams', icon: 'assignment' },
    { name: 'Exam Workspace', path: '/student/exam-workspace', icon: 'draw' },
    { name: 'Upload Answer Sheet', path: '/student/upload-answer-sheet', icon: 'cloud_upload' },
    { name: 'Results', path: '/student/results', icon: 'fact_check' },
    { name: 'Performance Analytics', path: '/student/analytics', icon: 'bar_chart' },
    { name: 'Settings', path: '/student/settings', icon: 'settings' }
  ];

  return (
    <div className={`min-h-screen bg-background text-on-surface font-body-md flex ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-surface-container border-r border-outline-variant/30 pt-6 h-screen sticky top-0">
        <div className="px-6 mb-8 flex items-center justify-between">
          <Link to="/" className="text-2xl font-black text-primary font-display">GradeAI</Link>
          <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full uppercase">Student</span>
        </div>
        
        <nav className="flex-grow px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-label-md text-label-md transition-all active:scale-95 ${
                  isActive 
                    ? 'bg-primary text-on-primary shadow-md font-semibold' 
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-outline-variant/30 flex flex-col gap-2">
          {/* User Profile Card */}
          <div className="flex items-center gap-3 p-2 bg-background dark:bg-surface-container-low rounded-xl">
            <div className="w-9 h-9 rounded-full bg-primary-light/50 flex items-center justify-center font-bold text-primary select-none overflow-hidden">
              {user?.profilePhoto || user?.avatar ? <img src={getFullPhotoUrl(user.profilePhoto || user.avatar)} className="object-cover w-full h-full" /> : user?.name.charAt(0)}
            </div>
            <div className="truncate flex-grow text-left">
              <p className="text-xs font-bold text-on-surface truncate">{user?.name}</p>
              <p className="text-[10px] text-outline truncate">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={() => logout().then(() => navigate('/auth/login'))}
            className="w-full py-2 bg-outline-variant/20 hover:bg-error/10 hover:text-error rounded-xl font-label-md text-label-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Top Header navbar */}
        <header className="h-16 px-6 bg-white/80 dark:bg-surface-container/80 backdrop-blur-md border-b border-outline-variant/20 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3 md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="text-primary cursor-pointer active:scale-90"
            >
              <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
            <span className="font-extrabold text-primary font-display text-lg">GradeAI</span>
          </div>

          <div className="flex-grow" />

          {/* Action Row */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl bg-outline-variant/10 hover:bg-outline-variant/20 text-on-surface flex items-center justify-center cursor-pointer transition-colors active:scale-95"
              title="Toggle Light/Dark Theme"
            >
              <span className="material-symbols-outlined">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setNotifDrawerOpen(prev => !prev)}
                className="w-10 h-10 rounded-xl bg-outline-variant/10 hover:bg-outline-variant/20 text-on-surface flex items-center justify-center cursor-pointer transition-colors active:scale-95"
              >
                <span className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-error text-on-error rounded-full flex items-center justify-center text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Quick Alerts Drawer */}
              {notifDrawerOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-outline-variant/30 flex justify-between bg-surface-container-low">
                    <span className="font-bold text-sm">System Alerts</span>
                    <button onClick={() => setNotifDrawerOpen(false)} className="text-outline hover:text-primary text-xs">Close</button>
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/10 text-left">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-outline text-center">No alerts logged</p>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`p-3 text-xs hover:bg-surface-container-low transition-colors cursor-pointer ${!n.read ? 'bg-primary/5 font-semibold' : ''}`}
                          onClick={() => {
                            markAsRead(n.id);
                            setNotifDrawerOpen(false);
                          }}
                        >
                          <p className="text-on-surface">{n.title}</p>
                          <p className="text-[10px] text-outline mt-0.5">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Menu Navigation Drawer */}
        {mobileMenuOpen && (
          <nav className="md:hidden bg-white dark:bg-surface-container border-b border-outline-variant/30 px-6 py-4 flex flex-col gap-2 text-left z-30">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isActive 
                      ? 'bg-primary text-on-primary' 
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="material-symbols-outlined text-base">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
            <button 
              onClick={() => {
                setMobileMenuOpen(false);
                logout().then(() => navigate('/auth/login'));
              }}
              className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-error hover:bg-error/10 font-bold"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              <span>Sign Out</span>
            </button>
          </nav>
        )}

        {/* Viewport for Pages */}
        <main className="flex-grow p-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};

export default StudentLayout;
