import { useState, useEffect, useMemo } from 'react';
import ActionProgressOverlay from '../common/ActionProgressOverlay';

const ProgressOverlay = ({ item }) => {
  const [messageIndex, setMessageIndex] = useState(0);

  // Message rotation logic - reset when active item ID changes
  useEffect(() => {
    if (!item?.messages || item.messages.length <= 1) return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % item.messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [item?.id, item?.messages]);

  const displayMessage = item?.messages ? item.messages[messageIndex] : item?.message;

  const kind = useMemo(() => {
    const normalizedVariant = String(item?.variant || '').toLowerCase();
    const normalizedTitle = String(item?.title || '').toLowerCase();
    const normalizedMessage = String(displayMessage || '').toLowerCase();
    const combined = `${normalizedVariant} ${normalizedTitle} ${normalizedMessage}`;

    if (combined.includes('email') || combined.includes('mail')) return 'email';
    if (combined.includes('pdf') || combined.includes('document')) return 'pdf';
    return 'process';
  }, [displayMessage, item?.title, item?.variant]);

  if (!item) return null;

  return (
    <ActionProgressOverlay
      open
      kind={kind}
      title={item.title || 'Processing Request'}
      subtitle={item.subtitle || 'Please wait while we complete this action safely.'}
      status={displayMessage || item.message || 'Please wait...'}
    />
  );
};

export default ProgressOverlay;
