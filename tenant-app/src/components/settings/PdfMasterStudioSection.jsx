import React, { useEffect, useMemo, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  Building2,
  Droplets,
  Eye,
  FileText,
  ImageIcon,
  Layout,
  Mail,
  Palette,
  Phone,
  Save,
  TableProperties,
  Type,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useTenant } from '../../context/useTenant';
import { fetchTenantPdfTemplates, getTenantSettingDoc, upsertTenantPdfTemplate, upsertTenantSettingDoc } from '../../lib/backendStore';
import { createSyncEvent } from '../../lib/syncEvents';
import { DEFAULT_QUOTATION_TERMS, PORTAL_STATEMENT_DISCLAIMER_TEXT, PDF_DEFAULT_TEMPLATE } from '../../lib/pdfTemplateRenderer';
import SettingCard from './SettingCard';
import InputActionField from '../common/InputActionField';
import SecureViewer from '../common/SecureViewer';
import { generateTenantPdf } from '../../lib/pdfGenerator';

const PDF_MASTER_PAGES = [
  { key: 'portalStatement', label: 'Portal Statement', titleText: 'Portal Statement' },
  { key: 'paymentReceipt', label: 'Payment Receipt', titleText: 'Payment Receipt' },
  { key: 'quotation', label: 'Quotation', titleText: 'Quotation' },
  { key: 'nextInvoice', label: 'Proforma Invoice', titleText: 'Proforma Invoice' },
  { key: 'invoice', label: 'Invoice', titleText: 'Tax Invoice' },
  { key: 'clientStatement', label: 'Client Statement', titleText: 'Client Statement' },
];

const FONT_OPTIONS = [
  { id: 'helvetica', label: 'Helvetica' },
  { id: 'times', label: 'Times' },
  { id: 'courier', label: 'Courier' },
  { id: 'helvetica-bold', label: 'Helvetica Bold' },
];

const LOGO_POSITIONS = [
  { id: 'left', icon: AlignLeft, label: 'Left' },
  { id: 'center', icon: AlignCenter, label: 'Center' },
  { id: 'right', icon: AlignRight, label: 'Right' },
  { id: 'bottom', icon: ArrowDownToLine, label: 'Bottom' },
];

const WATERMARK_POSITIONS = [
  { id: 'center', label: 'Center' },
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'diagonal', label: 'Diagonal' },
];

const DEFAULT_TEMPLATE = {
  templateId: 'master',
  name: 'Master Studio',
  titleText: 'Tax Invoice',
  headerText: '',
  logoSlotId: '',
  logoPosition: 'left',
  fontStyle: 'helvetica',
  headerAccentColor: '#0f172a',
  bottomAccentColor: '#e67e22',
  tableAccentColor: '#e67e22',
  accentColor: '#e67e22',
  showCompanyName: true,
  showContactInfo: true,
  showCompanyAddress: true,
  showBankDetails: true,
  tableEnabled: true,
  enableTerms: true,
  termsAndConditions: '',
  portalLogoEnabled: true,
  internalStatementDisclaimer: PORTAL_STATEMENT_DISCLAIMER_TEXT,
  contactVisibilityMap: {},
  bankAccountsVisibility: [],
  enableWatermark: false,
  watermarkType: 'logo',
  watermarkLogoSlotId: '',
  watermarkText: '',
  watermarkOpacity: 0.08,
  watermarkScale: 0.7,
  watermarkPosition: 'center',
  documentConfigs: {},
};

const normalizeText = (value) => String(value || '').trim();

const isSameText = (a, b) => normalizeText(a).replace(/\r\n/g, '\n') === normalizeText(b).replace(/\r\n/g, '\n');

const normalizeContactValue = (item) => normalizeText(item?.value || item?.phone || item?.email || item);

const normalizeLogoLibrary = (branding) => {
  const library = Array.isArray(branding?.logoLibrary) ? branding.logoLibrary : [];
  return library
    .map((slot, index) => ({
      slotId: normalizeText(slot?.slotId || slot?.id || `logo_${index + 1}`),
      name: normalizeText(slot?.name || slot?.label || `Logo ${index + 1}`),
      url: normalizeText(slot?.url || slot?.logoUrl || slot?.src),
    }))
    .filter((slot) => slot.slotId && slot.url);
};

