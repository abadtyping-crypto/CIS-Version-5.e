import { useReducer } from 'react';
import SettingCard from './SettingCard';
import {
  USER_NOTIFICATION_EVENTS,
  getUserNotificationRules,
  saveUserNotificationRules,
} from '../../lib/userControlPreferences';

const UserNotificationRulesSection = ({ tenantId, selectedUser }) => {
  const [, forceRefresh] = useReducer((value) => value + 1, 0);
  if (!selectedUser) return null;
  const rules = getUserNotificationRules(tenantId, selectedUser.uid);

  if (!rules) return null;

  const save = (nextRules) => {
    saveUserNotificationRules(tenantId, selectedUser.uid, nextRules);
    forceRefresh();
  };

  const toggleChannel = (key) => {
    save({ ...rules, [key]: !rules[key] });
  };

  const toggleEvent = (key) => {
    save({ ...rules, events: { ...rules.events, [key]: !rules.events[key] } });
  };

  return (
    <SettingCard
      title="User Notification Rules"
      description="Customize notification behavior per user without changing other users."
    >
      <div className="mb-3 rounded-xl border border-(--c-border) bg-(--c-panel) p-3">
        <p className="text-sm text-(--c-muted)">
          Selected: <span className="font-semibold text-(--c-text)">{selectedUser.displayName}</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {['inApp', 'email', 'flash'].map((channel) => (
          <button
            key={channel}
            onClick={() => toggleChannel(channel)}
            className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${rules[channel]
              ? 'border-(--c-accent) bg-(--c-accent)/5'
              : 'border-(--c-border) bg-(--c-panel) hover:bg-(--c-surface)'
              }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-(--c-muted)">
              {channel === 'inApp' ? 'In-App' : channel}
            </span>
            <div className={`h-1.5 w-1.5 rounded-full ${rules[channel] ? 'bg-(--c-accent) shadow-[0_0_8px_var(--c-accent)]' : 'bg-[var(--c-toggle-off)]'}`} />
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-(--c-muted)">Event Triggers</p>
        {USER_NOTIFICATION_EVENTS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => toggleEvent(item.key)}
            className={`flex items-center justify-between rounded-xl border p-3 transition ${rules.events[item.key]
              ? 'border-(--c-accent) bg-(--c-accent)/5'
              : 'border-(--c-border) bg-(--c-panel) hover:bg-(--c-surface)'
              }`}
          >
            <p className="text-sm font-bold text-(--c-text)">{item.label}</p>
            <div className={`h-1.5 w-1.5 rounded-full ${rules.events[item.key] ? 'bg-(--c-accent) shadow-[0_0_8px_var(--c-accent)]' : 'bg-[var(--c-toggle-off)]'}`} />
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-(--c-muted)">Quiet Hours</p>
          <button
            type="button"
            onClick={() => save({ ...rules, quietHoursEnabled: !rules.quietHoursEnabled })}
            className={`relative h-5 w-9 rounded-full transition ${rules.quietHoursEnabled ? 'bg-(--c-accent)' : 'bg-[var(--c-toggle-off)]'
              }`}
          >
            <div
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--c-knob)] transition-all ${rules.quietHoursEnabled ? 'left-4.5' : 'left-0.5'
                }`}
            />
          </button>
        </div>

        {rules.quietHoursEnabled && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-(--c-border) bg-(--c-panel) p-3">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-(--c-muted) uppercase">From</p>
              <input
                type="time"
                value={rules.quietFrom}
                onChange={(event) => save({ ...rules, quietFrom: event.target.value })}
                className="w-full bg-transparent text-sm font-bold text-(--c-text) outline-none"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-(--c-muted) uppercase">To</p>
              <input
                type="time"
                value={rules.quietTo}
                onChange={(event) => save({ ...rules, quietTo: event.target.value })}
                className="w-full bg-transparent text-sm font-bold text-(--c-text) outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </SettingCard>
  );
};

export default UserNotificationRulesSection;
