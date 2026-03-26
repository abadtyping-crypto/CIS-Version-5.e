import { useEffect, useState } from 'react';
import { Mail, ShieldCheck, Server, ChevronRight, CheckCircle2, XCircle, Loader2, ExternalLink, Info } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useTenant } from '../../context/useTenant';
import { fetchTenantMailConfig, upsertTenantMailConfig } from '../../lib/backendStore';
import { createSyncEvent } from '../../lib/syncEvents';
import SettingCard from './SettingCard';

const rowClass = 'grid grid-cols-1 gap-1 sm:grid-cols-[180px_1fr] sm:items-center py-2.5 border-b border-(--c-border) last:border-0';
const inputClass = 'w-full rounded-xl border border-(--c-border) bg-(--c-panel) px-3 py-2.5 text-sm font-semibold text-(--c-text) outline-none focus:ring-2 focus:ring-(--c-accent)/30 focus:border-(--c-accent) transition-all';
const labelClass = 'text-xs font-bold text-(--c-muted) uppercase tracking-wide';

const TABS = [
  { key: 'smtp', label: 'SMTP Server', icon: Server },
  { key: 'gmail', label: 'Gmail OAuth', icon: ShieldCheck },
];

// ─── SMTP Sub-panel ───────────────────────────────────────────────────────────
const SmtpPanel = ({ config, setConfig, onSave, isSaving, status, onTest }) => (
  <div className="space-y-6">
    {/* SMTP Server */}
    <div className="rounded-xl bg-(--c-panel)/60 p-4 space-y-1">
      <h3 className="text-xs font-bold uppercase tracking-wider text-(--c-muted) mb-3">Server Settings</h3>
      <div className={rowClass}>
        <label className={labelClass}>Host</label>
        <input type="text" placeholder="smtp.example.com" value={config.smtpHost || ''}
          onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })} className={inputClass} />
      </div>
      <div className={rowClass}>
        <label className={labelClass}>Port</label>
        <input type="text" placeholder="587" value={config.smtpPort || ''}
          onChange={(e) => setConfig({ ...config, smtpPort: e.target.value })} className={inputClass} />
      </div>
      <div className={rowClass}>
        <label className={labelClass}>Username</label>
        <input type="text" placeholder="user@example.com" value={config.smtpUser || ''}
          onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })} className={inputClass} />
      </div>
      <div className={rowClass}>
        <label className={labelClass}>Password</label>
        <input type="password" placeholder="••••••••" value={config.smtpPass || ''}
          onChange={(e) => setConfig({ ...config, smtpPass: e.target.value })} className={inputClass} />
      </div>
    </div>

    {/* Sender Identity */}
    <div className="rounded-xl bg-(--c-panel)/60 p-4 space-y-1">
      <h3 className="text-xs font-bold uppercase tracking-wider text-(--c-muted) mb-3">Sender Identity</h3>
      <div className={rowClass}>
        <label className={labelClass}>From Name</label>
        <input type="text" placeholder="Organization Name" value={config.fromName || ''}
          onChange={(e) => setConfig({ ...config, fromName: e.target.value })} className={inputClass} />
      </div>
      <div className={rowClass}>
        <label className={labelClass}>From Email</label>
        <input type="email" placeholder="billing@example.com" value={config.fromEmail || ''}
          onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })} className={inputClass} />
      </div>
      <div className={rowClass}>
        <label className={labelClass}>Reply-To</label>
        <input type="email" placeholder="support@example.com" value={config.replyTo || ''}
          onChange={(e) => setConfig({ ...config, replyTo: e.target.value })} className={inputClass} />
      </div>
    </div>

    <ActionBar onSave={onSave} isSaving={isSaving} status={status} extraActions={
      <button type="button" onClick={onTest}
        className="rounded-xl border border-(--c-border) bg-(--c-panel) px-4 py-2.5 text-sm font-semibold text-(--c-text) transition hover:bg-(--c-border)">
        Test Connection
      </button>
    } />
  </div>
);

