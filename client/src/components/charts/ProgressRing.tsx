import React from 'react';

interface ProgressRingProps {
  score: number;
  total?: number;
  size?: number;
  strokeWidth?: number;
  grade?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  score,
  total = 100,
  size = 128,
  strokeWidth = 8,
  grade
}) => {
  const percentage = Math.min(100, Math.max(0, (score / total) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90">
          {/* Background circle */}
          <circle
            className="text-surface-container"
            cx={size / 2}
            cy={size / 2}
            fill="transparent"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            className="text-primary transition-all duration-1000 ease-out"
            cx={size / 2}
            cy={size / 2}
            fill="transparent"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="font-bold text-on-surface" style={{ fontSize: size * 0.22 }}>
            {score}
          </span>
          <span className="text-outline text-xs mt-1">
            / {total}
          </span>
        </div>
      </div>
      {grade && (
        <span className="mt-4 px-3 py-1 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-full text-xs font-semibold">
          Grade: {grade}
        </span>
      )}
    </div>
  );
};

export default ProgressRing;
