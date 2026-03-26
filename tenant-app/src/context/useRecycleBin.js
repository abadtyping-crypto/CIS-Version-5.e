import { useContext } from 'react';
import { RecycleBinContext } from './RecycleBinContextValue';

export const useRecycleBin = () => {
  const context = useContext(RecycleBinContext);
  if (!context) {
    throw new Error('useRecycleBin must be used within a RecycleBinProvider');
  }
  return context;
};
