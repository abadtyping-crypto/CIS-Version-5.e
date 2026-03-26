import { useEffect, useMemo, useState } from 'react';
import IconSelect from './IconSelect';
import { resolveDefaultTransactionMethodIcon, resolvePortalMethodDefinitions } from '../../lib/transactionMethodConfig';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../../lib/systemAssetsCache';

const METHOD_ASSET_MAP = {
  cashByHand: ['icon_method_cash'],
  bankTransfer: ['icon_method_bank_transfer'],
  cdmDeposit: ['icon_method_cdm_deposit', 'icon_method_bank_transfer'],
  checqueDeposit: ['icon_method_cheque'],
  onlinePayment: ['icon_method_online'],
  cashWithdrawals: ['icon_method_cash_withdrawals', 'icon_method_cash'],
  tabby: ['icon_method_tabby'],
  tamara: ['icon_method_tamara'],
};

const PortalMethodSelectField = ({
  label = 'Transaction Method',
  value = '',
  onChange,
  portal = null,
  placeholder = 'Select Method',
  disabled = false,
}) => {
  const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());

  useEffect(() => {
    let isMounted = true;
    getSystemAssets()
      .then((snapshot) => {
        if (!isMounted) return;
        setSystemAssets(snapshot || {});
      })
      .catch(() => {
        // Keep fallback icon behavior if system assets fail.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const options = useMemo(() => (
    resolvePortalMethodDefinitions(portal?.customMethods || [])
      .filter((method) => Array.isArray(portal?.methods) && portal.methods.includes(method.id))
      .map((method) => ({
        value: method.id,
        label: method.label || method.id,
        icon: (() => {
          const systemKeys = METHOD_ASSET_MAP[method.id] || [];
          for (const key of systemKeys) {
            if (key && systemAssets?.[key]?.iconUrl) {
              return systemAssets[key].iconUrl;
            }
          }
          return method.iconUrl || resolveDefaultTransactionMethodIcon(method.id) || method.Icon || null;
        })(),
      }))
  ), [portal, systemAssets]);

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
        />
      </div>
    </div>
  );
};

export default PortalMethodSelectField;
