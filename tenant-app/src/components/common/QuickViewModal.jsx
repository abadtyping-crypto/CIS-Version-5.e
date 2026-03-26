import { useEffect } from 'react';
import { X } from 'lucide-react';

const normalizeSections = (quickView) => {
  const fields = Array.isArray(quickView?.fields) ? quickView.fields : [];
  const sections = Array.isArray(quickView?.sections) ? quickView.sections : [];
  if (!fields.length) return sections;
  return [{ title: '', description: '', fields }, ...sections];
};

const QuickViewModal = ({ isOpen, onClose, quickView = null }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !quickView) return null;

  const sections = normalizeSections(quickView);

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" onClick={onClose}>
      <div
        className="compact-dialog w-full overflow-hidden rounded-[1.35rem] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[0_28px_90px_-35px_rgba(15,23,42,0.85)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-3">
          <div className="min-w-0">
            {quickView.badge ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--c-accent)]">{quickView.badge}</p>
            ) : null}
            <h3 className="mt-1 text-base font-semibold text-[var(--c-text)]">{quickView.title || 'View Details'}</h3>
            {quickView.subtitle ? (
              <p className="mt-1 text-[13px] font-medium text-[var(--c-muted)]">{quickView.subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="compact-icon-action inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
            aria-label="Close quick view"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4" style={{ maxHeight: 'var(--d-modal-max-h)' }}>
          <div className={`grid gap-4 ${quickView.imageUrl ? 'md:grid-cols-[108px_1fr]' : 'grid-cols-1'}`}>
            {quickView.imageUrl ? (
              <div className="mx-auto h-[108px] w-[108px] overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_20%,white_80%)] p-2">
                <img src={quickView.imageUrl} alt="" className="h-full w-full object-contain" />
              </div>
            ) : null}
            <div className="space-y-3">
              {quickView.description ? (
                <p className="text-[13px] leading-relaxed text-[var(--c-muted)]">{quickView.description}</p>
              ) : null}

              {sections.map((section, index) => (
                <section key={`${section.title || 'section'}-${index}`} className="rounded-2xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_90%,transparent)] p-3">
                  {section.title ? (
                    <h4 className="text-sm font-semibold text-[var(--c-text)]">{section.title}</h4>
                  ) : null}
                  {section.description ? (
                    <p className="mt-1 text-xs font-medium text-[var(--c-muted)]">{section.description}</p>
                  ) : null}
                  {Array.isArray(section.fields) && section.fields.length > 0 ? (
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                      {section.fields.map((field, fieldIndex) => (
                        <div key={`${field.label || 'field'}-${fieldIndex}`} className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-2.5 py-2">
                          {field.label ? (
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--c-muted)]">{field.label}</p>
                          ) : null}
                          <p className="mt-1 text-[13px] font-semibold text-[var(--c-text)] break-words">{field.value || '-'}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickViewModal;
