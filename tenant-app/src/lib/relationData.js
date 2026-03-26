export const COMPANY_RELATION_OPTIONS = [
  { value: 'employee', label: 'Employee', icon: 'icon_rel_com_employee' },
  { value: 'investor', label: 'Investor', icon: 'icon_rel_com_investor' },
  { value: 'partner', label: 'Partner', icon: 'icon_rel_com_partner' },
  { value: 'local service agent', label: 'Local Service Agent', icon: 'icon_rel_com_localagent' },
];

export const INDIVIDUAL_RELATION_OPTIONS = [
  { value: 'wife', label: 'Wife', icon: 'icon_rel_ind_wife' },
  { value: 'husband', label: 'Husband', icon: 'icon_rel_ind_husband' },
  { value: 'son', label: 'Son', icon: 'icon_rel_ind_son' },
  { value: 'daughter', label: 'Daughter', icon: 'icon_rel_ind_daughter' },
  { value: 'father', label: 'Father', icon: 'icon_rel_ind_father' },
  { value: 'mother', label: 'Mother', icon: 'icon_rel_ind_mother' },
  { value: 'domestic worker', label: 'Domestic Worker', icon: 'icon_rel_ind_domestic' },
];

export const normalizeRelationValue = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const getRelationOptionsForParentType = (parentType) =>
  String(parentType || '').toLowerCase() === 'company'
    ? COMPANY_RELATION_OPTIONS
    : INDIVIDUAL_RELATION_OPTIONS;

export const findRelationOption = (value, parentType) => {
  const normalizedValue = normalizeRelationValue(value);
  return getRelationOptionsForParentType(parentType).find(
    (item) => normalizeRelationValue(item.value) === normalizedValue,
  ) || null;
};

export const getRelationIcon = (value, parentType = 'individual') =>
  findRelationOption(value, parentType)?.icon || '';
