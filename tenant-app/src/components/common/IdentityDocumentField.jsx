import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ClipboardPaste, Copy, IdCard, FileText, Users, Briefcase } from 'lucide-react';
import { getCachedSystemAssetsSnapshot, getSystemAssets, resolveAssetWithVariation } from '../../lib/systemAssetsCache';

const ID_TYPES_CONFIG = {
  emirates_id: { value: 'emirates_id', label: 'Emirates ID', iconId: 'icon_doc_emirates_id', fallbackIcon: IdCard },
  passport: { value: 'passport', label: 'Passport', iconId: 'icon_doc_passport', fallbackIcon: FileText },
  person_code: { value: 'person_code', label: 'Person Code', iconId: 'icon_doc_person_code', fallbackIcon: Users },
  work_permit: { value: 'work_permit', label: 'Work Permit', iconId: 'icon_doc_work_permit', fallbackIcon: Briefcase },
  unified_number: { value: 'unified_number', label: 'UID / Unified #', iconId: 'icon_doc_unified', fallbackIcon: FileText },
};

const formatInputValue = (type, rawValue) => {
  if (!rawValue) return '';
  let formatted = String(rawValue);
  
  if (type === 'emirates_id') {
    // 15 digits max, digits only. Paste handling (784-XXXX...) naturally strips dashes
    return formatted.replace(/\D/g, '').slice(0, 15);
  }
  
  if (type === 'passport') {
    // Letters forcibly Uppercase & Digits allow no special characters. Max 12
    return formatted.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  }
  
  if (type === 'person_code') {
    // only digits, must be 14 digits, allow leading zeros
    return formatted.replace(/\D/g, '').slice(0, 14);
  }
  
  if (type === 'work_permit') {
    // only digits min 8 max 9
    return formatted.replace(/\D/g, '').slice(0, 9);
  }

  if (type === 'unified_number') {
    // only digits max 12
    return formatted.replace(/\D/g, '').slice(0, 12);
  }

  return formatted;
};

