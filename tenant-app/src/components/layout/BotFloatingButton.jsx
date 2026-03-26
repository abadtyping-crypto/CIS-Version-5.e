import { useState, useRef, useEffect } from 'react';
import { collection, limit, onSnapshot, query } from 'firebase/firestore';
import useIsDesktopLayout from '../../hooks/useIsDesktopLayout';
import { db } from '../../lib/firebaseConfig';
import ChatAssistantPanel from '../chat/ChatAssistantPanel';
import '../../styles/desktop/bot-floating-button.css';

const BotFloatingButton = () => {
  const BUTTON_SIZE = 52;
  const EDGE_PADDING = 12;
  const TOP_SAFE_GAP = 96;
  const BROADCAST_OFFSET = 64;
  const PANEL_MARGIN = 64;
  const isDesktop = useIsDesktopLayout();

  // Position from bottom-right corner
  const [pos, setPos] = useState({ right: 24, bottom: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasActiveBroadcast, setHasActiveBroadcast] = useState(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, right: 0, bottom: 0 });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const didDrag = useRef(false);
  const effectiveBottom = pos.bottom + (hasActiveBroadcast ? BROADCAST_OFFSET : 0);

  const handleMouseDown = (e) => {
    e.preventDefault();
    didDrag.current = false;
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      right: pos.right,
      bottom: pos.bottom,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const q = query(collection(db, 'acis_global_broadcasts'), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      setHasActiveBroadcast(rows.some((item) => item?.isActive !== false));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      const dx = dragStart.current.mouseX - e.clientX;
      const dy = dragStart.current.mouseY - e.clientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
      const minRight = EDGE_PADDING;
      const maxRight = Math.max(minRight, window.innerWidth - BUTTON_SIZE - EDGE_PADDING);
      const minBottom = EDGE_PADDING;
      const maxBottom = Math.max(minBottom, window.innerHeight - BUTTON_SIZE - TOP_SAFE_GAP);
      const newRight = Math.max(minRight, Math.min(dragStart.current.right + dx, maxRight));
      const newBottom = Math.max(minBottom, Math.min(dragStart.current.bottom + dy, maxBottom));
      setPos({ right: newRight, bottom: newBottom });
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  useEffect(() => {
    const clampPosition = () => {
      const minRight = EDGE_PADDING;
      const maxRight = Math.max(minRight, window.innerWidth - BUTTON_SIZE - EDGE_PADDING);
      const minBottom = EDGE_PADDING;
      const maxBottom = Math.max(minBottom, window.innerHeight - BUTTON_SIZE - TOP_SAFE_GAP);
      setPos((prev) => ({
        right: Math.max(minRight, Math.min(prev.right, maxRight)),
        bottom: Math.max(minBottom, Math.min(prev.bottom, maxBottom)),
      }));
    };
    window.addEventListener('resize', clampPosition);
    return () => window.removeEventListener('resize', clampPosition);
  }, []);

  useEffect(() => {
    if (!isChatOpen) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setIsChatOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isChatOpen]);

  const handleClick = () => {
    if (didDrag.current) return;
    setIsChatOpen((prev) => !prev);
  };

  if (!isDesktop) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[9998] hidden lg:block">
        <div
          ref={panelRef}
          className={`absolute overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl transition-all duration-220 ${
            isChatOpen ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.98] opacity-0'
          }`}
          style={{
            right: `${pos.right}px`,
            bottom: `${effectiveBottom + PANEL_MARGIN}px`,
            width: 'min(420px, calc(100vw - 1.5rem))',
            height: 'min(72vh, 640px)',
            transformOrigin: 'bottom right',
          }}
        >
          <ChatAssistantPanel />
        </div>
      </div>

      <div
        ref={buttonRef}
        className="bot-floating-button fixed hidden lg:flex items-center justify-center select-none"
        style={{
          right: `${pos.right}px`,
          bottom: `${effectiveBottom}px`,
          width: '52px',
          height: '52px',
          zIndex: 9999,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        <div className="bot-pulse-ring absolute inset-0 rounded-full" />

        <div className="bot-chat-dots absolute bottom-14 flex gap-1.5">
          <span className="bot-dot w-1.5 h-1.5 rounded-full bg-[var(--c-accent)]" />
          <span className="bot-dot w-1.5 h-1.5 rounded-full bg-[var(--c-accent)]" style={{ animationDelay: '0.15s' }} />
          <span className="bot-dot w-1.5 h-1.5 rounded-full bg-[var(--c-accent)]" style={{ animationDelay: '0.3s' }} />
        </div>

        <div className="relative z-10 h-12 w-12 overflow-hidden rounded-full border border-[var(--c-border)] bg-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.32)]">
          <img src="/boticon.png" alt="Ayman Bot" className="h-full w-full object-contain p-2" />
        </div>
      </div>
    </>
  );
};

export default BotFloatingButton;
