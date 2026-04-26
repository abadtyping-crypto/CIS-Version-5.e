import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import CountryPhoneField from './CountryPhoneField';
import { DEFAULT_COUNTRY_PHONE_ISO2 } from '../../lib/countryPhoneData';
import {
  createMobileContact,
  ensureMobileContacts,
  normalizeMobileContactValue,
  validateMobileContact,
} from '../../lib/mobileContactUtils';

const MobileContactsField = ({
  label = 'Mobile Numbers',
  contacts = [createMobileContact()],
  onChange,
  maxContacts = 3,
  required = false,
  className = '',
}) => {
  const safeContacts = useMemo(() => ensureMobileContacts(contacts), [contacts]);
  const [errors, setErrors] = useState({});

  const commitContacts = (nextContacts) => {
    onChange?.(ensureMobileContacts(nextContacts));
  };

  const updateContact = (contactId, mutate) => {
    commitContacts(safeContacts.map((contact) => (
      contact.id === contactId ? mutate(contact) : contact
    )));
  };

  const appendContact = () => {
    if (safeContacts.length >= maxContacts) return;
    commitContacts([...safeContacts, createMobileContact()]);
  };

  const removeContact = (contactId) => {
    const nextContacts = safeContacts.filter((contact) => contact.id !== contactId);
    commitContacts(nextContacts.length ? nextContacts : [createMobileContact()]);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[contactId];
      return next;
    });
  };

  const handleBlur = (contactId, contact, index) => {
    const fieldLabel = index === 0 && required ? 'Mobile number' : `Mobile number ${index + 1}`;
    setErrors((prev) => ({
      ...prev,
      [contactId]: validateMobileContact(contact.value, contact.countryIso2, fieldLabel),
    }));
  };

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">{label}</p>
      </div>

      <div className="space-y-3 normal-case tracking-normal">
        {safeContacts.map((contact, index) => {
          const isLast = index === safeContacts.length - 1;
          const hasValue = String(contact.value || '').trim().length > 0;
          // Only show 'Add New' inside the tab if it has a value, is the last row, and hasn't hit max limit
          const canAddMoreOnThisRow = isLast && hasValue && safeContacts.length < maxContacts;

          return (
            <div key={contact.id} className="flex items-stretch gap-2">
              <div className="min-w-0 flex-1">
                <CountryPhoneField
                  countryIso2={contact.countryIso2 || DEFAULT_COUNTRY_PHONE_ISO2}
                  value={contact.value}
                  onCountryChange={(countryIso2) => {
                    const normalized = normalizeMobileContactValue(contact.value, countryIso2);
                    updateContact(contact.id, (current) => ({
                      ...current,
                      countryIso2,
                      value: normalized,
                    }));
                    setErrors((prev) => (
                      prev[contact.id]
                        ? { ...prev, [contact.id]: validateMobileContact(normalized, countryIso2, `Mobile number ${index + 1}`) }
                        : prev
                    ));
                  }}
                  onValueChange={(value) => {
                    const normalized = normalizeMobileContactValue(value, contact.countryIso2);
                    updateContact(contact.id, (current) => ({ ...current, value: normalized }));
                    setErrors((prev) => (
                      prev[contact.id]
                        ? { ...prev, [contact.id]: validateMobileContact(normalized, contact.countryIso2, `Mobile number ${index + 1}`) }
                        : prev
                    ));
                  }}
                  onValuePaste={(event) => {
                    const pastedText = event.clipboardData?.getData('text') || '';
                    if (!pastedText) return;
                    event.preventDefault();
                    const normalized = normalizeMobileContactValue(pastedText, contact.countryIso2);
                    updateContact(contact.id, (current) => ({ ...current, value: normalized }));
                    setErrors((prev) => (
                      prev[contact.id]
                        ? { ...prev, [contact.id]: validateMobileContact(normalized, contact.countryIso2, `Mobile number ${index + 1}`) }
                        : prev
                    ));
                  }}
                  onValueBlur={() => handleBlur(contact.id, contact, index)}
                  name={`mobile-contact-${index + 1}`}
                  placeholder={contact.countryIso2 === DEFAULT_COUNTRY_PHONE_ISO2 ? 'XX XXX XXXX' : 'XXXX'}
                  errorMessage={errors[contact.id] || ''}
                  showPasteWhenEmpty
                  showWhatsAppToggle
                  whatsAppEnabled={contact.whatsAppEnabled !== false}
                  onWhatsAppToggle={(enabled) => {
                    updateContact(contact.id, (current) => ({
                      ...current,
                      whatsAppEnabled: enabled !== false,
                    }));
                  }}
                  // Appears INSIDE the tab at the end
                  onAppend={canAddMoreOnThisRow ? appendContact : undefined}
                />
              </div>

              {/* ACTION BUTTONS */}
              {safeContacts.length > 1 ? (
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => removeContact(contact.id)}
                    className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-2xl bg-[var(--c-surface)] text-[var(--c-muted)] transition-all duration-300 hover:bg-rose-500/10 hover:text-rose-400"
                    aria-label="Remove mobile number"
                  >
                    <X strokeWidth={1.5} className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MobileContactsField;
