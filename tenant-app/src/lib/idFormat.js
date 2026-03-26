export const toYmd = (date = new Date()) => {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

export const formatDatePart = (dateFormat = 'YYYYMMDD', date = new Date()) => {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  if (dateFormat === 'DDMMYYYY') return `${dd}${mm}${yyyy}`;
  if (dateFormat === 'MMDDYYYY') return `${mm}${dd}${yyyy}`;
  if (dateFormat === 'YYMMDD') return `${yyyy.slice(2)}${mm}${dd}`;
  if (dateFormat === 'YYYYMMDD') return `${yyyy}${mm}${dd}`;
  return '';
};

export const formatDisplayId = ({
  prefix = '',
  seq = 1,
  padding = 4,
  dateFormat = 'YYYYMMDD',
  useSeparator = true,
  date = new Date(),
}) => {
  const safePrefix = String(prefix || '').trim().toUpperCase();
  const safeSeq = String(Number(seq) || 0).padStart(Number(padding) || 4, '0');
  const datePart = formatDatePart(dateFormat, date);
  const parts = [safePrefix];
  if (datePart) parts.push(datePart);
  parts.push(safeSeq);
  return useSeparator ? parts.filter(Boolean).join('-') : parts.join('');
};

export const normalizeIdRule = (rule = {}, fallbackPrefix = '') => {
  const prefix = String(rule?.prefix || fallbackPrefix || '').trim().toUpperCase();
  const padding = Number(rule?.padding);
  const sequenceStart = Number(rule?.sequenceStart);
  const dateEnabled = rule?.dateEnabled !== false && rule?.skipDate !== true;
  const dateFormat = String(rule?.dateFormat || 'YYYYMMDD').toUpperCase();
  const useSeparator = rule?.useSeparator !== false;
  const resetMode = String(rule?.resetMode || 'continuous').toLowerCase() === 'daily' ? 'daily' : 'continuous';

  return {
    prefix,
    padding: Number.isFinite(padding) && padding > 0 ? padding : 4,
    sequenceStart: Number.isFinite(sequenceStart) && sequenceStart > 0 ? sequenceStart : 1,
    dateEnabled,
    dateFormat,
    useSeparator,
    resetMode,
  };
};

export const buildSequenceKey = (ruleKey, normalizedRule, date = new Date()) => {
  if (normalizedRule.resetMode === 'daily') {
    return `${ruleKey}_${toYmd(date)}`;
  }
  return ruleKey;
};
