import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';
import { useEffect } from 'react';

const APPEARANCE = {
  error: {
    Icon: ShieldAlert,
    eyebrow: 'Action needed',
    ring: 'border-rose-500/35',
    bg: 'bg-rose-500',
    soft: 'bg-rose-500/10',
    text: 'text-rose-500',
  },
  warning: {
    Icon: AlertTriangle,
    eyebrow: 'Review required',
    ring: 'border-amber-500/35',
    bg: 'bg-amber-500',
    soft: 'bg-amber-500/10',
    text: 'text-amber-500',
  },
  success: {
    Icon: CheckCircle2,
    eyebrow: 'Completed',
    ring: 'border-emerald-500/35',
    bg: 'bg-emerald-500',
    soft: 'bg-emerald-500/10',
    text: 'text-emerald-500',
  },
  info: {
    Icon: Info,
    eyebrow: 'Notice',
    ring: 'border-[var(--c-accent)]/35',
    bg: 'bg-[var(--c-accent)]',
    soft: 'bg-[var(--c-accent)]/10',
    text: 'text-[var(--c-accent)]',
  },
};

const FocusErrorOverlay = ({
  open = false,
  type = 'error',
  title = 'Something needs attention',
  message = '',
  detail = '',
  actionLabel = 'Review',
  onClose,
}) => {
  const appearance = APPEARANCE[type] || APPEARANCE.error;
  const Icon = appearance.Icon;

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/78 backdrop-blur-xl" onClick={onClose} />
      <div className={`relative w-full max-w-[27rem] overflow-hidden rounded-3xl border ${appearance.ring} bg-[var(--c-surface)] text-[var(--c-text)] shadow-2xl animate-in fade-in zoom-in-95 duration-200`}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)] transition hover:text-[var(--c-text)]"
          aria-label="Close message"
        >
          <X className="h-4 w-4" />
        </button>

        <div className={`h-2 w-full ${appearance.bg}`} />
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${appearance.soft} ${appearance.text}`}>
              <Icon className="h-7 w-7" strokeWidth={1.7} />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${appearance.text}`}>
                {appearance.eyebrow}
              </p>
              <h3 className="mt-2 text-xl font-black leading-tight text-[var(--c-text)]">{title}</h3>
              {message ? (
                <p className="mt-3 text-sm font-bold leading-6 text-[var(--c-muted)] whitespace-pre-line">{message}</p>
              ) : null}
            </div>
          </div>

          {detail ? (
            <div className={`mt-5 rounded-2xl border ${appearance.ring} ${appearance.soft} px-4 py-3`}>
              <p className="text-xs font-bold leading-5 text-[var(--c-text)]">{detail}</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className={`mt-6 flex h-12 w-full items-center justify-center rounded-2xl ${appearance.bg} px-5 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg transition hover:brightness-105 active:scale-[0.98]`}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FocusErrorOverlay;
