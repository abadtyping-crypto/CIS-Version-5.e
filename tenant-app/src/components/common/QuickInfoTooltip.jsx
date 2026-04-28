import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

const normalizeList = (value) => {
  if (!value) return [];
  const source = Array.isArray(value) ? value : [value];
  return source
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
      return String(item?.value || item?.number || item?.email || item?.label || '').trim();
    })
    .filter(Boolean);
};

const CopyButton = ({ value }) => {
  const [copied, setCopied] = useState(false);
  const text = String(value || '').trim();
  if (!text) return null;

  const copy = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={copy}
      className={joinClasses(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[var(--c-muted)] transition',
        copied
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-[var(--c-border)] bg-[var(--c-panel)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]',
      )}
      title={copied ? 'Copied' : 'Copy'}
    >
      <Icon strokeWidth={1.7} className="h-3 w-3" />
    </button>
  );
};

const InfoRow = ({ label, values, copyable = false }) => {
  const list = normalizeList(values);
  if (list.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--c-muted)]">{label}</p>
      <div className="space-y-1">
        {list.map((item) => (
          <div key={`${label}-${item}`} className="flex min-w-0 items-center gap-2 rounded-xl bg-[var(--c-panel)] px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[var(--c-text)]">{item}</span>
            {copyable ? <CopyButton value={item} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

const QuickInfoTooltip = ({
  fullName = '',
  identity = '',
  mobiles = [],
  emails = [],
  parentClientName = '',
  parentClientId = '',
  className = '',
}) => {
  const hasParent = String(parentClientName || parentClientId || '').trim();

  return (
    <div
      className={joinClasses(
        'pointer-events-none absolute left-0 top-full z-[120] mt-2 w-[min(22rem,calc(100vw-2rem))] opacity-0 transition duration-150',
        'group-hover/identity:pointer-events-auto group-hover/identity:opacity-100 group-focus-within/identity:pointer-events-auto group-focus-within/identity:opacity-100',
        className,
      )}
    >
      <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3 text-left shadow-2xl">
        <div className="space-y-2">
          <InfoRow label="Full Name" values={fullName} />
          <InfoRow label="License / ID" values={identity} copyable />
          {hasParent ? (
            <InfoRow
              label="Under"
              values={`${parentClientName || 'Parent Client'}${parentClientId ? ` (${parentClientId})` : ''}`}
            />
          ) : null}
          <InfoRow label="Mobile" values={mobiles} copyable />
          <InfoRow label="Email" values={emails} copyable />
        </div>
      </div>
    </div>
  );
};

export default QuickInfoTooltip;