const IdentityDocumentField = ({
  id,
  type = 'emirates_id',
  number = '',
  onTypeChange,
  onNumberChange,
  allowedTypes = ['emirates_id', 'passport', 'person_code', 'work_permit', 'unified_number'],
  placeholder = 'Enter ID number',
  errorMessage = '',
  disabled = false,
  className = '',
  onBlurError, // Pass back blur error to parent if needed
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const rootRef = useRef(null);
  const dropdownRef = useRef(null);
  const [localError, setLocalError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());

  useEffect(() => {
    getSystemAssets().then(setSystemAssets).catch(() => {});
  }, []);

  const closeDropdown = () => setIsOpen(false);

  const updateDropdownPosition = () => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    const rect = rootEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const margin = 8;
    const maxAllowedWidth = Math.max(240, viewportWidth - (margin * 2));
    const width = Math.min(rect.width, maxAllowedWidth);
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
    if (isOpen) updateDropdownPosition();
  }, [isOpen]);

  useEffect(() => {
    const handlePointerDown = (e) => {
      const target = e.target;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      closeDropdown();
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') closeDropdown();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleInputChange = (val) => {
    setLocalError('');
    onNumberChange?.(formatInputValue(type, val));
  };

  const handlePasteFromClipboard = async () => {
    if (disabled) return;
    try {
      const text = await navigator.clipboard.readText();
      if (typeof text === 'string' && text.length > 0) {
        handleInputChange(text);
      }
    } catch (err) {
      console.warn('Clipboard read denied', err);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!number || disabled) return;
    try {
      await navigator.clipboard.writeText(number);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write denied', err);
    }
  };

  const handleInputBlur = () => {
    let error = '';
    if (number) {
      if (type === 'emirates_id' && number.length !== 15) {
        error = 'Emirates ID must be exactly 15 digits.';
      } else if (type === 'person_code' && number.length !== 14) {
        error = 'Person Code must be exactly 14 digits.';
      } else if (type === 'work_permit' && (number.length < 8 || number.length > 9)) {
        error = 'Work Permit must be 8 or 9 digits.';
      }
    }
    setLocalError(error);
    if (onBlurError) onBlurError(error);
  };

  const activeConfig = ID_TYPES_CONFIG[type] || ID_TYPES_CONFIG.emirates_id;
  const ActiveIconFallback = activeConfig.fallbackIcon;
  const activeIconUrl = resolveAssetWithVariation(systemAssets, activeConfig.iconId);

  const dynamicPlaceholder = useMemo(() => {
    if (placeholder !== 'Enter ID number') return placeholder; // If parent provided a custom one, use it
    if (type === 'emirates_id') return '784-XXXX-XXXXXXX-X';
    if (type === 'passport') return 'Enter Passport Number';
    if (type === 'person_code') return 'Enter 14-digit Person Code';
    if (type === 'work_permit') return 'Enter Work Permit Number';
    return placeholder;
  }, [type, placeholder]);

  const displayError = errorMessage || localError;

  return (
    <div ref={rootRef} className={`relative flex flex-col ${className}`.trim()}>
      <div
        className={`compact-field flex h-10 items-center overflow-hidden rounded-xl border bg-[var(--c-panel)] text-[var(--c-text)] shadow-sm transition ${
          displayError
            ? 'border-red-400/70 focus-within:border-red-400 focus-within:ring-4 focus-within:ring-red-400/10'
            : 'border-[var(--c-border)] focus-within:border-[var(--c-accent)] focus-within:ring-4 focus-within:ring-[var(--c-accent)]/5'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (isOpen) closeDropdown();
            else setIsOpen(true);
          }}
          className="flex h-10 shrink-0 items-center border-r border-[var(--c-border)] bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] transition hover:bg-slate-50 focus-visible:bg-slate-50"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden">
            {activeIconUrl ? (
              <img
                src={activeIconUrl}
                alt={activeConfig.label}
                className="relative z-[1] h-full w-full object-cover"
              />
            ) : (
              <ActiveIconFallback strokeWidth={1.5} className="relative z-[1] h-4.5 w-4.5 text-[var(--c-accent)]" />
            )}
          </span>
          <span className="flex h-10 items-center px-1.5">
            <ChevronDown strokeWidth={2.5} className={`h-2.5 w-2.5 text-[var(--c-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>

        <input
          id={id}
          type={type === 'passport' ? 'text' : 'tel'}
          inputMode={type === 'passport' ? 'text' : 'numeric'}
          disabled={disabled}
          value={number}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={handleInputBlur}
          placeholder={dynamicPlaceholder}
          className="h-full min-w-0 flex-1 bg-transparent px-4 text-sm font-semibold text-[var(--c-text)] outline-none placeholder:text-[var(--c-muted)] placeholder:font-medium"
        />

        {number ? (
          <button
            type="button"
            disabled={disabled}
            onClick={handleCopyToClipboard}
            className={`flex h-10 w-10 shrink-0 items-center justify-center transition-colors ${
              isCopied ? 'text-emerald-500' : 'text-[var(--c-muted)] hover:text-[var(--c-accent)]'
            }`}
            title="Copy to clipboard"
          >
            {isCopied ? <Check strokeWidth={1.5} className="h-4 w-4" /> : <Copy strokeWidth={1.5} className="h-4 w-4" />}
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={handlePasteFromClipboard}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--c-muted)] transition-colors hover:text-[var(--c-accent)]"
            title="Paste from clipboard"
          >
            <ClipboardPaste strokeWidth={1.5} className="h-4 w-4" />
          </button>
        )}
      </div>

      {displayError && (
        <p className="mt-2 text-xs font-bold text-red-400">{displayError}</p>
      )}

      {isOpen && dropdownStyle ? createPortal(
        <div
          ref={dropdownRef}
          className="compact-popover overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] shadow-[0_24px_48px_-28px_color-mix(in_srgb,var(--c-text)_55%,transparent)]"
          style={dropdownStyle}
        >
          <div className="flex px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)] border-b border-[var(--c-border)] bg-[var(--c-surface)]">
            Identity Method
          </div>
          <div className="overflow-y-auto py-1" style={{ maxHeight: '180px' }}>
            {allowedTypes.map((optType) => {
              const config = ID_TYPES_CONFIG[optType];
              if (!config) return null;
              const isSelected = type === optType;
              const FallbackIcon = config.fallbackIcon;
              const iconUrl = resolveAssetWithVariation(systemAssets, config.iconId);

              return (
                <button
                  key={optType}
                  type="button"
                  onClick={() => {
                    onTypeChange?.(optType);
                    setLocalError(''); // Reset validation error on type change
                    handleInputChange(''); // reset the field securely, or format the existing? Resetting is safer.
                    closeDropdown();
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                    isSelected
                      ? 'bg-[var(--c-accent-soft)] text-[var(--c-text)]'
                      : 'text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_18%,var(--c-panel)_82%)]'
                  }`}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded">
                    {iconUrl ? (
                      <img src={iconUrl} alt={config.label} className="h-full w-full object-cover" />
                    ) : (
                      <FallbackIcon className="h-3 w-3 text-[var(--c-muted)]" />
                    )}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{config.label}</span>
                  {isSelected && <Check strokeWidth={1.5} className="h-4 w-4 shrink-0 text-[var(--c-accent)]" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
};

export default IdentityDocumentField;
