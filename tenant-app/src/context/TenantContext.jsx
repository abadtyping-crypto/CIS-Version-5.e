import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_TENANT_ID, TENANTS, findTenantById } from '../config/tenants';
import { getTenantSettingDoc } from '../lib/backendStore';
import { TenantContext } from './TenantContextValue';

export const TenantProvider = ({ children }) => {
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [uiBrandName, setUiBrandName] = useState('');
  const baseTenant = findTenantById(tenantId) || findTenantById(DEFAULT_TENANT_ID);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    const handle = requestAnimationFrame(() => {
      setUiBrandName('');
      getTenantSettingDoc(tenantId, 'branding').then((result) => {
        if (!active) return;
        if (!result?.ok || !result?.data) return;
        const branding = result.data;
        const nextName = String(branding.brandName || branding.companyName || '').trim();
        setUiBrandName(nextName);
      });
    });

    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [tenantId]);

  const tenant = useMemo(() => {
    if (!baseTenant) return null;
    const effectiveName = uiBrandName || baseTenant.name;
    return {
      ...baseTenant,
      name: effectiveName,
      defaultName: baseTenant.name,
    };
  }, [baseTenant, uiBrandName]);

  const value = useMemo(
    () => ({
      tenantId,
      tenant,
      tenants: TENANTS,
      setTenantId,
    }),
    [tenantId, tenant],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
