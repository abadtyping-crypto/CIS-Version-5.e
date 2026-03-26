import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { useTenant } from '../../context/useTenant';
import useIsDesktopLayout from '../../hooks/useIsDesktopLayout';
import DesktopLayout from './DesktopLayout';
import MobileLayout from './MobileLayout';
import RecycleBinSidebar from '../portal/RecycleBinSidebar';
import { RecycleBinProvider } from '../../context/RecycleBinContext';
import { getRuntimePlatform, PLATFORM_ELECTRON } from '../../lib/runtimePlatform';

const isHexColor = (value) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value || '').trim());

const toHex6 = (value, fallback) => {
  const next = String(value || '').trim();
  if (!isHexColor(next)) return fallback;
  if (next.length === 7) return next.toUpperCase();
  const chars = next.slice(1).split('');
  return `#${chars.map((char) => `${char}${char}`).join('')}`.toUpperCase();
};

const hexToRgba = (hex, alpha = 1) => {
  const safe = toHex6(hex, '#E67E22').slice(1);
  const r = Number.parseInt(safe.slice(0, 2), 16);
  const g = Number.parseInt(safe.slice(2, 4), 16);
  const b = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};



const AppLayout = () => {
  const { tenant } = useTenant();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useIsDesktopLayout();
  const runtimePlatform = getRuntimePlatform();
  const useDesktopLayout = runtimePlatform === PLATFORM_ELECTRON ? true : isDesktop;

  useEffect(() => {
    if (useDesktopLayout) return;
    
    // Fallback for mobile/non-desktop branding
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const primary = toHex6(tenant?.brandColor, '#E67E22');
    root.style.setProperty('--c-accent', primary);
    root.style.setProperty('--c-accent-2', '#F39C12');
    root.style.setProperty('--c-accent-3', '#E6B054');
    root.style.setProperty('--c-ring', hexToRgba(primary, 0.24));
    root.style.setProperty('--brand-gradient', `linear-gradient(125deg, ${primary} 0%, #F39C12 54%, #E6B054 100%)`);
  }, [tenant?.brandColor, useDesktopLayout]);

  const onLogout = () => {
    logout();
    navigate(`/t/${tenant.id}/login`, { replace: true });
  };

  if (!user) return null;

  return (
    <RecycleBinProvider>
      {useDesktopLayout ? (
        <DesktopLayout tenant={tenant} user={user} onLogout={onLogout} />
      ) : (
        <MobileLayout tenant={tenant} user={user} onLogout={onLogout} />
      )}
      <RecycleBinSidebar />
    </RecycleBinProvider>
  );
};

export default AppLayout;

