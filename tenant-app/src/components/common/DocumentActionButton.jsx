import React from 'react';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

const TONE_CLASS_MAP = {
  neutral: 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_74%,var(--c-surface)_26%)]',
  success: 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-success)] hover:bg-[color:color-mix(in_srgb,var(--c-success)_10%,var(--c-surface))]',
  danger: 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-danger)] hover:bg-[color:color-mix(in_srgb,var(--c-danger)_10%,var(--c-surface))]',
  accent: 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-accent)] hover:bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-surface))]',
};

export default function DocumentActionButton({
  icon: Icon,
  iconUrl = '',
  iconAlt = '',
  label,
  tone = 'neutral',
  onClick,
  disabled = false,
  className = '',
}) {
  const resolvedIconUrl = String(iconUrl || '').trim();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={joinClasses(
        'inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black shadow-[0_10px_28px_-24px_color-mix(in_srgb,var(--c-text)_75%,transparent)] transition hover:border-[color:color-mix(in_srgb,var(--c-border)_62%,var(--c-accent)_38%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-surface)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
        TONE_CLASS_MAP[tone] || TONE_CLASS_MAP.neutral,
        className,
      )}
    >
      {resolvedIconUrl ? (
        <img
          src={resolvedIconUrl}
          alt={iconAlt || `${label} icon`}
          className="h-4 w-4 rounded object-cover"
        />
      ) : Icon ? <Icon strokeWidth={1.5} className="h-4 w-4" /> : null}
      {label}
    </button>
  );
}
