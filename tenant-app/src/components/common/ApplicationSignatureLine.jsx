import CurrencyValue from './CurrencyValue';
import CreatedByIdentityCard from './CreatedByIdentityCard';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

export default function ApplicationSignatureLine({
  name = '',
  iconUrl = '',
  qty = null,
  amount = 0,
  subtitle = '',
  hideIcon = false,
  hideQuantity = false,
  hideAmount = false,
  showCreator = false,
  createdByUid = '',
  createdByName = '',
  createdByAvatarUrl = '',
  createdByRole = '',
  withCard = true,
  className = '',
  bodyClassName = '',
  titleClassName = '',
  creatorClassName = '',
  fallbackIconUrl = '/defaultIcons/documents.png',
}) {
  const resolvedName = String(name || '').trim() || 'Application';
  const resolvedIcon = String(iconUrl || '').trim() || fallbackIconUrl;
  const hasQty = qty !== null && qty !== undefined && String(qty).trim() !== '';

  return (
    <div
      className={joinClasses(
        'min-w-0 flex items-stretch gap-0',
        withCard
          ? 'overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]'
          : '',
        className,
      )}
    >
      {!hideIcon ? (
        <div className={joinClasses(
          'relative h-14 w-14 shrink-0 overflow-hidden',
          withCard
            ? 'border-r border-[var(--c-border)] bg-[var(--c-surface)]'
            : 'rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)]',
        )}>
          <img
            src={resolvedIcon}
            alt=""
            className="absolute inset-0 h-full w-full rounded-[inherit] object-cover"
            onError={(event) => {
              if (event.currentTarget.dataset.fallbackApplied === '1') return;
              event.currentTarget.dataset.fallbackApplied = '1';
              event.currentTarget.src = fallbackIconUrl;
            }}
          />
        </div>
      ) : null}

      <div className={joinClasses(
        'min-w-0 flex flex-1 items-center justify-between gap-3 px-3 py-2',
        bodyClassName,
      )}>
        <div className="min-w-0 flex-1">
          <p className={joinClasses('truncate text-sm font-black text-[var(--c-text)]', titleClassName)}>
            {resolvedName}
          </p>
          {subtitle ? (
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--c-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>

        {(!hideQuantity || !hideAmount) ? (
          <div className="shrink-0 text-right">
            {!hideQuantity && hasQty ? (
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--c-muted)]">
                Qty {qty}
              </p>
            ) : null}
            {!hideAmount ? (
              <div className="text-sm font-black text-[var(--c-text)]">
                <CurrencyValue value={amount || 0} iconSize="h-3 w-3" />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showCreator ? (
        <div className={joinClasses('shrink-0 border-l border-[var(--c-border)] p-1.5', creatorClassName)}>
          <CreatedByIdentityCard
            uid={createdByUid}
            displayName={createdByName}
            avatarUrl={createdByAvatarUrl}
            role={createdByRole}
            className="min-w-[170px]"
          />
        </div>
      ) : null}
    </div>
  );
}
