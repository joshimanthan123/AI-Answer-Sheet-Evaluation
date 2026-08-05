import React from 'react';

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: DropdownOption[];
  error?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  label,
  options,
  error,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || `select-${Date.now()}`;
  return (
    <div className="flex flex-col gap-1 w-full text-left">
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`px-4 py-2 border rounded-xl bg-white dark:bg-surface-container text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 cursor-pointer ${
          error ? 'border-error ring-error/20 ring-2' : 'border-outline-variant/60'
        } ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-error font-medium">{error}</span>}
    </div>
  );
};

export default Dropdown;
