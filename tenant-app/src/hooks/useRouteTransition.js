import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useGlobalProgress } from './useGlobalProgress';
import { PROGRESS_PRESETS } from '../config/progressPresets';

/**
 * Hook for managing route transitions with global progress overlay
 * 
 * Usage:
 * const { onNavigate, isTransitioning } = useRouteTransition();
 * // Call onNavigate() before triggering navigation
 * // Or let it detect route changes automatically
 */
export const useRouteTransition = (options = {}) => {
  const location = useLocation();
  const { startProgress, finishProgress } = useGlobalProgress();
  const progressIdRef = useRef(null);
  const lastLocationRef = useRef(location);
  const navigationStartRef = useRef(null);
  const isManualNavigationRef = useRef(false);

  const minVisibleMs = options.minVisibleMs ?? 500;
  const speedThresholdMs = options.speedThresholdMs ?? 100; // Only show if wait time exceeds this

  /**
   * Call this BEFORE navigating to show progress immediately
   * Proactive trigger - for known navigation actions
   */
  const onNavigate = useCallback((config = {}) => {
    // Clear any existing progress from previous navigation
    if (progressIdRef.current) {
      finishProgress(progressIdRef.current);
      progressIdRef.current = null;
    }

    // Mark that we're in a manual navigation
    navigationStartRef.current = Date.now();
    isManualNavigationRef.current = true;

    // Start showing progress with route transition preset
    const presetConfig = {
      ...PROGRESS_PRESETS.ROUTE_CHANGE,
      minVisibleMs,
      ...config
    };

    progressIdRef.current = startProgress(presetConfig);
  }, [finishProgress, minVisibleMs, startProgress]);

  /**
   * For browser back/forward - detect via popstate
   * Reactive trigger - for native history navigation
   */
  useEffect(() => {
    const handlePopState = () => {
      // Only show progress if it's been a while (to avoid flicker on instant navigation)
      const now = Date.now();
      const timeSinceLastNav = now - (navigationStartRef.current || now);
      
      // Only trigger if we're not already in a manual navigation
      if (!isManualNavigationRef.current && timeSinceLastNav > speedThresholdMs) {
        onNavigate();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onNavigate, speedThresholdMs]);

  /**
   * Detect route changes and finish progress
   * This runs AFTER the route has changed
   */
  useEffect(() => {
    // Check if we've actually navigated (pathname or key changed)
    const isNewRoute = 
      location.pathname !== lastLocationRef.current.pathname ||
      location.key !== lastLocationRef.current.key;

    if (isNewRoute) {
      // Route has changed - finish any active progress
      if (progressIdRef.current) {
        finishProgress(progressIdRef.current);
        progressIdRef.current = null;
      }

      // Reset flags for next navigation
      isManualNavigationRef.current = false;
      navigationStartRef.current = null;
    }

    lastLocationRef.current = location;
  }, [location, finishProgress]);

  return {
    onNavigate,
    isTransitioning: () => Boolean(progressIdRef.current),
    getCurrentProgressId: () => progressIdRef.current,
  };
};
