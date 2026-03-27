import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { useTenant } from '../../context/useTenant';
import { fetchTenantMailConfig, sendTenantWelcomeEmail, upsertTenantMailConfig } from '../../lib/backendStore';
import { createSyncEvent } from '../../lib/syncEvents';
import SettingCard from './SettingCard';
import { Mail, RefreshCw, PenTool, Eye } from 'lucide-react';

const rowClass = 'grid grid-cols-1 gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start py-3';
const inputClass = 'w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:ring-1 focus:ring-[var(--c-accent)] transition';
const textAreaClass = `${inputClass} resize-y min-h-[120px] leading-relaxed`;

const generateBrandedEmail = (bodyText, signatureText, type) => {
    const formatParagraphs = (text) => (text || '').split('\n').filter(Boolean).map(p => Object.assign(p)).map(p => `<p style="margin:0 0 16px;">${p}</p>`).join('');
    const formattedBody = formatParagraphs(bodyText);
    const formattedSignature = (signatureText || '').split('\n').filter(Boolean).map(l => `<p style="margin:2px 0;">${l}</p>`).join('');

    return `<div style="background-color: #f8fafc; padding: 40px 20px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.03), 0 8px 10px -6px rgba(0, 0, 0, 0.03);">
    <div style="background-color: {{brandColor}}; height: 8px; width: 100%;"></div>
    <div style="padding: 48px;">
      <h1 style="margin: 0 0 32px; font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">{{tenantName}}</h1>
      <div style="color: #334155; font-size: 15px; line-height: 1.6;">
        <h2 style="color: #0f172a; font-size: 18px; margin-top: 0; margin-bottom: 24px; font-weight: 700;">
          ${type === 'welcome' ? 'Hello {{clientName}},' : 'Hello {{recipientName}},'}
        </h2>
        
        <div style="margin-bottom: 32px;">
            ${formattedBody}
        </div>

        ${type === 'welcome' ? `
        <div style="background-color: #f8fafc; border-left: 4px solid {{brandColor}}; padding: 24px; border-radius: 0 16px 16px 0; margin: 32px 0;">
          <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Your Client ID</p>
          <p style="margin: 8px 0 0; font-size: 24px; font-weight: 800; color: #0f172a;">{{displayClientId}}</p>
        </div>
        ` : ''}

        <div style="margin-top: 48px; padding-top: 32px; border-top: 1px solid #f1f5f9;">
          <div style="font-size: 14px; color: #475569; font-weight: 500;">
            ${formattedSignature}
          </div>
        </div>
      </div>
    </div>
    <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9;">
      <p style="margin: 0; font-size: 12px; color: #94a3b8; font-weight: 500;">© {{year}} {{tenantName}}. All rights reserved.</p>
      <p style="margin: 8px 0 0; font-size: 11px; color: #cbd5e1;">This is an automated message. Please do not reply directly to this email unless directed otherwise.</p>
    </div>
  </div>
</div>`;
};

