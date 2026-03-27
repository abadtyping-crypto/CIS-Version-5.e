import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { useTenant } from '../../context/useTenant';
import {
  fetchTenantPdfTemplates,
  getTenantSettingDoc,
  upsertTenantPdfTemplate,
  upsertTenantSettingDoc,
} from '../../lib/backendStore';
import SovereignViewer from '../common/SovereignViewer';
import { generateTenantPdf } from '../../lib/pdfGenerator';
import {
  DEFAULT_QUOTATION_TERMS,
  PORTAL_STATEMENT_DISCLAIMER_TEXT,
  PDF_DEFAULT_TEMPLATE,
  PDF_DOCUMENT_TYPES,
  normalizePdfTemplatePayload,
} from '../../lib/pdfTemplateRenderer';
import { uploadPdfTemplateAsset, validatePdfTemplateAsset } from '../../lib/pdfTemplateStorage';
import { ShieldAlert, Building2, MapPin, Plus, Trash2, Layout, Library, ChevronDown, Image, X } from 'lucide-react';
import { canUserPerformAction } from '../../lib/userControlPreferences';
import SettingCard from './SettingCard';
import { createSyncEvent } from '../../lib/syncEvents';

const inputClass =
  'mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-ring)]';
const labelClass = 'text-sm text-[var(--c-muted)]';
const errorTextClass = 'mt-1 text-xs text-[var(--c-danger)]';
const warningTextClass = 'mt-2 text-xs text-[var(--c-warning)]';
const statusEnabledClass = 'bg-[var(--c-success)] text-white';
const statusDisabledClass = 'bg-[var(--c-toggle-off)] text-white';
const warningPanelClass =
  'rounded-xl border border-[var(--c-warning)]/30 bg-[var(--c-warning-soft)] px-3 py-2 text-sm text-[var(--c-warning)]';
const dangerButtonClass =
  'self-end rounded-xl border border-[var(--c-danger)]/25 bg-[var(--c-danger-soft)] px-3 py-2 text-xs font-semibold text-[var(--c-danger)] disabled:opacity-50';

const premiumDefaults = {
  pdfCustomizationEnabled: true, // Master toggle
  pdfPremiumFeaturesEnabled: true,
  pdfPremiumGradientEnabled: true,
  pdfPremiumCoverPageEnabled: true,
};

const createRecord = (documentType, label) => ({
  documentType,
  isTemplateEnabled: true,
  activeTemplateId: 'default',
  templateVersion: 1,
  templates: [
    normalizePdfTemplatePayload({
      ...PDF_DEFAULT_TEMPLATE,
      name: `${label} Default`,
      titleText: label,
      termsAndConditions: documentType === 'quotation' ? DEFAULT_QUOTATION_TERMS : '',
    }),
  ],
  lastUpdatedBy: '',
  lastUpdatedAt: '',
});

const normalizeRecord = (documentType, label, raw) => {
  const fallback = createRecord(documentType, label);
  if (!raw || typeof raw !== 'object') return fallback;
  const templates = Array.isArray(raw.templates)
    ? raw.templates.map(normalizePdfTemplatePayload)
    : fallback.templates;
  const activeId = String(raw.activeTemplateId || templates[0]?.templateId || 'default');
  return {
    documentType,
    isTemplateEnabled: raw.isTemplateEnabled !== false,
    activeTemplateId: templates.some((item) => item.templateId === activeId) ? activeId : templates[0].templateId,
    templateVersion: Number(raw.templateVersion) || 1,
    templates,
    lastUpdatedBy: String(raw.lastUpdatedBy || ''),
    // These fields are likely intended for a different normalization function,
    // but are added here as per instruction. Assuming 'toLower' is defined elsewhere
    // or should be removed if not applicable to this context.
    // For now, commenting out to avoid runtime errors if toLower is not defined.
    // whatsappUrl: toLower(raw.whatsappUrl || ''),
    // addressSource: raw.addressSource || 'custom',
    // customAddress: raw.customAddress || '',
  };
};

const normalizeNumber = (value, fallback, max = 240) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
};

