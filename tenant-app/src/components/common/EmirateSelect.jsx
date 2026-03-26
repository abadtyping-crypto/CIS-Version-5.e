import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { EMIRATE_OPTIONS, findEmirateOption } from '../../lib/emirateData';
import { getCachedSystemAssetsSnapshot, getSystemAssets, resolveAssetWithVariation } from '../../lib/systemAssetsCache';

const EmirateSelect = ({
  value = '',
  onChange,
  placeholder = 'Select emirate',
  searchPlaceholder = 'Search emirate',
  emptyMessage = 'No emirate found',
  errorMessage = '',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const typeaheadRef = useRef('');
  const typeaheadTimerRef = useRef(null);
  const selected = findEmirateOption(value);
  const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());

  useEffect(() => {
    getSystemAssets().then(setSystemAssets).catch(() => {});
  }, []);

  // Auto-apply the user's default emirate preference from the TitleBar edit menu
  useEffect(() => {
    if (!value && typeof window !== 'undefined') {
      const defaultEm = localStorage.getItem('acis-default-emirate');
      if (defaultEm && findEmirateOption(defaultEm)) {
        onChange?.(defaultEm);
      }
    }
  }, [value, onChange]);

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  };

  const resetTypeahead = () => {
    typeaheadRef.current = '';
    if (typeaheadTimerRef.current) {
      window.clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = null;
    }
  };

  const openDropdown = () => {
    if (disabled) return;
    setIsOpen(true);
  };

  const focusNextInForm = () => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return false;
    const formScope = triggerEl.closest('form') || document;
    const focusableSelector = [
      'input:not([type="hidden"]):not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'button:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(',');
    const all = Array.from(formScope.querySelectorAll(focusableSelector)).filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return true;
    });
    const index = all.indexOf(triggerEl);
    if (index < 0) return false;
    const next = all.slice(index + 1).find((el) => el instanceof HTMLElement);
    if (!next) return false;
    next.focus();
    return true;
  };

  const handleSelectOption = (nextValue, { moveToNextField = false } = {}) => {
    const shouldRestoreFocus = !!(
      triggerRef.current &&
      (document.activeElement === triggerRef.current || rootRef.current?.contains(document.activeElement))
    );
    closeDropdown();
    resetTypeahead();
    onChange?.(nextValue);
    if (moveToNextField) {
      window.requestAnimationFrame(() => {
        if (!focusNextInForm()) triggerRef.current?.focus();
      });
      return;
    }
    if (shouldRestoreFocus) {
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  };

  const resolveTypeaheadMatches = (query) => {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return [];
    const byPrefix = EMIRATE_OPTIONS.filter((item) => item.label.toLowerCase().startsWith(normalized));
    if (byPrefix.length) return byPrefix;
    return EMIRATE_OPTIONS.filter((item) => item.label.toLowerCase().includes(normalized));
  };

  const applyTypeahead = (chunk) => {
    typeaheadRef.current = `${typeaheadRef.current}${chunk}`.toLowerCase();
    if (typeaheadTimerRef.current) window.clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = window.setTimeout(() => {
      typeaheadRef.current = '';
      typeaheadTimerRef.current = null;
    }, 700);

    const matches = resolveTypeaheadMatches(typeaheadRef.current);
    if (matches.length === 1) {
      handleSelectOption(matches[0].value);
      return true;
    }

    if (matches.length > 1) {
      setSearchQuery(typeaheadRef.current);
      openDropdown();
      return true;
    }

    return false;
  };

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return EMIRATE_OPTIONS;
    return EMIRATE_OPTIONS.filter((item) => item.label.toLowerCase().includes(query));
  }, [searchQuery]);

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
      top: rect.bottom + 8,
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

  const selectedFilteredIndex = useMemo(
    () => filteredOptions.findIndex((item) => item.value === value),
    [filteredOptions, value],
  );

  const effectiveHighlightedIndex = useMemo(() => {
    if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) return highlightedIndex;
    if (selectedFilteredIndex >= 0) return selectedFilteredIndex;
    return filteredOptions.length ? 0 : -1;
  }, [filteredOptions.length, highlightedIndex, selectedFilteredIndex]);

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

  useEffect(() => () => resetTypeahead(), []);

  const handleTriggerKeyDown = (event) => {
    if (disabled) return;

    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      openDropdown();
      return;
    }

    if (
      event.key.length === 1 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      applyTypeahead(event.key);
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      if (!typeaheadRef.current) return;
      typeaheadRef.current = typeaheadRef.current.slice(0, -1);
      if (!typeaheadRef.current) {
        closeDropdown();
        return;
      }
      const matches = resolveTypeaheadMatches(typeaheadRef.current);
      if (matches.length === 1) {
        handleSelectOption(matches[0].value);
      } else {
        setSearchQuery(typeaheadRef.current);
        openDropdown();
      }
    }
  };

  const handleSearchKeyDown = (event) => {
    if (!isOpen) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      setHighlightedIndex(() => {
        const next = effectiveHighlightedIndex < filteredOptions.length - 1
          ? effectiveHighlightedIndex + 1
          : filteredOptions.length - 1;
        return Math.max(next, 0);
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      setHighlightedIndex(() => Math.max(effectiveHighlightedIndex - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const highlighted = filteredOptions[effectiveHighlightedIndex];
      if (highlighted) handleSelectOption(highlighted.value, { moveToNextField: true });
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      if (filteredOptions.length === 1) {
        handleSelectOption(filteredOptions[0].value, { moveToNextField: true });
      } else {
        closeDropdown();
        window.requestAnimationFrame(() => {
          if (!focusNextInForm()) triggerRef.current?.focus();
        });
      }
    }
  };

  const defaultIconUrl = resolveAssetWithVariation(systemAssets, 'custom_icon_1');
  const displayIconUrl = selected 
    ? (systemAssets[selected.iconId]?.iconUrl || selected.icon) 
    : defaultIconUrl;

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (isOpen) closeDropdown();
          else openDropdown();
        }}
        onKeyDown={handleTriggerKeyDown}
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
          <span className="relative flex h-[3.5rem] w-[3.5rem] shrink-0 items-center justify-center overflow-hidden border-r border-[var(--c-border)]">
            {displayIconUrl ? (
              <img
                src={displayIconUrl}
                alt=""
                className="relative z-[1] h-full w-full object-cover"
              />
            ) : null}
          </span>
          <span className={`truncate px-3 ${selected ? 'text-[var(--c-text)]' : 'text-[var(--c-muted)]'}`}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <span className="pr-4">
          <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--c-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && dropdownStyle ? createPortal(
        <div
          ref={dropdownRef}
          className="compact-popover overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] shadow-[0_24px_48px_-28px_color-mix(in_srgb,var(--c-text)_55%,transparent)]"
          style={dropdownStyle}
        >
          <div className="border-b border-[var(--c-border)] p-3">
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_16%,var(--c-panel)_84%)] px-3 py-2.5 text-sm font-semibold text-[var(--c-text)] outline-none transition placeholder:text-[var(--c-muted)] focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-accent)]/10"
            />
          </div>

          <div className="overflow-y-auto py-1" style={{ maxHeight: 'var(--d-popover-max-h)' }}>
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm font-semibold text-[var(--c-muted)]">{emptyMessage}</div>
            ) : (
              filteredOptions.map((item, index) => {
                const isSelected = item.value === value;
                const isHighlighted = index === effectiveHighlightedIndex;
                const optIconUrl = systemAssets[item.iconId]?.iconUrl || item.icon;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleSelectOption(item.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                      isHighlighted
                        ? 'bg-[color:color-mix(in_srgb,var(--c-accent)_18%,var(--c-panel)_82%)] text-[var(--c-text)]'
                        : isSelected
                        ? 'bg-[var(--c-accent-soft)] text-[var(--c-text)]'
                        : 'text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_18%,var(--c-panel)_82%)]'
                    }`}
                  >
                    <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                      <img
                        src={optIconUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{item.label}</span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-[var(--c-accent)]" /> : null}
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

export default EmirateSelect;