const EmailTemplateSection = () => {
    const { tenantId, tenant } = useTenant();
    const { user } = useAuth();
    const [config, setConfig] = useState({
        enableWelcomeEmail: false,
        welcomeForCompany: true,
        welcomeForIndividual: true,
        welcomeSubject: 'Welcome to {{tenantName}}',
        welcomeBodyText: "We're excited to have you with us. Your account has been successfully created.\n\nPlease keep your Client ID safe. You will use it for secure communications with our team.",
        statementSubject: '{{tenantName}} - Your {{documentType}}',
        statementBodyText: "Please find attached your {{documentType}} regarding transaction {{txId}}.\n\nA PDF copy is safely attached for your records. If you have any questions, please reach out to our team using the contact details below.",
        signatureFormat: "Best regards,\n{{senderName}}\n{{senderRole}}\n{{tenantName}}"
    });

    const [testTo, setTestTo] = useState('');
    const [status, setStatus] = useState({ message: '', type: '' });
    const [isSaving, setIsSaving] = useState(false);

    // UI states
    const [activeTab, setActiveTab] = useState('welcome'); // welcome, statement, signature
    const [previewMode, setPreviewMode] = useState(false);

    const createPreviewHtml = (html) => {
        if (!html) return '';
        return html
            .replace(/{{tenantName}}/g, tenant?.name || 'Your Company')
            .replace(/{{brandColor}}/g, tenant?.brandColor || '#e67e22')
            .replace(/{{clientName}}/g, 'John Doe')
            .replace(/{{recipientName}}/g, 'Jane Doe')
            .replace(/{{clientType}}/g, 'Individual')
            .replace(/{{displayClientId}}/g, 'CLID-TEST-001')
            .replace(/{{documentType}}/g, 'Invoice')
            .replace(/{{txId}}/g, 'TX-1234')
            .replace(/{{year}}/g, new Date().getFullYear())
            .replace(/{{supportEmail}}/g, config.supportEmail || 'support@example.com')
            .replace(/{{senderName}}/g, user?.displayName || 'Admin')
            .replace(/{{senderRole}}/g, user?.role || 'Staff');
    };

    useEffect(() => {
        let active = true;
        fetchTenantMailConfig(tenantId).then((result) => {
            if (!active || !result.ok || !result.data) return;
            // Merge defaults if specific text fields are missing from legacy HTML settings
            setConfig((prev) => ({
                ...prev,
                ...result.data,
                welcomeBodyText: result.data.welcomeBodyText || prev.welcomeBodyText,
                statementBodyText: result.data.statementBodyText || prev.statementBodyText,
                signatureFormat: result.data.signatureFormat || prev.signatureFormat,
            }));
        });
        return () => { active = false; };
    }, [tenantId]);

    const onSave = async () => {
        setIsSaving(true);
        setStatus({ message: 'Saving templates...', type: 'info' });

        // Auto-compile the HTML wrappers on save
        const compiledWelcomeHtml = generateBrandedEmail(config.welcomeBodyText, config.signatureFormat, 'welcome');
        const compiledStatementHtml = generateBrandedEmail(config.statementBodyText, config.signatureFormat, 'statement');

        const payload = {
            ...config,
            welcomeHtml: compiledWelcomeHtml,
            statementHtml: compiledStatementHtml,
            updatedBy: user?.uid || 'system',
        };

        const res = await upsertTenantMailConfig(tenantId, payload);
        if (!res.ok) {
            setStatus({ message: `Save failed: ${res.error}`, type: 'error' });
            setIsSaving(false);
            return;
        }

        await createSyncEvent({
            tenantId,
            eventType: 'update',
            entityType: 'settingsMail',
            entityId: 'mailConfiguration',
            changedFields: ['welcomeBodyText', 'statementBodyText', 'signatureFormat', 'welcomeHtml', 'statementHtml'],
            createdBy: user?.uid || 'system',
        });

        setStatus({ message: 'Templates saved & compiled successfully.', type: 'success' });
        setIsSaving(false);
        setTimeout(() => setStatus({ message: '', type: '' }), 3000);
    };

    const handleSendWelcomeTest = async () => {
        if (!testTo.trim()) {
            setStatus({ message: 'Enter a test recipient email.', type: 'error' });
            return;
        }
        setStatus({ message: 'Sending test welcome email...', type: 'info' });
        const result = await sendTenantWelcomeEmail(tenantId, {
            toEmail: testTo.trim(),
            clientName: 'Test Client',
            clientType: 'individual',
            displayClientId: 'CLID-TEST-0001',
            forceSend: true,
        });
        if (result.ok && !result.skipped) {
            setStatus({ message: 'Test welcome email sent.', type: 'success' });
        } else {
            setStatus({ message: `Test failed: ${result.error || 'skipped'}`, type: 'error' });
        }
    };

    const renderPreview = (type) => {
        let text = '';
        if (type === 'welcome') {
            text = generateBrandedEmail(config.welcomeBodyText, config.signatureFormat, 'welcome');
        } else if (type === 'statement') {
            text = generateBrandedEmail(config.statementBodyText, config.signatureFormat, 'statement');
        } else {
            // Preview signature inside a dummy wrapper
            text = generateBrandedEmail('This is a preview of how your signature will appear at the bottom of standard emails.', config.signatureFormat, 'standard');
        }
        return (
            <div
                className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-2 sm:p-4 max-h-[500px] overflow-auto shadow-inner [&_a]:text-[var(--c-accent)]"
                dangerouslySetInnerHTML={{ __html: createPreviewHtml(text) }}
            />
        );
    };

    return (
        <SettingCard
            title="Premium Email Studio"
            description="Manage your automated emails. Content is automatically wrapped in your beautiful, branded tenant theme. No HTML required."
        >
            <div className="space-y-6">

                {/* Navigation Tabs */}
                <div className="flex flex-col gap-3 border-b border-[var(--c-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {['welcome', 'statement', 'signature'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => { setActiveTab(tab); setPreviewMode(false); }}
                                className={`whitespace-nowrap px-3 py-2 rounded-xl text-xs font-bold transition capitalize ${activeTab === tab
                                        ? 'bg-[var(--c-accent)] text-white shadow-md shadow-[var(--c-accent)]/20'
                                        : 'text-[var(--c-muted)] hover:bg-[var(--c-panel)] hover:text-[var(--c-text)]'
                                    }`}
                            >
                                {tab === 'signature' ? 'Global Signature' : `${tab} Email`}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setPreviewMode(!previewMode)}
                        className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition border ${previewMode
                                ? 'border-[var(--c-accent)] text-[var(--c-accent)] bg-[var(--c-accent)]/5'
                                : 'border-[var(--c-border)] text-[var(--c-muted)] hover:bg-[var(--c-panel)] hover:text-[var(--c-text)]'
                            }`}
                    >
                        {previewMode ? <PenTool strokeWidth={1.5} size={14} /> : <Eye strokeWidth={1.5} size={14} />}
                        {previewMode ? 'Edit Mode' : 'Live Preview'}
                    </button>
                </div>

                {/* Mobile Preview Toggle */}
                <div className="sm:hidden mb-4">
                    <button
                        onClick={() => setPreviewMode(!previewMode)}
                        className={`w-full flex justify-center items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition border ${previewMode
                                ? 'border-[var(--c-accent)] text-[var(--c-accent)] bg-[var(--c-accent)]/5'
                                : 'border-[var(--c-border)] text-[var(--c-text)] bg-[var(--c-panel)]'
                            }`}
                    >
                        {previewMode ? <PenTool strokeWidth={1.5} size={14} /> : <Eye strokeWidth={1.5} size={14} />}
                        {previewMode ? 'Switch to Edit Builder' : 'See Branded Email Preview'}
                    </button>
                </div>

                {previewMode ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {renderPreview(activeTab)}
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-300">

                        {/* Welcome Tab */}
                        {activeTab === 'welcome' && (
                            <div className="rounded-2xl border border-[var(--c-border)] bg-transparent p-4 sm:p-5">
                                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-[var(--c-text)]">Welcome Email Content</h3>
                                        <p className="text-xs text-[var(--c-muted)] mt-1">Sent automatically when a new client is onboarded.</p>
                                    </div>
                                    <div className="flex items-center gap-3 bg-[var(--c-panel)] p-2 px-4 rounded-xl border border-[var(--c-border)]">
                                        <span className="text-xs font-bold text-[var(--c-muted)]">Enabled?</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={!!config.enableWelcomeEmail} onChange={e => setConfig({ ...config, enableWelcomeEmail: e.target.checked })} />
                                            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--c-accent)]"></div>
                                        </label>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className={rowClass}>
                                        <label className="text-xs font-bold text-[var(--c-text)]">Email Subject</label>
                                        <input
                                            type="text"
                                            value={config.welcomeSubject || ''}
                                            onChange={(e) => setConfig({ ...config, welcomeSubject: e.target.value })}
                                            className={inputClass}
                                            placeholder="Welcome to {{tenantName}}"
                                        />
                                    </div>
                                    <div className={rowClass}>
                                        <label className="text-xs font-bold text-[var(--c-text)] mt-3">Message Body<br /><span className="text-[10px] text-[var(--c-muted)] font-normal">Use {'{{clientName}}'} to greet them.</span></label>
                                        <textarea
                                            value={config.welcomeBodyText || ''}
                                            onChange={(e) => setConfig({ ...config, welcomeBodyText: e.target.value })}
                                            className={textAreaClass}
                                            placeholder="Enter your welcome message here. It will automatically be wrapped in your brand styling."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Statement Tab */}
                        {activeTab === 'statement' && (
                            <div className="rounded-2xl border border-[var(--c-border)] bg-transparent p-4 sm:p-5">
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-[var(--c-text)]">Statement / Document Email</h3>
                                    <p className="text-xs text-[var(--c-muted)] mt-1">Sent when sharing statement portal links or sending attached receipts.</p>
                                </div>
                                <div className="space-y-4">
                                    <div className={rowClass}>
                                        <label className="text-xs font-bold text-[var(--c-text)]">Email Subject</label>
                                        <input
                                            type="text"
                                            value={config.statementSubject || ''}
                                            onChange={(e) => setConfig({ ...config, statementSubject: e.target.value })}
                                            className={inputClass}
                                            placeholder="{{tenantName}} - Your {{documentType}}"
                                        />
                                    </div>
                                    <div className={rowClass}>
                                        <label className="text-xs font-bold text-[var(--c-text)] mt-3">Message Body<br /><span className="text-[10px] text-[var(--c-muted)] font-normal">Use {'{{documentType}}'} or {'{{txId}}'}.</span></label>
                                        <textarea
                                            value={config.statementBodyText || ''}
                                            onChange={(e) => setConfig({ ...config, statementBodyText: e.target.value })}
                                            className={textAreaClass}
                                            placeholder="Enter the message body that accompanies attached documents."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Signature Tab */}
                        {activeTab === 'signature' && (
                            <div className="rounded-2xl border border-[var(--c-border)] bg-transparent p-4 sm:p-5">
                                <div className="mb-4 flex items-start gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl">
                                    <Mail strokeWidth={1.5} className="text-indigo-500 shrink-0 mt-1" size={20} />
                                    <div>
                                        <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Dynamic User Signatures</p>
                                        <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-1 leading-relaxed">
                                            This signature is automatically attached to the bottom of all system emails.
                                            Use <strong className="font-mono text-[10px] bg-white/50 px-1 py-0.5 rounded mx-1">{'{{senderName}}'}</strong> and
                                            <strong className="font-mono text-[10px] bg-white/50 px-1 py-0.5 rounded mx-1">{'{{senderRole}}'}</strong> to dynamically insert the details of the active user who triggered the email.
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-4 pt-2">
                                    <div className={rowClass}>
                                        <label className="text-xs font-bold text-[var(--c-text)] mt-3">Global Signature</label>
                                        <textarea
                                            value={config.signatureFormat || ''}
                                            onChange={(e) => setConfig({ ...config, signatureFormat: e.target.value })}
                                            className={textAreaClass}
                                            placeholder="Best regards,&#10;{{senderName}}&#10;{{senderRole}}&#10;{{tenantName}}"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                )}

                {/* Always-on Actions Footer */}
                <div className="mt-4 flex flex-col gap-4 border-t border-[var(--c-border)] pt-4">
                    <div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row sm:items-center">
                        <input
                            type="email"
                            placeholder="Send a test to..."
                            value={testTo}
                            onChange={(e) => setTestTo(e.target.value)}
                            className={`${inputClass} !py-2.5`}
                        />
                        <button
                            type="button"
                            onClick={handleSendWelcomeTest}
                            className="shrink-0 rounded-xl bg-[var(--c-panel)] border border-[var(--c-border)] px-4 py-2.5 text-sm font-bold text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
                        >
                            Test Drop
                        </button>
                    </div>

                    <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {status.message && (
                            <p className={`text-xs font-bold ${status.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {status.message}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={isSaving}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--c-accent)] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--c-accent)]/20 transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
                        >
                            {isSaving ? <RefreshCw strokeWidth={1.5} size={16} className="animate-spin" /> : 'Save & Compile'}
                        </button>
                    </div>
                </div>
            </div>
        </SettingCard>
    );
};

export default EmailTemplateSection;

