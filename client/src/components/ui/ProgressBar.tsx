import React from 'react';

interface ProgressBarProps {
  progress: number;
  height?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'error';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 'md',
  showPercentage = false,
  color = 'primary'
}) => {
  const value = Math.min(100, Math.max(0, progress));

  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-4'
  };

  const colors = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    success: 'bg-success',
    error: 'bg-error'
  };

  return (
    <div className="w-full text-left">
      <div className="flex justify-between items-center mb-1">
        {showPercentage && (
          <span className="text-xs font-semibold text-primary">
            {value}%
          </span>
        )}
      </div>
      <div className="w-full bg-outline-variant/20 rounded-full overflow-hidden">
        <div 
          className={`rounded-full transition-all duration-300 ${heightClasses[height]} ${colors[color]}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
