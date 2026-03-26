/**
 * Helper to wrap navigate() calls with route transition progress
 * Usage: Instead of navigate(path), use navigateWithTransition(path, navigate, onNavigate)
 */
export const navigateWithTransition = (path, navigate, onNavigate, options = {}) => {
  onNavigate(options);
  navigate(path);
};
