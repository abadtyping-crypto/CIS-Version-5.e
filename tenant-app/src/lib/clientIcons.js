import { getCachedSystemAssetsSnapshot } from './systemAssetsCache';

const emirateIconIdByKey = {
  dubai: 'icon_emirate_dubai',
  abudhabi: 'icon_emirate_abudhabi',
  ajman: 'icon_emirate_ajman',
  sharjah: 'icon_emirate_sharjah',
  fujairah: 'icon_emirate_fujairah',
  rasalkhaimah: 'icon_emirate_rak',
  ummalquwain: 'icon_emirate_uaq',
};

const emirateFallbackByKey = {
  dubai: '/emiratesIcon/dubai.png',
  abudhabi: '/emiratesIcon/abudhabi.png',
  ajman: '/emiratesIcon/ajman.png',
  sharjah: '/emiratesIcon/sharjah.png',
  fujairah: '/emiratesIcon/fujairah.png',
  rasalkhaimah: '/emiratesIcon/rasAlKhaaimah.png',
  ummalquwain: '/emiratesIcon/ummAlQuwain.png',
};

const relationAssetKeyMap = {
  employee: 'icon_rel_com_employee',
  investor: 'icon_rel_com_investor',
  partner: 'icon_rel_com_partner',
  localserviceagent: 'icon_rel_com_localagent',
  wife: 'icon_rel_ind_wife',
  husband: 'icon_rel_ind_husband',
  son: 'icon_rel_ind_son',
  daughter: 'icon_rel_ind_daughter',
  father: 'icon_rel_ind_father',
  mother: 'icon_rel_ind_mother',
  domesticworker: 'icon_rel_ind_domestic',
};

const resolveSystemIcon = (key, fallback, overrideSnapshot = null) => {
  const snapshot = overrideSnapshot && typeof overrideSnapshot === 'object'
    ? overrideSnapshot
    : getCachedSystemAssetsSnapshot();
  return snapshot[key]?.iconUrl || fallback;
};

export const normalizeEmirateKey = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

export const getEmirateIcon = (value, systemAssetsSnapshot = null) => {
  const key = normalizeEmirateKey(value);
  if (!key || !emirateIconIdByKey[key]) return '';
  return resolveSystemIcon(emirateIconIdByKey[key], emirateFallbackByKey[key] || '', systemAssetsSnapshot);
};

export const resolveClientTypeIcon = (item, parent, systemAssetsSnapshot = null) => {
  const type = String(item?.type || '').toLowerCase();
  const parentType = String(parent?.type || '').toLowerCase();
  const relationshipRaw = String(item?.relationship || item?.relation || '').toLowerCase();
  const relationshipKey = relationshipRaw.replace(/\s+/g, '');

  const emirateIcon =
    getEmirateIcon(item?.registeredEmirate, systemAssetsSnapshot) ||
    getEmirateIcon(item?.poBoxEmirate, systemAssetsSnapshot) ||
    getEmirateIcon(parent?.registeredEmirate, systemAssetsSnapshot) ||
    getEmirateIcon(parent?.poBoxEmirate, systemAssetsSnapshot);
  if (emirateIcon) return emirateIcon;

  if (type === 'company') return resolveSystemIcon('icon_main_company', '/company.png', systemAssetsSnapshot);
  if (type === 'individual') return resolveSystemIcon('icon_main_individual', '/individual.png', systemAssetsSnapshot);
  
  if (relationAssetKeyMap[relationshipKey]) {
    return resolveSystemIcon(relationAssetKeyMap[relationshipKey], '/dependent.png', systemAssetsSnapshot);
  }
  
  if (parentType === 'company' || relationshipKey === 'employee') {
    return resolveSystemIcon('icon_rel_com_employee', '/employee.png', systemAssetsSnapshot);
  }
  
  return resolveSystemIcon('icon_main_dependents', '/dependent.png', systemAssetsSnapshot);
};
