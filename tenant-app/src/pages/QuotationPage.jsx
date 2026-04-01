import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Copy, Mail, Ban, CheckCircle2, RefreshCcw, Plus, Tags, X, GripVertical, Users, UserPlus, ChevronUp, ChevronDown, Trash2, Check, Minus, Search } from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import useElectronLayoutMode from '../hooks/useElectronLayoutMode';
import { useTenant } from '../context/useTenant';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import ClientSearchField from '../components/dailyTransaction/ClientSearchField';
import ServiceSearchField from '../components/dailyTransaction/ServiceSearchField';
import { fetchApplicationIconLibrary } from '../lib/applicationIconLibraryStore';
import CurrencyValue from '../components/common/CurrencyValue';
import DirhamIcon from '../components/common/DirhamIcon';
import ProgressVideoOverlay from '../components/common/ProgressVideoOverlay';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ActionProgressOverlay from '../components/common/ActionProgressOverlay';
import MobileContactsField from '../components/common/MobileContactsField';
import EmailContactsField from '../components/common/EmailContactsField';
import AddressField from '../components/common/AddressField';
import InputActionField from '../components/common/InputActionField';
import EmirateSelect from '../components/common/EmirateSelect';
import QuickAddServiceTemplateModal from '../components/dailyTransaction/QuickAddServiceTemplateModal';
import {
  DEFAULT_COUNTRY_PHONE_ISO2,
  findCountryPhoneOption,
} from '../lib/countryPhoneData';
import {
  getMobileNumberValidationMessage,
} from '../lib/mobileNumberRules';
import { ENFORCE_UNIVERSAL_APPLICATION_UID } from '../lib/universalLibraryPolicy';
import {
  fetchTenantQuotations,
  fetchTenantPdfTemplates,
  generateDisplayDocumentRef,
  previewDisplayDocumentRef,
  sendTenantDocumentEmail,
  upsertTenantQuotation,
  fetchTenantUsersMap,
} from '../lib/backendStore';
// Moved conversion logic to manual proforma generation flow

import { generateTenantPdf } from '../lib/pdfGenerator';
import { createSyncEvent } from '../lib/syncEvents';
import { sendUniversalNotification } from '../lib/notificationDrafting';
import { toSafeDocId } from '../lib/idUtils';
import {
  normalizeLibraryDescription,
} from '../lib/serviceTemplateRules';
import { fetchMergedServiceTemplates } from '../lib/serviceTemplateStore';
import {
  DEFAULT_QUOTATION_TERMS,
  resolvePdfTemplateForRenderer,
} from '../lib/pdfTemplateRenderer';
import { resolvePageIconUrl } from '../lib/pageIconAssets';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../lib/systemAssetsCache';
import CreatedByIdentityCard from '../components/common/CreatedByIdentityCard';
import QuotationClientQuickCreate from '../components/quotation/QuotationClientQuickCreate';

const inputClass = 'compact-field mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm font-bold text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5';
const selectClass = 'compact-field mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm font-bold text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5';
const activeTabClass = 'bg-[var(--c-accent)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--c-accent)_28%,transparent)]';
const activeChoiceCardClass = 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-surface))]';
const activeChoiceIconClass = 'bg-[var(--c-accent)] text-white';
const primaryActionClass = 'bg-[var(--c-accent)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--c-accent)_24%,transparent)] hover:opacity-95';

const makeContactId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createManualMobileContact = (overrides = {}) => ({
  id: makeContactId('mobile'),
  value: '',
  countryIso2: DEFAULT_COUNTRY_PHONE_ISO2,
  whatsAppEnabled: true,
  ...overrides,
});
const createManualEmailContact = (overrides = {}) => ({
  id: makeContactId('email'),
  value: '',
  emailEnabled: true,
  ...overrides,
});
const syncManualClientContacts = (draft) => {
  const mobileContacts = Array.isArray(draft.mobileContacts) && draft.mobileContacts.length
    ? draft.mobileContacts
    : [createManualMobileContact()];
  const emailContacts = Array.isArray(draft.emailContacts) && draft.emailContacts.length
    ? draft.emailContacts
    : [createManualEmailContact()];
  const primaryMobileContact = mobileContacts.find((contact) => String(contact.value || '').trim()) || mobileContacts[0];
  const primaryEmailContact = emailContacts.find((contact) => String(contact.value || '').trim()) || emailContacts[0];
  return {
    ...draft,
    mobileContacts,
    emailContacts,
    primaryMobile: primaryMobileContact?.value || '',
    primaryMobileCountry: primaryMobileContact?.countryIso2 || DEFAULT_COUNTRY_PHONE_ISO2,
    primaryEmail: primaryEmailContact?.value || '',
  };
};
const createEmptyManualClient = () => syncManualClientContacts({
  clientType: 'company',
  legalName: '',
  brandName: '',
  contactPersonName: '',
  primaryMobile: '',
  primaryMobileCountry: DEFAULT_COUNTRY_PHONE_ISO2,
  primaryEmail: '',
  emirate: '',
  address: '',
  mobileContacts: [createManualMobileContact()],
  emailContacts: [createManualEmailContact()],
});

