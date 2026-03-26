import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Mail, ClipboardPaste } from 'lucide-react';

// Common Premium Brand Icons for Emails
const BRAND_ICONS = {
  gmail: <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#EA4335] shrink-0 fill-current"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" /></svg>,
  outlook: <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#0078D4] shrink-0 fill-current"><path d="M1.08 4.7L10.7 7v10.3l-9.62 2.05c-.41.09-.68-.26-.68-.68V5.37c0-.42.27-.78.68-.67z"/><path d="M23 4.2v15.6c0 .88-.72 1.6-1.6 1.6h-9.7V2.6h9.7c.88 0 1.6.72 1.6 1.6zM15.5 14v1.8h3V14h-3zm0-3.5v1.8h3v-1.8h-3zm0-3.5V8.8h3V7h-3z"/></svg>,
  yahoo: <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#6001D2] shrink-0 fill-current"><path d="M16.036 3H24l-9.117 12.87v5.13h-5.766v-5.13L0 3h7.965l4.037 6.463L16.036 3z"/></svg>,
  icloud: <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#36A2EB] shrink-0 fill-current"><path d="M13.75 6.94c-2.42 0-4.48 1.48-5.32 3.55A3.2 3.2 0 0 0 .5 13.52c0 1.77 1.43 3.2 3.2 3.2h10.05c3.34 0 6.05-2.71 6.05-6.05 0-3.08-2.31-5.64-5.26-6-.26-1.4-1.46-2.47-2.91-2.47-.84 0-1.61.34-2.16.89-.5-.73-1.34-1.2-2.28-1.2-.6 0-1.16.2-1.6.54z"/></svg>,
  hotmail: <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#0078D4] shrink-0 fill-current"><path d="M1.08 4.7L10.7 7v10.3l-9.62 2.05c-.41.09-.68-.26-.68-.68V5.37c0-.42.27-.78.68-.67z"/><path d="M23 4.2v15.6c0 .88-.72 1.6-1.6 1.6h-9.7V2.6h9.7c.88 0 1.6.72 1.6 1.6zM15.5 14v1.8h3V14h-3zm0-3.5v1.8h3v-1.8h-3zm0-3.5V8.8h3V7h-3z"/></svg>,
};

const SUGGESTED_DOMAINS = [
  { domain: 'gmail.com', name: 'gmail' },
  { domain: 'outlook.com', name: 'outlook' },
  { domain: 'yahoo.com', name: 'yahoo' },
  { domain: 'icloud.com', name: 'icloud' },
  { domain: 'hotmail.com', name: 'hotmail' },
  { domain: 'live.com', name: 'outlook' }, // Alternative outlook wrapper
];

const createEmailContact = () => ({ id: Math.random().toString(36).slice(2, 11), value: '' });

const ensureEmailContacts = (contacts) => {
  if (!Array.isArray(contacts) || contacts.length === 0) return [createEmailContact()];
  return contacts.map(c => ({
    id: c?.id || Math.random().toString(36).slice(2, 11),
    value: String(c?.value || '').toLowerCase()
  }));
};

