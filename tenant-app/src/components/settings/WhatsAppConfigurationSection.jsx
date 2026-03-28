import { useEffect, useState } from 'react';
import { MessageSquare, ShieldCheck, Phone, CheckCircle2, XCircle, Loader2, Info, ExternalLink, Send } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useTenant } from '../../context/useTenant';
import { fetchTenantWhatsAppConfig, upsertTenantWhatsAppConfig } from '../../lib/whatsappStore';
import { createSyncEvent } from '../../lib/syncEvents';
import SettingCard from './SettingCard';
import { WhatsAppIcon } from './BrandingSubsections';

const rowClass = 'grid grid-cols-1 gap-1 sm:grid-cols-[200px_1fr] sm:items-center py-2.5 border-b border-(--c-border) last:border-0';
const inputClass = 'w-full rounded-xl border border-(--c-border) bg-(--c-panel) px-3 py-2.5 text-sm font-semibold text-(--c-text) outline-none focus:ring-2 focus:ring-(--c-accent)/30 focus:border-(--c-accent) transition-all';
const labelClass = 'text-xs font-bold text-(--c-muted) uppercase tracking-wide';

const WhatsAppConfigurationSection = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();

  const [config, setConfig] = useState({
    isServiceEnabled: false,
    useMasterConfig: true,
    appId: '',
    accessToken: '',
    phoneNumberId: '',
    apiVersion: 'v22.0',
    templateName: 'hello_world',
    templateLang: 'en_US',
    testRecipient: '',
  });

  const [status, setStatus] = useState({ message: '', type: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    let active = true;
    fetchTenantWhatsAppConfig(tenantId).then((result) => {
      if (!active || !result.ok || !result.data) return;
      setConfig((prev) => ({ ...prev, ...result.data }));
    });
    return () => { active = false; };
  }, [tenantId]);

  const onSave = async () => {
    setIsSaving(true);
    setStatus({ message: 'Saving…', type: 'info' });
    const payload = { ...config, updatedBy: user.uid };
    const res = await upsertTenantWhatsAppConfig(tenantId, payload);
    if (!res.ok) {
      setStatus({ message: `Save failed: ${res.error}`, type: 'error' });
      setIsSaving(false);
      return;
    }
    await createSyncEvent({
      tenantId, eventType: 'update', entityType: 'settingsWhatsApp',
      entityId: 'whatsappConfiguration', changedFields: Object.keys(payload), createdBy: user.uid,
    });
    setStatus({ message: 'Configuration saved successfully.', type: 'success' });
    setIsSaving(false);
    setTimeout(() => setStatus({ message: '', type: '' }), 3000);
  };

  const handleTestMessage = async () => {
    if (!config.testRecipient) {
      setStatus({ message: 'Test recipient phone number is required.', type: 'error' });
      return;
    }
    if (!config.accessToken || !config.phoneNumberId) {
      setStatus({ message: 'Access Token and Phone Number ID are required for testing.', type: 'error' });
      return;
    }

    setIsTesting(true);
    setStatus({ message: 'Sending test message...', type: 'info' });

    try {
      const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: config.testRecipient,
          type: 'template',
          template: {
            name: config.templateName,
            language: { code: config.templateLang },
          },
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setStatus({ message: 'Test message sent successfully! Check WhatsApp.', type: 'success' });
      } else {
        setStatus({ message: `Test failed: ${data.error?.message || 'Unknown error'}`, type: 'error' });
      }
    } catch (err) {
      setStatus({ message: `Error: ${err.message}`, type: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <SettingCard
      title="WhatsApp Configuration"
      description="Configure your Meta WhatsApp Business API credentials to enable WhatsApp OTP verification and notifications."
      icon={WhatsAppIcon}
    >
      <div className="space-y-6">
        {/* Platform Administration (Super Admin Only) */}
        {user?.role?.toLowerCase().includes('super admin') && (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-4">
            <div className="flex items-center gap-2 text-indigo-400">
              <ShieldCheck strokeWidth={1.5} className="h-5 w-5" />
              <h3 className="text-sm font-black uppercase tracking-widest">Platform Administration</h3>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-4 rounded-xl bg-indigo-500/10 p-3">
                <div>
                  <p className="text-[10px] font-black uppercase text-indigo-300">Service Status</p>
                  <p className="text-[9px] font-bold text-indigo-400/70">Enable WhatsApp for this tenant</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, isServiceEnabled: !config.isServiceEnabled })}
                  className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${config.isServiceEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${config.isServiceEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl bg-indigo-500/10 p-3">
                <div>
                  <p className="text-[10px] font-black uppercase text-indigo-300">Integration Route</p>
                  <p className="text-[9px] font-bold text-indigo-400/70">Managed by Platform Master</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, useMasterConfig: !config.useMasterConfig })}
                  className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${config.useMasterConfig ? 'bg-indigo-500' : 'bg-slate-600'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${config.useMasterConfig ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl border border-teal-500/20 bg-teal-500/5 px-4 py-3">
          <Info strokeWidth={1.5} className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
          <p className="text-xs font-medium text-teal-300 leading-relaxed">
            WhatsApp integration requires a Facebook Developer account and a WhatsApp Business Platform setup.
            You can find your credentials in the{' '}
            <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer"
              className="underline hover:text-teal-200 inline-flex items-center gap-0.5">
              Meta App Dashboard<ExternalLink strokeWidth={1.5} className="h-3 w-3 ml-0.5" />
            </a>.
          </p>
        </div>

        {/* API Credentials */}
        <div className="rounded-xl bg-(--c-panel)/60 p-4 space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-(--c-muted) mb-3">API Credentials</h3>

          <div className={rowClass}>
            <label className={labelClass}>App ID</label>
            <div className="flex flex-col gap-1">
              <input
                type="text"
                placeholder="App ID from Meta"
                value={config.appId || ''}
                onChange={(e) => setConfig({ ...config, appId: e.target.value })}
                className={inputClass}
              />
              <p className="text-[10px] text-(--c-muted)">The unique ID for your Meta app (e.g., from your screenshot).</p>
            </div>
          </div>

          <div className={rowClass}>
            <label className={labelClass}>Access Token</label>
            <div className="flex flex-col gap-1">
              <input
                type="password"
                placeholder="EAA..."
                value={config.accessToken || ''}
                onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                className={inputClass}
              />
              <p className="text-[10px] text-(--c-muted)">Use a permanent System User token for high reliability.</p>
            </div>
          </div>

          <div className={rowClass}>
            <label className={labelClass}>Phone Number ID</label>
            <input
              type="text"
              placeholder="Enter your 15+ digit Phone Number ID"
              value={config.phoneNumberId || ''}
              onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className={rowClass}>
            <label className={labelClass}>API Version</label>
            <input
              type="text"
              placeholder="v22.0"
              value={config.apiVersion || ''}
              onChange={(e) => setConfig({ ...config, apiVersion: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        {/* Template Settings */}
        <div className="rounded-xl bg-(--c-panel)/60 p-4 space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-(--c-muted) mb-3">Default Template</h3>

          <div className={rowClass}>
            <label className={labelClass}>Template Name</label>
            <input
              type="text"
              placeholder="hello_world"
              value={config.templateName || ''}
              onChange={(e) => setConfig({ ...config, templateName: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className={rowClass}>
            <label className={labelClass}>Language Code</label>
            <input
              type="text"
              placeholder="en_US"
              value={config.templateLang || ''}
              onChange={(e) => setConfig({ ...config, templateLang: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        {/* Test Connection */}
        <div className="rounded-xl bg-(--c-panel)/60 p-4 space-y-1 border border-teal-500/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-3">Test Connection</h3>
          <div className={rowClass}>
            <label className={labelClass}>Test Phone Number</label>
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="971500000000"
                value={config.testRecipient || ''}
                onChange={(e) => setConfig({ ...config, testRecipient: e.target.value })}
                className={inputClass}
              />
              <button
                type="button"
                onClick={handleTestMessage}
                disabled={isTesting || !config.testRecipient}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-500/10 border border-teal-500/20 px-4 py-2 text-sm font-bold text-teal-400 hover:bg-teal-500/20 transition disabled:opacity-50 whitespace-nowrap"
              >
                {isTesting ? <Loader2 strokeWidth={1.5} className="h-4 w-4 animate-spin" /> : <Send strokeWidth={1.5} className="h-4 w-4" />}
                Send Test
              </button>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-(--c-accent) px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-(--c-accent)/20 transition hover:opacity-90 disabled:opacity-50"
          >
            {isSaving && <Loader2 strokeWidth={1.5} className="h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving…' : 'Save Configuration'}
          </button>

          {status.message && (
            <p className={`text-xs font-bold ${status.type === 'error' ? 'text-rose-500' : status.type === 'success' ? 'text-emerald-500' : 'text-indigo-500'}`}>
              {status.message}
            </p>
          )}
        </div>
      </div>
    </SettingCard>
  );
};

export default WhatsAppConfigurationSection;

