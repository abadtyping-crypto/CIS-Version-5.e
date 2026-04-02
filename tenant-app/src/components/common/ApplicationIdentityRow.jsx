import React from 'react';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

export default function ApplicationIdentityRow({
  name,
  subtitle = '',
  iconUrl = '',
  fallbackIconUrl = '/defaultIcons/documents.png',
  className = '',
  nameClassName = '',
  subtitleClassName = '',
  iconFrameClassName = '',
  iconImageClassName = '',
}) {
  const resolvedName = String(name || '').trim() || 'Application';
  const resolvedIcon = String(iconUrl || '').trim() || fallbackIconUrl;

  return (
    <div className={joinClasses('flex min-w-0 items-center gap-3', className)}>
      <div
        className={joinClasses(
          'h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)]',
          iconFrameClassName,
        )}
      >
        <img
          src={resolvedIcon}
          alt=""
          className={joinClasses('h-full w-full rounded-[inherit] object-cover', iconImageClassName)}
          onError={(event) => {
            if (event.currentTarget.dataset.fallbackApplied === '1') return;
            event.currentTarget.dataset.fallbackApplied = '1';
            event.currentTarget.src = fallbackIconUrl;
          }}
        />
      </div>
      <div className="min-w-0">
        <p className={joinClasses('truncate text-sm font-black text-[var(--c-text)]', nameClassName)}>{resolvedName}</p>
        {subtitle ? (
          <p className={joinClasses('truncate text-[10px] font-bold text-[var(--c-muted)]', subtitleClassName)}>{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
