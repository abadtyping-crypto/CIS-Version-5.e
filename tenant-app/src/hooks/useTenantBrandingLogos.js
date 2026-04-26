import { useEffect, useMemo, useState } from 'react';
import { getTenantSettingDoc } from '../lib/backendStore';

const resolveLogoSlotUrl = (branding, slotKey, fallbackUrl) => {
  const fallback = String(fallbackUrl || '/logo.png').trim() || '/logo.png';
  if (!branding || typeof branding !== 'object') return fallback;

  const hasLogoUsage = branding.logoUsage && typeof branding.logoUsage === 'object';
  const slotId = String(branding.logoUsage?.[slotKey] || '').trim();
  const logoLibrary = Array.isArray(branding.logoLibrary) ? branding.logoLibrary : [];
  const activeLogoUrl = String(branding.activeLogoUrl || '').trim();
  if (!slotId) return hasLogoUsage ? '' : activeLogoUrl || fallback;
  if (logoLibrary.length === 0) return activeLogoUrl || fallback;

  const matchedSlot = logoLibrary.find((slot) => String(slot?.slotId || '').trim() === slotId);
  const slotUrl = String(matchedSlot?.url || '').trim();
  return slotUrl || activeLogoUrl || fallback;
};

export const useTenantBrandingLogos = (tenantId, fallbackLogoUrl) => {
  const fallback = String(fallbackLogoUrl || '/logo.png').trim() || '/logo.png';
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    let active = true;
    if (!tenantId) return undefined;

    getTenantSettingDoc(tenantId, 'branding').then((result) => {
      if (!active) return;
      setBranding(result?.ok ? result.data || null : null);
    });

    return () => {
      active = false;
    };
  }, [tenantId]);

  return useMemo(() => ({
    headerLogoUrl: resolveLogoSlotUrl(branding, 'header', fallback),
    loginLogoUrl: resolveLogoSlotUrl(branding, 'login', fallback),
    footerLogoUrl: resolveLogoSlotUrl(branding, 'footer', fallback),
    brandName: String(branding?.brandName || '').trim(),
    companyName: String(branding?.companyName || '').trim(),
  }), [branding, fallback]);
};
