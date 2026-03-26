import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import '../../styles/mobile/layout.css';
import MobileBottomBar from './MobileBottomBar';
import MobileHeader from './MobileHeader';
import { MOBILE_APPEARANCE_EVENT, readMobileAppearance } from '../../lib/mobileAppearance';

const MobileLayout = ({ tenant, user, onLogout }) => {
  const hasNativeTitleBar = typeof window !== 'undefined' && Boolean(window.electron?.windowControls);
  const [appearance, setAppearance] = useState(() => readMobileAppearance());

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const syncAppearance = () => setAppearance(readMobileAppearance());
    const onAppearance = (event) => {
      const next = event?.detail;
      if (next?.wallpaper && next?.iconStyle) {
        setAppearance(next);
        return;
      }
      syncAppearance();
    };
    window.addEventListener('storage', syncAppearance);
    window.addEventListener(MOBILE_APPEARANCE_EVENT, onAppearance);
    return () => {
      window.removeEventListener('storage', syncAppearance);
      window.removeEventListener(MOBILE_APPEARANCE_EVENT, onAppearance);
    };
  }, []);

  return (
    <div
      className="mobile-shell min-h-screen bg-transparent"
      data-mobile-wallpaper={appearance.wallpaper}
      data-mobile-icon-style={appearance.iconStyle}
      style={{ height: hasNativeTitleBar ? 'calc(100dvh - 2.25rem)' : '100dvh' }}
    >
      <MobileHeader tenant={tenant} user={user} onLogout={onLogout} />
      <main className="mobile-main relative px-2 py-3">
        <div className="relative z-10">
          <Outlet />
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default MobileLayout;
