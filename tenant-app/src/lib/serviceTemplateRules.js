export const createEmptyServiceTemplateDraft = () => ({
  name: '',
  description: '',
  govCharge: '',
  clientCharge: '',
  iconId: '',
});

export const normalizeLibraryTitle = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());

export const normalizeLibraryDescription = (value) => {
  const cleaned = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

export const normalizeServiceTemplateNameForCompare = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]/g, '');

export const findServiceTemplateNameConflict = (rows = [], draftName = '', editingId = '') => {
  const nextNameKey = normalizeServiceTemplateNameForCompare(draftName);
  if (!nextNameKey) return null;

  return (rows || []).find((item) => {
    const currentId = String(item?.id || '').trim();
    if (editingId && currentId === String(editingId).trim()) return false;
    return normalizeServiceTemplateNameForCompare(item?.name || currentId) === nextNameKey;
  }) || null;
};

export const hydrateServiceTemplateDraft = (source = {}) => ({
  name: String(source.name || ''),
  description: String(source.description || ''),
  govCharge: source.govCharge === 0 ? '0' : String(source.govCharge || ''),
  clientCharge: source.clientCharge === 0 ? '0' : String(source.clientCharge || ''),
  iconId: String(source.iconId || ''),
});

const parseChargeValue = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
};

export const validateServiceTemplateDraft = (draft, options = {}) => {
  const {
    nameLabel = 'Application Name',
  } = options;

  const trimmedName = String(draft?.name || '').trim();
  if (!trimmedName) return `${nameLabel} is required.`;

  const govCharge = parseChargeValue(draft?.govCharge);
  if (Number.isNaN(govCharge)) return 'Government Charge must be a valid number.';

  const clientCharge = parseChargeValue(draft?.clientCharge);
  if (Number.isNaN(clientCharge)) return 'Client Charge must be a valid number.';

  return '';
};

export const buildServiceTemplatePayload = (draft, options = {}) => {
  const {
    createdBy = '',
    updatedBy = '',
    editing = false,
    status = 'active',
  } = options;

  const payload = {
    name: normalizeLibraryTitle(draft?.name || ''),
    description: normalizeLibraryDescription(draft?.description || ''),
    govCharge: parseChargeValue(draft?.govCharge) || 0,
    clientCharge: parseChargeValue(draft?.clientCharge) || 0,
    iconId: String(draft?.iconId || '').trim(),
    status,
  };

  if (editing) {
    payload.updatedAt = new Date().toISOString();
    payload.updatedBy = updatedBy;
  } else {
    payload.createdAt = new Date().toISOString();
    payload.createdBy = createdBy;
  }

  return payload;
};