// ─── Gmail OAuth Sub-panel ────────────────────────────────────────────────────
const GmailPanel = ({ config, setConfig, onSave, isSaving, status, onConnect }) => {
  const isConnected = config.gmailConnected === true;
  const isConnecting = status.type === 'connecting';

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
        <p className="text-xs font-medium text-indigo-300 leading-relaxed">
          Gmail OAuth allows the system to send emails on behalf of a Google account without storing a password.
          You need a{' '}
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer"
            className="underline hover:text-indigo-200 inline-flex items-center gap-0.5">
            Google Cloud OAuth 2.0 Client<ExternalLink className="h-3 w-3 ml-0.5" />
          </a>{' '}
          with the Gmail API enabled.
        </p>
      </div>

      {/* Connection Status Badge */}
      <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${isConnected ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-(--c-panel)/60 border border-(--c-border)'}`}>
        {isConnected
          ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          : <XCircle className="h-5 w-5 text-(--c-muted) shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${isConnected ? 'text-emerald-400' : 'text-(--c-muted)'}`}>
            {isConnected ? 'Gmail Account Connected' : 'Not Connected'}
          </p>
          {config.gmailEmail && (
            <p className="text-xs text-(--c-muted) mt-0.5 truncate">{config.gmailEmail}</p>
          )}
        </div>
        {isConnected ? (
          <button type="button" onClick={() => setConfig({ ...config, gmailConnected: false, gmailEmail: '', gmailRefreshToken: '' })}
            className="ml-auto rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition">
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={!config.gmailClientId || !config.gmailClientSecret || isConnecting}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-600 disabled:opacity-50"
          >
            {isConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            {isConnecting ? 'Authenticating...' : 'Sign in with Google'}
          </button>
        )}
      </div>

      {/* OAuth Credentials */}
      <div className="rounded-xl bg-(--c-panel)/60 p-4 space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-(--c-muted) mb-3">OAuth 2.0 Credentials</h3>
        <div className={rowClass}>
          <label className={labelClass}>Client ID</label>
          <input type="text" placeholder="xxxxxxxxxx.apps.googleusercontent.com" value={config.gmailClientId || ''}
            onChange={(e) => setConfig({ ...config, gmailClientId: e.target.value })} className={inputClass} />
        </div>
        <div className={rowClass}>
          <label className={labelClass}>Client Secret</label>
          <input type="password" placeholder="GOCSPX-••••••••" value={config.gmailClientSecret || ''}
            onChange={(e) => setConfig({ ...config, gmailClientSecret: e.target.value })} className={inputClass} />
        </div>
        <div className={rowClass}>
          <label className={labelClass}>Redirect URI</label>
          <input type="text" placeholder="http://localhost:8888" value={config.gmailRedirectUri || ''}
            onChange={(e) => setConfig({ ...config, gmailRedirectUri: e.target.value })} className={inputClass} />
        </div>
        <div className={rowClass}>
          <label className={labelClass}>Refresh Token</label>
          <input type="password" placeholder="Automatically filled after sign-in" value={config.gmailRefreshToken || ''}
            onChange={(e) => setConfig({ ...config, gmailRefreshToken: e.target.value })} className={inputClass} />
        </div>
        <div className={rowClass}>
          <label className={labelClass}>Gmail Account</label>
          <input type="email" placeholder="Automatically filled after sign-in" value={config.gmailEmail || ''}
            onChange={(e) => setConfig({ ...config, gmailEmail: e.target.value })} className={inputClass} />
        </div>
      </div>

      {/* Sender Identity (shared with SMTP) */}
      <div className="rounded-xl bg-(--c-panel)/60 p-4 space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-(--c-muted) mb-3">Sender Identity</h3>
        <div className={rowClass}>
          <label className={labelClass}>From Name</label>
          <input type="text" placeholder="Organization Name" value={config.fromName || ''}
            onChange={(e) => setConfig({ ...config, fromName: e.target.value })} className={inputClass} />
        </div>
        <div className={rowClass}>
          <label className={labelClass}>Reply-To</label>
          <input type="email" placeholder="support@example.com" value={config.replyTo || ''}
            onChange={(e) => setConfig({ ...config, replyTo: e.target.value })} className={inputClass} />
        </div>
      </div>

      <ActionBar onSave={onSave} isSaving={isSaving} status={status} />
    </div>
  );
};

// ─── Shared Action Bar ────────────────────────────────────────────────────────
const ActionBar = ({ onSave, isSaving, status, extraActions }) => (
  <div className="flex flex-wrap items-center gap-3 pt-2">
    <button type="button" onClick={onSave} disabled={isSaving}
      className="inline-flex items-center gap-2 rounded-xl bg-(--c-accent) px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-(--c-accent)/20 transition hover:opacity-90 disabled:opacity-50">
      {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
      {isSaving ? 'Saving…' : 'Save Configuration'}
    </button>
    {extraActions}
    {status.message && (
      <p className={`text-xs font-bold ${status.type === 'error' ? 'text-rose-500' : status.type === 'success' ? 'text-emerald-500' : 'text-indigo-500'}`}>
        {status.message}
      </p>
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const MailConfigurationSection = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('smtp');
  const [config, setConfig] = useState({
    // SMTP
    smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '',
    fromName: '', fromEmail: '', replyTo: '',
    // Gmail OAuth
    gmailConnected: false, gmailEmail: '', gmailClientId: '',
    gmailClientSecret: '', gmailRedirectUri: '', gmailRefreshToken: '',
  });
  const [status, setStatus] = useState({ message: '', type: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchTenantMailConfig(tenantId).then((result) => {
      if (!active || !result.ok || !result.data) return;
      setConfig((prev) => ({ ...prev, ...result.data }));
    });
    return () => { active = false; };
  }, [tenantId]);

  const onSave = async () => {
    setIsSaving(true);
    setStatus({ message: 'Saving…', type: 'info' });
    const payload = { ...config, updatedBy: user.uid };
    const res = await upsertTenantMailConfig(tenantId, payload);
    if (!res.ok) {
      setStatus({ message: `Save failed: ${res.error}`, type: 'error' });
      setIsSaving(false);
      return;
    }
    await createSyncEvent({
      tenantId, eventType: 'update', entityType: 'settingsMail',
      entityId: 'mailConfiguration', changedFields: Object.keys(payload), createdBy: user.uid,
    });
    setStatus({ message: 'Configuration saved successfully.', type: 'success' });
    setIsSaving(false);
    setTimeout(() => setStatus({ message: '', type: '' }), 3000);
  };

  const handleGmailAuth = async () => {
    if (!config.gmailClientId || !config.gmailClientSecret) {
      setStatus({ message: 'Client ID and Client Secret are required.', type: 'error' });
      return;
    }

    const authStart = window?.electron?.mail?.authStart;
    if (typeof authStart !== 'function') {
      setStatus({ message: 'OAuth is only available in the Desktop app.', type: 'error' });
      return;
    }

    setStatus({ message: 'Waiting for Google authentication...', type: 'connecting' });

    try {
      const res = await authStart({
        clientId: config.gmailClientId,
        clientSecret: config.gmailClientSecret,
        redirectUri: config.gmailRedirectUri || 'http://localhost:8888',
      });

      if (res.ok && res.tokens) {
        setConfig((prev) => ({
          ...prev,
          gmailRefreshToken: res.tokens.refresh_token || prev.gmailRefreshToken,
          gmailConnected: true,
          // If the token flow returns user info (need to check scopes)
          // For now, we manually fill email if possible or user does it
        }));
        setStatus({ message: 'Authenticated successfully! Please Save to persist.', type: 'success' });
      } else {
        setStatus({ message: 'Authentication failed.', type: 'error' });
      }
    } catch (err) {
      setStatus({ message: `Error: ${err.message}`, type: 'error' });
    }
  };

  const handleTestConnection = async () => {
    const isSmtp = activeTab === 'smtp';

    if (isSmtp) {
      if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
        setStatus({ message: 'Host, User, and Password are required for test.', type: 'error' });
        return;
      }
    } else {
      if (!config.gmailClientId || !config.gmailRefreshToken || !config.gmailEmail) {
        setStatus({ message: 'Client ID, Refresh Token, and Gmail Account are required for test.', type: 'error' });
        return;
      }
    }

    setStatus({ message: `Testing ${isSmtp ? 'SMTP' : 'Gmail OAuth'} connection…`, type: 'info' });

    const send = window?.electron?.mail?.send;
    if (typeof send !== 'function') {
      setStatus({ message: 'Email test is only available in the Desktop app.', type: 'error' });
      return;
    }

    const payload = {
      message: {
        to: [isSmtp ? config.smtpUser : config.gmailEmail],
        subject: `${isSmtp ? 'SMTP' : 'Gmail OAuth'} Connection Test`,
        html: `<p>If you received this, your ${isSmtp ? 'SMTP' : 'Gmail OAuth'} settings are correct!</p>`,
      },
    };

    if (isSmtp) {
      payload.smtp = {
        host: config.smtpHost,
        port: config.smtpPort,
        user: config.smtpUser,
        pass: config.smtpPass,
        fromName: config.fromName,
        fromEmail: config.fromEmail,
        replyTo: config.replyTo,
      };
    } else {
      payload.google = {
        clientId: config.gmailClientId,
        clientSecret: config.gmailClientSecret,
        refreshToken: config.gmailRefreshToken,
        userEmail: config.gmailEmail,
        fromName: config.fromName,
        replyTo: config.replyTo,
      };
    }

    const res = await send(payload);

    setStatus(res.ok
      ? { message: 'Connection test passed! Check your inbox.', type: 'success' }
      : { message: `Connection failed: ${res.error}`, type: 'error' });
  };

  return (
    <SettingCard title="Mail Configuration" description="Configure your outgoing email provider — use a raw SMTP server or authenticate via Gmail OAuth 2.0." icon={Mail}>
      {/* Tab Switcher */}
      <div className="mb-6 flex gap-1 rounded-xl bg-(--c-panel) p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-(--c-accent) text-white shadow-md shadow-(--c-accent)/30'
                : 'text-(--c-muted) hover:text-(--c-text) hover:bg-(--c-border)'
            }`}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
            {activeTab === tab.key && <ChevronRight className="h-3 w-3 opacity-70" />}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
        {activeTab === 'smtp' && (
          <SmtpPanel
            config={config} setConfig={setConfig}
            onSave={onSave} isSaving={isSaving} status={status}
            onTest={handleTestConnection}
          />
        )}
        {activeTab === 'gmail' && (
          <GmailPanel
            config={config} setConfig={setConfig}
            onSave={onSave} isSaving={isSaving} status={status}
            onConnect={handleGmailAuth}
            onTest={handleTestConnection}
          />
        )}
      </div>
    </SettingCard>
  );
};

export default MailConfigurationSection;

