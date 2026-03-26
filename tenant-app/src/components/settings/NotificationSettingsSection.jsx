import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { useTenant } from '../../context/useTenant';
import { getTenantSettingDoc, upsertTenantSettingDoc } from '../../lib/backendStore';
import { createSyncEvent } from '../../lib/syncEvents';
import { Bell } from 'lucide-react';
import SettingCard from './SettingCard';

const rowClass =
  'flex min-h-11 items-center justify-between rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2';

const initialSettings = {
  inAppAlerts: true,
  notificationTone: true,
  emailNotification: false,
};

const NotificationSettingsSection = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [settings, setSettings] = useState(initialSettings);
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getTenantSettingDoc(tenantId, 'notificationSettings').then((result) => {
      if (!active || !result.ok || !result.data) return;
      setSettings((prev) => ({
        ...prev,
        ...result.data,
      }));
    });
    return () => {
      active = false;
    };
  }, [tenantId]);

  if (!user) return null;

  const onToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const onSave = async () => {
    setIsSaving(true);
    setSaveMessage('Saving notification settings...');
    const payload = {
      ...settings,
      updatedBy: user.uid,
    };
    const write = await upsertTenantSettingDoc(tenantId, 'notificationSettings', payload);
    if (!write.ok) {
      setSaveMessage(`Save failed: ${write.error}`);
      setIsSaving(false);
      return;
    }

    const sync = await createSyncEvent({
      tenantId,
      eventType: 'update',
      entityType: 'settingsNotifications',
      entityId: 'notificationSettings',
      changedFields: Object.keys(payload),
      createdBy: user.uid,
    });

    setSaveMessage(
      sync.backendSynced
        ? 'Settings saved and synced with backend.'
        : 'Settings saved. Backend sync pending.',
    );
    setIsSaving(false);
  };

  return (
    <SettingCard
      title="Notification Settings"
      description="Manage how and where you receive system alerts and updates."
      icon={Bell}
    >
      <div className="space-y-2">
        <div className={rowClass}>
          <span className="text-sm font-medium text-[var(--c-text)]">In-App Alerts</span>
          <input
            type="checkbox"
            checked={settings.inAppAlerts}
            onChange={() => onToggle('inAppAlerts')}
            className="h-4 w-4 accent-[var(--c-accent)]"
          />
        </div>
        <div className={rowClass}>
          <span className="text-sm font-medium text-[var(--c-text)]">Notification Tone</span>
          <input
            type="checkbox"
            checked={settings.notificationTone}
            onChange={() => onToggle('notificationTone')}
            className="h-4 w-4 accent-[var(--c-accent)]"
          />
        </div>
        <div className={rowClass}>
          <span className="text-sm font-medium text-[var(--c-text)]">Email Notifications</span>
          <input
            type="checkbox"
            checked={settings.emailNotification}
            onChange={() => onToggle('emailNotification')}
            className="h-4 w-4 accent-[var(--c-accent)]"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="rounded-xl bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
        {saveMessage ? <p className="text-sm text-[var(--c-muted)]">{saveMessage}</p> : null}
      </div>
    </SettingCard>
  );
};

export default NotificationSettingsSection;

