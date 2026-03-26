import { useCallback, useMemo, useRef, useState } from 'react';
import { RecycleBinContext } from './RecycleBinContextValue';

export const RecycleBinProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const restoreListeners = useRef(new Set());

  const openRecycleBin = useCallback(() => setIsOpen(true), []);
  const closeRecycleBin = useCallback(() => setIsOpen(false), []);
  const registerRestoreListener = useCallback((listener) => {
    restoreListeners.current.add(listener);
    return () => {
      restoreListeners.current.delete(listener);
    };
  }, []);

  const notifyRestore = useCallback(() => {
    restoreListeners.current.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.warn('[RecycleBinContext] restore listener failed', error);
      }
    });
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      openRecycleBin,
      closeRecycleBin,
      registerRestoreListener,
      notifyRestore,
    }),
    [isOpen, openRecycleBin, closeRecycleBin, registerRestoreListener, notifyRestore],
  );

  return <RecycleBinContext.Provider value={value}>{children}</RecycleBinContext.Provider>;
};
