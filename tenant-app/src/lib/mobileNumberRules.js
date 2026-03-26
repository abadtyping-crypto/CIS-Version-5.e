import {
  DEFAULT_COUNTRY_PHONE_ISO2,
  findCountryPhoneOption,
} from './countryPhoneData';

const UAE_LOCAL_MOBILE_LENGTH = 9;
const DEFAULT_LOCAL_MOBILE_LENGTH = 15;

const normalizeFieldLabel = (fieldLabel = 'Mobile number') => String(fieldLabel || 'Mobile number').trim();

export const toMobileDigits = (value) => String(value || '').replace(/\D/g, '');

export const getMobileNumberRule = (countryIso2 = DEFAULT_COUNTRY_PHONE_ISO2) => {
  const country = findCountryPhoneOption(countryIso2);
  const normalizedIso2 = country?.iso2 || DEFAULT_COUNTRY_PHONE_ISO2;

  if (normalizedIso2 === DEFAULT_COUNTRY_PHONE_ISO2) {
    return {
      countryIso2: normalizedIso2,
      dialCode: country?.dialCode || '',
      localLength: UAE_LOCAL_MOBILE_LENGTH,
      maxLocalLength: UAE_LOCAL_MOBILE_LENGTH,
      trimLeadingZero: true,
      requiresExactLength: true,
    };
  }

  return {
    countryIso2: normalizedIso2,
    dialCode: country?.dialCode || '',
    localLength: null,
    maxLocalLength: DEFAULT_LOCAL_MOBILE_LENGTH,
    trimLeadingZero: false,
    requiresExactLength: false,
  };
};

export const normalizeMobileNumberInput = (value, countryIso2 = DEFAULT_COUNTRY_PHONE_ISO2) => {
  const rule = getMobileNumberRule(countryIso2);
  let digits = toMobileDigits(value);

  if (rule.dialCode && digits.startsWith(rule.dialCode)) digits = digits.slice(rule.dialCode.length);
  if (rule.trimLeadingZero && digits.startsWith('0')) digits = digits.slice(1);

  return digits.slice(0, rule.maxLocalLength);
};

export const getMobileNumberValidationMessage = (
  value,
  countryIso2 = DEFAULT_COUNTRY_PHONE_ISO2,
  options = {},
) => {
  const {
    fieldLabel = 'Primary mobile number',
    required = true,
  } = options;

  const normalizedFieldLabel = normalizeFieldLabel(fieldLabel);
  const normalizedValue = normalizeMobileNumberInput(value, countryIso2);
  const rule = getMobileNumberRule(countryIso2);

  if (!normalizedValue) {
    return required ? `${normalizedFieldLabel} is required.` : '';
  }

  if (rule.requiresExactLength && rule.localLength && normalizedValue.length < rule.localLength) {
    const missingCount = rule.localLength - normalizedValue.length;
    return `${missingCount} number${missingCount > 1 ? 's are' : ' is'} missing from the mobile number.`;
  }

  return '';
};
