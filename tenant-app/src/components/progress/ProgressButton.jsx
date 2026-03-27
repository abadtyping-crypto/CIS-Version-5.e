import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { PROGRESS_STATUS } from '../../config/progressPresets';

const ProgressButton = ({ 
  children, 
  status = PROGRESS_STATUS.IDLE, 
  disabled, 
  onClick, 
  className = '',
  loadingText,
  variant = 'primary'
}) => {
  const isLoading = status === PROGRESS_STATUS.LOADING;
  const isSuccess = status === PROGRESS_STATUS.SUCCESS;
  const isError = status === PROGRESS_STATUS.ERROR;

  const baseClasses = "relative flex items-center justify-center gap-2 overflow-hidden rounded-xl py-3 px-6 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-(--c-accent) text-white shadow-lg shadow-(--c-accent)/20 hover:brightness-110",
    secondary: "bg-(--c-panel) text-(--c-text) border border-(--c-border) hover:bg-(--c-surface)",
    ghost: "text-(--c-text) hover:bg-(--c-panel)",
    danger: "bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-600"
  };

  return (
    <button
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseClasses} ${variants[variant]} ${className}`}
    >
      <div className={`flex items-center gap-2 transition-all duration-300 ${isLoading || isSuccess || isError ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
        {children}
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300">
          <RefreshCw strokeWidth={1.5} className="h-4 w-4 animate-spin" />
          {loadingText && <span>{loadingText}</span>}
        </div>
      )}

      {isSuccess && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-white animate-in slide-in-from-bottom duration-300">
          <CheckCircle2 strokeWidth={1.5} className="h-5 w-5" />
        </div>
      )}

      {isError && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-white animate-in animate-shake duration-300">
          <AlertCircle strokeWidth={1.5} className="h-5 w-5" />
        </div>
      )}
    </button>
  );
};

export default ProgressButton;
