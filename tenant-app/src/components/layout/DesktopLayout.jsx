import { useState, useEffect, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import '../../styles/desktop/layout.css';
import AppFooter from './AppFooter';
import AppSidebar from './AppSidebar';
import DesktopHeader from './DesktopHeader';
import BotFloatingButton from './BotFloatingButton';
import { useTenantNotifications } from '../../hooks/useTenantNotifications';
import { useTenant } from '../../context/useTenant';
import useElectronLayoutMode, { LAYOUT_MINI, LAYOUT_COMPACT, LAYOUT_STANDARD, LAYOUT_WIDE, modeToDensityTier } from '../../hooks/useElectronLayoutMode';

const DesktopLayout = ({ tenant, user, onLogout }) => {
  const { tenantId } = useTenant();
  const hasNativeTitleBar = typeof window !== 'undefined' && Boolean(window.electron?.windowControls);
  const { layoutMode, setMode, overrideMode } = useElectronLayoutMode();
  const densityTier = modeToDensityTier(layoutMode);

  // Default: collapsed (true) unless user has explicitly saved 'open' (='false')
  const savedCollapsed = localStorage.getItem('acis_sidebar_collapsed');
  const [userToggled, setUserToggled] = useState(savedCollapsed !== 'false');
  const [overlayOpen, setOverlayOpen] = useState(false);

  // Effective sidebar visibility per mode
  const sidebarState = useMemo(() => {
    // mini: sidebar is fully hidden, user can open it as an overlay via hamburger
    if (layoutMode === LAYOUT_MINI) return { hidden: true, collapsed: false };
    // compact: icon-only strip, no toggle (window too narrow for labels)
    if (layoutMode === LAYOUT_COMPACT) return { hidden: false, collapsed: true };
    // standard & wide: both respect userToggled so Collapse/Expand button always works
    return { hidden: false, collapsed: userToggled };
  }, [layoutMode, userToggled]);

  // Persist sidebar preference for STANDARD and WIDE modes
  useEffect(() => {
    if (layoutMode === LAYOUT_STANDARD || layoutMode === LAYOUT_WIDE) {
      localStorage.setItem('acis_sidebar_collapsed', userToggled ? 'true' : 'false');
    }
  }, [userToggled, layoutMode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-layout-mode', layoutMode);
    root.setAttribute('data-density', densityTier);
    return () => {
      root.removeAttribute('data-layout-mode');
      root.removeAttribute('data-density');
    };
  }, [layoutMode, densityTier]);

  // Overlay is only meaningful in mini mode; it auto-closes when mode changes because
  // effectiveOverlayOpen is gated on layoutMode === LAYOUT_MINI
  const effectiveOverlayOpen = layoutMode === LAYOUT_MINI && overlayOpen;

  const toggleSidebar = () => {
    if (layoutMode === LAYOUT_MINI) {
      setOverlayOpen(prev => !prev);
    } else if (layoutMode === LAYOUT_COMPACT) {
      // No toggle in compact — always collapsed icon-only
      return;
    } else {
      setUserToggled(prev => !prev);
    }
  };

  const { unreadCount, recentNotifications, markAsRead } = useTenantNotifications(tenantId, user);

  return (
    <div
      className="desktop-shell bg-transparent"
      data-layout-mode={layoutMode}
      data-density={densityTier}
      style={{
        height: hasNativeTitleBar ? 'calc(100dvh - var(--d-shell-titlebar-h))' : '100dvh',
        background: 'transparent',
      }}
    >
      <DesktopHeader
        tenant={tenant}
        user={user}
        notificationCount={unreadCount}
        recentNotifications={recentNotifications}
        onNotificationRead={markAsRead}
        onLogout={onLogout}
        layoutMode={layoutMode}
        setMode={setMode}
        overrideMode={overrideMode}
        onToggleSidebar={toggleSidebar}
      />
      <div
        className="desktop-frame flex flex-1 min-h-0 relative"
        style={{
          padding: '0 var(--d-shell-main-pad-x) var(--d-shell-main-pad-y) var(--d-shell-main-pad-x)',
          gap: 'var(--d-shell-main-pad-x)'
        }}
      >
        {/* Overlay backdrop for mini mode */}
        {effectiveOverlayOpen && (
          <div
            className="desktop-sidebar-backdrop"
            onClick={() => setOverlayOpen(false)}
          />
        )}
        <AppSidebar
          isCollapsed={sidebarState.collapsed}
          isHidden={sidebarState.hidden}
          isOverlay={effectiveOverlayOpen}
          layoutMode={layoutMode}
          onToggle={toggleSidebar}
        />
        <div className="desktop-content flex flex-1 flex-col min-w-0 border border-[var(--c-border)] glass rounded-2xl overflow-hidden relative shadow-sm">
          <main className="desktop-main compact-shell-main relative z-10 flex-1 overflow-y-auto scrollbar-hide">
            <Outlet context={{ layoutMode }} />
          </main>
          <div className="relative z-10">
            <AppFooter appName="ACIS" />
          </div>
        </div>
      </div>
      <BotFloatingButton />
    </div>
  );
};

export default DesktopLayout;
