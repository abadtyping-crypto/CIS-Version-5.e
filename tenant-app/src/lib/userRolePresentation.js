export const normalizeRoleLabel = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'superadmin' || normalized === 'super admin') return 'Owner';
  if (normalized === 'admin') return 'Admin';
  if (normalized === 'accountant') return 'Accountant';
  if (normalized === 'manager') return 'Manager';
  if (normalized === 'staff') return 'Staff';
  return role || 'Staff';
};

export const getRoleBadgeClassName = (roleLabel) => {
  const normalized = String(roleLabel || '').trim().toLowerCase();
  if (normalized === 'owner') {
    return 'border-[color:color-mix(in_srgb,var(--c-warning)_58%,var(--c-border))] bg-[color:color-mix(in_srgb,var(--c-warning)_16%,var(--c-surface))] text-[var(--c-warning)]';
  }
  if (normalized === 'accountant') {
    return 'border-[color:color-mix(in_srgb,var(--c-accent)_54%,var(--c-border))] bg-[color:color-mix(in_srgb,var(--c-accent)_16%,var(--c-surface))] text-[var(--c-accent)]';
  }
  if (normalized === 'staff') {
    return 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)]';
  }
  if (normalized === 'admin') {
    return 'border-[color:color-mix(in_srgb,var(--c-success)_42%,var(--c-border))] bg-[color:color-mix(in_srgb,var(--c-success)_14%,var(--c-surface))] text-[var(--c-success)]';
  }
  if (normalized === 'manager') {
    return 'border-[color:color-mix(in_srgb,var(--c-info)_46%,var(--c-border))] bg-[color:color-mix(in_srgb,var(--c-info)_14%,var(--c-surface))] text-[var(--c-info)]';
  }
  return 'border-[color:color-mix(in_srgb,var(--c-success)_42%,var(--c-border))] bg-[color:color-mix(in_srgb,var(--c-success)_14%,var(--c-surface))] text-[var(--c-success)]';
};

export const getRoleChipLabel = (role) => {
  const label = normalizeRoleLabel(role);
  if (label === 'Owner') return 'Owner / Gold';
  if (label === 'Accountant') return 'Accountant / Blue';
  if (label === 'Manager') return 'Manager / Green';
  if (label === 'Admin') return 'Admin / Green';
  return `${label} / Neutral`;
};
