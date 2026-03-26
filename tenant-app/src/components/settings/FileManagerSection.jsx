import { useEffect, useState } from 'react';
import {
  HardDrive,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Info,
  Loader2,
  FolderOpen,
  Key,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useTenant } from '../../context/useTenant';
import { fetchTenantIntegrationConfig, upsertTenantIntegrationConfig } from '../../lib/backendStore';
import { createSyncEvent } from '../../lib/syncEvents';
import SettingCard from './SettingCard';

const rowClass =
  'grid grid-cols-1 gap-1 sm:grid-cols-[200px_1fr] sm:items-center py-2.5 border-b border-(--c-border) last:border-0';
const inputClass =
  'w-full rounded-xl border border-(--c-border) bg-(--c-panel) px-3 py-2.5 text-sm font-semibold text-(--c-text) outline-none focus:ring-2 focus:ring-(--c-accent)/30 focus:border-(--c-accent) transition-all';
const labelClass = 'text-xs font-bold text-(--c-muted) uppercase tracking-wide';

// ─── Status Badge ─────────────────────────────────────────────────────────────
const ConnectionBadge = ({ connected, email, onDisconnect, onConnect, isConnecting }) => (
  <div
    className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
      connected
        ? 'bg-emerald-500/10 border border-emerald-500/20'
        : 'bg-(--c-panel)/60 border border-(--c-border)'
    }`}
  >
    {connected ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
    ) : (
      <XCircle className="h-5 w-5 text-(--c-muted) shrink-0" />
    )}
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-bold ${connected ? 'text-emerald-400' : 'text-(--c-muted)'}`}>
        {connected ? 'Google Drive Connected' : 'Not Connected'}
      </p>
      {email && <p className="text-xs text-(--c-muted) mt-0.5 truncate">{email}</p>}
    </div>
    {connected ? (
      <button
        type="button"
        onClick={onDisconnect}
        className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition"
      >
        Disconnect
      </button>
    ) : (
      <button
        type="button"
        onClick={onConnect}
        className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-600 disabled:opacity-50"
      >
        {isConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
        {isConnecting ? 'Authenticating...' : 'Sign in with Google'}
      </button>
    )}
  </div>
);

