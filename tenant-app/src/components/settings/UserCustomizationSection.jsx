import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { useTenant } from '../../context/useTenant';
import {
  addTenantUser,
  deleteTenantUser,
  fetchTenantUsersFromBackend,
  getTenantUsers,
  toggleTenantUserFreeze,
} from '../../lib/tenantUsers';
import SettingCard from './SettingCard';

const inputClass =
  'mt-1 w-full rounded-xl border border-(--c-border) bg-(--c-panel) px-3 py-2.5 text-sm text-(--c-text) outline-none transition focus:border-(--c-accent) focus:ring-2 focus:ring-(--c-ring)';

const labelClass = 'text-sm text-(--c-muted)';
const errorTextClass = 'mt-1 text-xs text-[var(--c-danger)]';
const freezeActionClass =
  'rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 bg-[var(--c-warning-soft)] text-[var(--c-warning)]';
const unfreezeActionClass =
  'rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 bg-[var(--c-success-soft)] text-[var(--c-success)]';
const deleteActionClass =
  'rounded-lg bg-[var(--c-danger-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--c-danger)] transition hover:opacity-80';

const roleOptions = ['Admin', 'Staff', 'Accountant', 'Manager'];

const toDigits = (value) => String(value || '').replace(/\D/g, '');

const toProperCase = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const toLower = (value) => String(value || '').trim().toLowerCase();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const UserCustomizationSection = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    mobile: '',
    role: '',
  });
  const [users, setUsers] = useState(() => getTenantUsers(tenantId));
  const [errors, setErrors] = useState({});
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetchTenantUsersFromBackend(tenantId).then((next) => {
      if (active) setUsers(next);
    });
    return () => {
      active = false;
    };
  }, [tenantId]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = () => {
    const payload = {
      displayName: toProperCase(form.displayName),
      email: toLower(form.email),
      mobile: toDigits(form.mobile).slice(0, 9),
      role: form.role,
    };

    const nextErrors = {};

    if (!payload.displayName) {
      nextErrors.displayName = 'Display Name is required.';
    }

    if (!payload.email) {
      nextErrors.email = 'Email Address is required.';
    } else if (!isValidEmail(payload.email)) {
      nextErrors.email = 'Use format: email@domain.com';
    }

    if (!payload.role) {
      nextErrors.role = 'Role is required.';
    }

    if (users.some((item) => item.email.toLowerCase() === payload.email.toLowerCase())) {
      nextErrors.email = 'This email already exists in tenant users.';
    }

    if (payload.mobile) {
      if (payload.mobile.startsWith('0')) {
        nextErrors.mobile = 'Leading 0 is not allowed.';
      } else if (payload.mobile.length > 9) {
        nextErrors.mobile = 'Maximum 9 digits allowed.';
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setSaveMessage('Fix validation errors before creating user.');
      return;
    }

    const next = addTenantUser(tenantId, {
      ...payload,
      createdBy: user.uid,
      status: 'Invited',
    });
    setUsers(next);
    setForm({
      displayName: '',
      email: '',
      mobile: '',
      role: '',
    });
    setSaveMessage('User created with Invited status. On first successful login, status becomes Active.');
  };

  if (!user) return null;

  const onToggleFreeze = (uid) => {
    const next = toggleTenantUserFreeze(tenantId, uid);
    setUsers(next);
    setSaveMessage('User status updated.');
  };

  const onDelete = (uid) => {
    const next = deleteTenantUser(tenantId, uid);
    setUsers(next);
    setSaveMessage('User removed.');
  };

  return (
    <SettingCard
      title="User Customization"
      description="Tenant can add staff users. User-specific setup only."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Display Name *
          <input
            className={inputClass}
            value={form.displayName}
            onChange={(event) => updateField('displayName', event.target.value)}
            placeholder="Display Name"
          />
          <p className="mt-1 text-[11px] text-(--c-muted)">
            This name appears on transactions created by this user.
          </p>
          {errors.displayName ? <p className={errorTextClass}>{errors.displayName}</p> : null}
        </label>

        <label className={labelClass}>
          Role *
          <select
            className={inputClass}
            value={form.role}
            onChange={(event) => updateField('role', event.target.value)}
          >
            <option value="">Select role</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          {errors.role ? <p className={errorTextClass}>{errors.role}</p> : null}
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Email Address *
          <input
            className={inputClass}
            value={form.email}
            onChange={(event) => updateField('email', event.target.value.toLowerCase())}
            placeholder="email@domain.com"
          />
          <p className="mt-1 text-[11px] text-(--c-muted)">
            Invite-safe access is tied to this email. User must log in with this exact email.
          </p>
          {errors.email ? <p className={errorTextClass}>{errors.email}</p> : null}
        </label>

        <label className={labelClass}>
          Mobile Number
          <div className="mt-1 flex items-center rounded-xl border border-(--c-border) bg-(--c-panel) px-3">
            <span className="pr-2 text-sm text-(--c-muted)">+971</span>
            <input
              className="w-full bg-transparent py-2.5 text-sm text-(--c-text) outline-none"
              value={form.mobile}
              onChange={(event) => updateField('mobile', toDigits(event.target.value).slice(0, 9))}
              inputMode="numeric"
              maxLength={9}
              placeholder="5xxxxxxxx"
            />
          </div>
          {errors.mobile ? <p className={errorTextClass}>{errors.mobile}</p> : null}
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          className="rounded-xl bg-(--c-accent) px-4 py-2.5 text-sm font-semibold text-white"
        >
          Create User
        </button>
        {saveMessage ? <p className="text-sm text-(--c-muted)">{saveMessage}</p> : null}
      </div>

      <div className="mt-5 border-t border-(--c-border) pt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-(--c-text)">Manage Existing Users</p>
          <p className="text-xs text-(--c-muted)">{users.length} user(s)</p>
        </div>

        {users.length === 0 ? (
          <p className="rounded-xl border border-dashed border-(--c-border) bg-(--c-panel) p-3 text-sm text-(--c-muted)">
            No users added yet for this tenant.
          </p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => {
              const isFrozen = String(user.status || '').toLowerCase() === 'frozen';
              const isSuperAdmin = String(user.role || '').toLowerCase() === 'super admin';
              return (
                <article
                  key={user.uid}
                  className="rounded-xl border border-(--c-border) bg-(--c-panel) p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-(--c-text)">{user.displayName}</p>
                      <p className="truncate text-xs text-(--c-muted)">{user.email}</p>
                      <p className="mt-1 text-xs text-(--c-muted)">
                        Role: <span className={isSuperAdmin ? 'font-bold text-(--c-accent)' : ''}>{user.role}</span> • Status: {user.status}
                      </p>
                    </div>
                    {!isSuperAdmin && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleFreeze(user.uid)}
                          className={`${isFrozen
                              ? unfreezeActionClass
                              : freezeActionClass
                            }`}
                        >
                          {isFrozen ? 'Unfreeze' : 'Freeze'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(user.uid)}
                          className={deleteActionClass}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </SettingCard>
  );
};

export default UserCustomizationSection;

