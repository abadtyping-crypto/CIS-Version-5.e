import { useContext } from 'react';
import { GlobalProgressContext } from '../context/GlobalProgressContext';

export const useGlobalProgress = () => {
  const context = useContext(GlobalProgressContext);
  if (!context) {
    throw new Error('useGlobalProgress must be used within a GlobalProgressProvider');
  }
  return context;
};
