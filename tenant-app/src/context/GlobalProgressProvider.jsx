import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GlobalProgressContext } from './GlobalProgressContext';
import { PROGRESS_STATUS, PROGRESS_PRESETS } from '../config/progressPresets';

export const GlobalProgressProvider = ({ children }) => {
  const [progressStack, setProgressStack] = useState({});
  const timers = useRef({});

  // Cleanup all timers on unmount
  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      Object.values(timerMap).forEach(clearTimeout);
    };
  }, []);

  const removeProgress = useCallback((id) => {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    setProgressStack(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const startProgress = useCallback((config) => {
    // 1. Resolve preset if provided
    const presetConfig = config.preset && PROGRESS_PRESETS[config.preset] 
      ? PROGRESS_PRESETS[config.preset] 
      : {};
    
    // Merge: Defaults < Preset < Config
    const mergedConfig = { ...presetConfig, ...config };
    const id = mergedConfig.id || `op-${Date.now()}`;
    const startTime = Date.now();

    // CRITICAL: If the same ID is restarting, cancel its old timer to prevent deletion of new item
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }

    setProgressStack(prev => ({
      ...prev,
      [id]: {
        ...mergedConfig,
        id,
        status: PROGRESS_STATUS.LOADING,
        startTime,
        message: mergedConfig.message || (mergedConfig.messages ? mergedConfig.messages[0] : ''),
        progress: 0,
        error: null
      }
    }));
    return id;
  }, []);

  const updateProgress = useCallback((id, patch) => {
    setProgressStack(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], ...patch }
      };
    });
  }, []);

  const finishProgress = useCallback((id, options = {}) => {
    let waitTime = 0;
    let shouldRemove = false;

    setProgressStack(prev => {
      const item = prev[id];
      if (!item || item.status === PROGRESS_STATUS.SUCCESS) return prev;

      const elapsed = Date.now() - item.startTime;
      const minVisible = item.minVisibleMs || 0;
      waitTime = Math.max(0, minVisible - elapsed);
      shouldRemove = true;

      return {
        ...prev,
        [id]: { ...item, status: PROGRESS_STATUS.SUCCESS, progress: 100 }
      };
    });

    // SIDE EFFECTS ONLY OUTSIDE UPDATER
    // Guard: Only set timer if we actually updated the state
    if (shouldRemove) {
      if (timers.current[id]) clearTimeout(timers.current[id]);
      
      timers.current[id] = setTimeout(() => {
        removeProgress(id);
        if (options.onComplete) options.onComplete();
      }, waitTime);
    }
  }, [removeProgress]);

  const failProgress = useCallback((id, error, options = {}) => {
    let shouldRemove = false;

    setProgressStack(prev => {
      const item = prev[id];
      if (!item) return prev;

      if (options.persistent === false) {
        shouldRemove = true;
        return prev;
      }

      return {
        ...prev,
        [id]: { ...item, status: PROGRESS_STATUS.ERROR, error }
      };
    });

    if (shouldRemove) {
      removeProgress(id);
    }
  }, [removeProgress]);

  const runWithProgress = useCallback(async (asyncFn, config = {}) => {
    const id = startProgress(config);
    try {
      const result = await asyncFn(id);
      finishProgress(id, config);
      return result;
    } catch (err) {
      failProgress(id, err.message || 'Operation failed', config);
      throw err;
    }
  }, [startProgress, finishProgress, failProgress]);

  const value = useMemo(() => ({
    progressStack,
    startProgress,
    updateProgress,
    finishProgress,
    failProgress,
    runWithProgress
  }), [progressStack, startProgress, updateProgress, finishProgress, failProgress, runWithProgress]);

  return (
    <GlobalProgressContext.Provider value={value}>
      {children}
    </GlobalProgressContext.Provider>
  );
};
