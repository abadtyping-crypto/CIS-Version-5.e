import { useEffect } from 'react';
import { X } from 'lucide-react';

const ProgressVideoOverlay = ({
  open = false,
  onClose,
  videoSrc = '/Video/ProgressView.mp4',
  title = 'Processing Request',
  subtitle = 'Please wait while we complete the transaction in the background.',
  minimal = false,
  dismissible = true,
  frameWidthClass = 'max-w-4xl',
  backdropClassName = 'bg-[rgba(15,23,42,0.58)] backdrop-blur-md',
  frameless = false,
}) => {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape' && dismissible) onClose?.();
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dismissible, open, onClose]);

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-[120] flex items-center justify-center px-4 py-6 ${backdropClassName}`}>
      <div className={`w-full ${frameWidthClass} overflow-hidden ${frameless ? 'bg-transparent shadow-none border-0 rounded-none' : 'rounded-[2rem] border border-[#f1ddcf] bg-white shadow-[0_32px_80px_-28px_rgba(15,23,42,0.18)]'}`}>
        {minimal ? (
          <div className="px-6 pt-6 text-center">
            <p className="text-lg font-black text-[#53321d]">{title}</p>
            {subtitle ? <p className="mt-2 text-sm text-[#8b6b57]">{subtitle}</p> : null}
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4 border-b border-[var(--c-border)] bg-[var(--c-panel)] px-6 py-4">
            <div className="min-w-0">
              <p className="text-base font-black text-[var(--c-text)]">{title}</p>
              <p className="mt-1 text-sm text-[var(--c-muted)]">{subtitle}</p>
            </div>
            {dismissible ? (
              <button
                type="button"
                onClick={() => onClose?.()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-text)]"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        )}

        <div className={minimal ? (frameless ? 'px-0 pb-0 pt-4' : 'bg-white px-6 pb-6 pt-4') : 'bg-white p-4'}>
          <div className={`overflow-hidden ${frameless ? 'rounded-none bg-transparent' : 'rounded-[1.5rem] bg-white'} ${minimal ? '' : 'border border-[#f1ddcf] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)]'}`}>
            <video
              className={`block h-auto w-full ${frameless ? 'bg-transparent' : 'bg-white'}`}
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              controls={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressVideoOverlay;
