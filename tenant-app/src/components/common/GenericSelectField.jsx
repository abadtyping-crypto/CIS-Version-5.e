import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

const GenericSelectField = ({
  value = '',
  onChange,
  options = [],
  placeholder = 'Choose option...',
  disabled = false,
  className = '',
  icon: Icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const rootRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedOption = useMemo(() => 
    options.find(opt => String(opt.value) === String(value))
  , [options, value]);

  useEffect(() => {
    const updatePosition = () => {
      const rootEl = rootRef.current;
      if (!rootEl) return;
      const rect = rootEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = Math.min(300, options.length * 48 + 10);
      const spaceBelow = viewportHeight - rect.bottom;
      const preferDropUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        top: preferDropUp ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
        width: rect.width,
        maxHeight: 300,
        zIndex: 1000,
      });
    };

    const handleEvents = (e) => {
      if (rootRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)) return;
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleEvents);
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      updatePosition();
    }
    return () => {
      document.removeEventListener('mousedown', handleEvents);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, options.length]);

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="flex h-14 w-full items-center justify-between rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 text-sm font-bold text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 disabled:opacity-50"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {Icon && <Icon size={18} className="shrink-0 text-[var(--c-muted)]" />}
          <span className={`truncate ${!selectedOption ? 'text-[var(--c-muted)]' : ''}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown 
          size={18} 
          className={`shrink-0 text-[var(--c-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && dropdownStyle && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="overflow-y-auto rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl animate-in fade-in zoom-in-95 duration-100"
        >
          {options.length === 0 ? (
            <div className="p-4 text-center text-xs font-bold text-[var(--c-muted)] italic">No options available</div>
          ) : (
            <div className="p-1.5 space-y-1">
              {options.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                        onChange?.(opt.value);
                        setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
                        isSelected 
                        ? 'bg-[var(--c-accent)] text-white' 
                        : 'text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-text)_6%,transparent)]'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check size={16} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default GenericSelectField;
