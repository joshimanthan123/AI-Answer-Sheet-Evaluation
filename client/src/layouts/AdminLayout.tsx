import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ToastContainer from '../components/ui/Toast';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/admin', icon: 'donut_large' },
    { name: 'Analytics', path: '/admin/analytics', icon: 'monitoring' },
    { name: 'Advanced Analytics', path: '/admin/advanced-analytics', icon: 'insights' },
    { name: 'System Intelligence', path: '/admin/system-intelligence', icon: 'monitor_heart' },
    { name: 'User Management', path: '/admin/users', icon: 'manage_accounts' },
    { name: 'Registries', path: '/admin/registries', icon: 'dns' },
    { name: 'AI Models Config', path: '/admin/ai-config', icon: 'settings_suggest' },
    { name: 'AI Improvement', path: '/admin/ai-improvement', icon: 'auto_fix_high' },
    { name: 'Security Logs', path: '/admin/logs', icon: 'security' },
    { name: 'Settings', path: '/admin/settings', icon: 'settings' }
  ];

  return (
    <div className={`min-h-screen bg-background text-on-surface font-body-md flex ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-surface-container border-r border-outline-variant/30 pt-6 h-screen sticky top-0">
        <div className="px-6 mb-8 flex items-center justify-between">
          <Link to="/" className="text-2xl font-black text-primary font-display">GradeAI</Link>
          <span className="text-[10px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold px-2 py-0.5 rounded-full uppercase">Admin</span>
        </div>

        <nav className="flex-grow px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
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
          {/* Admin User Info */}
          <div className="flex items-center gap-3 p-2 bg-background dark:bg-surface-container-low rounded-xl">
            <div className="w-9 h-9 rounded-full bg-error-container/20 flex items-center justify-center font-bold text-error select-none overflow-hidden">
              {user?.name.charAt(0)}
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
            <button 
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl bg-outline-variant/10 hover:bg-outline-variant/20 text-on-surface flex items-center justify-center cursor-pointer transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
          </div>
        </header>

        {/* Mobile menu list */}
        {mobileMenuOpen && (
          <nav className="md:hidden bg-white dark:bg-surface-container border-b border-outline-variant/30 px-6 py-4 flex flex-col gap-2 text-left z-30">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
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

        {/* Dynamic Page Viewport */}
        <main className="flex-grow p-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};

export default AdminLayout;
