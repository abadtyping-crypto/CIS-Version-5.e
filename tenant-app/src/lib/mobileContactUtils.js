import {
  DEFAULT_COUNTRY_PHONE_ISO2,
  findCountryPhoneOption,
} from './countryPhoneData';
import {
  getMobileNumberValidationMessage,
  normalizeMobileNumberInput,
} from './mobileNumberRules';

const makeMobileContactId = () => `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createMobileContact = (overrides = {}) => ({
  id: makeMobileContactId(),
  value: '',
  countryIso2: DEFAULT_COUNTRY_PHONE_ISO2,
  whatsAppEnabled: true,
  ...overrides,
});

export const normalizeMobileContactValue = (value, countryIso2 = DEFAULT_COUNTRY_PHONE_ISO2) => (
  normalizeMobileNumberInput(value, countryIso2)
);

export const normalizeMobileContact = (contact = {}) => {
  const countryIso2 = String(contact.countryIso2 || DEFAULT_COUNTRY_PHONE_ISO2).toLowerCase();
  return createMobileContact({
    id: String(contact.id || '') || makeMobileContactId(),
    value: normalizeMobileContactValue(contact.value || '', countryIso2),
    countryIso2,
    whatsAppEnabled: contact.whatsAppEnabled !== false,
  });
};

export const normalizeMobileContacts = (contacts, fallbackStrings = []) => {
  const source = Array.isArray(contacts) && contacts.length
    ? contacts.map((contact) => normalizeMobileContact(contact))
    : Array.isArray(fallbackStrings)
      ? fallbackStrings
        .map((value) => normalizeMobileContact({ value }))
        .filter((contact) => contact.value)
      : [];
  return source.length ? source.slice(0, 3) : [createMobileContact()];
};

export const ensureMobileContacts = (contacts) => (
  Array.isArray(contacts) && contacts.length ? contacts.slice(0, 3) : [createMobileContact()]
);

export const validateMobileContact = (value, countryIso2, fieldLabel = 'Mobile number') => (
  getMobileNumberValidationMessage(value, countryIso2, { fieldLabel })
);

export const getFilledMobileContacts = (contacts = []) => (
  ensureMobileContacts(contacts).filter((contact) => String(contact.value || '').trim())
);

export const getPrimaryMobileContact = (contacts = []) => (
  getFilledMobileContacts(contacts)[0] || ensureMobileContacts(contacts)[0] || createMobileContact()
);

export const serializeMobileContacts = (contacts = []) => (
  getFilledMobileContacts(contacts).map((contact) => ({
    value: contact.value,
    countryIso2: contact.countryIso2,
    dialCode: findCountryPhoneOption(contact.countryIso2)?.dialCode || '',
    whatsAppEnabled: Boolean(contact.whatsAppEnabled),
  }))
);

