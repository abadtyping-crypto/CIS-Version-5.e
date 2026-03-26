import useIsDesktopLayout from '../hooks/useIsDesktopLayout';
import MobileProfilePage from './MobileProfilePage';
import ProfilePage from './ProfilePage';

const AdaptiveProfilePage = () => {
  const isDesktop = useIsDesktopLayout();
  if (isDesktop) return <ProfilePage />;
  return <MobileProfilePage />;
};

export default AdaptiveProfilePage;
