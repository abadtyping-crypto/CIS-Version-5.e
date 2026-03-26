import PortalMethodSelectField from './PortalMethodSelectField';
import PortalSelectField from './PortalSelectField';

const PortalTransactionSelector = ({
  portalLabel = 'Portal',
  methodLabel = 'Transaction Method',
  portalId = '',
  methodId = '',
  onPortalChange,
  onMethodChange,
  portals = [],
  portal = null,
  portalPlaceholder = 'Select Portal',
  methodPlaceholder = 'Select Method',
  disabled = false,
  excludePortalId = '',
  showBalancePanel = false,
  showBalance = false,
  onToggleBalance,
  projectedBalance = null,
  currentBalanceTitle = 'Current Balance',
  projectedBalanceTitle = 'New Balance',
  hideMethodUntilPortal = true,
  className = '',
}) => {
  const wrapperClass = [
    'rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClass}>
      <div className="space-y-3">
        <PortalSelectField
          label={portalLabel}
          value={portalId}
          onChange={onPortalChange}
          portals={portals}
          placeholder={portalPlaceholder}
          disabled={disabled}
          excludePortalId={excludePortalId}
          showBalancePanel={showBalancePanel}
          showBalance={showBalance}
          onToggleBalance={onToggleBalance}
          projectedBalance={projectedBalance}
          currentBalanceTitle={currentBalanceTitle}
          projectedBalanceTitle={projectedBalanceTitle}
        />

        {!hideMethodUntilPortal || portalId ? (
          <PortalMethodSelectField
            label={methodLabel}
            value={methodId}
            onChange={onMethodChange}
            portal={portal}
            placeholder={portal ? methodPlaceholder : 'Select portal first'}
            disabled={disabled || !portal}
          />
        ) : null}
      </div>
    </div>
  );
};

export default PortalTransactionSelector;
