export const EMIRATE_ICON_BASE_PATH = '/emiratesIcon';

export const EMIRATE_OPTIONS = [
  { value: 'Dubai', label: 'Dubai', iconId: 'icon_emirate_dubai', icon: `${EMIRATE_ICON_BASE_PATH}/dubai.png` },
  { value: 'Abu Dhabi', label: 'Abu Dhabi', iconId: 'icon_emirate_abudhabi', icon: `${EMIRATE_ICON_BASE_PATH}/abudhabi.png` },
  { value: 'Sharjah', label: 'Sharjah', iconId: 'icon_emirate_sharjah', icon: `${EMIRATE_ICON_BASE_PATH}/sharjah.png` },
  { value: 'Ajman', label: 'Ajman', iconId: 'icon_emirate_ajman', icon: `${EMIRATE_ICON_BASE_PATH}/ajman.png` },
  { value: 'Fujairah', label: 'Fujairah', iconId: 'icon_emirate_fujairah', icon: `${EMIRATE_ICON_BASE_PATH}/fujairah.png` },
  { value: 'Ras Al Khaimah', label: 'Ras Al Khaimah', iconId: 'icon_emirate_rak', icon: `${EMIRATE_ICON_BASE_PATH}/rasAlKhaaimah.png` },
  { value: 'Umm Al Quwain', label: 'Umm Al Quwain', iconId: 'icon_emirate_uaq', icon: `${EMIRATE_ICON_BASE_PATH}/ummAlQuwain.png` },
];

export const findEmirateOption = (value) =>
  EMIRATE_OPTIONS.find((item) => item.value === value) || null;
