import { useState } from 'react';
import SettingCard from './SettingCard';
import {
  USER_ACCESS_ACTIONS,
  getRoleDefaultPermissions,
  getUserAccessOverrides,
  setUserAccessOverride,
  clearUserAccessOverrides,
} from '../../lib/userControlPreferences';

const UserFunctionAccessSection = ({ tenantId, selectedUser }) => {
  const [overrides, setOverrides] = useState({});
  const [prevUid, setPrevUid] = useState(null);

  if (!selectedUser) return null;

  if (selectedUser.uid !== prevUid) {
    setPrevUid(selectedUser.uid);
    setOverrides(getUserAccessOverrides(tenantId, selectedUser.uid));
  }

  const roleDefaults = getRoleDefaultPermissions(selectedUser.role);

  const onToggle = (actionKey, currentEnabled) => {
    const next = setUserAccessOverride(tenantId, selectedUser.uid, actionKey, !currentEnabled);
    setOverrides(next);
  };

  const onReset = () => {
    if (!confirm('Are you sure you want to clear all custom overrides for this user?')) return;
    const next = clearUserAccessOverrides(tenantId, selectedUser.uid);
    setOverrides(next);
  };

  return (
    <SettingCard
      title="User Function Access"
      description="User-wise function permissions. Page can remain visible; action can still be blocked."
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-(--c-border) bg-(--c-panel) p-3">
        <p className="text-sm text-(--c-muted)">
          Selected: <span className="font-semibold text-(--c-text)">{selectedUser.displayName}</span> ({selectedUser.role})
        </p>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-(--c-border) bg-(--c-surface) px-3 py-1.5 text-xs font-semibold text-(--c-text)"
        >
          Reset Overrides
        </button>
      </div>

      <div className="grid gap-2">
        {USER_ACCESS_ACTIONS.map((item) => {
          const hasOverride = Object.prototype.hasOwnProperty.call(overrides, item.key);
          const effectiveValue = hasOverride ? overrides[item.key] : roleDefaults[item.key];

          return (
            <div
              key={item.key}
              className={`flex items-center justify-between rounded-xl border p-3 transition ${hasOverride ? 'border-(--c-accent) bg-(--c-accent)/5' : 'border-(--c-border) bg-(--c-panel)'
                }`}
            >
              <div>
                <p className="text-sm font-bold text-(--c-text)">{item.label}</p>
                <p className="text-[10px] uppercase font-bold text-(--c-muted)">
                  {hasOverride ? 'Custom Override' : `Role Default (${roleDefaults[item.key] ? 'Enabled' : 'Disabled'})`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggle(item.key, effectiveValue)}
                className={`relative h-6 w-11 rounded-full transition ${effectiveValue ? 'bg-(--c-accent)' : 'bg-[var(--c-toggle-off)]'
                  }`}
              >
                <div
                  className={`absolute top-1 h-4 w-4 rounded-full bg-[var(--c-knob)] transition-all ${effectiveValue ? 'left-6' : 'left-1'
                    }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </SettingCard>
  );
};

export default UserFunctionAccessSection;
