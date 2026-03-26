import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { fetchGlobalInstructionAsset } from '../../lib/backendStore';

const toSafeString = (value) => String(value || '').trim();

const PageInstructionOverlay = ({ open = false, instructionID = '', onClose }) => {
  const safeInstructionID = useMemo(() => toSafeString(instructionID), [instructionID]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [instruction, setInstruction] = useState(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    if (!safeInstructionID) {
      setInstruction(null);
      setError('No instruction is configured for this page yet.');
      return;
    }

    let active = true;
    setIsLoading(true);
    setError('');

    fetchGlobalInstructionAsset(safeInstructionID)
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          setInstruction(res.data || null);
        } else {
          setInstruction(null);
          setError(res.error || 'Instruction not found.');
        }
      })
      .catch((err) => {
        if (!active) return;
        setInstruction(null);
        setError(err?.message || 'Failed to load instruction.');
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, safeInstructionID]);

  if (!open) return null;

  const name = toSafeString(instruction?.instructionName) || 'Page Instructions';
  const mediaType = toSafeString(instruction?.mediaType) || 'image';
  const mediaUrl = toSafeString(instruction?.mediaUrl);
  const isVideo = mediaType === 'video';

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onClick={() => onClose?.()}
    >
      <div
        className="w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[0_28px_90px_-35px_rgba(15,23,42,0.85)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--c-border)] bg-[var(--c-panel)] px-6 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--c-muted)]">Help</p>
            <h3 className="mt-1 truncate text-base font-black text-[var(--c-text)] sm:text-lg">{name}</h3>
            {safeInstructionID ? (
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-muted)]">
                ID: {safeInstructionID}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
            aria-label="Close instructions"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="bg-[var(--c-surface)] p-6">
          {isLoading ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--c-accent)] border-t-transparent" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4">
              <p className="text-sm font-semibold text-[var(--c-text)]">{error}</p>
              <p className="mt-1 text-xs text-[var(--c-muted)]">
                Configure `instructionID` in Developer Site → Header Control Center.
              </p>
            </div>
          ) : mediaUrl ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--c-border)] bg-black/5">
              {isVideo ? (
                <video
                  className="block max-h-[70vh] w-full bg-black"
                  src={mediaUrl}
                  controls
                  playsInline
                />
              ) : (
                <img src={mediaUrl} alt={name} className="block max-h-[70vh] w-full object-contain bg-white" />
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4">
              <p className="text-sm font-semibold text-[var(--c-text)]">No mediaUrl found on this instruction.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageInstructionOverlay;