// ─── Scope Tag ────────────────────────────────────────────────────────────────
const ScopeTag = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
      active
        ? 'bg-(--c-accent) text-white border-(--c-accent) shadow-sm'
        : 'border-(--c-border) text-(--c-muted) hover:text-(--c-text) hover:border-(--c-accent)/40'
    }`}
  >
    {label}
  </button>
);

const SCOPES = [
  { key: 'drive.file', label: 'Drive File (Recommended)' },
  { key: 'drive', label: 'Full Drive Access' },
  { key: 'drive.readonly', label: 'Read-Only' },
  { key: 'drive.appdata', label: 'App Data Only' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
const FileManagerSection = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();

  const [config, setConfig] = useState({
    driveConnected: false,
    driveEmail: '',
    driveClientId: '',
    driveClientSecret: '',
    driveRedirectUri: '',
    driveRefreshToken: '',
    driveScope: 'drive.file',
    driveRootFolderId: '',
    driveSharedDriveId: '',
  });
  const [status, setStatus] = useState({ message: '', type: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchTenantIntegrationConfig(tenantId).then((result) => {
      if (!active || !result.ok || !result.data) return;
      setConfig((prev) => ({ ...prev, ...result.data }));
    });
    return () => { active = false; };
  }, [tenantId]);

  const onSave = async () => {
    setIsSaving(true);
    setStatus({ message: 'Saving…', type: 'info' });
    const payload = { ...config, updatedBy: user.uid };
    const res = await upsertTenantIntegrationConfig(tenantId, payload);
    if (!res.ok) {
      setStatus({ message: `Save failed: ${res.error}`, type: 'error' });
      setIsSaving(false);
      return;
    }
    await createSyncEvent({
      tenantId,
      eventType: 'update',
      entityType: 'settingsIntegrations',
      entityId: 'integrations',
      changedFields: Object.keys(payload),
      createdBy: user.uid,
    });
    setStatus({ message: 'Drive configuration saved successfully.', type: 'success' });
    setIsSaving(false);
    setTimeout(() => setStatus({ message: '', type: '' }), 3000);
  };

  const handleDisconnect = () => {
    setConfig((prev) => ({
      ...prev,
      driveConnected: false,
      driveEmail: '',
      driveRefreshToken: '',
    }));
  };

  const handleDriveAuth = async () => {
    if (!config.driveClientId || !config.driveClientSecret) {
      setStatus({ message: 'Client ID and Client Secret are required.', type: 'error' });
      return;
    }

    const authStart = window?.electron?.mail?.authStart; // We use the same service for any Google OAuth
    if (typeof authStart !== 'function') {
      setStatus({ message: 'OAuth is only available in the Desktop app.', type: 'error' });
      return;
    }

    setStatus({ message: 'Waiting for Google authentication...', type: 'connecting' });

    try {
      const res = await authStart({
        clientId: config.driveClientId,
        clientSecret: config.driveClientSecret,
        redirectUri: config.driveRedirectUri || 'http://localhost:8888',
      });

      if (res.ok && res.tokens) {
        setConfig((prev) => ({
          ...prev,
          driveRefreshToken: res.tokens.refresh_token || prev.driveRefreshToken,
          driveConnected: true,
        }));
        setStatus({ message: 'Authenticated successfully! Please Save to persist.', type: 'success' });
      } else {
        setStatus({ message: 'Authentication failed.', type: 'error' });
      }
    } catch (err) {
      setStatus({ message: `Error: ${err.message}`, type: 'error' });
    }
  };

  return (
    <SettingCard
      title="File Manager"
      description="Connect Google Drive to enable file uploads, document storage, and cloud attachments across the platform."
      icon={HardDrive}
    >
      <div className="space-y-6">
        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
          <p className="text-xs font-medium text-indigo-300 leading-relaxed">
            Google Drive integration requires a{' '}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-indigo-200 inline-flex items-center gap-0.5"
            >
              Google Cloud OAuth 2.0 Client
              <ExternalLink className="h-3 w-3 ml-0.5" />
            </a>{' '}
            with the <strong>Google Drive API</strong> enabled. Generating a refresh token is required to maintain persistent access without re-authentication.
          </p>
        </div>

        {/* Status Badge */}
        <ConnectionBadge
          connected={config.driveConnected}
          email={config.driveEmail}
          onDisconnect={handleDisconnect}
          onConnect={handleDriveAuth}
          isConnecting={status.type === 'connecting'}
        />

        {/* OAuth Credentials */}
        <div className="rounded-xl bg-(--c-panel)/60 p-4 space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <Key className="h-4 w-4 text-(--c-accent)" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-(--c-muted)">
              OAuth 2.0 Credentials
            </h3>
          </div>
          <div className={rowClass}>
            <label className={labelClass}>Client ID</label>
            <input
              type="text"
              placeholder="xxxxxxxxxx.apps.googleusercontent.com"
              value={config.driveClientId || ''}
              onChange={(e) => setConfig({ ...config, driveClientId: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className={rowClass}>
            <label className={labelClass}>Client Secret</label>
            <input
              type="password"
              placeholder="GOCSPX-••••••••"
              value={config.driveClientSecret || ''}
              onChange={(e) => setConfig({ ...config, driveClientSecret: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className={rowClass}>
            <label className={labelClass}>Redirect URI</label>
            <input
              type="text"
              placeholder="http://localhost:8888"
              value={config.driveRedirectUri || ''}
              onChange={(e) => setConfig({ ...config, driveRedirectUri: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className={rowClass}>
            <label className={labelClass}>Refresh Token</label>
            <input
              type="password"
              placeholder="Paste refresh token from OAuth flow"
              value={config.driveRefreshToken || ''}
              onChange={(e) =>
                setConfig({ ...config, driveRefreshToken: e.target.value, driveConnected: e.target.value.length > 10 })
              }
              className={inputClass}
            />
          </div>
          <div className={rowClass}>
            <label className={labelClass}>Google Account Email</label>
            <input
              type="email"
              placeholder="yourname@gmail.com"
              value={config.driveEmail || ''}
              onChange={(e) => setConfig({ ...config, driveEmail: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        {/* Drive Settings */}
        <div className="rounded-xl bg-(--c-panel)/60 p-4 space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen className="h-4 w-4 text-(--c-accent)" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-(--c-muted)">
              Drive Settings
            </h3>
          </div>

          {/* Scope Selector */}
          <div className={`${rowClass} border-b border-(--c-border)`}>
            <label className={labelClass}>Access Scope</label>
            <div className="flex flex-wrap gap-2 py-1">
              {SCOPES.map(({ key, label }) => (
                <ScopeTag
                  key={key}
                  label={label}
                  active={config.driveScope === key}
                  onClick={() => setConfig({ ...config, driveScope: key })}
                />
              ))}
            </div>
          </div>

          <div className={rowClass}>
            <label className={labelClass}>Root Folder ID</label>
            <input
              type="text"
              placeholder="Optional — leave blank for My Drive root"
              value={config.driveRootFolderId || ''}
              onChange={(e) => setConfig({ ...config, driveRootFolderId: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className={rowClass}>
            <label className={labelClass}>Shared Drive ID</label>
            <input
              type="text"
              placeholder="Optional — for Shared Drive (Team Drive)"
              value={config.driveSharedDriveId || ''}
              onChange={(e) => setConfig({ ...config, driveSharedDriveId: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        {/* Quick-link to generate token */}
        <div className="flex items-center gap-3 rounded-xl border border-(--c-border) bg-(--c-panel)/40 px-4 py-3">
          <RefreshCw className="h-4 w-4 text-(--c-accent) shrink-0" />
          <p className="text-xs font-medium text-(--c-muted)">
            Need a refresh token?{' '}
            <a
              href="https://developers.google.com/oauthplayground"
              target="_blank"
              rel="noreferrer"
              className="text-(--c-accent) hover:underline inline-flex items-center gap-0.5"
            >
              Use Google OAuth Playground
              <ExternalLink className="h-3 w-3 ml-0.5" />
            </a>{' '}
            — select the Drive scope, authorize, and copy the refresh token here.
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-(--c-accent) px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-(--c-accent)/20 transition hover:opacity-90 disabled:opacity-50"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving…' : 'Save Drive Configuration'}
          </button>
          {status.message && (
            <p
              className={`text-xs font-bold ${
                status.type === 'error'
                  ? 'text-rose-500'
                  : status.type === 'success'
                  ? 'text-emerald-500'
                  : 'text-indigo-500'
              }`}
            >
              {status.message}
            </p>
          )}
        </div>
      </div>
    </SettingCard>
  );
};

export default FileManagerSection;