const scanBranding = (branding) => {
  const companyName = normalizeText(branding?.companyName || branding?.legalName || branding?.brandName);
  const mobileSource = Array.isArray(branding?.mobileContacts) && branding.mobileContacts.length
    ? branding.mobileContacts
    : (Array.isArray(branding?.mobiles) ? branding.mobiles.map((value) => ({ value })) : []);
  const emailSource = Array.isArray(branding?.emailContacts) && branding.emailContacts.length
    ? branding.emailContacts
    : (Array.isArray(branding?.emails) ? branding.emails.map((value) => ({ value })) : []);
  const addressSource = Array.isArray(branding?.addresses) ? branding.addresses : [];
  const bankSource = Array.isArray(branding?.bankDetails) ? branding.bankDetails : [];

  const mobileContacts = mobileSource
    .map((item, index) => ({
      key: `mobile:${index}`,
      label: `Mobile ${index + 1}`,
      value: normalizeContactValue(item),
    }))
    .filter((item) => item.value);

  const emailContacts = emailSource
    .map((item, index) => ({
      key: `email:${index}`,
      label: `Email ${index + 1}`,
      value: normalizeContactValue(item).toLowerCase(),
    }))
    .filter((item) => item.value);

  const addresses = addressSource
    .map((value, index) => ({
      key: `address:${index}`,
      label: `Address ${index + 1}`,
      value: normalizeText(value),
    }))
    .filter((item) => item.value);

  const poBox = normalizeText(branding?.poBoxNumber)
    ? {
      key: 'poBox',
      label: 'PO Box',
      value: `PO Box ${normalizeText(branding.poBoxNumber)}${normalizeText(branding.poBoxEmirate) ? `, ${normalizeText(branding.poBoxEmirate)}` : ''}`,
    }
    : null;

  const bankDetails = bankSource
    .map((bank, index) => ({
      key: `bank:${index}`,
      label: `Bank ${index + 1}`,
      value: [
        bank?.bankName,
        bank?.bankAccountName,
        bank?.bankAccountNumber,
        bank?.bankIban,
      ].map(normalizeText).filter(Boolean).join(' | '),
    }))
    .filter((item) => item.value);

  const logoLibrary = normalizeLogoLibrary(branding);

  return {
    companyName,
    mobileContacts,
    emailContacts,
    addresses,
    poBox,
    bankDetails,
    logoLibrary,
  };
};

const buildVisibilityMap = (template, scan) => {
  const existing = template?.contactVisibilityMap && typeof template.contactVisibilityMap === 'object'
    ? template.contactVisibilityMap
    : {};
  const keys = [
    ...scan.mobileContacts,
    ...scan.emailContacts,
    ...scan.addresses,
    ...(scan.poBox ? [scan.poBox] : []),
  ].map((item) => item.key);
  return keys.reduce((acc, key) => {
    acc[key] = existing[key] !== false;
    return acc;
  }, {});
};

const reconcileTemplateWithBranding = (template, scan) => {
  const merged = { ...DEFAULT_TEMPLATE, ...(template || {}) };
  const logoSlotId = scan.logoLibrary.some((slot) => slot.slotId === merged.logoSlotId)
    ? merged.logoSlotId
    : (scan.logoLibrary[0]?.slotId || '');
  const watermarkLogoSlotId = scan.logoLibrary.some((slot) => slot.slotId === merged.watermarkLogoSlotId)
    ? merged.watermarkLogoSlotId
    : logoSlotId;

  return {
    ...merged,
    logoSlotId,
    watermarkLogoSlotId,
    watermarkType: scan.logoLibrary.length ? merged.watermarkType : 'text',
    showCompanyName: Boolean(scan.companyName) && merged.showCompanyName !== false,
    showContactInfo: (scan.mobileContacts.length > 0 || scan.emailContacts.length > 0) && merged.showContactInfo !== false,
    showCompanyAddress: (scan.addresses.length > 0 || Boolean(scan.poBox)) && merged.showCompanyAddress !== false,
    showBankDetails: scan.bankDetails.length > 0 && merged.showBankDetails !== false,
    contactVisibilityMap: buildVisibilityMap(merged, scan),
    bankAccountsVisibility: scan.bankDetails.map((_, index) => merged.bankAccountsVisibility?.[index] !== false),
  };
};

