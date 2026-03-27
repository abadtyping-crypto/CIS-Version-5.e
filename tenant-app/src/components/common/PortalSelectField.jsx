import { Eye, EyeOff } from 'lucide-react';
import IconSelect from './IconSelect';
import DirhamIcon from './DirhamIcon';
import { resolvePortalTypeIcon } from '../../lib/transactionMethodConfig';

const fallbackPortalIcon = (type) => resolvePortalTypeIcon(type);

const PortalSelectField = ({
  label = 'Portal',
  value = '',
  onChange,
  portals = [],
  placeholder = 'Select Portal',
  disabled = false,
  excludePortalId = '',
  showBalancePanel = false,
  showBalance = false,
  onToggleBalance,
  hiddenBalanceLabel = 'XXXXXX.XX',
  projectedBalance = null,
  currentBalanceTitle = 'Current Balance',
  projectedBalanceTitle = 'New Balance',
}) => {
  const selectedPortal = portals.find((item) => item.id === value) || null;
  const options = portals
    .filter((item) => item.id !== excludePortalId)
    .map((item) => ({
      value: item.id,
      label: item.name || item.displayPortalId || item.id,
      icon: item.iconUrl || fallbackPortalIcon(item.type),
      meta: '',
    }));

  const formatBalance = (amountValue) => Number(amountValue || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const currentBalance = Number(selectedPortal?.balance || 0);
  const hasProjectedBalance = projectedBalance !== null && projectedBalance !== undefined && Number.isFinite(Number(projectedBalance));
  const nextBalance = hasProjectedBalance ? Number(projectedBalance) : currentBalance;

  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">{label}</label>
      <div className="mt-1">
        <IconSelect
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          disabled={disabled}
          leftIconSlot
          defaultIconId="custom_icon_2"
        />
      </div>
      {showBalancePanel && selectedPortal ? (
        <div className="compact-section mt-2 flex items-start justify-between rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)]">
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">{currentBalanceTitle}</p>
              <p className={`mt-1 inline-flex items-center gap-2 text-sm font-semibold ${currentBalance < 0 ? 'text-[var(--c-danger)]' : 'text-[var(--c-success)]'}`}>
                <DirhamIcon className="h-4 w-4 text-[var(--c-muted)]" />
                {showBalance ? formatBalance(currentBalance) : hiddenBalanceLabel}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">{projectedBalanceTitle}</p>
              <p className={`mt-1 inline-flex items-center gap-2 text-sm font-semibold ${nextBalance < 0 ? 'text-[var(--c-danger)]' : 'text-[var(--c-success)]'}`}>
                <DirhamIcon className="h-4 w-4 text-[var(--c-muted)]" />
                {showBalance ? formatBalance(nextBalance) : hiddenBalanceLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleBalance}
            className="compact-icon-action inline-flex items-center justify-center rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-text)]"
            aria-label={showBalance ? 'Hide balance' : 'Show balance'}
          >
            {showBalance ? <EyeOff strokeWidth={1.5} className="h-4 w-4" /> : <Eye strokeWidth={1.5} className="h-4 w-4" />}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default PortalSelectField;