const SingleEmailInput = ({ id, value, onChange, onAppend, placeholder, errorMessage }) => {
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const rootRef = useRef(null);
  const dropdownRef = useRef(null);

  const closeDropdown = useCallback(() => {}, []); // isOpen is derived — closing happens automatically when filteredDomains clears

  const { prefix, domainQuery, shouldShowSuggestions } = useMemo(() => {
    // Determine if @ has been pressed, triggering suggestions
    const atIndex = value.indexOf('@');
    if (atIndex === -1) return { shouldShowSuggestions: false };

    const prefixPart = value.substring(0, atIndex);
    const domainQueryPart = value.substring(atIndex + 1);
    
    // Only show if the user isn't fully finished typing a valid domain yet
    // Meaning no `.` present after `@`, or we definitely have domains that match what they are currently typing.
    const isEditingDomain = !domainQueryPart.includes('.');
    
    return { 
      prefix: prefixPart, 
      domainQuery: domainQueryPart, 
      shouldShowSuggestions: isEditingDomain 
    };
  }, [value]);

  const filteredDomains = useMemo(() => {
    if (!shouldShowSuggestions) return [];
    return SUGGESTED_DOMAINS.filter(sd => sd.domain.startsWith(domainQuery.toLowerCase()));
  }, [shouldShowSuggestions, domainQuery]);

  // Handle position tracking for the smart portal dropdown
  const updateDropdownPosition = useCallback(() => {
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
      zIndex: 99999,
    });
  }, []);

  const isOpen = filteredDomains.length > 0 && shouldShowSuggestions;

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      if (dropdownRef.current?.contains(event.target)) return;
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
  }, [closeDropdown]);

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  return (
    <div ref={rootRef} className="relative w-full">
      <div
        className={`compact-field flex min-h-[56px] items-center overflow-hidden rounded-2xl border bg-[var(--c-panel)] text-[var(--c-text)] shadow-sm transition ${
          errorMessage
            ? 'border-red-400/70 focus-within:border-red-400 focus-within:ring-4 focus-within:ring-red-400/10'
            : 'border-[var(--c-border)] focus-within:border-[var(--c-accent)] focus-within:ring-4 focus-within:ring-[var(--c-accent)]/5'
        }`}
      >
        <div className="flex shrink-0 items-center justify-center border-r border-[var(--c-border)] bg-[var(--c-panel)] px-4 text-[var(--c-muted)]">
          <Mail className="h-4 w-4" />
        </div>
        
        <input
          id={id}
          type="email"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          autoCapitalize="none"
          placeholder={placeholder}
          value={value}
          onFocus={() => { /* isOpen is derived from filteredDomains — no manual set needed */ }}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s/g, ''))} // strictly enforce lowercase and no spaces globally
          className="h-full min-w-0 flex-1 bg-transparent px-4 text-sm font-semibold text-[var(--c-text)] outline-none placeholder:text-[var(--c-muted)] placeholder:font-medium"
        />

        {!value && (
          <button
            type="button"
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                if (text) onChange(text.toLowerCase().replace(/\s/g, ''));
              } catch (err) {
                console.warn('Clipboard read denied', err);
              }
            }}
            className="flex h-[56px] w-[56px] shrink-0 items-center justify-center text-[var(--c-muted)] hover:text-[var(--c-accent)] transition-colors"
            title="Paste from clipboard"
          >
            <ClipboardPaste className="h-4 w-4" />
          </button>
        )}

        {onAppend ? (
          <button
            type="button"
            onClick={onAppend}
            className="flex h-[56px] w-[56px] shrink-0 items-center justify-center border-l border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)] transition hover:bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-panel))] hover:text-[var(--c-accent)]"
            aria-label="Add additional email"
          >
            <Plus className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mt-2 text-xs font-bold text-red-400">
          {errorMessage}
        </p>
      ) : null}

      {/* PORTAL FOR EMAIL AUTOCOMPLETE SUGGESTIONS */}
      {isOpen && dropdownStyle && createPortal(
        <div
          ref={dropdownRef}
          className="compact-popover overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] shadow-[0_24px_48px_-28px_color-mix(in_srgb,var(--c-text)_55%,transparent)]"
          style={dropdownStyle}
        >
          <div className="flex px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)] border-b border-[var(--c-border)] bg-[var(--c-surface)]">
            Suggested Domains
          </div>
          <div className="overflow-y-auto py-1" style={{ maxHeight: '180px' }}>
            {filteredDomains.map((domainObj) => {
              const fullEmailProposal = `${prefix}@${domainObj.domain}`;
              return (
                <button
                  key={domainObj.domain}
                  type="button"
                  onClick={() => {
                    onChange(fullEmailProposal);
                    closeDropdown();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_38%,var(--c-panel)_62%)]"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--c-surface)] border border-[color:color-mix(in_srgb,var(--c-border)_40%,transparent)]">
                    {BRAND_ICONS[domainObj.name] || <Mail className="h-4 w-4 text-[var(--c-muted)]" />}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-[color:color-mix(in_srgb,var(--c-text)_90%,transparent)]">
                    <span className="text-[var(--c-text)]">{prefix}</span>
                    <span className="text-[var(--c-muted)]">@{domainObj.domain}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default function EmailContactsField({
  label = 'Email Addresses',
  contacts = [createEmailContact()],
  onChange,
  maxContacts = 3,
  className = '',
}) {
  const safeContacts = useMemo(() => ensureEmailContacts(contacts), [contacts]);

  const commitContacts = (nextContacts) => {
    onChange?.(ensureEmailContacts(nextContacts));
  };

  const updateContact = (contactId, newValue) => {
    commitContacts(safeContacts.map(c => c.id === contactId ? { ...c, value: newValue } : c));
  };

  const appendContact = () => {
    if (safeContacts.length >= maxContacts) return;
    commitContacts([...safeContacts, createEmailContact()]);
  };

  const removeContact = (contactId) => {
    const nextContacts = safeContacts.filter(c => c.id !== contactId);
    commitContacts(nextContacts.length ? nextContacts : [createEmailContact()]);
  };

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">{label}</p>
      </div>

      <div className="space-y-3 normal-case tracking-normal">
        {safeContacts.map((contact, index) => {
          const isLast = index === safeContacts.length - 1;
          const val = contact.value || '';
          
          // User Confirmation Check: Must have "@" AND "." present in the actual typing string.
          // This is the trigger that shows the inward "+" append button safely.
          const isConfirmed = val.includes('@') && val.includes('.');
          const canAddMoreOnThisRow = isLast && isConfirmed && safeContacts.length < maxContacts;

          return (
            <div key={contact.id} className="flex items-stretch gap-2">
              <SingleEmailInput
                id={`email-contact-${contact.id}`}
                value={val}
                onChange={(newVal) => updateContact(contact.id, newVal)}
                placeholder={index === 0 ? "example@domain.com" : `Email address ${index + 1}`}
                onAppend={canAddMoreOnThisRow ? appendContact : undefined}
              />

              {safeContacts.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeContact(contact.id)}
                  className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-2xl bg-[var(--c-surface)] text-[var(--c-muted)] transition-all duration-300 hover:bg-rose-500/10 hover:text-rose-400"
                  aria-label="Remove email"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