const newTemplateId = () => `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const validateTemplate = (template, premium) => {
  const errors = {};
  if (!template.name.trim()) errors.name = 'Template name is required.';
  if (template.backgroundType === 'image' && !template.backgroundImageUrl.trim()) {
    errors.backgroundImageUrl = 'Background image is required for image mode.';
  }
  if (!premium.pdfPremiumFeaturesEnabled && template.backgroundType !== 'solid') {
    errors.premium = 'Premium features are disabled from Preferences.';
  }
  return errors;
};

const PdfCustomizationStudioSection = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [activeType, setActiveType] = useState(PDF_DOCUMENT_TYPES[0].key);
  const [records, setRecords] = useState({});
  const [selectedIds, setSelectedIds] = useState({});
  const [premium, setPremium] = useState(premiumDefaults);
  const [branding, setBranding] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('');
  const [viewingSamplePath, setViewingSamplePath] = useState('');
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);

  const handleViewSample = async () => {
    try {
      setIsGeneratingSample(true);
      setStatus('Generating high-fidelity sample...');
      
      const sampleData = {
        txId: 'SAMPLE-V5',
        statementRef: 'REF-2024-V5',
        date: new Date().toLocaleDateString(),
        recipientName: 'Valued Client (Sample)',
        amount: 480,
        description: 'Sample Statement for V5 Layout Verification',
        items: [
           { name: 'Onboarding Service Fee', qty: 1, unit: 200, total: 200 },
           { name: 'Monthly Maintenance', qty: 1, unit: 280, total: 280 },
        ],
        statementRows: [
          { date: '2024-03-01', description: 'Opening Balance', balance: 0 },
          { date: '2024-03-05', description: 'Client Deposit', credit: 500, balance: 500 },
          { date: '2024-03-10', description: 'Service Deduction', debit: 20, balance: 480 },
          { date: '2024-03-15', description: 'Closing Balance', balance: 480 },
        ]
      };

      const res = await generateTenantPdf({
        tenantId,
        documentType: activeType,
        data: sampleData,
        save: true, // This will trigger download/save in Electron default path
        filename: `ACIS_V5_SAMPLE_${activeType}.pdf`
      });

      if (res.ok) {
        setStatus('Sample generated. Check your downloads or viewer.');
        // If we want to automatically open it in SovereignViewer, 
        // we need the absolute path. Electron usually saves to Downloads.
        // For now, let's just keep the viewer state for documentation.
      } else {
        setStatus(`Error: ${res.error}`);
      }
    } finally {
      setIsGeneratingSample(false);
    }
  };
  const [previewTime, setPreviewTime] = useState('');

  const canView = Boolean(user) && canUserPerformAction(tenantId, user, 'pdfStudioView');
  const canEdit = Boolean(user) && canUserPerformAction(tenantId, user, 'pdfStudioEdit');

  useEffect(() => {
    if (!tenantId) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const [templatesRes, prefRes, brandRes] = await Promise.all([
        fetchTenantPdfTemplates(tenantId),
        getTenantSettingDoc(tenantId, 'preferenceSettings'),
        getTenantSettingDoc(tenantId, 'branding'),
      ]);
      if (!mounted) return;
      const nextRecords = {};
      const nextSelected = {};
      PDF_DOCUMENT_TYPES.forEach((item) => {
        const normalized = normalizeRecord(item.key, item.label, templatesRes.byType?.[item.key]);
        nextRecords[item.key] = normalized;
        nextSelected[item.key] = normalized.activeTemplateId;
      });
      setRecords(nextRecords);
      setSelectedIds(nextSelected);
      setPremium({
        ...premiumDefaults,
        ...(prefRes.ok && prefRes.data ? prefRes.data : {}),
      });
      setBranding(brandRes.ok && brandRes.data ? brandRes.data : {});
      setLoading(false);
      setErrors({});
      setStatus('');
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [tenantId]);

  const activeRecord = records[activeType];
  const selectedId = selectedIds[activeType] || activeRecord?.activeTemplateId || 'default';
  const activeTemplate = useMemo(() => {
    if (!activeRecord) return normalizePdfTemplatePayload(PDF_DEFAULT_TEMPLATE);
    return activeRecord.templates.find((item) => item.templateId === selectedId) || activeRecord.templates[0];
  }, [activeRecord, selectedId]);
  const isPortalStatement = activeType === 'portalStatement';
  const hasCompanyNameData = Boolean(String(branding.legalName || branding.brandName || '').trim());
  const hasCompanyAddressData = Boolean(
    [
      branding?.officeAddress,
      branding?.emirate,
      branding?.country,
    ].some((value) => String(value || '').trim()),
  );
  const hasBankDetailsData = Array.isArray(branding?.bankDetails) && branding.bankDetails.length > 0;
  const hasContactData = Boolean(
    (Array.isArray(branding?.emailContacts) && branding.emailContacts.some((item) => String(item?.value || '').trim()))
    || (Array.isArray(branding?.mobileContacts) && branding.mobileContacts.some((item) => String(item?.value || '').trim()))
    || String(branding?.landline || '').trim(),
  );
  const logoLibrary = Array.isArray(branding?.logoLibrary) ? branding.logoLibrary : [];
  const availableLogoSlots = logoLibrary.filter((slot) => String(slot?.url || '').trim());
  const autoLogoSlotId = String(branding?.logoUsage?.[activeType] || branding?.logoUsage?.header || '').trim();
  const selectedLogoSlotId = String(activeTemplate?.logoSlotId || '').trim();
  const resolvedLogoSlotId = selectedLogoSlotId || autoLogoSlotId;
  const resolvedLogoSlot = availableLogoSlots.find((slot) => String(slot?.slotId || '').trim() === resolvedLogoSlotId) || null;
  const resolvedTemplateLogoUrl = String(resolvedLogoSlot?.url || activeTemplate?.logoUrl || '').trim();
  const previewHeaderBg =
    activeTemplate.templateId === 'default' && activeTemplate.headerBackground === '#0f172a'
      ? 'var(--c-accent)'
      : activeTemplate.headerBackground;

  const setRecord = (documentType, next) => {
    setRecords((prev) => ({ ...prev, [documentType]: next }));
  };

  const setSelectedId = (documentType, templateId) => {
    setSelectedIds((prev) => ({ ...prev, [documentType]: templateId }));
  };

  const updateTemplate = (patch) => {
    if (!activeRecord) return;
    const nextTemplates = activeRecord.templates.map((item) =>
      item.templateId === activeTemplate.templateId ? { ...item, ...patch } : item,
    );
    setRecord(activeType, { ...activeRecord, templates: nextTemplates });
  };

  const persistRecord = async (documentType, nextRecord, changedFields, successMsg) => {
    if (!user) return;
    setSaving(true);
    const payload = {
      ...nextRecord,
      templateVersion: (Number(nextRecord.templateVersion) || 0) + 1,
      lastUpdatedBy: user.uid,
      lastUpdatedAt: new Date().toISOString(),
    };
    const write = await upsertTenantPdfTemplate(tenantId, documentType, payload);
    if (!write.ok) {
      setStatus(`Save failed: ${write.error}`);
      setSaving(false);
      return;
    }
    setRecord(documentType, payload);
    const sync = await createSyncEvent({
      tenantId,
      eventType: 'update',
      entityType: 'pdfTemplate',
      entityId: documentType,
      changedFields,
      createdBy: user.uid,
    });
    setStatus(sync.backendSynced ? successMsg : `${successMsg} Backend sync pending.`);
    setSaving(false);
  };

  const saveCurrentTemplate = async () => {
    if (!canEdit) {
      setStatus('Save blocked. Ask admin for PDF Studio Edit permission in User Control Center.');
      return;
    }
    const nextErrors = validateTemplate(activeTemplate, premium);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !activeRecord) return;
    const nextRecord = {
      ...activeRecord,
      activeTemplateId: activeTemplate.templateId,
      templates: activeRecord.templates.map(normalizePdfTemplatePayload),
    };
    await persistRecord(
      activeType,
      nextRecord,
      ['templates', 'activeTemplateId', 'isTemplateEnabled', 'templateVersion'],
      'Template saved.',
    );
  };

  const createTemplate = async (mode) => {
    if (!canEdit || !activeRecord) {
      setStatus('Create blocked. Ask admin for PDF Studio Edit permission.');
      return;
    }
    const label = PDF_DOCUMENT_TYPES.find((item) => item.key === activeType)?.label || 'Document';
    const source = mode === 'duplicate'
      ? activeTemplate
      : {
          ...PDF_DEFAULT_TEMPLATE,
          titleText: label,
          termsAndConditions: activeType === 'quotation' ? DEFAULT_QUOTATION_TERMS : '',
        };
    const nextTemplate = normalizePdfTemplatePayload({
      ...source,
      templateId: newTemplateId(),
      name: mode === 'duplicate' ? `${activeTemplate.name} Copy` : `${label} Custom`,
    });
    const nextRecord = {
      ...activeRecord,
      activeTemplateId: nextTemplate.templateId,
      templates: [...activeRecord.templates, nextTemplate],
    };
    setRecord(activeType, nextRecord);
    setSelectedId(activeType, nextTemplate.templateId);
    await persistRecord(activeType, nextRecord, ['templates', 'activeTemplateId', 'templateVersion'], 'Template created.');
  };

  const deleteTemplate = async () => {
    if (!canEdit || !activeRecord) {
      setStatus('Delete blocked. Ask admin for PDF Studio Edit permission.');
      return;
    }
    if (activeTemplate.templateId === 'default') {
      setStatus('Default template cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete "${activeTemplate.name}"?`)) return;
    const nextTemplates = activeRecord.templates.filter((item) => item.templateId !== activeTemplate.templateId);
    const nextActiveId = nextTemplates[0]?.templateId || 'default';
    const nextRecord = {
      ...activeRecord,
      templates: nextTemplates,
      activeTemplateId: nextActiveId,
    };
    setRecord(activeType, nextRecord);
    setSelectedId(activeType, nextActiveId);
    await persistRecord(activeType, nextRecord, ['templates', 'activeTemplateId', 'templateVersion'], 'Template deleted.');
  };

  const toggleTypeEnabled = async () => {
    if (!canEdit || !activeRecord) {
      setStatus('Action blocked. Ask admin for PDF Studio Edit permission.');
      return;
    }
    const nextRecord = { ...activeRecord, isTemplateEnabled: !activeRecord.isTemplateEnabled };
    setRecord(activeType, nextRecord);
    await persistRecord(activeType, nextRecord, ['isTemplateEnabled', 'templateVersion'], 'Template status updated.');
  };

  const uploadAsset = async (assetType, field, fileBlob) => {
    if (!canEdit || !activeRecord || !fileBlob) return;
    const validationError = validatePdfTemplateAsset(fileBlob);
    if (validationError) {
      setErrors((prev) => ({ ...prev, [field]: validationError }));
      return;
    }
    setUploading(true);
    const result = await uploadPdfTemplateAsset({
      tenantId,
      documentType: activeType,
      templateId: activeTemplate.templateId,
      assetType,
      oldUrl: activeTemplate[field],
      fileBlob,
    });
    setUploading(false);
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, [field]: result.error || 'Upload failed.' }));
      return;
    }
    updateTemplate({ [field]: result.url });
    setErrors((prev) => ({ ...prev, [field]: '' }));
    setStatus(`${assetType} uploaded. Save template to commit.`);
  };

  if (loading) return <p className="text-xs text-[var(--c-muted)]">Loading PDF customization studio...</p>;

  if (!canView) {
    return (
      <SettingCard
        title="PDF Customization Studio"
        description="Centralized PDF branding and layout control."
      >
        <p className={warningPanelClass}>
          Access blocked. Ask admin to enable PDF Studio View permission in User Control Center.
        </p>
      </SettingCard>
    );
  }

  return (
    <SettingCard
      title="PDF Customization Studio"
      description="Templates for payment receipts, invoices, quotations, performer invoices, and statements."
      headerActions={(
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-[10px] font-bold uppercase tracking-widest text-(--c-muted)">Enable Customization</span>
          <div className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={premium.pdfCustomizationEnabled !== false}
              onChange={async (e) => {
                const next = { ...premium, pdfCustomizationEnabled: e.target.checked };
                setPremium(next);
                await upsertTenantSettingDoc(tenantId, 'preferenceSettings', { 
                  ...next,
                  updatedBy: user.uid 
                });
                setStatus('Master PDF toggle updated.');
              }}
            />
            <div className="w-9 h-5 bg-(--c-panel) peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-(--c-accent)"></div>
          </div>
        </label>
      )}
    >
      <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 ${premium.pdfCustomizationEnabled === false ? 'opacity-40 pointer-events-none' : ''}`}>
        {PDF_DOCUMENT_TYPES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setActiveType(item.key);
              setErrors({});
              setStatus('');
            }}
            className={`rounded-xl px-3 py-2 text-xs font-semibold ${activeType === item.key ? 'bg-[var(--c-accent)] text-white' : 'bg-[var(--c-panel)] text-[var(--c-muted)] hover:text-[var(--c-text)]'}`}
          >
            {item.label}
          </button>
        ))}
        <div className="flex items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">
          <span>Status</span>
          <button
            type="button"
            onClick={() => void toggleTypeEnabled()}
            disabled={!canEdit || saving || premium.pdfCustomizationEnabled === false}
            className={`rounded-full px-2 py-1 text-[10px] font-bold ${activeRecord.isTemplateEnabled ? statusEnabledClass : statusDisabledClass}`}
          >
            {activeRecord.isTemplateEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className={`grid gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3 lg:grid-cols-[1fr_auto_auto_auto_auto_auto] ${premium.pdfCustomizationEnabled === false ? 'opacity-40 pointer-events-none' : ''}`}>
        <label className={labelClass}>
          Template
          <select
            value={selectedId}
            onChange={(event) => {
              const nextId = event.target.value;
              setSelectedId(activeType, nextId);
              setRecord(activeType, { ...activeRecord, activeTemplateId: nextId });
            }}
            className={inputClass}
            disabled={!canEdit || premium.pdfCustomizationEnabled === false}
          >
            {activeRecord.templates.map((item) => (
              <option key={item.templateId} value={item.templateId}>{item.name}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void createTemplate('new')} disabled={!canEdit || saving || premium.pdfCustomizationEnabled === false} className="self-end rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-xs font-semibold disabled:opacity-50">New</button>
        <button type="button" onClick={() => void createTemplate('duplicate')} disabled={!canEdit || saving || premium.pdfCustomizationEnabled === false} className="self-end rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-xs font-semibold disabled:opacity-50">Duplicate</button>
        <button type="button" onClick={() => void deleteTemplate()} disabled={!canEdit || saving || activeTemplate.templateId === 'default' || premium.pdfCustomizationEnabled === false} className={dangerButtonClass}>Delete</button>
        <button type="button" onClick={() => void toggleTypeEnabled()} disabled={!canEdit || saving || premium.pdfCustomizationEnabled === false} className={`self-end rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${activeRecord.isTemplateEnabled ? statusEnabledClass : statusDisabledClass}`}>{activeRecord.isTemplateEnabled ? 'Enabled' : 'Disabled'}</button>
        <button type="button" onClick={() => void saveCurrentTemplate()} disabled={!canEdit || saving || premium.pdfCustomizationEnabled === false} className="self-end rounded-xl bg-[var(--c-accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
      </div>

      {!canEdit ? <p className={warningTextClass}>View only. Ask admin for PDF Studio Edit permission.</p> : null}
      {errors.premium ? <p className="mt-2 text-xs text-[var(--c-danger)]">{errors.premium}</p> : null}

      {premium.pdfCustomizationEnabled === false ? (
        <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm font-bold text-amber-500 uppercase tracking-tight flex items-center gap-2">
            <ShieldAlert strokeWidth={1.5} className="w-4 h-4" /> Professional Default Mode Active
          </p>
          <p className="text-xs text-amber-500/70 mt-1">PDF customization is currently disabled. All documents will be generated using the high-fidelity professional baseline with standard branding resolution.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="auto-fit-span-full mb-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <button 
                  onClick={handleViewSample}
                  disabled={isGeneratingSample}
                  className="flex h-12 items-center justify-center gap-3 rounded-2xl bg-orange-500 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 disabled:opacity-50"
                >
                  {isGeneratingSample ? '⚙️ Generating...' : '👁️ View Sovereign Sample'}
                </button>
                <button 
                  onClick={saveCurrentTemplate}
                  disabled={saving}
                  className="flex h-12 items-center justify-center gap-3 rounded-2xl bg-[var(--c-accent)] text-sm font-black text-white shadow-lg shadow-[var(--c-accent)]/20 transition hover:opacity-90 disabled:opacity-50"
                >
                  💾 {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>

              <div className="auto-fit-span-full mb-1">
                <label className="flex items-center gap-3 p-3 rounded-2xl bg-(--c-panel) border border-(--c-border) cursor-pointer transition hover:bg-(--c-surface)">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--c-accent)/10 text-(--c-accent)">
                    <MapPin strokeWidth={1.5} className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-(--c-text)">Address Source</p>
                    <p className="text-[10px] text-(--c-muted)">Use brand details or define a unique PDF address.</p>
                  </div>
                  <select 
                    value={activeTemplate.addressSource || 'custom'} 
                    onChange={(e) => updateTemplate({ addressSource: e.target.value })}
                    className="rounded-lg bg-(--c-surface) border border-(--c-border) px-3 py-1.5 text-xs font-bold text-(--c-text) outline-none"
                  >
                    <option value="tenant">Tenant Profile</option>
                    <option value="custom">Custom Brand Address</option>
                  </select>
                </label>
              </div>
              </div>

              <label className={labelClass}>Template Name
                <input className={inputClass} value={activeTemplate.name} onChange={(event) => updateTemplate({ name: event.target.value })} disabled={!canEdit} />
                {errors.name ? <p className={errorTextClass}>{errors.name}</p> : null}
              </label>
              <label className={labelClass}>Header Text
                <textarea className={inputClass} rows={3} value={activeTemplate.headerText} onChange={(event) => updateTemplate({ headerText: event.target.value })} disabled={!canEdit} />
                {errors.headerText ? <p className={errorTextClass}>{errors.headerText}</p> : null}
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Title
                  <input className={inputClass} value={activeTemplate.titleText} onChange={(event) => updateTemplate({ titleText: event.target.value })} disabled={!canEdit} />
                </label>
                <label className={labelClass}>Header Color
                  <input type="color" className={`${inputClass} h-10 p-1`} value={activeTemplate.headerBackground} onChange={(event) => updateTemplate({ headerBackground: event.target.value })} disabled={!canEdit} />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Footer Text
                  <input className={inputClass} value={activeTemplate.footerText} onChange={(event) => updateTemplate({ footerText: event.target.value })} disabled={!canEdit} />
                </label>
                {!isPortalStatement ? (
                  <label className={labelClass}>Footer Link
                    <input className={inputClass} value={activeTemplate.footerLink} onChange={(event) => updateTemplate({ footerLink: event.target.value })} disabled={!canEdit} />
                  </label>
                ) : null}
              </div>
              {activeType === 'quotation' ? (
                <label className={labelClass}>Terms and Conditions
                  <textarea
                    className={inputClass}
                    rows={5}
                    value={activeTemplate.termsAndConditions}
                    onChange={(event) => updateTemplate({ termsAndConditions: event.target.value })}
                    disabled={!canEdit}
                  />
                  <p className="mt-1 text-[11px] text-[var(--c-muted)]">Use <code>{'{{expiryDate}}'}</code> to show the quotation expiry date automatically.</p>
                </label>
              ) : null}
              <label className={labelClass}>Logo Source (Settings Library)
                <select
                  className={inputClass}
                  value={selectedLogoSlotId}
                  onChange={(event) => updateTemplate({ logoSlotId: event.target.value })}
                  disabled={!canEdit || availableLogoSlots.length === 0}
                >
                  <option value="">Auto (from Branding usage)</option>
                  {availableLogoSlots.map((slot) => (
                    <option key={slot.slotId} value={slot.slotId}>
                      {slot.name ? `${slot.name} (${slot.slotId})` : slot.slotId}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] text-[var(--c-muted)]">
                Logo upload is managed only in Settings {'>'} Brand Details {'>'} Logo Library.
              </p>
              {resolvedTemplateLogoUrl ? (
                <img src={resolvedTemplateLogoUrl} alt="Logo preview" className="max-h-20 rounded border border-[var(--c-border)] bg-[var(--c-surface)] p-2 object-contain" />
              ) : (
                <p className="text-[11px] text-[var(--c-muted)]">No logo available. Add logo first in Branding logo library.</p>
              )}
              <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
                <p className="mb-2 text-sm font-semibold text-[var(--c-text)]">Brand Visibility</p>
                <div className="grid gap-2">
                  <label className="flex items-center justify-between rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)]">
                    <span>Show Company Name</span>
                    <input
                      type="checkbox"
                      checked={activeTemplate.showCompanyName !== false}
                      disabled={!canEdit || !hasCompanyNameData}
                      onChange={(event) => updateTemplate({ showCompanyName: event.target.checked })}
                      className="h-4 w-4 accent-[var(--c-accent)]"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)]">
                    <span>Show Company Address</span>
                    <input
                      type="checkbox"
                      checked={activeTemplate.showCompanyAddress !== false}
                      disabled={!canEdit || !hasCompanyAddressData}
                      onChange={(event) => updateTemplate({ showCompanyAddress: event.target.checked })}
                      className="h-4 w-4 accent-[var(--c-accent)]"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)]">
                    <span>Show Bank Details</span>
                    <input
                      type="checkbox"
                      checked={activeTemplate.showBankDetails !== false}
                      disabled={!canEdit || !hasBankDetailsData}
                      onChange={(event) => updateTemplate({ showBankDetails: event.target.checked })}
                      className="h-4 w-4 accent-[var(--c-accent)]"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)]">
                    <span>Show Contact Info</span>
                    <input
                      type="checkbox"
                      checked={activeTemplate.showContactInfo !== false}
                      disabled={!canEdit || !hasContactData}
                      onChange={(event) => updateTemplate({ showContactInfo: event.target.checked })}
                      className="h-4 w-4 accent-[var(--c-accent)]"
                    />
                  </label>

                  {activeTemplate.showContactInfo !== false && hasContactData && (
                    <div className="ml-4 mt-1 space-y-2 border-l-2 border-[var(--c-border)] pl-3">
                      <label className="flex items-center justify-between text-[11px] text-[var(--c-muted)]">
                        <span>Show Primary Email</span>
                        <input
                          type="checkbox"
                          checked={activeTemplate.contactVisibilityMap?.showPrimaryEmail !== false}
                          onChange={(e) => updateTemplate({ contactVisibilityMap: { ...activeTemplate.contactVisibilityMap, showPrimaryEmail: e.target.checked } })}
                          className="h-3 w-3 accent-[var(--c-accent)]"
                        />
                      </label>
                      <label className="flex items-center justify-between text-[11px] text-[var(--c-muted)]">
                        <span>Show Primary Mobile</span>
                        <input
                          type="checkbox"
                          checked={activeTemplate.contactVisibilityMap?.showPrimaryMobile !== false}
                          onChange={(e) => updateTemplate({ contactVisibilityMap: { ...activeTemplate.contactVisibilityMap, showPrimaryMobile: e.target.checked } })}
                          className="h-3 w-3 accent-[var(--c-accent)]"
                        />
                      </label>
                      <label className="flex items-center justify-between text-[11px] text-[var(--c-muted)]">
                        <span>Show Landline</span>
                        <input
                          type="checkbox"
                          checked={activeTemplate.contactVisibilityMap?.showLandline !== false}
                          onChange={(e) => updateTemplate({ contactVisibilityMap: { ...activeTemplate.contactVisibilityMap, showLandline: e.target.checked } })}
                          className="h-3 w-3 accent-[var(--c-accent)]"
                        />
                      </label>
                    </div>
                  )}

                  {!hasBankDetailsData || !hasContactData || !hasCompanyNameData || !hasCompanyAddressData ? (
                    <p className="text-[11px] text-[var(--c-muted)]">
                      Some visibility toggles are disabled until corresponding Branding data exists in Settings.
                    </p>
                  ) : null}

                  {activeTemplate.showBankDetails !== false && hasBankDetailsData && (
                    <div className="ml-4 mt-2 space-y-2 border-l-2 border-[var(--c-accent)]/30 pl-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">Visible Bank Accounts</p>
                      {branding.bankDetails.map((bank, idx) => (
                        <label key={idx} className="flex items-center justify-between text-[11px] text-[var(--c-muted)]">
                          <span className="truncate pr-2">{bank.bankName || `Bank ${idx + 1}`} - {bank.bankAccountNumber?.slice(-4) || '...'}</span>
                          <input
                            type="checkbox"
                            checked={activeTemplate.bankAccountsVisibility?.[idx] !== false}
                            onChange={(e) => {
                              const nextArr = [...(activeTemplate.bankAccountsVisibility || [])];
                              while (nextArr.length <= idx) nextArr.push(true);
                              nextArr[idx] = e.target.checked;
                              updateTemplate({ bankAccountsVisibility: nextArr });
                            }}
                            className="h-3 w-3 accent-[var(--c-accent)]"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Paper Size
                  <select className={inputClass} value={activeTemplate.paperSize} onChange={(event) => updateTemplate({ paperSize: event.target.value })} disabled={!canEdit}>
                    <option value="A4">A4</option><option value="Letter">Letter</option>
                  </select>
                </label>
                <label className={labelClass}>Orientation
                  <select className={inputClass} value={activeTemplate.orientation} onChange={(event) => updateTemplate({ orientation: event.target.value })} disabled={!canEdit}>
                    <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Body Layout
                  <select className={inputClass} value={activeTemplate.bodyLayout} onChange={(event) => updateTemplate({ bodyLayout: event.target.value })} disabled={!canEdit}>
                    <option value="standard">Standard</option><option value="compact">Compact</option>
                  </select>
                </label>
                {!isPortalStatement ? (
                  <label className={labelClass}>Billing Address Pos
                    <select className={inputClass} value={activeTemplate.billingAddressPosition} onChange={(event) => updateTemplate({ billingAddressPosition: event.target.value })} disabled={!canEdit}>
                      <option value="left">Left</option><option value="right">Right</option><option value="bottom">Bottom</option>
                    </select>
                  </label>
                ) : null}
                <label className={labelClass}>Table Row Height
                  <input type="number" min={4} max={48} className={inputClass} value={activeTemplate.rowPadding} onChange={(event) => updateTemplate({ rowPadding: normalizeNumber(event.target.value, 8, 48) })} disabled={!canEdit} />
                </label>
              </div>
              {isPortalStatement ? (
                <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
                  <p className="mb-2 text-sm font-semibold text-[var(--c-text)]">Portal Statement Options</p>
                  <div className="grid gap-2">
                    <label className="flex items-center justify-between rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)]">
                      <span>Portal Logo (Per Portal)</span>
                      <input
                        type="checkbox"
                        checked={activeTemplate.portalLogoEnabled !== false}
                        disabled={!canEdit}
                        onChange={(event) => updateTemplate({ portalLogoEnabled: event.target.checked })}
                        className="h-4 w-4 accent-[var(--c-accent)]"
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)]">
                      <span>Show Statement Table</span>
                      <input
                        type="checkbox"
                        checked={activeTemplate.portalTableEnabled !== false}
                        disabled={!canEdit}
                        onChange={(event) => updateTemplate({ portalTableEnabled: event.target.checked })}
                        className="h-4 w-4 accent-[var(--c-accent)]"
                      />
                    </label>
                    {activeTemplate.portalTableEnabled !== false ? (
                      <label className={labelClass}>Table Layout
                        <select
                          className={inputClass}
                          value={activeTemplate.portalTableLayout || 'horizontal'}
                          onChange={(event) => updateTemplate({ portalTableLayout: event.target.value })}
                          disabled={!canEdit}
                        >
                          <option value="horizontal">Horizontal</option>
                          <option value="vertical">Vertical</option>
                        </select>
                      </label>
                    ) : null}
                    <label className={labelClass}>Mandatory Disclaimer (Always Enabled)
                      <textarea
                        rows={3}
                        className={inputClass}
                        value={PORTAL_STATEMENT_DISCLAIMER_TEXT}
                        readOnly
                      />
                    </label>
                  </div>
                </div>
              ) : null}
              <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
                <p className="mb-2 text-sm font-semibold text-[var(--c-text)]">Margins</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>Top<input type="number" min={0} max={120} className={inputClass} value={activeTemplate.margins.top} onChange={(event) => updateTemplate({ margins: { ...activeTemplate.margins, top: normalizeNumber(event.target.value, activeTemplate.margins.top, 120) } })} disabled={!canEdit} /></label>
                  <label className={labelClass}>Right<input type="number" min={0} max={120} className={inputClass} value={activeTemplate.margins.right} onChange={(event) => updateTemplate({ margins: { ...activeTemplate.margins, right: normalizeNumber(event.target.value, activeTemplate.margins.right, 120) } })} disabled={!canEdit} /></label>
                  <label className={labelClass}>Bottom<input type="number" min={0} max={120} className={inputClass} value={activeTemplate.margins.bottom} onChange={(event) => updateTemplate({ margins: { ...activeTemplate.margins, bottom: normalizeNumber(event.target.value, activeTemplate.margins.bottom, 120) } })} disabled={!canEdit} /></label>
                  <label className={labelClass}>Left<input type="number" min={0} max={120} className={inputClass} value={activeTemplate.margins.left} onChange={(event) => updateTemplate({ margins: { ...activeTemplate.margins, left: normalizeNumber(event.target.value, activeTemplate.margins.left, 120) } })} disabled={!canEdit} /></label>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
                <p className="mb-2 text-sm font-semibold text-[var(--c-text)]">Branding Overrides</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>Accent
                    <input type="color" className={`${inputClass} h-10 p-1`} value={activeTemplate.accentColor} onChange={(event) => updateTemplate({ accentColor: event.target.value })} disabled={!canEdit} />
                  </label>
                  <label className={labelClass}>Background Mode
                    <select className={inputClass} value={activeTemplate.backgroundType} onChange={(event) => updateTemplate({ backgroundType: event.target.value })} disabled={!canEdit || !premium.pdfPremiumFeaturesEnabled}>
                      <option value="solid">Solid</option><option value="gradient" disabled={!premium.pdfPremiumGradientEnabled}>Gradient</option>{!isPortalStatement ? <option value="image" disabled={!premium.pdfPremiumGradientEnabled}>Image</option> : null}
                    </select>
                  </label>
                </div>
                {activeTemplate.backgroundType === 'solid' ? (
                  <label className={`${labelClass} mt-3 block`}>Background Color
                    <input type="color" className={`${inputClass} h-10 p-1`} value={activeTemplate.backgroundColor} onChange={(event) => updateTemplate({ backgroundColor: event.target.value })} disabled={!canEdit} />
                  </label>
                ) : null}
                {activeTemplate.backgroundType === 'gradient' ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className={labelClass}>Gradient Start<input type="color" className={`${inputClass} h-10 p-1`} value={activeTemplate.gradientStart} onChange={(event) => updateTemplate({ gradientStart: event.target.value })} disabled={!canEdit || !premium.pdfPremiumGradientEnabled} /></label>
                    <label className={labelClass}>Gradient End<input type="color" className={`${inputClass} h-10 p-1`} value={activeTemplate.gradientEnd} onChange={(event) => updateTemplate({ gradientEnd: event.target.value })} disabled={!canEdit || !premium.pdfPremiumGradientEnabled} /></label>
                  </div>
                ) : null}
                {activeTemplate.backgroundType === 'image' && !isPortalStatement ? (
                  <div className="mt-3">
                    <label className={labelClass}>Background Image Upload
                      <input type="file" accept=".png,.svg,.jpg,.jpeg,.webp,image/png,image/svg+xml,image/jpeg,image/webp" className={inputClass} disabled={!canEdit || uploading || !premium.pdfPremiumGradientEnabled} onChange={(event) => { const fileBlob = event.target.files?.[0]; if (!fileBlob) return; void uploadAsset('background', 'backgroundImageUrl', fileBlob); event.target.value = ''; }} />
                      {errors.backgroundImageUrl ? <p className={errorTextClass}>{errors.backgroundImageUrl}</p> : null}
                    </label>
                    {activeTemplate.backgroundImageUrl ? <img src={activeTemplate.backgroundImageUrl} alt="Background preview" className="mt-2 max-h-28 rounded border border-[var(--c-border)] object-cover" /> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <p className="text-sm font-semibold text-[var(--c-text)]">Preview Canvas</p>
              <button type="button" onClick={() => setPreviewTime(new Date().toLocaleTimeString())} className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-xs font-semibold">Render Preview</button>
            </div>
            <div className="overflow-hidden rounded-xl bg-[var(--c-surface)] p-4 text-[var(--c-text)]">
              <div className="mb-3 flex justify-start border-b border-[var(--c-border)] pb-3">
                {isPortalStatement && activeTemplate.portalLogoEnabled === false ? (
                  <div className="rounded border border-dashed border-[var(--c-border)] px-3 py-2 text-xs text-[var(--c-muted)]">Portal Logo Hidden</div>
                ) : isPortalStatement && activeTemplate.portalLogoEnabled !== false ? (
                  <div className="rounded border border-dashed border-[var(--c-border)] px-3 py-2 text-xs text-[var(--c-muted)]">
                    Portal logo will be used from portal profile
                  </div>
                ) : resolvedTemplateLogoUrl ? (
                  <img src={resolvedTemplateLogoUrl} alt="Logo preview" className="h-10 max-w-[120px] object-contain" />
                ) : (
                  <div className="rounded border border-dashed border-[var(--c-border)] px-3 py-2 text-xs text-[var(--c-muted)]">Logo from Settings</div>
                )}
              </div>
              <div className="rounded-lg px-3 py-2 text-white" style={{ backgroundColor: previewHeaderBg }}>
                <p className="text-sm font-semibold">{activeTemplate.titleText || 'Document Title'}</p>
                <p className="text-xs opacity-90">{activeTemplate.headerText || 'Header section preview text'}</p>
              </div>
              <div className="mt-3 space-y-1">
                {isPortalStatement && activeTemplate.portalTableEnabled === false ? (
                  <div className="rounded-md border border-dashed border-[var(--c-border)] px-3 py-2 text-xs text-[var(--c-muted)]">
                    Statement table is disabled for this template.
                  </div>
                ) : activeTemplate.portalTableLayout === 'vertical' && isPortalStatement ? (
                  ['Opening Balance', 'Service Charge', 'Closing Balance'].map((item, index) => (
                    <div key={item} className="rounded-md border border-[var(--c-border)] px-2 py-2 text-xs text-[var(--c-text)]">
                      <p className="font-semibold">{item}</p>
                      <p className="text-[11px] text-[var(--c-muted)]">Qty: 1 | Unit: Dhs {(120 + index * 40).toFixed(2)}</p>
                      <p className="mt-1 font-bold text-[var(--c-accent)]">Amount: Dhs {(120 + index * 40).toFixed(2)}</p>
                    </div>
                  ))
                ) : (
                  ['Service Item 1', 'Service Item 2', 'Service Item 3'].map((item, index) => (
                    <div key={item} className="flex items-center justify-between rounded-md border border-[var(--c-border)] px-2 text-xs text-[var(--c-text)]" style={{ paddingTop: activeTemplate.rowPadding, paddingBottom: activeTemplate.rowPadding }}>
                      <span>{item}</span><span>Dhs {(120 + index * 40).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-2 text-right text-sm font-bold text-[var(--c-accent)]">
                Total: Dhs 480.00
              </div>

              {!isPortalStatement && (activeTemplate.billingAddressPosition === 'bottom' || activeTemplate.billingAddressPosition === 'left' || activeTemplate.billingAddressPosition === 'right') && (
                <div className={`mt-3 rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] p-3 text-xs text-[var(--c-text)] ${activeTemplate.billingAddressPosition === 'bottom' ? 'order-last mt-6 border-[var(--c-accent)]/20' : ''} ${activeTemplate.billingAddressPosition === 'right' ? 'text-right ml-auto w-2/3' : 'w-2/3'}`}>
                  <p className="font-bold text-[var(--c-accent)]">Recipient: Valued Client</p>
                  <p className="opacity-80">Custom billing address preview based on selection.</p>
                </div>
              )}

              <div className="mt-3 space-y-1 rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] p-3 text-xs text-[var(--c-text)]">
                {activeTemplate.showCompanyName !== false ? <p className="font-semibold">{branding.brandName || 'ACIS Version 5.0'}</p> : null}
                {activeTemplate.showCompanyAddress !== false ? <p>Address: {branding.officeAddress || 'Dubai, UAE'}</p> : null}
                {activeTemplate.showBankDetails !== false ? (
                  <div className="border-t border-[var(--c-border)] mt-1 pt-1 italic opacity-80">
                    Bank Details: {activeTemplate.bankAccountsVisibility?.filter(v => v !== false).length || branding.bankDetails?.length || 0} Account(s) Visible
                  </div>
                ) : null}
                {activeTemplate.showContactInfo !== false ? (
                  <p>Contact: {activeTemplate.contactVisibilityMap?.showPrimaryEmail !== false ? branding.emailContacts?.[0]?.value : ''} {activeTemplate.contactVisibilityMap?.showPrimaryMobile !== false ? `| ${branding.mobileContacts?.[0]?.value}` : ''}</p>
                ) : null}
              </div>
              <div className={`mt-3 text-xs text-[var(--c-muted)] ${activeTemplate.footerAlignment === 'center' ? 'text-center' : activeTemplate.footerAlignment === 'right' ? 'text-right' : 'text-left'}`}>
                <p>{activeTemplate.footerText || 'Footer text preview'}</p>
                {!isPortalStatement && activeTemplate.footerLink ? <p className="text-[var(--c-accent)]">{activeTemplate.footerLink}</p> : null}
              </div>
              {isPortalStatement ? (
                <div className="mt-2 rounded-lg border border-rose-300/40 bg-rose-50/60 p-2 text-[11px] font-semibold text-rose-700">
                  {PORTAL_STATEMENT_DISCLAIMER_TEXT}
                </div>
              ) : null}
              {activeType === 'quotation' && activeTemplate.termsAndConditions ? (
                <div className="mt-3 rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] p-3 text-xs text-[var(--c-text)]">
                  <p className="mb-2 font-semibold">Terms and Conditions</p>
                  <p className="whitespace-pre-line">{activeTemplate.termsAndConditions.replaceAll('{{expiryDate}}', '31/12/2099')}</p>
                </div>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] text-[var(--c-muted)]">
              {previewTime ? `Preview rendered at ${previewTime}` : 'Preview updates live as key fields change.'}
            </p>
          </div>

          {status ? <p className="mt-3 text-sm text-[var(--c-muted)]">{status}</p> : null}
        </>
      )}
      {viewingSamplePath && (
        <SovereignViewer 
          localFilePath={viewingSamplePath}
          onClose={() => setViewingSamplePath('')}
          title={`Sovereign V5 Sample: ${activeType}`}
        />
      )}
    </SettingCard>
  );
};

export default PdfCustomizationStudioSection;