const makeItem = (service) => ({
  rowId: `${service?.id || 'row'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  applicationId: service?.id || '',
  name: service?.name || '',
  iconId: service?.iconId || service?.globalIconId || '',
  iconUrl: service?.iconUrl || '',
  description: service?.description || '',
  qty: 1,
  amount: Number(service?.clientCharge || 0),
});

const createEmptyItemBuilder = () => ({
  service: null,
  qty: 1,
  amount: '',
  description: '',
});
const createQuotationTerm = (overrides = {}) => ({
  id: makeContactId('term'),
  type: 'custom',
  text: '',
  templateText: '',
  ...overrides,
});
const stripLeadingTermNumber = (value) => String(value || '').replace(/^\s*\d+\.\s*/, '').trim();
const parseQuotationTerms = (rawTerms) => {
  const sourceLines = String(rawTerms || '')
    .split(/\r?\n/)
    .map((line) => stripLeadingTermNumber(line))
    .filter(Boolean)
    .slice(0, 5);
  return sourceLines.map((line) => (
    line.includes('{{expiryDate}}')
      ? createQuotationTerm({ type: 'expiry', templateText: line })
      : createQuotationTerm({ type: 'custom', text: line })
  ));
};
const cloneQuotationTerms = (terms) => terms.map((term) => createQuotationTerm({
  type: term.type,
  text: term.text || '',
  templateText: term.templateText || '',
}));
const resolveQuotationTermText = (term, expiryDate) => {
  const source = term.type === 'expiry' ? term.templateText : term.text;
  return String(source || '')
    .replaceAll('{{expiryDate}}', String(expiryDate || '').trim() || 'the selected expiry date')
    .trim();
};
const serializeQuotationTerms = (terms, expiryDate) => terms
  .map((term, index) => {
    const text = resolveQuotationTermText(term, expiryDate);
    return text ? `${index + 1}. ${text}` : '';
  })
  .filter(Boolean)
  .join('\n');
const serializeQuotationTermTemplates = (terms) => terms
  .map((term) => ({
    type: term.type,
    text: term.type === 'expiry' ? term.templateText : term.text,
  }))
  .map((term) => ({
    ...term,
    text: String(term.text || '').trim(),
  }))
  .filter((term) => term.text);
const resolveStoredQuotationTerms = (storedTerms, expiryDate) => serializeQuotationTerms(
  Array.isArray(storedTerms)
    ? storedTerms.map((term) => createQuotationTerm({
      type: term?.type === 'expiry' ? 'expiry' : 'custom',
      text: term?.type === 'expiry' ? '' : String(term?.text || ''),
      templateText: term?.type === 'expiry' ? String(term?.text || '') : '',
    }))
    : [],
  expiryDate,
);

const addWeeks = (dateValue, weeks) => {
  const base = new Date(dateValue);
  if (Number.isNaN(base.getTime())) return new Date().toISOString().slice(0, 10);
  base.setDate(base.getDate() + (Number(weeks) || 0) * 7);
  return base.toISOString().slice(0, 10);
};

const formatAmountInputValue = (value) => {
  if (value === '' || value === null || value === undefined) return '0.00';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toFixed(2);
};

const toProperText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const QuotationPage = () => {
  const lockToUniversalApps = ENFORCE_UNIVERSAL_APPLICATION_UID;
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const { layoutMode } = useElectronLayoutMode();

  const [activeView, setActiveView] = useState('create');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().slice(0, 10));
  const [validityWeeks, setValidityWeeks] = useState(2);
  const [reference, setReference] = useState('');
  const [quotationDescription, setQuotationDescription] = useState('');
  const [clientMode, setClientMode] = useState('manual');
  const [existingClient, setExistingClient] = useState(null);
  const [selectedDependents, setSelectedDependents] = useState([]);
  const [manualClient, setManualClient] = useState(createEmptyManualClient);
  const [itemBuilder, setItemBuilder] = useState(createEmptyItemBuilder());
  const [items, setItems] = useState([]);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountMode, setDiscountMode] = useState('amount');
  const [discountValue, setDiscountValue] = useState('');
  const [quickClientModal, setQuickClientModal] = useState({ open: false, quotation: null });
  const [rows, setRows] = useState([]);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [quotationSearch, setQuotationSearch] = useState('');
  const [selectedQuotationId, setSelectedQuotationId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());
  const [appIconUrlById, setAppIconUrlById] = useState({});
  const [openDescriptionRows, setOpenDescriptionRows] = useState({});
  const [itemBuilderError, setItemBuilderError] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('info');
  const [confirmDialog, setConfirmDialog] = useState({ open: false });
  const [actionOverlay, setActionOverlay] = useState({
    open: false,
    kind: 'process',
    title: '',
    subtitle: '',
    status: '',
  });
  const [cancelReasonDialog, setCancelReasonDialog] = useState({
    open: false,
    quotation: null,
    reason: '',
    error: '',
  });
  const [serviceRefreshKey, setServiceRefreshKey] = useState(0);
  const [isInlineTemplateOpen, setIsInlineTemplateOpen] = useState(false);
  const [defaultQuotationTerms, setDefaultQuotationTerms] = useState(() => parseQuotationTerms(DEFAULT_QUOTATION_TERMS));
  const [quotationTerms, setQuotationTerms] = useState(() => cloneQuotationTerms(parseQuotationTerms(DEFAULT_QUOTATION_TERMS)));
  const [draggedItemRowId, setDraggedItemRowId] = useState('');
  const [dragOverItemRowId, setDragOverItemRowId] = useState('');
  const [serviceTemplates, setServiceTemplates] = useState([]);
  const statusRef = useRef(null);
  const handleQuickClientClose = () => setQuickClientModal({ open: false, quotation: null });
  const goToProforma = (proformaId) => {
    if (!proformaId) return;
    navigate(`/t/${tenantId}/proforma-invoices?id=${encodeURIComponent(proformaId)}`);
  };

  const handleQuickClientCreated = async ({ clientId, snapshot }) => {
    const quotation = quickClientModal.quotation;
    if (!quotation || !clientId) {
      handleQuickClientClose();
      return;
    }
    const patchedQuotation = { ...quotation, clientId, clientSnapshot: snapshot };
    // Persist the client link on the quotation document before conversion
    const safeSnapshot = Object.fromEntries(
      Object.entries(snapshot || {}).filter(([, v]) => v !== undefined && v !== null)
    );
    await upsertTenantQuotation(tenantId, quotation.id, {
      clientId,
      clientSnapshot: safeSnapshot,
      updatedAt: new Date().toISOString(),
    });
    // Optimistic UI update
    setRows((prev) =>
      prev.map((item) =>
        item.id === quotation.id ? { ...item, clientId, clientSnapshot: snapshot } : item
      )
    );
    handleQuickClientClose();
    await executeAcceptQuotation(patchedQuotation);
  };

  useEffect(() => {
    if (quickClientModal.open) {
      document.body.classList.add('hide-desktop-footer');
    } else {
      document.body.classList.remove('hide-desktop-footer');
    }
    return () => document.body.classList.remove('hide-desktop-footer');
  }, [quickClientModal.open]);
  const quotationDateFieldRef = useRef(null);
  const validityFieldRef = useRef(null);
  const actionLockRef = useRef(false);

  const tenantUserMap = useMemo(() => {
    const next = {};
    (tenantUsers || []).forEach((member) => {
      const key = member?.uid || member?.id;
      if (key) next[String(key)] = member;
    });
    return next;
  }, [tenantUsers]);

  const filteredRows = useMemo(() => {
    const query = String(quotationSearch || '').trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((quotation) => {
      const creator = tenantUserMap[String(quotation?.createdBy || '')];
      const creatorName = String(creator?.displayName || creator?.name || creator?.email || '').toLowerCase();
      const clientName = String(
        quotation?.clientSnapshot?.name
        || quotation?.clientSnapshot?.tradeName
        || quotation?.clientSnapshot?.fullName
        || ''
      ).toLowerCase();
      return [
        quotation?.displayRef,
        quotation?.status,
        quotation?.quoteDate,
        quotation?.expiryDate,
        clientName,
        creatorName,
      ].some((field) => String(field || '').toLowerCase().includes(query));
    });
  }, [rows, quotationSearch, tenantUserMap]);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    const [quoteRef, quotationsRes, userRes] = await Promise.all([
      previewDisplayDocumentRef(tenantId, 'quotation'),
      fetchTenantQuotations(tenantId),
      fetchTenantUsersMap(tenantId),
    ]);

    setReference(quoteRef);
    if (quotationsRes.ok) setRows(quotationsRes.rows || []);
    if (userRes.ok) setTenantUsers((userRes.rows || []).filter((u) => !u.deletedAt));
    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      void loadData();
    });
    return () => cancelAnimationFrame(handle);
  }, [loadData]);

  useEffect(() => {
    getSystemAssets().then(setSystemAssets).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    if (!tenantId) return undefined;
    fetchApplicationIconLibrary(tenantId).then((res) => {
      if (!active || !res.ok) return;
      const next = {};
      (res.rows || []).forEach((item) => {
        const iconId = String(item?.iconId || '').trim();
        const iconUrl = String(item?.iconUrl || '').trim();
        if (!iconId || !iconUrl) return;
        next[iconId] = iconUrl;
      });
      setAppIconUrlById(next);
    });
    return () => {
      active = false;
    };
  }, [tenantId]);

  useEffect(() => {
    let active = true;
    if (!tenantId) return undefined;
    fetchMergedServiceTemplates(tenantId).then((res) => {
      if (!active || !res.ok) return;
      setServiceTemplates(res.rows || []);
    });
    return () => {
      active = false;
    };
  }, [tenantId]);

  useEffect(() => {
    let active = true;
    if (!tenantId) return undefined;
    fetchTenantPdfTemplates(tenantId).then((res) => {
      if (!active || !res.ok) return;
      const { template } = resolvePdfTemplateForRenderer({
        documentType: 'quotation',
        templateDoc: res.byType?.quotation,
      });
      const parsed = parseQuotationTerms(template?.termsAndConditions || DEFAULT_QUOTATION_TERMS);
      if (parsed.length) {
        setDefaultQuotationTerms(parsed);
        setQuotationTerms(cloneQuotationTerms(parsed));
      }
    });
    return () => {
      active = false;
    };
  }, [tenantId]);

  const expiryDate = useMemo(() => addWeeks(quotationDate, validityWeeks), [quotationDate, validityWeeks]);
  const resolvedQuotationTerms = useMemo(
    () => serializeQuotationTerms(quotationTerms, expiryDate),
    [quotationTerms, expiryDate],
  );
  const companyTypeIcon = useMemo(
    () => systemAssets?.icon_main_company?.iconUrl || '/company.png',
    [systemAssets],
  );
  const individualTypeIcon = useMemo(
    () => systemAssets?.icon_main_individual?.iconUrl || '/individual.png',
    [systemAssets],
  );
  const selectedQuotation = useMemo(
    () => rows.find((item) => item.id === selectedQuotationId) || rows[0] || null,
    [rows, selectedQuotationId],
  );
  const subtotalAmount = useMemo(
    () => items.reduce((sum, item) => sum + ((Number(item.qty) || 0) * (Number(item.amount) || 0)), 0),
    [items],
  );
  const discountAmount = useMemo(() => {
    if (!discountEnabled) return 0;
    const rawValue = Math.max(0, Number(discountValue || 0));
    if (!Number.isFinite(rawValue) || rawValue <= 0) return 0;
    if (discountMode === 'percent') {
      const pct = Math.min(100, rawValue);
      return Math.min(subtotalAmount, (subtotalAmount * pct) / 100);
    }
    return Math.min(subtotalAmount, rawValue);
  }, [discountEnabled, discountMode, discountValue, subtotalAmount]);
  const totalAmount = Math.max(0, subtotalAmount - discountAmount);
  const isActionBusy = isSaving || isLoading || actionOverlay.open;
  const serviceTemplateMap = useMemo(() => {
    const next = {};
    (serviceTemplates || []).forEach((row) => {
      const key = String(row?.id || '').trim();
      if (key) next[key] = row;
    });
    return next;
  }, [serviceTemplates]);
  const resolveServiceMeta = useCallback((applicationId) => {
    if (!applicationId) return null;
    return serviceTemplateMap[String(applicationId)] || null;
  }, [serviceTemplateMap]);
  const resolveItemIconUrl = useCallback((item) => {
    const preferredUrl = String(item?.iconUrl || '').trim();
    if (preferredUrl) return preferredUrl;
    const iconId = String(item?.iconId || '').trim();
    if (iconId && appIconUrlById[iconId]) return appIconUrlById[iconId];
    const serviceMeta = resolveServiceMeta(item?.applicationId);
    const metaIconUrl = String(serviceMeta?.iconUrl || '').trim();
    if (metaIconUrl) return metaIconUrl;
    const metaIconId = String(serviceMeta?.iconId || serviceMeta?.globalIconId || '').trim();
    if (metaIconId && appIconUrlById[metaIconId]) return appIconUrlById[metaIconId];
    return '/defaultIcons/documents.png';
  }, [appIconUrlById, resolveServiceMeta]);
  const resolveItemName = useCallback((item) => {
    const preferredName = String(item?.name || '').trim();
    if (preferredName) return preferredName;
    const serviceMeta = resolveServiceMeta(item?.applicationId);
    return serviceMeta?.name || serviceMeta?.label || serviceMeta?.iconName || item?.applicationId || 'Application';
  }, [resolveServiceMeta]);

  const pushStatus = (message, type = 'info') => {
    setStatus(message);
    setStatusType(type);
    window.requestAnimationFrame(() => {
      statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };
  const openConfirm = useCallback((opts) => {
    setConfirmDialog({ open: true, isDangerous: false, ...opts });
  }, []);
  const closeConfirm = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  }, []);
  const openCancelReasonDialog = useCallback((quotation) => {
    setCancelReasonDialog({
      open: true,
      quotation,
      reason: '',
      error: '',
    });
  }, []);
  const closeCancelReasonDialog = useCallback(() => {
    setCancelReasonDialog({
      open: false,
      quotation: null,
      reason: '',
      error: '',
    });
  }, []);
  const closeActionOverlay = useCallback(() => {
    setActionOverlay((prev) => ({ ...prev, open: false }));
  }, []);
  const focusQuotationDateControls = useCallback(() => {
    const target = validityFieldRef.current || quotationDateFieldRef.current;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus?.();
  }, []);

  const validateManualMobile = useCallback((mobileValue, countryIso2, fieldLabel = 'Mobile number') => (
    getMobileNumberValidationMessage(mobileValue, countryIso2, { fieldLabel })
  ), []);
  const validateManualEmail = useCallback((emailValue, fieldLabel = 'Email address') => {
    const normalized = String(emailValue || '').trim().toLowerCase();
    if (!normalized) return '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? '' : `${fieldLabel} format is invalid.`;
  }, []);

  const updateManualClient = useCallback((updater) => {
    setManualClient((prev) => syncManualClientContacts(typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const handleQuotationTermChange = useCallback((termId, nextText) => {
    setQuotationTerms((prev) => prev.map((term) => {
      if (term.id !== termId || term.type === 'expiry') return term;
      return {
        ...term,
        text: nextText,
      };
    }));
  }, []);

  const appendQuotationTerm = useCallback(() => {
    setQuotationTerms((prev) => (
      prev.length >= 5
        ? prev
        : [...prev, createQuotationTerm({ text: '' })]
    ));
  }, []);

  const removeQuotationTerm = useCallback((termId) => {
    setQuotationTerms((prev) => prev.filter((term) => term.id !== termId));
  }, []);

  const resetComposer = useCallback(async () => {
    setQuotationDate(new Date().toISOString().slice(0, 10));
    setValidityWeeks(2);
    setQuotationDescription('');
    setClientMode('manual');
    setExistingClient(null);
    setSelectedDependents([]);
    setManualClient(createEmptyManualClient());
    setItems([]);
    setItemBuilder(createEmptyItemBuilder());
    setItemBuilderError('');
    setStatus('');
    setQuotationTerms(cloneQuotationTerms(defaultQuotationTerms));
    setIsInlineTemplateOpen(false);
    const nextRef = await previewDisplayDocumentRef(tenantId, 'quotation');
    setReference(nextRef);
  }, [defaultQuotationTerms, tenantId]);

  const handleAddItem = (service, overrides = {}) => {
    const alreadyExists = items.find((item) => item.applicationId === service?.id);
    if (alreadyExists) {
      setItemBuilderError(`"${service?.name || 'Application'}" is already in the list.`);
      pushStatus(`"${service?.name || 'Application'}" already exists. Increase quantity instead.`, 'error');
      return;
    }
    const resolvedDescription = normalizeLibraryDescription(overrides.description ?? service?.description ?? '');
    setItemBuilderError('');
    setItems((prev) => [...prev, {
      ...makeItem(service),
      qty: Math.max(1, Number(overrides.qty ?? 1) || 1),
      amount: Math.max(0, Number(overrides.amount ?? service?.clientCharge ?? 0) || 0),
      description: resolvedDescription,
    }]);
  };

  const handleSelectApplication = (service) => {
    const duplicateExists = items.some((item) => item.applicationId === service?.id);
    if (duplicateExists) {
      setItemBuilderError(`"${service?.name || 'Application'}" is already selected.`);
      return;
    }
    setItemBuilderError('');
    const resolvedCharge = Number(service?.clientCharge || 0);
    setItemBuilder({
      service,
      qty: 1,
      amount: resolvedCharge > 0 ? formatAmountInputValue(resolvedCharge) : '',
      description: normalizeLibraryDescription(service?.description || ''),
    });
  };

  const handleAddBuiltItem = () => {
    if (!itemBuilder.service) {
      setItemBuilderError('Select an application first.');
      pushStatus('Select an application first.', 'error');
      return;
    }
    setItemBuilderError('');
    handleAddItem(itemBuilder.service, {
      qty: itemBuilder.qty,
      amount: itemBuilder.amount,
      description: itemBuilder.description,
    });
    setItemBuilder(createEmptyItemBuilder());
  };



  const handleItemChange = (rowId, field, value) => {
    setItems((prev) => prev.map((item) => {
      if (item.rowId !== rowId) return item;
      if (field === 'qty') return { ...item, qty: Math.max(1, Number(value) || 1) };
      if (field === 'amount') return { ...item, amount: Math.max(0, Number(value) || 0) };
      return { ...item, [field]: value };
    }));
  };

  const adjustItemQty = (rowId, delta) => {
    setItems((prev) => prev.map((item) => {
      if (item.rowId !== rowId) return item;
      return {
        ...item,
        qty: Math.max(1, (Number(item.qty) || 1) + delta),
      };
    }));
  };

  const removeItem = (rowId) => {
    setItems((prev) => prev.filter((item) => item.rowId !== rowId));
    setOpenDescriptionRows((prev) => {
      if (!prev[rowId]) return prev;
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  const moveItemRow = useCallback((sourceRowId, targetRowId) => {
    if (!sourceRowId || !targetRowId || sourceRowId === targetRowId) return;
    setItems((prev) => {
      const sourceIndex = prev.findIndex((item) => item.rowId === sourceRowId);
      const targetIndex = prev.findIndex((item) => item.rowId === targetRowId);
      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return prev;
      const next = [...prev];
      const [movedItem] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, movedItem);
      return next;
    });
  }, []);

  const toggleDescriptionRow = useCallback((rowId) => {
    setOpenDescriptionRows((prev) => ({
      ...prev,
      [rowId]: !prev[rowId],
    }));
  }, []);

  const addDependentChip = (item) => {
    if (!item?.id || selectedDependents.some((dep) => dep.id === item.id)) return;
    setSelectedDependents((prev) => [...prev, item]);
  };

  const removeDependentChip = (id) => {
    setSelectedDependents((prev) => prev.filter((item) => item.id !== id));
  };

  const stripUndefined = (obj) =>
    Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== undefined && v !== null));

  const buildQuotationPayload = (overrides = {}) => {
    const filledMobileContacts = manualClient.mobileContacts.filter((contact) => String(contact.value || '').trim());
    const filledEmailContacts = manualClient.emailContacts.filter((contact) => String(contact.value || '').trim());
    const primaryMobileContact = filledMobileContacts[0] || manualClient.mobileContacts[0] || createManualMobileContact();
    const primaryEmailContact = filledEmailContacts[0] || manualClient.emailContacts[0] || createManualEmailContact();
    const clientSnapshotRaw = clientMode === 'existing'
      ? {
          id: existingClient?.id || '',
          name: existingClient?.fullName || existingClient?.tradeName || '',
          tradeName: existingClient?.tradeName || '',
          email: existingClient?.primaryEmail || '',
          type: existingClient?.type || '',
        }
      : {
          id: '',
          name: manualClient.legalName,
          brandName: manualClient.brandName,
          contactPersonName: manualClient.contactPersonName,
          email: primaryEmailContact.value || '',
          mobile: primaryMobileContact.value || '',
          mobileCountryIso2: primaryMobileContact.countryIso2 || DEFAULT_COUNTRY_PHONE_ISO2,
          mobileDialCode: findCountryPhoneOption(primaryMobileContact.countryIso2 || DEFAULT_COUNTRY_PHONE_ISO2)?.dialCode || '',
          mobileContacts: filledMobileContacts.map((contact) => ({
            value: contact.value,
            countryIso2: contact.countryIso2,
            dialCode: findCountryPhoneOption(contact.countryIso2)?.dialCode || '',
            whatsAppEnabled: Boolean(contact.whatsAppEnabled),
          })),
          emailContacts: filledEmailContacts.map((contact) => ({
            value: contact.value,
            emailEnabled: contact.emailEnabled !== false,
          })),
          emirate: manualClient.emirate,
          address: manualClient.address,
          type: manualClient.clientType,
        };
    const clientSnapshot = stripUndefined(clientSnapshotRaw);

    return {
      displayRef: reference,
      quoteDate: quotationDate,
      description: normalizeLibraryDescription(quotationDescription),
      validityWeeks: Number(validityWeeks),
      expiryDate,
      termsAndConditions: resolvedQuotationTerms,
      termsTemplateLines: serializeQuotationTermTemplates(quotationTerms),
      clientMode,
      clientId: clientMode === 'existing' ? (existingClient?.id || null) : null,
      dependentIds: selectedDependents.map((item) => item.id),
      dependentNames: selectedDependents.map((item) => item.fullName || item.tradeName || item.displayClientId || ''),
      clientSnapshot,
      items: items.map((item) => ({
        applicationId: item.applicationId || '',
        description: item.description || '',
        qty: Number(item.qty) || 1,
        amount: Number(item.amount) || 0,
        lineTotal: (Number(item.qty) || 0) * (Number(item.amount) || 0),
      })),
      subtotalAmount,
      discountEnabled,
      discountMode,
      discountValue: discountEnabled ? Number(discountValue || 0) : 0,
      discountAmount,
      totalAmount,
      status: 'generated',
      sourceQuotationId: null,
      cancellationReason: null,
      acceptedAt: null,
      createdBy: user?.uid || '',
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  };

  const validateComposer = useCallback(() => {
    if (!reference) return 'Quotation reference is missing.';
    if (!quotationDate) return 'Quotation date is required.';
    if (Number(validityWeeks) < 1 || Number(validityWeeks) > 8) return 'Validity must be between 1 and 8 weeks.';
    if (items.length === 0) return 'Add at least one application.';
    const zeroAmountItem = items.find((item) => (Number(item.amount) || 0) <= 0);
    if (zeroAmountItem) return `Amount must be greater than zero for "${zeroAmountItem.name || 'Application'}".`;
    if (clientMode === 'existing' && !existingClient?.id) return 'Select an existing client.';
    if (clientMode === 'manual') {
      if (!manualClient.legalName.trim()) return manualClient.clientType === 'individual' ? 'Name is required.' : 'Company legal name is required.';
      const filledMobileContacts = manualClient.mobileContacts.filter((contact) => String(contact.value || '').trim());
      if (filledMobileContacts.length === 0) {
        return 'At least one mobile number is required.';
      }
      for (let index = 0; index < manualClient.mobileContacts.length; index += 1) {
        const contact = manualClient.mobileContacts[index];
        const normalized = String(contact.value || '').trim();
        const shouldValidate = index === 0 || normalized;
        if (!shouldValidate) continue;
        const nextError = validateManualMobile(contact.value, contact.countryIso2, `Mobile number ${index + 1}`);
        if (nextError) return nextError;
      }

      for (let index = 0; index < manualClient.emailContacts.length; index += 1) {
        const contact = manualClient.emailContacts[index];
        const nextError = validateManualEmail(contact.value, `Email ${index + 1}`);
        if (nextError) return nextError;
      }
    }
    return '';
  }, [clientMode, existingClient?.id, items, manualClient.clientType, manualClient.emailContacts, manualClient.legalName, manualClient.mobileContacts, quotationDate, reference, validityWeeks, validateManualEmail, validateManualMobile]);

  const buildPdfData = (quotation) => ({
    txId: quotation.displayRef,
    date: quotation.quoteDate,
    expiryDate: quotation.expiryDate,
    termsAndConditions: quotation.termsAndConditions || resolveStoredQuotationTerms(quotation.termsTemplateLines, quotation.expiryDate),
    recipientName: quotation.clientSnapshot?.name || quotation.clientSnapshot?.tradeName || 'Client',
    amount: quotation.totalAmount,
    subtotalAmount: quotation.subtotalAmount ?? quotation.totalAmount,
    discountAmount: quotation.discountAmount ?? 0,
    description: quotation.description || 'Quotation',
    items: (quotation.items || []).map((item) => ({
      name: resolveItemName(item),
      qty: item.qty,
      price: item.amount,
      total: item.lineTotal,
    })),
  });

  const executeSaveQuotation = async () => {
    setIsSaving(true);
    try {
      // Generate the real document reference only at final submission.
      const finalReference = await generateDisplayDocumentRef(tenantId, 'quotation');
      const quotationId = toSafeDocId(finalReference, 'quotation');
      const payload = buildQuotationPayload({
        displayRef: finalReference,
      });
      const res = await upsertTenantQuotation(tenantId, quotationId, payload);

      if (res.ok) {
        await createSyncEvent({
          tenantId,
          eventType: 'create',
          entityType: 'quotation',
          entityId: quotationId,
          changedFields: Object.keys(payload),
          createdBy: user?.uid,
        });
        await sendUniversalNotification({
          tenantId,
          topic: 'documents',
          subTopic: 'quotation',
          type: 'create',
          title: 'Quotation Generated',
          message: `${finalReference} was generated successfully.`,
          createdBy: user?.uid,
          routePath: `/t/${tenantId}/quotations`,
          actionPresets: ['view'],
          entityType: 'quotation',
          entityId: quotationId,
          entityLabel: finalReference,
          pageKey: 'quotations',
        });
        pushStatus(`Quotation ${finalReference} generated.`, 'success');
        await loadData();
        setSelectedQuotationId(quotationId);
        setActiveView('existing');
        await resetComposer();
      } else {
        pushStatus(res.error || 'Failed to save quotation.', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const saveQuotation = () => {
    const validationError = validateComposer();
    if (validationError) {
      pushStatus(validationError, 'error');
      return;
    }

    openConfirm({
      title: 'Generate Quotation?',
      message: `Generate quotation ${reference} now?\n\nPlease confirm before continuing.`,
      confirmText: 'Generate',
      cancelText: 'Review Again',
      onConfirm: async () => {
        closeConfirm();
        await executeSaveQuotation();
      },
      onCancel: closeConfirm,
    });
  };

  const updateExistingQuotation = async (quotationId, nextPayload) => {
    const res = await upsertTenantQuotation(tenantId, quotationId, nextPayload);
    if (res.ok) {
      await loadData();
      setSelectedQuotationId(quotationId);
    }
    return res;
  };

  const executeCloneDraft = async (quotation) => {
    if (!quotation) return;
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setActionOverlay({
      open: true,
      kind: 'process',
      title: 'Preparing Clone Draft',
      subtitle: 'Loading quotation details into create form without generating a new quotation.',
      status: 'Preparing draft...',
    });
    try {
      const nextRef = await previewDisplayDocumentRef(tenantId, 'quotation');
      const snapshot = quotation.clientSnapshot || {};
      const nextClientMode = quotation.clientMode === 'existing' || quotation.clientId ? 'existing' : 'manual';

      const dependentIds = Array.isArray(quotation.dependentIds) ? quotation.dependentIds : [];
      const dependentNames = Array.isArray(quotation.dependentNames) ? quotation.dependentNames : [];
      setSelectedDependents(
        dependentIds.map((id, index) => ({
          id,
          fullName: dependentNames[index] || '',
          tradeName: dependentNames[index] || '',
        })),
      );

      if (nextClientMode === 'existing') {
        setClientMode('existing');
        setExistingClient({
          id: quotation.clientId || snapshot.id || '',
          fullName: snapshot.name || '',
          tradeName: snapshot.tradeName || '',
          primaryEmail: snapshot.email || '',
          type: snapshot.type || '',
        });
        setManualClient(createEmptyManualClient());
      } else {
        const rawMobileContacts = Array.isArray(snapshot.mobileContacts) ? snapshot.mobileContacts : [];
        const rawEmailContacts = Array.isArray(snapshot.emailContacts) ? snapshot.emailContacts : [];
        setClientMode('manual');
        setExistingClient(null);
        setManualClient(syncManualClientContacts({
          clientType: snapshot.type === 'individual' ? 'individual' : 'company',
          legalName: snapshot.name || '',
          brandName: snapshot.brandName || '',
          contactPersonName: snapshot.contactPersonName || '',
          primaryMobile: snapshot.mobile || '',
          primaryMobileCountry: snapshot.mobileCountryIso2 || DEFAULT_COUNTRY_PHONE_ISO2,
          primaryEmail: snapshot.email || '',
          emirate: snapshot.emirate || '',
          address: snapshot.address || '',
          mobileContacts: rawMobileContacts.length
            ? rawMobileContacts.map((contact) => createManualMobileContact({
              value: contact?.value || '',
              countryIso2: contact?.countryIso2 || DEFAULT_COUNTRY_PHONE_ISO2,
              whatsAppEnabled: contact?.whatsAppEnabled !== false,
            }))
            : [createManualMobileContact({
              value: snapshot.mobile || '',
              countryIso2: snapshot.mobileCountryIso2 || DEFAULT_COUNTRY_PHONE_ISO2,
            })],
          emailContacts: rawEmailContacts.length
            ? rawEmailContacts.map((contact) => createManualEmailContact({
              value: contact?.value || '',
              emailEnabled: contact?.emailEnabled !== false,
            }))
            : [createManualEmailContact({
              value: snapshot.email || '',
            })],
        }));
      }

      const hydratedTerms = Array.isArray(quotation.termsTemplateLines) && quotation.termsTemplateLines.length
        ? quotation.termsTemplateLines.map((term) => createQuotationTerm({
          type: term?.type === 'expiry' ? 'expiry' : 'custom',
          text: term?.type === 'expiry' ? '' : String(term?.text || ''),
          templateText: term?.type === 'expiry' ? String(term?.text || '') : '',
        }))
        : parseQuotationTerms(quotation.termsAndConditions || DEFAULT_QUOTATION_TERMS);

      setReference(nextRef);
      setQuotationDate(quotation.quoteDate || new Date().toISOString().slice(0, 10));
      setValidityWeeks(Math.max(1, Number(quotation.validityWeeks) || 2));
      setQuotationDescription(normalizeLibraryDescription(quotation.description || ''));
      setQuotationTerms(hydratedTerms.length ? hydratedTerms : cloneQuotationTerms(defaultQuotationTerms));
      setItems((quotation.items || []).map((item, index) => ({
        rowId: `${item?.applicationId || item?.name || 'row'}-${Date.now()}-${index}`,
        applicationId: item?.applicationId || '',
        name: item?.name || resolveServiceMeta(item?.applicationId)?.name || '',
        iconId: item?.iconId || resolveServiceMeta(item?.applicationId)?.iconId || resolveServiceMeta(item?.applicationId)?.globalIconId || '',
        iconUrl: item?.iconUrl || resolveServiceMeta(item?.applicationId)?.iconUrl || '',
        description: item?.description || '',
        qty: Math.max(1, Number(item?.qty) || 1),
        amount: Math.max(0, Number(item?.amount) || 0),
      })));
      setDiscountEnabled(Boolean(quotation.discountEnabled));
      setDiscountMode(quotation.discountMode === 'percent' ? 'percent' : 'amount');
      setDiscountValue(quotation.discountEnabled ? String(quotation.discountValue ?? '') : '');
      setItemBuilder(createEmptyItemBuilder());
      setItemBuilderError('');
      setOpenDescriptionRows({});
      setStatus('');
      setActiveView('create');
      pushStatus(`Clone loaded as draft (${nextRef}) in create form. No quotation is generated yet.`, 'success');
    } finally {
      closeActionOverlay();
      actionLockRef.current = false;
    }
  };

  const handleClone = (quotation) => {
    if (!quotation || actionLockRef.current || actionOverlay.open || isSaving) return;
    openConfirm({
      title: 'Clone As Draft?',
      message: `Load ${quotation.displayRef} into create form as a draft?\n\nNo quotation will be created until you click Generate.`,
      confirmText: 'Load Draft',
      cancelText: 'Cancel',
      onConfirm: async () => {
        closeConfirm();
        await executeCloneDraft(quotation);
      },
      onCancel: closeConfirm,
    });
  };

  const executeExtendQuotation = async (quotation) => {
    const nextRef = await generateDisplayDocumentRef(tenantId, 'quotation');
    const nextId = toSafeDocId(nextRef, 'quotation');
    const expireRes = await updateExistingQuotation(quotation.id, { status: 'expired' });
    if (!expireRes.ok) {
      pushStatus(expireRes.error || 'Failed to expire the current quotation.', 'error');
      return;
    }
    const nextPayload = {
      ...quotation,
      displayRef: nextRef,
      sourceQuotationId: quotation.id,
      quoteDate: new Date().toISOString().slice(0, 10),
      expiryDate: addWeeks(new Date().toISOString().slice(0, 10), quotation.validityWeeks || 2),
      termsAndConditions: resolveStoredQuotationTerms(
        quotation.termsTemplateLines,
        addWeeks(new Date().toISOString().slice(0, 10), quotation.validityWeeks || 2),
      ) || quotation.termsAndConditions || '',
      createdAt: new Date().toISOString(),
      updatedAt: null,
      status: 'generated',
      cancellationReason: null,
      acceptedAt: null,
      createdBy: user?.uid || quotation.createdBy || '',
    };
    const createRes = await upsertTenantQuotation(tenantId, nextId, nextPayload);
    pushStatus(createRes.ok ? `Quotation extended as ${nextRef}.` : (createRes.error || 'Failed to create the extended quotation.'), createRes.ok ? 'success' : 'error');
    if (createRes.ok) {
      await loadData();
      setSelectedQuotationId(nextId);
    }
  };

  const handleExtend = (quotation) => {
    if (!quotation) return;
    openConfirm({
      title: 'Extend Quotation?',
      message: `Create a new extended quotation from ${quotation.displayRef} and mark the current one as expired?`,
      confirmText: 'Extend',
      cancelText: 'Cancel',
      onConfirm: async () => {
        closeConfirm();
        await executeExtendQuotation(quotation);
      },
      onCancel: closeConfirm,
    });
  };

  const confirmCancelQuotation = async () => {
    const quotation = cancelReasonDialog.quotation;
    if (!quotation) return;
    const normalizedReason = toProperText(cancelReasonDialog.reason);
    if (!normalizedReason) {
      setCancelReasonDialog((prev) => ({ ...prev, error: 'Cancellation reason is required.' }));
      return;
    }
    if (normalizedReason.length < 30) {
      setCancelReasonDialog((prev) => ({ ...prev, error: 'Cancellation reason must be at least 30 characters.' }));
      return;
    }
    closeCancelReasonDialog();
    const res = await updateExistingQuotation(quotation.id, {
      status: 'canceled',
      cancellationReason: normalizedReason,
      canceledAt: new Date().toISOString(),
      canceledBy: user?.uid || '',
    });
    pushStatus(res.ok ? `Quotation ${quotation.displayRef} canceled.` : (res.error || 'Failed to cancel quotation.'), res.ok ? 'success' : 'error');
  };

  const handleCancel = (quotation) => {
    if (!quotation) return;
    openCancelReasonDialog(quotation);
  };

  const executeAcceptQuotation = async (quotation) => {
    if (!quotation || isSaving) return;
    const normalizedStatus = String(quotation.status || '').trim().toLowerCase();
    if (normalizedStatus === 'canceled' || normalizedStatus === 'converted') {
      pushStatus('Quotation cannot be converted in its current status.', 'error');
      return;
    }

    navigate(`/t/${tenantId}/proforma-invoices`, {
      state: {
        fromQuotation: true,
        sourceQuotationId: quotation.id,
        items: (quotation.items || []).map((item) => ({
          ...item,
          govCharge: 0,
        })),
        description: quotation.description || '',
        clientSnapshot: quotation.clientSnapshot || {},
        clientMode: quotation.clientId ? 'existing' : 'manual',
        existingClientId: quotation.clientId || '',
        selectedDependents: quotation.dependentIds || [],
        proformaDate: new Date().toISOString().split('T')[0],
      }
    });
  };

  const handleAccept = (quotation) => {
    if (!quotation) return;
    if (!quotation.clientId) {
      setQuickClientModal({ open: true, quotation });
      return;
    }
    openConfirm({
      title: 'Move to Proforma Create Form?',
      message: `Open ${quotation.displayRef} in Proforma create form with prefilled details?\n\nNo proforma will be created until you click Generate in Proforma page.`,
      confirmText: 'Open Create Form',
      cancelText: 'Not Now',
      onConfirm: async () => {
        closeConfirm();
        await executeAcceptQuotation(quotation);
      },
      onCancel: closeConfirm,
    });
  };

  const executeDownloadPdf = async (quotation) => {
    if (!quotation || actionLockRef.current) return;
    actionLockRef.current = true;
    setActionOverlay({
      open: true,
      kind: 'pdf',
      title: 'Generating Quotation PDF',
      subtitle: 'Preparing the latest quotation layout before download.',
      status: 'Rendering PDF...',
    });
    try {
      const pdfRes = await generateTenantPdf({
        tenantId,
        documentType: 'quotation',
        data: buildPdfData(quotation),
        save: true,
      });
      pushStatus(pdfRes.ok ? `PDF generated for ${quotation.displayRef}.` : (pdfRes.error || 'Failed to generate PDF.'), pdfRes.ok ? 'success' : 'error');
    } finally {
      closeActionOverlay();
      actionLockRef.current = false;
    }
  };

  const handleDownloadPdf = (quotation) => {
    if (!quotation || actionLockRef.current || actionOverlay.open || isSaving) return;
    openConfirm({
      title: 'Download PDF?',
      message: `Generate and download PDF for ${quotation.displayRef}?`,
      confirmText: 'Download',
      cancelText: 'Cancel',
      onConfirm: async () => {
        closeConfirm();
        await executeDownloadPdf(quotation);
      },
      onCancel: closeConfirm,
    });
  };

  const executeEmailQuotation = async (quotation) => {
    if (!quotation || actionLockRef.current) return;
    actionLockRef.current = true;
    const email = String(quotation.clientSnapshot?.email || '').trim().toLowerCase();
    if (!email) {
      pushStatus('No recipient email is available for this quotation.', 'error');
      actionLockRef.current = false;
      return;
    }
    setActionOverlay({
      open: true,
      kind: 'email',
      title: 'Sending Quotation Email',
      subtitle: 'Generating PDF and delivering it to the client mailbox.',
      status: 'Sending Email...',
    });
    try {
      const pdfRes = await generateTenantPdf({
        tenantId,
        documentType: 'quotation',
        data: buildPdfData(quotation),
        save: false,
        returnBase64: true,
      });
      if (!pdfRes.ok) {
        pushStatus(pdfRes.error || 'Failed to generate quotation PDF for email.', 'error');
        return;
      }
      const emailRes = await sendTenantDocumentEmail(tenantId, email, 'quotation', pdfRes.base64, buildPdfData(quotation));
      pushStatus(emailRes.ok ? `Quotation emailed to ${email}.` : (emailRes.error || 'Failed to send quotation email.'), emailRes.ok ? 'success' : 'error');
    } finally {
      closeActionOverlay();
      actionLockRef.current = false;
    }
  };

  const handleEmail = (quotation) => {
    if (!quotation || actionLockRef.current || actionOverlay.open || isSaving) return;
    openConfirm({
      title: 'Send Quotation Email?',
      message: `Send ${quotation.displayRef} to the client email now?`,
      confirmText: 'Send Email',
      cancelText: 'Cancel',
      onConfirm: async () => {
        closeConfirm();
        await executeEmailQuotation(quotation);
      },
      onCancel: closeConfirm,
    });
  };

  return (
    <PageShell
      pageID="quotations"
      iconKey="quotations"
      title="Quotation Workspace"
      subtitle="Create, review, and manage client quotations before they move into proforma conversion."
      eyebrow="Quotation"
      widthPreset="data"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveView('create')}
              className={`flex h-[3.5rem] min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${activeView === 'create'
                ? activeTabClass
                : 'bg-[var(--c-panel)] text-[var(--c-muted)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_80%,transparent)]'}`}
            >
              <Plus strokeWidth={1.5} className="h-4 w-4" />
              Create Quotation
            </button>
            <button
              type="button"
              onClick={() => setActiveView('existing')}
              className={`flex h-[3.5rem] min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${activeView === 'existing'
                ? activeTabClass
                : 'bg-[var(--c-panel)] text-[var(--c-muted)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_80%,transparent)]'}`}
            >
              <FileText strokeWidth={1.5} className="h-4 w-4" />
              Existing Quotations
            </button>
          </div>
        </div>

        {status ? <div ref={statusRef} className={`rounded-2xl border px-4 py-3 text-sm font-bold ${statusType === 'error' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>{status}</div> : null}

        {activeView === 'create' ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)_220px]">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Quotation Date<input ref={quotationDateFieldRef} type="date" className={inputClass} style={{ colorScheme: 'light' }} value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} /></label>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Validity Duration<select ref={validityFieldRef} className={selectClass} value={validityWeeks} onChange={(e) => setValidityWeeks(Number(e.target.value))}>{[1,2,3,4,5,6,7,8].map((week) => <option key={week} value={week}>{week} Week{week > 1 ? 's' : ''}</option>)}</select><p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">Expires on {expiryDate}</p></label>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Client Source</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setClientMode('manual');
                      setExistingClient(null);
                      setSelectedDependents([]);
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${clientMode === 'manual' ? activeChoiceCardClass : 'border-[var(--c-border)] bg-[var(--c-panel)]'}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${clientMode === 'manual' ? activeChoiceIconClass : 'bg-[var(--c-surface)] text-[var(--c-accent)]'}`}>
                      <UserPlus strokeWidth={1.5} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-[var(--c-text)]">New Client</span>
                      <span className="block text-[10px] font-bold uppercase text-[var(--c-muted)]">Enter details manually</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClientMode('existing');
                      setExistingClient(null);
                      setSelectedDependents([]);
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${clientMode === 'existing' ? activeChoiceCardClass : 'border-[var(--c-border)] bg-[var(--c-panel)]'}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${clientMode === 'existing' ? activeChoiceIconClass : 'bg-[var(--c-surface)] text-[var(--c-accent)]'}`}>
                      <Users strokeWidth={1.5} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-[var(--c-text)]">Existing Client</span>
                      <span className="block text-[10px] font-bold uppercase text-[var(--c-muted)]">Select from saved list</span>
                    </span>
                  </button>
                </div>
              </div>

              {clientMode === 'existing' ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">
                      Existing Client
                    </p>
                    <div className="mt-1">
                      <ClientSearchField
                        onSelect={(item) => {
                          setExistingClient(item);
                          setSelectedDependents([]);
                        }}
                        selectedId={existingClient?.id}
                        filterType="parent"
                      />
                    </div>
                  </div>
                  {existingClient ? (
                    <>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">
                          Add Dependents
                        </p>
                        <div className="mt-1">
                          <ClientSearchField
                            onSelect={addDependentChip}
                            selectedId={null}
                            filterType="dependent"
                            parentId={existingClient.id}
                          />
                        </div>
                      </div>
                      {selectedDependents.length ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedDependents.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => removeDependentChip(item.id)}
                              className="rounded-full border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-1 text-xs font-bold text-[var(--c-text)]"
                            >
                              {item.fullName || item.tradeName || item.displayClientId} ×
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Client Type</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setManualClient((prev) => ({ ...prev, clientType: 'company' }))}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${manualClient.clientType === 'company' ? activeChoiceCardClass : 'border-[var(--c-border)] bg-[var(--c-panel)]'}`}
                      >
                        <img src={companyTypeIcon} alt="Company" className="h-10 w-10 rounded-xl object-cover" />
                        <div>
                          <p className="text-sm font-black text-[var(--c-text)]">Company</p>
                          <p className="text-[10px] font-bold uppercase text-[var(--c-muted)]">Default quotation client</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualClient((prev) => ({ ...prev, clientType: 'individual' }))}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${manualClient.clientType === 'individual' ? activeChoiceCardClass : 'border-[var(--c-border)] bg-[var(--c-panel)]'}`}
                      >
                        <img src={individualTypeIcon} alt="Individual" className="h-10 w-10 rounded-xl object-cover" />
                        <div>
                          <p className="text-sm font-black text-[var(--c-text)]">Individual</p>
                          <p className="text-[10px] font-bold uppercase text-[var(--c-muted)]">Switch naming to person flow</p>
                        </div>
                      </button>
                    </div>
                  </div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">
                    {manualClient.clientType === 'individual' ? 'Name' : 'Company Legal Name'}
                    <InputActionField
                      name="manual-legal-name"
                      value={manualClient.legalName}
                      onValueChange={(value) => updateManualClient((prev) => ({ ...prev, legalName: value }))}
                      forceUppercase
                      className="mt-1 w-full"
                      inputClassName="text-sm font-bold"
                    />
                  </label>
                  {manualClient.clientType === 'company' && manualClient.legalName.trim() ? (
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">
                      Brand Name (Optional)
                      <InputActionField
                        name="manual-brand-name"
                        value={manualClient.brandName}
                        onValueChange={(value) => updateManualClient((prev) => ({ ...prev, brandName: value }))}
                        forceUppercase
                        className="mt-1 w-full"
                        inputClassName="text-sm font-bold"
                      />
                    </label>
                  ) : null}
                  {manualClient.clientType === 'company' ? (
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">
                      Primary Contact Person (Optional)
                      <InputActionField
                        name="manual-contact-person-name"
                        value={manualClient.contactPersonName}
                        onValueChange={(value) => updateManualClient((prev) => ({ ...prev, contactPersonName: value }))}
                        forceUppercase
                        className="mt-1 w-full"
                        inputClassName="text-sm font-bold"
                      />
                    </label>
                  ) : null}
                  <div className="space-y-2">
                    <MobileContactsField
                      label="Mobile Numbers"
                      contacts={manualClient.mobileContacts}
                      onChange={(contacts) => updateManualClient((prev) => ({ ...prev, mobileContacts: contacts }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <EmailContactsField
                      label="Email Addresses"
                      contacts={manualClient.emailContacts}
                      onChange={(contacts) => updateManualClient((prev) => ({
                        ...prev,
                        emailContacts: contacts.map((contact) => ({
                          ...contact,
                          emailEnabled: prev.emailContacts.find((row) => row.id === contact.id)?.emailEnabled !== false,
                        })),
                      }))}
                    />
                  </div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">
                    Emirate
                    <div className="mt-1">
                      <EmirateSelect
                        value={manualClient.emirate}
                        onChange={(value) => updateManualClient((prev) => ({ ...prev, emirate: value }))}
                      />
                    </div>
                  </label>
                  <div className="md:col-span-2">
                    <AddressField
                      value={manualClient.address}
                      onValueChange={(value) => updateManualClient((prev) => ({ ...prev, address: value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--c-accent)_14%,transparent)] text-[var(--c-accent)]">
                  <FileText strokeWidth={1.5} className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-[var(--c-text)]">Description</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Purpose of this quotation</p>
                </div>
              </div>

              <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">
                Description
                <textarea
                  className={`${inputClass} min-h-[84px] resize-y`}
                  value={quotationDescription}
                  onChange={(e) => setQuotationDescription(e.target.value)}
                  onBlur={() => setQuotationDescription((prev) => normalizeLibraryDescription(prev))}
                />
              </label>
            </div>

            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--c-accent)_14%,transparent)] text-[var(--c-accent)]">
                    <Tags strokeWidth={1.5} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-[var(--c-text)]">Add Services</p>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Build line items</p>
                  </div>
                </div>
              </div>

              <div className="order-2 space-y-2">
              <div className="grid gap-3 items-end"
                style={{
                  gridTemplateColumns: layoutMode === 'mini' ? '1fr' : 
                                       layoutMode === 'compact' ? 'minmax(200px, 1fr) auto' :
                                       layoutMode === 'standard' ? 'minmax(200px, 1fr) auto 100px 140px auto' :
                                       'minmax(200px, 1.9fr) 56px 132px 176px 132px'
                }}
              >
                <div className={layoutMode === 'compact' ? 'col-span-2' : ''}>
                  <p className="text-xs font-black uppercase tracking-wider text-[var(--c-muted)]">Application / Service</p>
                  <div className="mt-2">
                    <ServiceSearchField
                      onSelect={handleSelectApplication}
                      selectedId={itemBuilder.service?.id || null}
                      onCreateNew={null}
                      refreshKey={serviceRefreshKey}
                      variant="compact"
                    />
                  </div>
                </div>

                <div className={layoutMode === 'mini' ? 'flex justify-end' : ''}>
                  <p className="text-xs font-black uppercase tracking-wider text-[var(--c-muted)] opacity-0">New</p>
                  {!lockToUniversalApps ? (
                    <button
                      type="button"
                      onClick={() => setIsInlineTemplateOpen((prev) => !prev)}
                      className="mt-2 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
                      aria-label="Add new application template"
                    >
                      <Plus strokeWidth={1.5} className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Qty</label>
                  <InputActionField
                    type="number"
                    value={itemBuilder.qty}
                    onValueChange={(val) => setItemBuilder(prev => ({ ...prev, qty: Math.max(1, Number(val) || 1) }))}
                    className="w-full"
                    showPasteButton={false}
                  />
                </div>

                <label className="text-xs font-black uppercase tracking-wider text-[var(--c-muted)] whitespace-nowrap">
                  Unit Price
                  <div className="mt-2 flex h-10 w-full overflow-hidden items-center rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] pl-3 pr-2 focus-within:border-[var(--c-accent)] focus-within:ring-4 focus-within:ring-[var(--c-accent)]/5">
                    <DirhamIcon className="mr-3 h-4 w-4 shrink-0 text-[var(--c-muted)]" />
                    <input
                      type="number"
                      min={0}
                      className="no-spinner min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--c-text)] outline-none placeholder:text-[var(--c-muted)]"
                      value={itemBuilder.amount}
                      onChange={(event) => setItemBuilder((prev) => ({ ...prev, amount: event.target.value }))}
                      onBlur={(event) => setItemBuilder((prev) => ({
                        ...prev,
                        amount: event.target.value === '' ? '' : formatAmountInputValue(event.target.value),
                      }))}
                      placeholder="0.00"
                    />
                  </div>
                </label>

                <div className={layoutMode === 'compact' ? 'col-span-2 flex justify-end' : ''}>
                  <p className="text-xs font-black uppercase tracking-wider text-[var(--c-muted)] opacity-0 hidden sm:block">Add</p>
                  <button
                    type="button"
                    onClick={handleAddBuiltItem}
                    className={`mt-2 h-10 ${layoutMode === 'compact' ? 'w-[140px]' : 'w-full'} rounded-xl px-4 text-sm font-bold transition ${primaryActionClass}`}
                  >
                    Add
                  </button>
                </div>
              </div>
              {itemBuilderError ? (
                <p className="text-xs font-semibold text-rose-500">{itemBuilderError}</p>
              ) : null}
              </div>

              {!lockToUniversalApps ? (
                <QuickAddServiceTemplateModal
                  isOpen={isInlineTemplateOpen}
                  onClose={() => setIsInlineTemplateOpen(false)}
                  onCreated={(createdTemplate) => {
                    setServiceRefreshKey((prev) => prev + 1);
                    setItemBuilderError('');
                    setItemBuilder({
                      service: createdTemplate,
                      qty: 1,
                      amount: Number(createdTemplate.clientCharge || 0) > 0
                        ? formatAmountInputValue(createdTemplate.clientCharge || 0)
                        : '',
                      description: normalizeLibraryDescription(createdTemplate.description || ''),
                    });
                    pushStatus(`Application "${createdTemplate.name}" created.`, 'success');
                  }}
                />
              ) : null}

              <div className="order-1">
              {items.length ? (
                <div className="space-y-3">
                  {items.map((item, index) => {
                    const isDescriptionOpen = Boolean(openDescriptionRows[item.rowId]);
                    const hasDescription = Boolean(String(item.description || '').trim());
                    return (
                    <div
                      key={item.rowId}
                      draggable
                      onDragStart={() => {
                        setDraggedItemRowId(item.rowId);
                        setDragOverItemRowId(item.rowId);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (dragOverItemRowId !== item.rowId) setDragOverItemRowId(item.rowId);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        moveItemRow(draggedItemRowId, item.rowId);
                        setDraggedItemRowId('');
                        setDragOverItemRowId('');
                      }}
                      onDragEnd={() => {
                        setDraggedItemRowId('');
                        setDragOverItemRowId('');
                      }}
                      className={`rounded-2xl border bg-[var(--c-panel)] p-4 transition ${
                        dragOverItemRowId === item.rowId
                          ? 'border-[var(--c-accent)] ring-2 ring-[var(--c-accent)]/15'
                          : 'border-[var(--c-border)]'
                      }`}
                    >
                      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_112px_156px_46px]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              draggable
                              tabIndex={-1}
                              className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-lg text-[var(--c-muted)] transition hover:text-[var(--c-accent)] active:cursor-grabbing"
                              aria-label="Drag to reorder"
                            >
                              <GripVertical strokeWidth={1.5} className="h-4 w-4" />
                            </button>
                            <span className="rounded-md bg-[var(--c-surface)] px-1.5 py-0.5 text-[10px] font-black tracking-wider text-[var(--c-muted)]">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-[var(--c-border)] bg-white/80 p-1">
                              <img
                                src={resolveItemIconUrl(item)}
                                alt=""
                                className="h-full w-full rounded-[inherit] object-cover"
                                onError={(event) => {
                                  event.currentTarget.src = '/defaultIcons/documents.png';
                                }}
                              />
                            </div>
                            <p className="truncate text-sm font-black text-[var(--c-text)]">{resolveItemName(item)}</p>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleDescriptionRow(item.rowId)}
                              className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--c-muted)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
                            >
                              {isDescriptionOpen ? 'Hide Description' : 'Description'}
                            </button>
                            {!isDescriptionOpen ? (
                              hasDescription ? (
                                <p className="truncate text-xs font-semibold text-[var(--c-muted)]">
                                  {item.description}
                                </p>
                              ) : (
                                <p className="truncate text-xs font-semibold text-[var(--c-muted)]/80">
                                  No description
                                </p>
                              )
                            ) : null}
                          </div>
                          {isDescriptionOpen ? (
                            <div className="mt-2">
                              <textarea
                                rows={2}
                                value={item.description || ''}
                                onChange={(event) => handleItemChange(item.rowId, 'description', event.target.value)}
                                className="compact-field w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm font-semibold text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)]"
                              />
                            </div>
                          ) : null}
                        </div>
                        <label className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">
                          Quantity
                          <div className="mt-1 flex h-[46px] w-full overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] focus-within:border-[var(--c-accent)] focus-within:ring-4 focus-within:ring-[var(--c-accent)]/5">
                            <input
                              type="number"
                              min={1}
                              className="no-spinner min-w-0 flex-1 bg-transparent px-2 text-center text-sm font-bold text-[var(--c-text)] outline-none"
                              value={item.qty}
                              onChange={(e) => handleItemChange(item.rowId, 'qty', e.target.value)}
                            />
                            <div className="flex w-8 flex-col border-l border-[var(--c-border)]">
                              <button
                                type="button"
                                onClick={() => adjustItemQty(item.rowId, 1)}
                                className="flex h-1/2 items-center justify-center bg-[var(--c-panel)] text-[var(--c-muted)] transition hover:text-[var(--c-accent)]"
                                aria-label="Increase quantity"
                              >
                                <ChevronUp strokeWidth={1.5} className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => adjustItemQty(item.rowId, -1)}
                                className="flex h-1/2 items-center justify-center border-t border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)] transition hover:text-[var(--c-accent)]"
                                aria-label="Decrease quantity"
                              >
                                <ChevronDown strokeWidth={1.5} className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </label>
                        <label className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">
                          Amount
                          <div className="mt-1 flex h-[46px] w-full overflow-hidden items-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] pl-3 pr-2 focus-within:border-[var(--c-accent)] focus-within:ring-4 focus-within:ring-[var(--c-accent)]/5">
                            <DirhamIcon className="mr-3 h-4 w-4 shrink-0 text-[var(--c-muted)]" />
                            <input
                              type="number"
                              min={0}
                              className="no-spinner min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--c-text)] outline-none placeholder:text-[var(--c-muted)]"
                              value={item.amount}
                              onChange={(e) => handleItemChange(item.rowId, 'amount', e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        </label>
                        <div className="flex h-[46px] items-end justify-end">
                          <button
                            type="button"
                            onClick={() => removeItem(item.rowId)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-300/70 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                            aria-label="Remove item"
                          >
                            <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs font-bold">
                        <span className="text-[var(--c-muted)]">Line Total</span>
                        <span className="text-[var(--c-text)]">
                          <CurrencyValue
                            value={(Number(item.qty) || 0) * (Number(item.amount) || 0)}
                            iconSize="h-3 w-3"
                          />
                        </span>
                      </div>
                    </div>
                    );
                  })}
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-3">
                    <span className="text-sm font-black text-[var(--c-text)]">Quotation Total</span>
                    <span className="text-lg font-black text-[var(--c-text)]">
                      <CurrencyValue value={totalAmount} iconSize="h-4 w-4" />
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setDiscountEnabled((prev) => !prev)}
                      className={`flex h-8 w-8 items-center justify-center rounded-xl border transition ${
                        discountEnabled
                          ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_12%,var(--c-panel))] text-[var(--c-text)]'
                          : 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)] hover:border-[var(--c-accent)]/40'
                      }`}
                      aria-pressed={discountEnabled}
                      aria-label={discountEnabled ? 'Disable discount' : 'Enable discount'}
                    >
                      {discountEnabled ? <Check strokeWidth={2.2} className="h-3.5 w-3.5" /> : <Minus strokeWidth={2} className="h-4 w-4" />}
                    </button>
                    <div className="flex min-w-[180px] flex-1 items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Discount</span>
                      <select
                        value={discountMode}
                        onChange={(e) => setDiscountMode(e.target.value === 'percent' ? 'percent' : 'amount')}
                        disabled={!discountEnabled}
                        className="h-9 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-2 text-xs font-semibold text-[var(--c-text)] disabled:opacity-50"
                      >
                        <option value="amount">Amount</option>
                        <option value="percent">%</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        disabled={!discountEnabled}
                        className="h-9 w-24 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-2 text-sm font-semibold text-[var(--c-text)] outline-none disabled:opacity-50"
                      />
                      {discountEnabled ? (
                        <span className="ml-auto text-xs font-semibold text-[var(--c-muted)]">
                          - <CurrencyValue value={discountAmount} iconSize="h-3 w-3" />
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : <div className="rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-panel)] p-6 text-center text-xs font-bold uppercase tracking-widest text-[var(--c-muted)]">No applications added yet.</div>}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-[var(--c-text)]">Terms and Conditions</p>
                  <p className="text-xs font-black uppercase tracking-wider text-[var(--c-muted)]">Shown on this quotation only</p>
                </div>
                <button
                  type="button"
                  onClick={appendQuotationTerm}
                  disabled={quotationTerms.length >= 5}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Add term and condition"
                >
                  <Plus strokeWidth={1.5} className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                {quotationTerms.map((term, index) => {
                  const resolvedText = resolveQuotationTermText(term, expiryDate);
                  return (
                    <div key={term.id} className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--c-muted)]">Condition {index + 1}</p>
                          {term.type === 'expiry' ? (
                            <p className="mt-2 text-sm font-bold text-[var(--c-text)]">{resolvedText}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {term.type === 'expiry' ? (
                            <button
                              type="button"
                              onClick={focusQuotationDateControls}
                              className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[11px] font-black uppercase tracking-wider text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
                            >
                              Edit Date
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => removeQuotationTerm(term.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] transition hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-rose-400"
                            aria-label={`Remove condition ${index + 1}`}
                          >
                            <X strokeWidth={1.5} className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {term.type === 'custom' ? (
                        <textarea
                          className={`${inputClass} mt-3 min-h-[72px] resize-y normal-case tracking-normal`}
                          value={term.text}
                          onChange={(e) => handleQuotationTermChange(term.id, e.target.value)}
                        />
                      ) : (
                        <p className="mt-3 text-xs font-bold text-[var(--c-muted)]">
                          This condition follows the selected expiry date. Use Edit Date to update it from the quotation date section.
                        </p>
                      )}
                    </div>
                  );
                })}
                {quotationTerms.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-panel)] p-6 text-center text-xs font-bold uppercase tracking-widest text-[var(--c-muted)]">
                    No terms added for this quotation.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end"><button type="button" onClick={() => void saveQuotation()} disabled={isSaving || isLoading} className={`min-w-[180px] rounded-xl px-6 py-3 text-sm font-bold transition disabled:opacity-50 ${primaryActionClass}`}>{isSaving ? 'Generating...' : 'Generate Quotation'}</button></div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3 shadow-sm">
              <p className="mb-3 text-sm font-bold text-[var(--c-text)]">Quotation List</p>
              <div className="mb-3">
                <InputActionField
                  value={quotationSearch}
                  onValueChange={setQuotationSearch}
                  placeholder="Search quotations"
                  className="w-full"
                  showPasteButton={false}
                  leadIcon={Search}
                />
              </div>
                <div className="space-y-1.5">
                {filteredRows.map((quotation) => {
                  const creator = tenantUserMap[String(quotation?.createdBy || '')];
                  const creatorRawName = creator?.displayName || creator?.name || creator?.email || 'System';
                  const creatorName = String(creatorRawName || '').includes('@')
                    ? creatorRawName
                    : toProperText(creatorRawName);
                  const quotationIconUrl = resolvePageIconUrl(systemAssets, 'quotations') || '/documents.png';
                  return (
                    <div
                      key={quotation.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedQuotationId(quotation.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedQuotationId(quotation.id);
                        }
                      }}
                      className={`group w-full cursor-pointer rounded-xl border text-left transition ${selectedQuotationId === quotation.id ? activeChoiceCardClass : 'border-[var(--c-border)] bg-[var(--c-panel)]'}`}
                    >
                      <div className="flex items-center gap-2 px-3 py-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="truncate text-xs font-black text-[var(--c-text)]">{quotation.displayRef}</p>
                            {(quotation.proformaDisplayRef || quotation.proformaId || quotation.convertedToProformaId) ? (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); goToProforma(quotation.proformaDisplayRef || quotation.proformaId || quotation.convertedToProformaId); }}
                                className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700 hover:border-emerald-400"
                              >
                                {quotation.proformaDisplayRef || quotation.proformaId || quotation.convertedToProformaId}
                              </button>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[var(--c-muted)]">
                            <span className="uppercase">{String(quotation.status || 'generated').toUpperCase()}</span>
                            <span className="h-1 w-1 rounded-full bg-[var(--c-border)]" />
                            <span>Date: {quotation.quoteDate || '-'}</span>
                            <span className="h-1 w-1 rounded-full bg-[var(--c-border)]" />
                            <span className="text-[var(--c-text)]">
                              <CurrencyValue value={quotation.totalAmount || 0} iconSize="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <CreatedByIdentityCard
                            uid={quotation.createdBy || ''}
                            displayName={creatorName}
                            avatarUrl={creator?.photoURL || '/avatar.png'}
                            role={creator?.role || ''}
                            className="max-w-[190px]"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-panel)] p-6 text-center text-xs font-bold uppercase tracking-widest text-[var(--c-muted)]">No quotations generated yet.</div>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm">
              {selectedQuotation ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-[var(--c-text)]">{selectedQuotation.displayRef}</p>
                      <p className="text-sm font-bold text-[var(--c-muted)]">{selectedQuotation.clientSnapshot?.name || selectedQuotation.clientSnapshot?.tradeName || 'Client'}</p>
                      {(selectedQuotation.proformaDisplayRef || selectedQuotation.proformaId || selectedQuotation.convertedToProformaId) ? (
                        <button
                          type="button"
                          onClick={() => goToProforma(selectedQuotation.proformaDisplayRef || selectedQuotation.proformaId || selectedQuotation.convertedToProformaId)}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 hover:border-emerald-400"
                        >
                          Open Proforma {selectedQuotation.proformaDisplayRef || selectedQuotation.proformaId || selectedQuotation.convertedToProformaId}
                        </button>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">Status</p>
                      <p className="text-sm font-black text-[var(--c-text)]">{String(selectedQuotation.status || 'generated').toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">Quote Date</p><p className="mt-2 text-sm font-black text-[var(--c-text)]">{selectedQuotation.quoteDate || '-'}</p></div><div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">Expiry Date</p><p className="mt-2 text-sm font-black text-[var(--c-text)]">{selectedQuotation.expiryDate || '-'}</p></div><div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">Total</p><div className="mt-2 text-sm font-black text-[var(--c-text)]"><CurrencyValue value={selectedQuotation.totalAmount || 0} iconSize="h-3 w-3" /></div></div></div>
                  <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4"><p className="mb-3 text-sm font-black text-[var(--c-text)]">Applications</p><div className="space-y-2">{(selectedQuotation.items || []).map((item, index) => <div key={`${selectedQuotation.id}-${index}`} className="flex items-center justify-between rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3"><div><p className="text-sm font-black text-[var(--c-text)]">{resolveItemName(item)}</p><p className="text-[10px] font-bold uppercase text-[var(--c-muted)]">Qty {item.qty}</p></div><div className="text-sm font-black text-[var(--c-text)]"><CurrencyValue value={item.lineTotal || 0} iconSize="h-3 w-3" /></div></div>)}</div></div>
                  {String(selectedQuotation.termsAndConditions || '').trim() ? <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4"><p className="mb-3 text-sm font-black text-[var(--c-text)]">Terms and Conditions</p><div className="space-y-2">{String(selectedQuotation.termsAndConditions || '').split(/\r?\n/).filter(Boolean).map((term, index) => <p key={`${selectedQuotation.id}-term-${index}`} className="text-sm font-bold text-[var(--c-text)]">{term}</p>)}</div></div> : null}
                  {selectedQuotation.cancellationReason ? <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-700">Cancellation reason: {selectedQuotation.cancellationReason}</div> : null}
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <button
                      type="button"
                      disabled={isActionBusy}
                      onClick={() => void handleDownloadPdf(selectedQuotation)}
                      className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-3 text-xs font-black text-[var(--c-text)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Download PDF
                    </button>
                    <button
                      type="button"
                      disabled={isActionBusy}
                      onClick={() => void handleEmail(selectedQuotation)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-3 text-xs font-black text-[var(--c-text)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Mail strokeWidth={1.5} className="h-4 w-4" />
                      Email
                    </button>
                    <button
                      type="button"
                      disabled={isActionBusy}
                      onClick={() => void handleClone(selectedQuotation)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-3 text-xs font-black text-[var(--c-text)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Copy strokeWidth={1.5} className="h-4 w-4" />
                      Clone
                    </button>
                    <button
                      type="button"
                      disabled={isActionBusy}
                      onClick={() => void handleExtend(selectedQuotation)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-3 text-xs font-black text-[var(--c-text)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCcw strokeWidth={1.5} className="h-4 w-4" />
                      Extend
                    </button>
                    <button
                      type="button"
                      disabled={isActionBusy || String(selectedQuotation.status || '').toLowerCase() === 'converted'}
                      onClick={() => void handleAccept(selectedQuotation)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 strokeWidth={1.5} className="h-4 w-4" />
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={isActionBusy}
                      onClick={() => void handleCancel(selectedQuotation)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Ban strokeWidth={1.5} className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : <div className="rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-panel)] p-6 text-center text-xs font-bold uppercase tracking-widest text-[var(--c-muted)]">Select a quotation to review it.</div>}
            </div>
          </div>
        )}

      </div>
      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title || 'Confirm Action'}
        message={confirmDialog.message || 'Are you sure you want to proceed?'}
        confirmText={confirmDialog.confirmText || 'Confirm'}
        cancelText={confirmDialog.cancelText || 'Cancel'}
        isDangerous={Boolean(confirmDialog.isDangerous)}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel || closeConfirm}
      />
      {cancelReasonDialog.open ? (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={closeCancelReasonDialog}
          />
          <div className="relative w-full max-w-xl rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-2xl">
            <p className="text-base font-black text-[var(--c-text)]">Cancel Quotation</p>
            <p className="mt-1 text-sm font-semibold text-[var(--c-muted)]">
              Enter cancellation reason (minimum 30 characters)
            </p>
            <textarea
              rows={4}
              value={cancelReasonDialog.reason}
              onChange={(event) => setCancelReasonDialog((prev) => ({
                ...prev,
                reason: event.target.value,
                error: '',
              }))}
              placeholder="Reason for cancellation..."
              className="compact-field mt-3 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm font-semibold text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)]"
            />
            {cancelReasonDialog.error ? (
              <p className="mt-2 text-xs font-bold text-rose-500">{cancelReasonDialog.error}</p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeCancelReasonDialog}
                className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2 text-xs font-black uppercase tracking-wider text-[var(--c-muted)] transition hover:border-[var(--c-text)] hover:text-[var(--c-text)]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void confirmCancelQuotation()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-rose-600/20 transition hover:opacity-90"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ActionProgressOverlay
        open={actionOverlay.open}
        kind={actionOverlay.kind}
        title={actionOverlay.title}
        subtitle={actionOverlay.subtitle}
        status={actionOverlay.status}
      />
      <QuotationClientQuickCreate
        open={quickClientModal.open}
        quotation={quickClientModal.quotation}
        tenantId={tenantId}
        user={user}
        onClose={handleQuickClientClose}
        onCreated={handleQuickClientCreated}
      />
      <ProgressVideoOverlay
        open={isSaving}
        dismissible={false}
        minimal
        frameless
        videoSrc="/Video/DocumentGeneration.mp4"
        frameWidthClass="max-w-[360px]"
        backdropClassName="bg-white/92 backdrop-blur-sm"
        title="Quotation Generating"
        subtitle=""
      />
    </PageShell>
  );
};

export default QuotationPage;
