import React from 'react';
import { Outlet } from 'react-router-dom';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background dark:bg-on-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="text-4xl font-extrabold text-primary tracking-tight font-display mb-2 select-none">
          GradeAI
        </h1>
        <p className="text-sm text-on-surface-variant font-medium">
          AI-Powered Answer Sheet Grading & Analytics
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-surface-container py-8 px-4 border border-outline-variant/30 sm:rounded-2xl shadow-xl sm:px-10 transition-all duration-300">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
