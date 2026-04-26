import React from 'react';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

const TONE_CLASS_MAP = {
  neutral: 'border-[var(--c-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--c-surface)_82%,white_18%),color-mix(in_srgb,var(--c-panel)_86%,black_14%))] text-[var(--c-text)] hover:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--c-surface)_88%,white_12%),color-mix(in_srgb,var(--c-panel)_92%,black_8%))]',
  success: 'border-[color:color-mix(in_srgb,var(--c-success)_34%,var(--c-border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--c-success)_14%,var(--c-surface)),color-mix(in_srgb,var(--c-success)_6%,var(--c-panel)))] text-[var(--c-success)] hover:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--c-success)_18%,var(--c-surface)),color-mix(in_srgb,var(--c-success)_9%,var(--c-panel)))]',
  danger: 'border-[color:color-mix(in_srgb,var(--c-danger)_34%,var(--c-border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--c-danger)_14%,var(--c-surface)),color-mix(in_srgb,var(--c-danger)_6%,var(--c-panel)))] text-[var(--c-danger)] hover:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--c-danger)_18%,var(--c-surface)),color-mix(in_srgb,var(--c-danger)_9%,var(--c-panel)))]',
  accent: 'border-[color:color-mix(in_srgb,var(--c-accent)_36%,var(--c-border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--c-accent)_14%,var(--c-surface)),color-mix(in_srgb,var(--c-accent)_6%,var(--c-panel)))] text-[var(--c-accent)] hover:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--c-accent)_18%,var(--c-surface)),color-mix(in_srgb,var(--c-accent)_9%,var(--c-panel)))]',
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
      title={label}
      aria-label={label}
      className={joinClasses(
        'inline-flex min-h-[44px] w-full flex-wrap items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-[11px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_12px_24px_-20px_color-mix(in_srgb,var(--c-text)_70%,transparent)] transition hover:border-[color:color-mix(in_srgb,var(--c-border)_58%,var(--c-accent)_42%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-surface)] active:translate-y-[1px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_8px_16px_-14px_color-mix(in_srgb,var(--c-text)_60%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-xs',
        TONE_CLASS_MAP[tone] || TONE_CLASS_MAP.neutral,
        className,
      )}
    >
      {resolvedIconUrl ? (
        <img
          src={resolvedIconUrl}
          alt={iconAlt || `${label} icon`}
          className="h-4 w-4 shrink-0 rounded object-cover"
        />
      ) : Icon ? <Icon strokeWidth={1.5} className="h-4 w-4 shrink-0" /> : null}
      <span className="min-w-0 max-w-full text-center leading-tight break-words" style={{ overflowWrap: 'anywhere' }}>
        {label}
      </span>
    </button>
  );
}
