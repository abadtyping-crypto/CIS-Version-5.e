import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, ClipboardPaste } from 'lucide-react';
import 'react-phone-input-2/lib/style.css';
import { WhatsAppColorIcon } from '../icons/AppIcons';
import {
  COUNTRY_PHONE_OPTIONS,
  DEFAULT_COUNTRY_PHONE_ISO2,
  PREFERRED_COUNTRY_ORDER,
  findCountryPhoneOption,
} from '../../lib/countryPhoneData';

const FlagSprite = ({ iso2 }) => (
  <span className="acis-phone-flag-sprite react-tel-input" style={{ width: 'auto', position: 'static', display: 'inline-flex' }}>
    <span className={`flag ${String(iso2 || '').toLowerCase()}`} style={{ display: 'block', margin: 0 }} />
  </span>
);

const CountryPhoneField = ({
  countryIso2 = DEFAULT_COUNTRY_PHONE_ISO2,
  value = '',
  onCountryChange,
  onValueChange,
  onValuePaste,
  onValueBlur,
  id,
  name,
  placeholder = 'Enter mobile number',
  errorMessage = '',
  onAppend, // Optional: if provided, shows a Plus button inside the field
  showPasteButton = true,
  showPasteWhenEmpty = true,
  showWhatsAppToggle = false,
  whatsAppEnabled = true,
  onWhatsAppToggle,
  whatsAppToggleAriaLabel = 'Toggle WhatsApp',
  whatsAppToggleDisabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const rootRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const selectedCountry = findCountryPhoneOption(countryIso2);

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  const orderedCountries = useMemo(() => {
    const preferred = [];
    const rest = [];
    COUNTRY_PHONE_OPTIONS.forEach((country) => {
      if (PREFERRED_COUNTRY_ORDER.includes(country.iso2)) preferred.push(country);
      else rest.push(country);
    });
    preferred.sort((left, right) => PREFERRED_COUNTRY_ORDER.indexOf(left.iso2) - PREFERRED_COUNTRY_ORDER.indexOf(right.iso2));
    return [...preferred, ...rest];
  }, []);

  const filteredCountries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return orderedCountries;
    return orderedCountries.filter((country) =>
      country.name.toLowerCase().includes(query)
      || country.iso2.toLowerCase().includes(query)
      || country.dialCode.includes(query.replace(/^\+/, '')),
    );
  }, [orderedCountries, searchQuery]);

  const updateDropdownPosition = () => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    const rect = rootEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const margin = 8;
    const desiredWidth = rect.width;
    const maxAllowedWidth = Math.max(240, viewportWidth - (margin * 2));
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

  const cleanPhoneValue = (text) => {
    let cleaned = String(text || '').trim().replace(/[\s\-()]/g, '');
    const dialCode = selectedCountry.dialCode;

    // Handle international prefixes ONLY at the start of the string
    if (cleaned.startsWith('00971')) {
      cleaned = cleaned.substring(5);
    } else if (cleaned.startsWith('+971')) {
      cleaned = cleaned.substring(4);
    } else if (cleaned.startsWith(`00${dialCode}`)) {
      cleaned = cleaned.substring(2 + dialCode.length);
    } else if (cleaned.startsWith(`+${dialCode}`)) {
      cleaned = cleaned.substring(1 + dialCode.length);
    }

    return cleaned;
  };

  const setCleanedValue = (val) => {
    onValueChange?.(cleanPhoneValue(val));
  };
  const hasValue = String(value || '').trim().length > 0;
  const shouldShowPaste = showPasteButton && (!showPasteWhenEmpty || !hasValue);

  return (
    <div ref={rootRef} className="relative mt-1">
      <div
        className={`compact-field flex h-14 items-center overflow-hidden rounded-2xl border bg-[var(--c-panel)] text-[var(--c-text)] shadow-sm transition ${
          errorMessage
            ? 'border-red-400/70 focus-within:border-red-400 focus-within:ring-4 focus-within:ring-red-400/10'
            : 'border-[var(--c-border)] focus-within:border-[var(--c-accent)] focus-within:ring-4 focus-within:ring-[var(--c-accent)]/5'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            if (isOpen) closeDropdown();
            else setIsOpen(true);
          }}
          className="flex shrink-0 items-center justify-center gap-2 border-r border-[var(--c-border)] bg-[var(--c-panel)] px-4 text-left outline-none transition hover:bg-[color:color-mix(in_srgb,var(--c-accent)_6%,var(--c-panel))] focus-visible:bg-[color:color-mix(in_srgb,var(--c-accent)_6%,var(--c-panel))]"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex items-center pb-0.5"><FlagSprite iso2={selectedCountry.iso2} /></div>
          <ChevronDown strokeWidth={1.5} className={`h-4 w-4 text-[var(--c-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex items-center justify-center border-r border-[var(--c-border)] bg-[var(--c-panel)] px-4 text-sm font-semibold text-[var(--c-text)]">
          +{selectedCountry.dialCode}
        </div>
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={value}
          onChange={(event) => setCleanedValue(event.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text');
            if (text) setCleanedValue(text);
            onValuePaste?.(e);
          }}
          onBlur={onValueBlur}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-4 text-sm font-semibold text-[var(--c-text)] outline-none placeholder:text-[var(--c-muted)]"
        />
        {shouldShowPaste ? (
          <button
            type="button"
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                if (text) setCleanedValue(text);
              } catch (err) {
                console.warn('Clipboard read denied', err);
              }
            }}
            className="flex h-14 w-10 shrink-0 items-center justify-center border-l border-[var(--c-border)] text-[var(--c-muted)] transition-colors hover:text-[var(--c-accent)]"
            title="Paste from clipboard"
          >
            <ClipboardPaste strokeWidth={1.5} className="h-4 w-4" />
          </button>
        ) : null}
        {showWhatsAppToggle ? (
          <button
            type="button"
            disabled={whatsAppToggleDisabled}
            onClick={() => onWhatsAppToggle?.(!whatsAppEnabled)}
            className={`flex h-14 w-11 shrink-0 items-center justify-center border-l border-[var(--c-border)] transition ${
              whatsAppEnabled
                ? 'bg-emerald-500/10'
                : 'bg-transparent'
            } ${whatsAppToggleDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-emerald-500/10'}`}
            aria-label={whatsAppToggleAriaLabel}
            title={whatsAppEnabled ? 'WhatsApp enabled' : 'WhatsApp disabled'}
          >
            <WhatsAppColorIcon className={whatsAppEnabled ? 'h-6 w-6' : 'h-6 w-6 opacity-45 grayscale'} />
          </button>
        ) : null}
        {onAppend ? (
          <button
            type="button"
            onClick={onAppend}
            className="flex h-14 w-10 shrink-0 items-center justify-center border-l border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)] transition hover:bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-panel))] hover:text-[var(--c-accent)]"
            aria-label="Add additional number"
          >
            <Plus strokeWidth={1.5} className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {errorMessage ? (
        <p className="mt-2 text-xs font-bold normal-case tracking-normal text-red-400">
          {errorMessage}
        </p>
      ) : null}

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
              placeholder="Search country or code"
              className="w-full rounded-xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_16%,var(--c-panel)_84%)] px-3 py-2.5 text-sm font-semibold text-[var(--c-text)] outline-none transition placeholder:text-[var(--c-muted)] focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-accent)]/10"
            />
          </div>

          <div className="overflow-y-auto py-1" style={{ maxHeight: 'var(--d-popover-max-h)' }}>
            {filteredCountries.length === 0 ? (
              <div className="px-4 py-3 text-sm font-semibold text-[var(--c-muted)]">No country found</div>
            ) : (
              filteredCountries.map((country) => {
                const isSelected = country.iso2 === selectedCountry.iso2;
                return (
                  <button
                    key={`${country.iso2}-${country.dialCode}`}
                    type="button"
                    onClick={() => {
                      onCountryChange?.(country.iso2);
                      closeDropdown();
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                      isSelected
                        ? 'bg-[var(--c-accent-soft)] text-[var(--c-text)]'
                        : 'text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_18%,var(--c-panel)_82%)]'
                    }`}
                  >
                    <FlagSprite iso2={country.iso2} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{country.name}</span>
                      <span className="block text-xs font-semibold text-[var(--c-muted)]">+{country.dialCode}</span>
                    </span>
                    {isSelected ? <Check strokeWidth={1.5} className="h-4 w-4 shrink-0 text-[var(--c-accent)]" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
};

export default CountryPhoneField;
