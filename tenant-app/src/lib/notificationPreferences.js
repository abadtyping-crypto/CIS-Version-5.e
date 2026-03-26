const keyFor = (tenantId, uid) => `acis_notification_prefs_v1_${tenantId}_${uid}`;

export const getNotificationPreferences = (tenantId, uid) => {
  if (typeof window === 'undefined') {
    return { flashEnabled: true, flashDurationMs: 3000 };
  }

  const raw = window.localStorage.getItem(keyFor(tenantId, uid));
  if (!raw) return { flashEnabled: true, flashDurationMs: 3000 };

  try {
    const parsed = JSON.parse(raw);
    return {
      flashEnabled: parsed?.flashEnabled !== false,
      flashDurationMs: Number(parsed?.flashDurationMs || 3000),
    };
  } catch {
    return { flashEnabled: true, flashDurationMs: 3000 };
  }
};

export const saveNotificationPreferences = (tenantId, uid, prefs) => {
  if (typeof window === 'undefined') return;
  const payload = {
    flashEnabled: prefs?.flashEnabled !== false,
    flashDurationMs: Number(prefs?.flashDurationMs || 3000),
  };
  window.localStorage.setItem(keyFor(tenantId, uid), JSON.stringify(payload));
};

