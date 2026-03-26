import { useEffect, useState } from 'react';
import { SHELL_MODE_DESKTOP, getUiShellMode } from '../lib/uiShellMode';

const readDesktopMode = () => {
  // Always use desktop shell on wide web viewports.
  if (typeof window !== 'undefined' && window.innerWidth >= 1024) return true;
  return getUiShellMode() === SHELL_MODE_DESKTOP;
};

const useIsDesktopLayout = () => {
  const [isDesktop, setIsDesktop] = useState(() => readDesktopMode());

  useEffect(() => {
    const onPopState = () => setIsDesktop(readDesktopMode());
    const onResize = () => setIsDesktop(readDesktopMode());
    window.addEventListener('popstate', onPopState);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return isDesktop;
};

export default useIsDesktopLayout;