const Toggle = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    role="switch"
    disabled={disabled}
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/30 ${
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
    } ${checked ? 'bg-[var(--c-accent)]' : 'bg-[color:color-mix(in_srgb,var(--c-muted)_30%,var(--c-panel))]'}`}
  >
    <span className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
  </button>
);

const ToggleRow = ({ icon: Icon, label, value, checked, onChange, disabled = false }) => (
  <div className={`flex items-center justify-between gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-3 ${disabled ? 'opacity-60' : ''}`}>
    <div className="flex min-w-0 items-center gap-3">
      {Icon ? <Icon className="h-4 w-4 shrink-0 text-[var(--c-accent)]" /> : null}
      <div className="min-w-0">
        <p className="text-sm font-bold text-[var(--c-text)]">{label}</p>
        {value ? <p className="mt-0.5 truncate text-xs text-[var(--c-muted)]">{value}</p> : null}
      </div>
    </div>
    <Toggle checked={checked} onChange={onChange} disabled={disabled} />
  </div>
);

const ColorControl = ({ label, value, onChange }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">{label}</label>
    <div className="flex gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-1">
      <label className="relative h-[38px] w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] p-1">
        <span className="block h-full w-full rounded-md" style={{ backgroundColor: value }} />
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </label>
      <div className="flex-1">
        <InputActionField value={value} onValueChange={onChange} />
      </div>
    </div>
  </div>
);

const PdfMasterStudioSection = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();

  const [branding, setBranding] = useState(null);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [activeDocumentType, setActiveDocumentType] = useState(PDF_MASTER_PAGES[0].key);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [previewDataUrl, setPreviewDataUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [pdfTemplatesByType, setPdfTemplatesByType] = useState({});

  const scan = useMemo(() => scanBranding(branding), [branding]);
  const hasLogoLibrary = scan.logoLibrary.length > 0;
  const selectedLogo = useMemo(
    () => scan.logoLibrary.find((slot) => slot.slotId === template.logoSlotId) || scan.logoLibrary[0] || null,
    [scan.logoLibrary, template.logoSlotId],
  );
  const selectedWatermarkLogo = useMemo(
    () => scan.logoLibrary.find((slot) => slot.slotId === template.watermarkLogoSlotId) || selectedLogo,
    [scan.logoLibrary, selectedLogo, template.watermarkLogoSlotId],
  );
  const activePage = PDF_MASTER_PAGES.find((item) => item.key === activeDocumentType) || PDF_MASTER_PAGES[0];

  useEffect(() => {
    let active = true;
    Promise.all([
      getTenantSettingDoc(tenantId, 'branding'),
      getTenantSettingDoc(tenantId, 'pdfTemplate_default'),
      fetchTenantPdfTemplates(tenantId),
    ]).then(([brandRes, tmplRes, pdfTemplatesRes]) => {
      if (!active) return;
      const brandData = brandRes.ok && brandRes.data ? brandRes.data : {};
      const scanned = scanBranding(brandData);
      const byType = pdfTemplatesRes.ok ? pdfTemplatesRes.byType || {} : {};
      const quotationTemplate = Array.isArray(byType.quotation?.templates)
        ? byType.quotation.templates.find((item) => item.templateId === byType.quotation.activeTemplateId) || byType.quotation.templates[0]
        : null;
      setBranding(brandData);
      setPdfTemplatesByType(byType);
      setTemplate(reconcileTemplateWithBranding({
        ...(tmplRes.ok && tmplRes.data ? tmplRes.data : DEFAULT_TEMPLATE),
        termsAndConditions: normalizeText(quotationTemplate?.termsAndConditions || DEFAULT_QUOTATION_TERMS),
      }, scanned));
    });
    return () => {
      active = false;
    };
  }, [tenantId]);

  const updateField = (key, value) => {
    setTemplate((prev) => ({ ...prev, [key]: value }));
  };

  const updateDocumentType = (documentType) => {
    const nextPage = PDF_MASTER_PAGES.find((item) => item.key === documentType) || PDF_MASTER_PAGES[0];
    setActiveDocumentType(nextPage.key);
    setTemplate((prev) => {
      const currentPageConfig = prev.documentConfigs?.[nextPage.key] || {};
      const docTemplate = pdfTemplatesByType[nextPage.key];
      const activeDocTemplate = Array.isArray(docTemplate?.templates)
        ? docTemplate.templates.find((item) => item.templateId === docTemplate.activeTemplateId) || docTemplate.templates[0]
        : null;
      return {
        ...prev,
        titleText: currentPageConfig.titleText || nextPage.titleText,
        footerText: currentPageConfig.footerText || prev.footerText || '',
        termsAndConditions: nextPage.key === 'quotation'
          ? normalizeText(activeDocTemplate?.termsAndConditions || DEFAULT_QUOTATION_TERMS)
          : prev.termsAndConditions,
        internalStatementDisclaimer: nextPage.key === 'portalStatement'
          ? normalizeText(prev.internalStatementDisclaimer || PORTAL_STATEMENT_DISCLAIMER_TEXT)
          : prev.internalStatementDisclaimer,
      };
    });
  };

  const updateVisibility = (key, value) => {
    setTemplate((prev) => ({
      ...prev,
      contactVisibilityMap: {
        ...(prev.contactVisibilityMap || {}),
        [key]: value,
      },
    }));
  };

  const updateBankVisibility = (index, value) => {
    setTemplate((prev) => {
      const next = scan.bankDetails.map((_, bankIndex) => prev.bankAccountsVisibility?.[bankIndex] !== false);
      next[index] = value;
      return { ...prev, bankAccountsVisibility: next };
    });
  };

  const buildSavePayload = () => {
    const documentConfigs = PDF_MASTER_PAGES.reduce((acc, page) => {
      const existing = template.documentConfigs?.[page.key] || {};
      acc[page.key] = {
        ...existing,
        documentType: page.key,
        label: page.label,
        titleText: page.key === activeDocumentType ? normalizeText(template.titleText || page.titleText) : normalizeText(existing.titleText || page.titleText),
        footerMode: 'system',
      };
      return acc;
    }, {});

    return {
      templateId: 'master',
      name: 'Master Studio',
      titleText: normalizeText(template.titleText),
      headerText: normalizeText(template.headerText),
      logoSlotId: selectedLogo?.slotId || '',
      logoPosition: ['left', 'center', 'right', 'bottom'].includes(template.logoPosition) ? template.logoPosition : 'left',
      fontStyle: FONT_OPTIONS.some((font) => font.id === template.fontStyle) ? template.fontStyle : 'helvetica',
      headerAccentColor: template.headerAccentColor,
      bottomAccentColor: template.bottomAccentColor,
      tableAccentColor: template.tableAccentColor,
      accentColor: template.tableAccentColor,
      showCompanyName: Boolean(scan.companyName) && template.showCompanyName !== false,
      showContactInfo: (scan.mobileContacts.length > 0 || scan.emailContacts.length > 0) && template.showContactInfo !== false,
      showCompanyAddress: (scan.addresses.length > 0 || Boolean(scan.poBox)) && template.showCompanyAddress !== false,
      showBankDetails: scan.bankDetails.length > 0 && template.showBankDetails !== false,
      contactVisibilityMap: buildVisibilityMap(template, scan),
      bankAccountsVisibility: scan.bankDetails.map((_, index) => template.bankAccountsVisibility?.[index] !== false),
      tableEnabled: template.tableEnabled !== false,
      enableTerms: activeDocumentType === 'portalStatement' ? true : template.enableTerms !== false,
      termsAndConditions: activeDocumentType === 'quotation' && !isSameText(template.termsAndConditions || DEFAULT_QUOTATION_TERMS, DEFAULT_QUOTATION_TERMS)
        ? normalizeText(template.termsAndConditions)
        : '',
      portalLogoEnabled: template.portalLogoEnabled !== false,
      internalStatementDisclaimer: PORTAL_STATEMENT_DISCLAIMER_TEXT,
      enableWatermark: template.enableWatermark === true,
      watermarkType: template.watermarkType === 'text' || !hasLogoLibrary ? 'text' : 'logo',
      watermarkLogoSlotId: selectedWatermarkLogo?.slotId || selectedLogo?.slotId || '',
      watermarkText: normalizeText(template.watermarkText),
      watermarkOpacity: Math.min(0.35, Math.max(0.03, Number(template.watermarkOpacity) || DEFAULT_TEMPLATE.watermarkOpacity)),
      watermarkScale: Math.min(1.3, Math.max(0.3, Number(template.watermarkScale) || DEFAULT_TEMPLATE.watermarkScale)),
      watermarkPosition: WATERMARK_POSITIONS.some((position) => position.id === template.watermarkPosition) ? template.watermarkPosition : 'center',
      documentConfigs,
      updatedBy: user?.uid || '',
      updatedAt: new Date().toISOString(),
    };
  };

  const handleSave = async () => {
    if (!user?.uid) {
      setSaveMessage('Sign in again before saving.');
      return;
    }

    setIsSaving(true);
    setSaveMessage('');

    const savePayload = buildSavePayload();
    const write = await upsertTenantSettingDoc(tenantId, 'pdfTemplate_default', savePayload);
    if (write.ok) {
      if (activeDocumentType === 'quotation' && (!isSameText(savePayload.termsAndConditions, DEFAULT_QUOTATION_TERMS) || pdfTemplatesByType.quotation)) {
        const quotationTerms = normalizeText(savePayload.termsAndConditions || DEFAULT_QUOTATION_TERMS);
        const quotationTemplatePayload = {
          documentType: 'quotation',
          isTemplateEnabled: true,
          activeTemplateId: 'default',
          templateVersion: Date.now(),
          templates: [{
            ...PDF_DEFAULT_TEMPLATE,
            templateId: 'default',
            name: 'Quotation',
            titleText: savePayload.documentConfigs?.quotation?.titleText || 'Quotation',
            enableTerms: true,
            termsAndConditions: quotationTerms,
          }],
          updatedBy: user.uid,
        };
        const quotationWrite = await upsertTenantPdfTemplate(tenantId, 'quotation', quotationTemplatePayload);
        if (!quotationWrite.ok) {
          setSaveMessage(`Quotation terms save failed: ${quotationWrite.error}`);
          setIsSaving(false);
          return;
        }
        await createSyncEvent({
          tenantId,
          eventType: 'update',
          entityType: 'settingsPdfTemplate',
          entityId: 'quotation',
          changedFields: Object.keys(quotationTemplatePayload),
          createdBy: user.uid,
        });
      }
      await createSyncEvent({
        tenantId,
        eventType: 'update',
        entityType: 'settingsPdfTemplate',
        entityId: 'pdfTemplate_default',
        changedFields: Object.keys(savePayload),
        createdBy: user.uid,
      });
      setTemplate((prev) => ({ ...prev, ...savePayload }));
      setSaveMessage('PDF Master Studio saved.');
    } else {
      setSaveMessage(`Failed to save: ${write.error}`);
    }

    setIsSaving(false);
  };

  const handlePreview = async () => {
    const previewTemplate = buildSavePayload();
    const result = await generateTenantPdf({
      documentType: activeDocumentType,
      tenantId,
      data: {
        txId: `${activeDocumentType.toUpperCase()}-20260426-0001`,
        date: new Date().toLocaleDateString(),
        recipientName: activeDocumentType === 'portalStatement' ? 'Sample Bank Portal' : 'Valued Client LLC',
        portalName: activeDocumentType === 'portalStatement' ? 'Sample Bank Portal' : undefined,
        portalId: activeDocumentType === 'portalStatement' ? 'sample-bank-portal' : undefined,
        portalType: activeDocumentType === 'portalStatement' ? 'Bank' : undefined,
        portalLogoUrl: activeDocumentType === 'portalStatement' && template.portalLogoEnabled !== false
          ? (scan.logoLibrary[0]?.url || '')
          : '',
        documentType: activeDocumentType,
        amount: 1500,
        items: [
          { name: 'Application typing and service coordination', qty: 1, unit: 1000, total: 1000 },
          { name: 'Government receipt handling', qty: 1, unit: 500, total: 500 },
        ],
        statementRows: [
          { date: '2026-04-01', description: 'Opening Balance', debit: 0, credit: 0, balance: 0 },
          { date: '2026-04-26', description: 'Invoice preview', debit: 1500, credit: 0, balance: 1500 },
        ],
        description: `${activePage.label} preview of the scanned master layout`,
      },
      returnBase64: true,
      save: false,
      templateOverride: previewTemplate,
    });

    if (result.ok) {
      setPreviewDataUrl(result.base64);
      setShowPreview(true);
    } else {
      setSaveMessage(`Preview failed: ${result.error || 'unknown error'}`);
    }
  };

  if (!branding) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[var(--c-panel)]" />;
  }

  const sectionClass = 'rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm';
  const labelClass = 'text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]';
  const visibilityMap = template.contactVisibilityMap || {};
  const isPortalStatementPage = activeDocumentType === 'portalStatement';
  const isQuotationPage = activeDocumentType === 'quotation';

  return (
    <div className="space-y-6">
      <SettingCard
        title="PDF Master Studio"
        description="Scans Brand Settings at this point in time and renders only available tenant data into A4 PDF layouts."
        icon={Layout}
      >
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-12">
          <div className="space-y-6 2xl:col-span-8">
            <div className={sectionClass}>
              <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-[var(--c-accent)]">
                <FileText className="h-4 w-4" /> PDF Master Pages
              </h3>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {PDF_MASTER_PAGES.map((page) => (
                  <button
                    key={page.key}
                    type="button"
                    onClick={() => updateDocumentType(page.key)}
                    className={`min-h-[44px] rounded-xl border px-3 text-xs font-black transition ${
                      activeDocumentType === page.key
                        ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/10 text-[var(--c-accent)]'
                        : 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)]'
                    }`}
                  >
                    {page.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={sectionClass}>
              <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-[var(--c-accent)]">
                <Building2 className="h-4 w-4" /> Dynamic Scanned UI
              </h3>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {scan.companyName ? (
                  <ToggleRow
                    icon={Building2}
                    label="Company Name"
                    value={scan.companyName}
                    checked={template.showCompanyName}
                    onChange={(value) => updateField('showCompanyName', value)}
                  />
                ) : null}

                {scan.addresses.map((address) => (
                  <ToggleRow
                    key={address.key}
                    icon={FileText}
                    label={address.label}
                    value={address.value}
                    checked={visibilityMap[address.key] !== false && template.showCompanyAddress !== false}
                    onChange={(value) => updateVisibility(address.key, value)}
                    disabled={template.showCompanyAddress === false}
                  />
                ))}

                {scan.poBox ? (
                  <ToggleRow
                    icon={FileText}
                    label={scan.poBox.label}
                    value={scan.poBox.value}
                    checked={visibilityMap.poBox !== false && template.showCompanyAddress !== false}
                    onChange={(value) => updateVisibility('poBox', value)}
                    disabled={template.showCompanyAddress === false}
                  />
                ) : null}

                {scan.mobileContacts.map((contact) => (
                  <ToggleRow
                    key={contact.key}
                    icon={Phone}
                    label={contact.label}
                    value={contact.value}
                    checked={visibilityMap[contact.key] !== false && template.showContactInfo !== false}
                    onChange={(value) => updateVisibility(contact.key, value)}
                    disabled={template.showContactInfo === false}
                  />
                ))}

                {scan.emailContacts.map((contact) => (
                  <ToggleRow
                    key={contact.key}
                    icon={Mail}
                    label={contact.label}
                    value={contact.value}
                    checked={visibilityMap[contact.key] !== false && template.showContactInfo !== false}
                    onChange={(value) => updateVisibility(contact.key, value)}
                    disabled={template.showContactInfo === false}
                  />
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {(scan.addresses.length > 0 || scan.poBox) ? (
                  <ToggleRow
                    label="Address Group"
                    checked={template.showCompanyAddress}
                    onChange={(value) => updateField('showCompanyAddress', value)}
                  />
                ) : null}
                {(scan.mobileContacts.length > 0 || scan.emailContacts.length > 0) ? (
                  <ToggleRow
                    label="Contact Group"
                    checked={template.showContactInfo}
                    onChange={(value) => updateField('showContactInfo', value)}
                  />
                ) : null}
                {scan.bankDetails.length > 0 ? (
                  <ToggleRow
                    label="Bank Details"
                    checked={template.showBankDetails}
                    onChange={(value) => updateField('showBankDetails', value)}
                  />
                ) : null}
              </div>

              {scan.bankDetails.length > 0 && template.showBankDetails ? (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {scan.bankDetails.map((bank, index) => (
                    <ToggleRow
                      key={bank.key}
                      label={bank.label}
                      value={bank.value}
                      checked={template.bankAccountsVisibility?.[index] !== false}
                      onChange={(value) => updateBankVisibility(index, value)}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            {!isPortalStatementPage ? (
            <div className={sectionClass}>
              <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-[var(--c-accent)]">
                <ImageIcon className="h-4 w-4" /> Logo Library
              </h3>

              {hasLogoLibrary ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {scan.logoLibrary.map((logo) => (
                      <button
                        key={logo.slotId}
                        type="button"
                        onClick={() => updateField('logoSlotId', logo.slotId)}
                        className={`flex min-h-[88px] overflow-hidden rounded-xl border bg-[var(--c-panel)] p-0 text-left transition ${
                          template.logoSlotId === logo.slotId
                            ? 'border-[var(--c-accent)] ring-2 ring-[var(--c-accent)]/20'
                            : 'border-[var(--c-border)]'
                        }`}
                      >
                        <span className="flex aspect-square w-[88px] shrink-0 items-center justify-center overflow-hidden bg-[var(--c-surface)]">
                          <img src={logo.url} alt={logo.name} className="h-full w-full object-cover" />
                        </span>
                        <span className="flex min-w-0 flex-1 items-center px-3">
                          <span className="block truncate text-xs font-black text-[var(--c-text)]">{logo.name}</span>
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <label className={labelClass}>Logo Position</label>
                    <div className="grid grid-cols-4 gap-2">
                      {LOGO_POSITIONS.map((position) => (
                        <button
                          key={position.id}
                          type="button"
                          onClick={() => updateField('logoPosition', position.id)}
                          className={`flex h-[42px] items-center justify-center rounded-xl border transition ${
                            template.logoPosition === position.id
                              ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/10 text-[var(--c-accent)]'
                              : 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)]'
                          }`}
                          title={position.label}
                        >
                          <position.icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-[var(--c-border)] bg-[var(--c-panel)] p-4 text-sm font-semibold text-[var(--c-muted)]">
                  Logo controls are hidden until Brand Settings has at least one logo in the library.
                </p>
              )}
            </div>
            ) : (
              <div className={sectionClass}>
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-[var(--c-accent)]">
                  <ImageIcon className="h-4 w-4" /> Portal Statement Portal Logo
                </h3>
                <ToggleRow
                  icon={ImageIcon}
                  label="Enable Portal Logo"
                  value="Uses the logo stored on the selected portal, not the tenant logo library."
                  checked={template.portalLogoEnabled !== false}
                  onChange={(value) => updateField('portalLogoEnabled', value)}
                />
              </div>
            )}

            <div className={sectionClass}>
              <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-[var(--c-accent)]">
                <Palette className="h-4 w-4" /> Styling
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className={labelClass}>Document Title</label>
                  <InputActionField value={template.titleText} onValueChange={(value) => updateField('titleText', value)} placeholder="Tax Invoice" />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Professional Font</label>
                  <select
                    className="h-[42px] w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-sm font-semibold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
                    value={template.fontStyle}
                    onChange={(event) => updateField('fontStyle', event.target.value)}
                  >
                    {FONT_OPTIONS.map((font) => (
                      <option key={font.id} value={font.id}>{font.label}</option>
                    ))}
                  </select>
                </div>
                <ColorControl label="Header Accent" value={template.headerAccentColor} onChange={(value) => updateField('headerAccentColor', value)} />
                <ColorControl label="Bottom Accent" value={template.bottomAccentColor} onChange={(value) => updateField('bottomAccentColor', value)} />
                <ColorControl label="Table Accent" value={template.tableAccentColor} onChange={(value) => updateField('tableAccentColor', value)} />
                <ToggleRow
                  icon={TableProperties}
                  label="Enable Table Format"
                  checked={template.tableEnabled !== false}
                  onChange={(value) => updateField('tableEnabled', value)}
                />
              </div>
            </div>

            <div className={sectionClass}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--c-accent)]">
                  <Droplets className="h-4 w-4" /> Independent Watermark
                </h3>
                <Toggle checked={template.enableWatermark} onChange={(value) => updateField('enableWatermark', value)} />
              </div>

              {template.enableWatermark ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className={labelClass}>Watermark Type</label>
                    <select
                      className="h-[42px] w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-sm font-semibold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
                      value={template.watermarkType}
                      onChange={(event) => updateField('watermarkType', event.target.value)}
                    >
                      {hasLogoLibrary ? <option value="logo">Logo</option> : null}
                      <option value="text">Text</option>
                    </select>
                  </div>

                  {template.watermarkType === 'logo' && hasLogoLibrary ? (
                    <div className="space-y-1">
                      <label className={labelClass}>Watermark Logo</label>
                      <div className="grid grid-cols-2 gap-2">
                        {scan.logoLibrary.map((logo) => (
                          <button
                            key={logo.slotId}
                            type="button"
                            onClick={() => updateField('watermarkLogoSlotId', logo.slotId)}
                            className={`overflow-hidden rounded-xl border bg-[var(--c-panel)] p-0 transition ${
                              template.watermarkLogoSlotId === logo.slotId
                                ? 'border-[var(--c-accent)] ring-2 ring-[var(--c-accent)]/20'
                                : 'border-[var(--c-border)]'
                            }`}
                            title={logo.name}
                          >
                            <span className="flex aspect-square w-full items-center justify-center overflow-hidden bg-[var(--c-surface)]">
                              <img src={logo.url} alt={logo.name} className="h-full w-full object-cover" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className={labelClass}>Watermark Text</label>
                      <InputActionField value={template.watermarkText} onValueChange={(value) => updateField('watermarkText', value)} placeholder={scan.companyName || 'ACIS'} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className={labelClass}>Size {Math.round(Number(template.watermarkScale || 0) * 100)}%</label>
                    <input
                      type="range"
                      min="0.3"
                      max="1.3"
                      step="0.1"
                      value={template.watermarkScale}
                      onChange={(event) => updateField('watermarkScale', Number(event.target.value))}
                      className="w-full accent-[var(--c-accent)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Opacity {Math.round(Number(template.watermarkOpacity || 0) * 100)}%</label>
                    <input
                      type="range"
                      min="0.03"
                      max="0.35"
                      step="0.01"
                      value={template.watermarkOpacity}
                      onChange={(event) => updateField('watermarkOpacity', Number(event.target.value))}
                      className="w-full accent-[var(--c-accent)]"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className={labelClass}>Position</label>
                    <div className="grid grid-cols-4 gap-2">
                      {WATERMARK_POSITIONS.map((position) => (
                        <button
                          key={position.id}
                          type="button"
                          onClick={() => updateField('watermarkPosition', position.id)}
                          className={`h-[42px] rounded-xl border px-2 text-xs font-bold transition ${
                            template.watermarkPosition === position.id
                              ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/10 text-[var(--c-accent)]'
                              : 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)]'
                          }`}
                        >
                          {position.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4">
                    <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)]">
                      {template.watermarkType === 'logo' && selectedWatermarkLogo?.url ? (
                        <img
                          src={selectedWatermarkLogo.url}
                          alt={selectedWatermarkLogo.name}
                          className="max-h-full max-w-full object-contain transition"
                          style={{
                            opacity: Math.min(0.35, Math.max(0.03, Number(template.watermarkOpacity) || 0.08)),
                            transform: `scale(${Math.min(1.3, Math.max(0.3, Number(template.watermarkScale) || 0.7))})`,
                          }}
                        />
                      ) : (
                        <span
                          className="text-3xl font-black uppercase text-[var(--c-text)] transition"
                          style={{
                            opacity: Math.min(0.35, Math.max(0.03, Number(template.watermarkOpacity) || 0.08)),
                            transform: `scale(${Math.min(1.3, Math.max(0.3, Number(template.watermarkScale) || 0.7))})`,
                          }}
                        >
                          {template.watermarkText || scan.companyName || 'ACIS'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={sectionClass}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--c-accent)]">
                  <Type className="h-4 w-4" /> Terms & Conditions
                </h3>
                {!isPortalStatementPage ? (
                  <Toggle checked={template.enableTerms !== false} onChange={(value) => updateField('enableTerms', value)} />
                ) : null}
              </div>
              {isPortalStatementPage ? (
                <div className="space-y-2">
                  <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-600">
                    This disclaimer is mandatory and appears on every Portal Statement.
                  </p>
                  <textarea
                    value={PORTAL_STATEMENT_DISCLAIMER_TEXT}
                    readOnly
                    className="min-h-[112px] w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-3 text-sm font-semibold text-[var(--c-text)] outline-none"
                    placeholder={PORTAL_STATEMENT_DISCLAIMER_TEXT}
                  />
                </div>
              ) : template.enableTerms !== false ? (
                <textarea
                  value={isQuotationPage ? (template.termsAndConditions || DEFAULT_QUOTATION_TERMS) : template.termsAndConditions}
                  onChange={(event) => updateField('termsAndConditions', event.target.value)}
                  className="min-h-[112px] w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-3 text-sm font-semibold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5"
                  placeholder="Add tenant-wide terms. Use {{expiryDate}} for quotation expiry."
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-4 2xl:col-span-4">
            <div className="flex flex-col gap-4 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-lg 2xl:sticky 2xl:top-6">
              <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--c-accent)]/10">
                  <Eye className="h-6 w-6 text-[var(--c-accent)]" />
                </div>
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--c-text)]">A4 Render Preview</p>
                <button
                  type="button"
                  onClick={handlePreview}
                  className="w-full rounded-xl bg-[var(--c-text)] px-4 py-3.5 text-sm font-black text-[var(--c-surface)] shadow-xl transition hover:opacity-90 active:scale-95"
                >
                  Preview
                </button>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--c-accent)] px-4 py-3.5 text-sm font-black text-white shadow-xl transition hover:opacity-90 disabled:opacity-50 active:scale-95"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Master'}
              </button>
              {saveMessage ? <p className="text-center text-xs font-bold text-[var(--c-accent)]">{saveMessage}</p> : null}
            </div>
          </div>
        </div>
      </SettingCard>

      {showPreview ? (
        <SecureViewer
          dataUrl={`data:application/pdf;base64,${previewDataUrl}`}
          onClose={() => setShowPreview(false)}
          title="PDF Master Preview"
        />
      ) : null}
    </div>
  );
};

export default PdfMasterStudioSection;
