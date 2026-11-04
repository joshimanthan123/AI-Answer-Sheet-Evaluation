import React from 'react';
import { useNotifications, ToastMessage } from '../../context/NotificationContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useNotifications();

  return (
    <div className="fixed bottom-20 md:bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: ToastMessage;
  onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const styles = {
    success: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900 text-green-800 dark:text-green-200',
    error: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200',
    warning: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200',
    info: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-200'
  };

  const icons = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };

  return (
    <div className={`p-4 border rounded-2xl shadow-lg flex items-center justify-between gap-3 animate-slide-in duration-300 ${styles[toast.type]}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="material-symbols-outlined text-lg">
          {icons[toast.type]}
        </span>
        <span>{toast.message}</span>
      </div>
      <button 
        onClick={onClose}
        className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-sm font-bold">close</span>
      </button>
    </div>
  );
};

export default ToastContainer;
