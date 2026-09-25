import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import ToastContainer from '../components/ui/Toast';

export const FacultyLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount, notifications, markAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  const navigationCategories = [
    {
      category: 'FACULTY PORTAL',
      items: [
        { name: 'Dashboard', path: '/faculty', icon: 'dashboard' }
      ]
    },
    {
      category: 'ACADEMIC MANAGEMENT',
      items: [
        { name: 'Subjects', path: '/faculty/subjects', icon: 'library_books' },
        { name: 'Exams', path: '/faculty/exams', icon: 'assignment' }
      ]
    },
    {
      category: 'EVALUATION',
      items: [
        { name: 'AI Evaluation Review', path: '/faculty/evaluations', icon: 'fact_check' },
        { name: 'Evaluation Queue', path: '/faculty/evaluation-queue', icon: 'playlist_play' },
        { name: 'Review Evaluations', path: '/faculty/review-evaluations', icon: 'rate_review' },
        { name: 'Historical References', path: '/faculty/historical-references', icon: 'bookmarks' },
        { name: 'AI Improvement', path: '/faculty/ai-improvement', icon: 'auto_fix_high' }
      ]
    },

    {
      category: 'RESULTS & REPORTS',
      items: [
        { name: 'Analytics', path: '/faculty/analytics', icon: 'monitoring' },
        { name: 'Advanced Analytics', path: '/faculty/advanced-analytics', icon: 'insights' },
        { name: 'Academic Reports', path: '/faculty/reports', icon: 'analytics' }
      ]
    },
    {
      category: 'ACCOUNT',
      items: [
        { name: 'Profile', path: '/faculty/settings', icon: 'settings' }
      ]
    }
  ];

  return (
    <div className={`min-h-screen bg-background text-on-surface flex ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-surface-container border-r border-outline-variant/30 pt-6 h-screen sticky top-0">
        <div className="px-6 mb-6 flex items-center justify-between">
          <Link to="/" className="text-2xl font-black text-primary font-display">GradeAI</Link>
          <span className="text-[10px] bg-secondary/15 text-primary font-bold px-2 py-0.5 rounded-full uppercase">Faculty</span>
        </div>

        <nav className="flex-grow px-4 space-y-4 overflow-y-auto custom-scrollbar text-xs">
          {navigationCategories.map((cat) => (
            <div key={cat.category} className="space-y-1 text-left">
              <span className="px-4 text-[9px] font-black text-outline uppercase tracking-wider block mb-1">
                {cat.category}
              </span>
              {cat.items.map((item) => {
                const isActive = item.name === 'Dashboard' 
                  ? location.pathname === '/faculty' || location.pathname === '/faculty/'
                  : item.name === 'Exams'
                    ? location.pathname.startsWith('/faculty/exams') || location.pathname.startsWith('/faculty/answer-sheets')
                    : location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all active:scale-95 ${
                      isActive 
                        ? 'bg-primary text-on-primary shadow-md font-semibold' 
                        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{item.icon}</span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-outline-variant/30 flex flex-col gap-2">
          {/* Faculty User Info */}
          <div className="flex items-center gap-3 p-2 bg-background dark:bg-surface-container-low rounded-xl">
            <div className="w-9 h-9 rounded-full bg-secondary-container/20 flex items-center justify-center font-bold text-secondary select-none overflow-hidden">
              {user?.avatar ? <img src={user.avatar} className="object-cover w-full h-full" /> : user?.name.charAt(0)}
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

      {/* Main Panel Viewport */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Navigation bar */}
        <header className="h-16 px-6 bg-white/80 dark:bg-surface-container/80 backdrop-blur-md border-b border-outline-variant/20 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3 md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="text-primary cursor-pointer active:scale-95"
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
            >
              <span className="material-symbols-outlined">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Notification Drawer */}
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

              {/* Alert Dropdown Drawer */}
              {notifDrawerOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-outline-variant/30 flex justify-between bg-surface-container-low">
                    <span className="font-bold text-sm">Faculty Notifications</span>
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

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <nav className="md:hidden bg-white dark:bg-surface-container border-b border-outline-variant/30 px-6 py-4 flex flex-col gap-3 text-left z-30 max-h-[80vh] overflow-y-auto">
            {navigationCategories.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <span className="text-[9px] font-black text-outline uppercase tracking-wider block mb-1 px-4">{cat.category}</span>
                {cat.items.map((item) => {
                  const isActive = item.name === 'Dashboard' 
                    ? location.pathname === '/faculty' || location.pathname === '/faculty/'
                    : item.name === 'Exams'
                      ? location.pathname.startsWith('/faculty/exams') || location.pathname.startsWith('/faculty/answer-sheets')
                      : location.pathname.startsWith(item.path);
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
              </div>
            ))}
            <button 
              onClick={() => {
                setMobileMenuOpen(false);
                logout().then(() => navigate('/auth/login'));
              }}
              className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-error hover:bg-error/10 font-bold mt-2"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              <span>Sign Out</span>
            </button>
          </nav>
        )}

        {/* Page Content Viewport */}
        <main className="flex-grow p-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};

export default FacultyLayout;
