import { useGlobalProgress } from '../../hooks/useGlobalProgress';
import ProgressOverlay from './ProgressOverlay';
import { PROGRESS_SCOPE } from '../../config/progressPresets';

const GlobalProgressController = () => {
  const { progressStack } = useGlobalProgress();

  // Find the highest priority global or route progress item to show
  const activeItem = Object.values(progressStack)
    .filter(item => item.scope === PROGRESS_SCOPE.GLOBAL || item.scope === PROGRESS_SCOPE.ROUTE)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];

  if (!activeItem) return null;

  return <ProgressOverlay item={activeItem} />;
};

export default GlobalProgressController;
