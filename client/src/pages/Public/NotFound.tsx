import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-background dark:bg-on-background flex flex-col items-center justify-center p-6 text-center select-none">
      <span className="material-symbols-outlined text-primary text-7xl font-bold animate-bounce">
        error
      </span>
      <h2 className="text-3xl font-black text-on-surface mt-4 font-display">
        Page Not Recovered
      </h2>
      <p className="text-sm text-on-surface-variant max-w-sm mt-2">
        The location you requested does not map to any active workspace inside GradeAI.
      </p>
      <Link to="/" className="mt-8">
        <Button variant="primary">
          Back to Safety
        </Button>
      </Link>
    </div>
  );
};

export default NotFound;
