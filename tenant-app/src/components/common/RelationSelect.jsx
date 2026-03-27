import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import {
  findRelationOption,
  getRelationOptionsForParentType,
} from '../../lib/relationData';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../../lib/systemAssetsCache';

const resolveSystemIcon = (snapshot, key, fallback) => {
  return snapshot[key]?.iconUrl || fallback;
};

const RelationSelect = ({
  value = '',
  onChange,
  parentType = 'individual',
  placeholder = 'Select relation',
  searchPlaceholder = 'Search relation',
  emptyMessage = 'No relation found',
  errorMessage = '',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const rootRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());
  const selected = findRelationOption(value, parentType);
  const options = useMemo(
    () => getRelationOptionsForParentType(parentType),
    [parentType],
  );

  useEffect(() => {
    getSystemAssets().then(setSystemAssets).catch(() => {});
  }, []);

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return options;
    return options.filter((item) => item.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const updateDropdownPosition = () => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    const rect = rootEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const margin = 8;
    const desiredWidth = rect.width;
    const maxAllowedWidth = Math.max(220, viewportWidth - (margin * 2));
    const width = Math.min(desiredWidth, maxAllowedWidth);
    const left = Math.min(Math.max(rect.left, margin), viewportWidth - width - margin);
    setDropdownStyle({
      position: 'fixed',
      left,
      top: rect.bottom + 9,
      width,
      zIndex: 1000,
    });
  };

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      closeDropdown();
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') closeDropdown();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (isOpen) searchInputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    updateDropdownPosition();
    const handleReposition = () => updateDropdownPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (isOpen) closeDropdown();
          else if (!disabled) setIsOpen(true);
        }}
        style={{ minHeight: '3.5rem' }}
        className={`flex w-full items-center justify-between overflow-hidden rounded-2xl border bg-[var(--c-panel)] text-left text-sm font-semibold text-[var(--c-text)] shadow-sm outline-none transition ${
          errorMessage
            ? 'border-red-400/70 focus:border-red-400 focus:ring-4 focus:ring-red-400/10'
            : 'border-[var(--c-border)] focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5'
        } disabled:cursor-not-allowed disabled:opacity-50`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 flex-1 items-center">
          <span className="relative flex h-[3.5rem] w-[3.5rem] shrink-0 items-center justify-center overflow-hidden border-r border-[var(--c-border)] bg-[var(--c-panel)]">
            {selected ? (
              <img
                src={resolveSystemIcon(systemAssets, selected.icon, '/dependent.png')}
                alt=""
                className="relative z-[1] h-full w-full object-cover"
              />
            ) : (
              <span className="relative z-[1] text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">RL</span>
            )}
          </span>
          <span className={`truncate px-3 ${selected ? 'text-[var(--c-text)]' : 'text-[var(--c-muted)]'}`}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <span className="pr-4">
          <ChevronDown strokeWidth={1.5} className={`h-4 w-4 shrink-0 text-[var(--c-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && dropdownStyle ? createPortal(
        <div
          ref={dropdownRef}
          className="overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] shadow-[0_24px_48px_-28px_color-mix(in_srgb,var(--c-text)_55%,transparent)]"
          style={dropdownStyle}
        >
          <div className="border-b border-[var(--c-border)] p-3">
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_16%,var(--c-panel)_84%)] px-3 py-2.5 text-sm font-semibold text-[var(--c-text)] outline-none transition placeholder:text-[var(--c-muted)] focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-accent)]/10"
            />
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm font-semibold text-[var(--c-muted)]">{emptyMessage}</div>
            ) : (
              filteredOptions.map((item) => {
                const isSelected = item.value === value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      onChange?.(item.value);
                      closeDropdown();
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                      isSelected
                        ? 'bg-[var(--c-accent-soft)] text-[var(--c-text)]'
                        : 'text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_18%,var(--c-panel)_82%)]'
                    }`}
                  >
                    <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                      <img
                        src={resolveSystemIcon(systemAssets, item.icon, '/dependent.png')}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{item.label}</span>
                    {isSelected ? <Check strokeWidth={1.5} className="h-4 w-4 shrink-0 text-[var(--c-accent)]" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      ) : null}

      {errorMessage ? (
        <p className="mt-2 text-xs font-bold normal-case tracking-normal text-red-400">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};

export default RelationSelect;
