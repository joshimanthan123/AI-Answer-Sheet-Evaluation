import React from 'react';
import Button from './Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'folder_open',
  title,
  description,
  actionText,
  onAction
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-surface-container-low border border-dashed border-outline-variant/50 rounded-2xl">
      <span className="material-symbols-outlined text-outline text-5xl mb-4 select-none">
        {icon}
      </span>
      <h4 className="text-lg font-bold text-on-surface mb-2">
        {title}
      </h4>
      <p className="text-sm text-on-surface-variant max-w-sm mb-6">
        {description}
      </p>
      {actionText && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
