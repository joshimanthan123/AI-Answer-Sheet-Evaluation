import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  height?: string | number;
  width?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rect',
  height,
  width
}) => {
  const variantClasses = {
    text: 'h-4 w-3/4 rounded-sm',
    rect: 'rounded-xl',
    circle: 'rounded-full'
  };

  const style: React.CSSProperties = {
    height: typeof height === 'number' ? `${height}px` : height,
    width: typeof width === 'number' ? `${width}px` : width,
  };

  return (
    <div
      className={`bg-outline-variant/30 animate-pulse shimmer-effect ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
};

export default Skeleton;
