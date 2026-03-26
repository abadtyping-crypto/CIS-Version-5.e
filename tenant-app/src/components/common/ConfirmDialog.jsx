import { X, AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

const ConfirmDialog = ({
  isOpen,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  onClose,
  isDangerous = false,
}) => {
  const handleCancel = onCancel || onClose;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={handleCancel}
      />
      
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-[var(--c-surface)] shadow-2xl ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDangerous ? 'bg-rose-100 text-rose-600' : 'bg-[var(--c-accent)]/10 text-[var(--c-accent)]'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-base font-black text-[var(--c-text)] space-y-2">{title}</h3>
              <div className="mt-2 text-sm font-bold text-[var(--c-muted)] whitespace-pre-line">{message}</div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 bg-[var(--c-panel)] px-6 py-4 border-t border-[var(--c-border)]/50">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2 text-xs font-black uppercase tracking-wider text-[var(--c-muted)] transition hover:border-[var(--c-text)] hover:text-[var(--c-text)]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg transition hover:opacity-90 active:scale-95 ${isDangerous ? 'bg-rose-600 shadow-rose-600/20' : 'bg-[var(--c-accent)] shadow-[var(--c-accent)]/20'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
