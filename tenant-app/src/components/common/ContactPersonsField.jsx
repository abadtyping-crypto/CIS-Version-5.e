import { useMemo } from 'react';
import { X } from 'lucide-react';
import InputActionField from './InputActionField';

const createContactPerson = () => ({
  id: Math.random().toString(36).slice(2, 11),
  value: '',
});

const ensureContactPersons = (contacts) => {
  if (!Array.isArray(contacts) || contacts.length === 0) return [createContactPerson()];
  return contacts.map((contact) => ({
    id: contact?.id || Math.random().toString(36).slice(2, 11),
    value: String(contact?.value || ''),
  }));
};

const ContactPersonsField = ({
  label = 'Primary Contact Person (Optional)',
  contacts = [createContactPerson()],
  onChange,
  maxContacts = 3,
  className = '',
}) => {
  const safeContacts = useMemo(() => ensureContactPersons(contacts), [contacts]);

  const commitContacts = (nextContacts) => {
    onChange?.(ensureContactPersons(nextContacts));
  };

  const updateContact = (contactId, nextValue) => {
    commitContacts(
      safeContacts.map((contact) => (
        contact.id === contactId ? { ...contact, value: nextValue } : contact
      )),
    );
  };

  const appendContact = () => {
    if (safeContacts.length >= maxContacts) return;
    commitContacts([...safeContacts, createContactPerson()]);
  };

  const removeContact = (contactId) => {
    const nextContacts = safeContacts.filter((contact) => contact.id !== contactId);
    commitContacts(nextContacts.length ? nextContacts : [createContactPerson()]);
  };

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">{label}</p>
      <div className="space-y-3 normal-case tracking-normal">
        {safeContacts.map((contact, index) => {
          const value = String(contact.value || '');
          const hasValue = value.trim().length > 0;
          const isLast = index === safeContacts.length - 1;
          const canAppend = isLast && hasValue && safeContacts.length < maxContacts;

          return (
            <div key={contact.id} className="flex items-stretch gap-2">
              <div className="min-w-0 flex-1">
                <InputActionField
                  name={`manual-contact-person-${contact.id}`}
                  value={value}
                  onValueChange={(nextValue) => updateContact(contact.id, nextValue)}
                  forceUppercase
                  className="w-full"
                  inputClassName="text-sm font-bold"
                  placeholder={index === 0 ? 'Contact person name' : `Contact person ${index + 1}`}
                  showPasteButton={!hasValue}
                  onAppend={canAppend ? appendContact : undefined}
                  appendLabel="Add contact person"
                />
              </div>
              {safeContacts.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeContact(contact.id)}
                  className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-2xl bg-[var(--c-surface)] text-[var(--c-muted)] transition-all duration-300 hover:bg-rose-500/10 hover:text-rose-400"
                  aria-label="Remove contact person"
                >
                  <X strokeWidth={1.5} className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContactPersonsField;
