import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  type = 'text',
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${Date.now()}`;
  return (
    <div className="flex flex-col gap-1 w-full text-left">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        className={`px-4 py-2 border rounded-xl bg-white dark:bg-surface-container text-on-surface placeholder:text-outline/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 ${
          error ? 'border-error ring-error/20 ring-2' : 'border-outline-variant/60'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-error font-medium">{error}</span>}
      {!error && helperText && <span className="text-xs text-outline">{helperText}</span>}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
