import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Download, Mail, Plus, Save, FileText, User, Users, UserPlus,
  History, Trash2, Building2, X, Search, ChevronDown, ChevronUp, GripVertical, Tags,
} from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import useElectronLayoutMode from '../hooks/useElectronLayoutMode';
import { useTenant } from '../context/useTenant';
import { useAuth } from '../context/useAuth';
import ClientSearchField from '../components/dailyTransaction/ClientSearchField';
import ServiceSearchField from '../components/dailyTransaction/ServiceSearchField';
import PortalTransactionSelector from '../components/common/PortalTransactionSelector';
import ClientHistoryPanel from '../components/dailyTransaction/ClientHistoryPanel';
import QuickAddServiceTemplateModal from '../components/dailyTransaction/QuickAddServiceTemplateModal';
import CurrencyValue from '../components/common/CurrencyValue';
import DirhamIcon from '../components/common/DirhamIcon';
import EmirateSelect from '../components/common/EmirateSelect';
import AddressField from '../components/common/AddressField';
import MobileContactsField from '../components/common/MobileContactsField';
import EmailContactsField from '../components/common/EmailContactsField';
import InputActionField from '../components/common/InputActionField';
import IdentityDocumentField from '../components/common/IdentityDocumentField';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ActionProgressOverlay from '../components/common/ActionProgressOverlay';
import {
  fetchTenantProformaInvoices,
  fetchTenantQuotations,
  fetchTenantClients,
  fetchTenantPortals,
  sendTenantDocumentEmail,
  upsertTenantProformaInvoice,
  updateTenantProformaInvoiceStatus,
  acceptTenantProformaInvoice,
  linkProformaToTasks,
  cancelTenantProformaInvoice,
  generateDisplayDocumentRef,
  generateDisplayClientId,
  checkTradeLicenseDuplicate,
  checkIndividualDuplicate,
  recordClientPaymentWithFinancials,
  markQuotationAsConverted,
  upsertClient,
  createTenantTask,
  fetchTenantUsersMap,
  fetchTenantIntegrationConfig,
} from '../lib/backendStore';
import { fetchMergedServiceTemplates } from '../lib/serviceTemplateStore';
import { fetchApplicationIconLibrary } from '../lib/applicationIconLibraryStore';
import { sendWhatsAppDocument } from '../lib/whatsappService';
import { TasksIcon, WhatsAppColorIcon } from '../components/icons/AppIcons';
import { toSafeDocId } from '../lib/idUtils';
import { generateTenantPdf } from '../lib/pdfGenerator';
import { createSyncEvent } from '../lib/syncEvents';
import { DEFAULT_COUNTRY_PHONE_ISO2 } from '../lib/countryPhoneData';
import { ENFORCE_UNIVERSAL_APPLICATION_UID } from '../lib/universalLibraryPolicy';
import { normalizeLibraryDescription } from '../lib/serviceTemplateRules';
import CreatedByIdentityCard from '../components/common/CreatedByIdentityCard';
import ApplicationIdentityRow from '../components/common/ApplicationIdentityRow';
import {
  createMobileContact,
  getPrimaryMobileContact,
  serializeMobileContacts,
  validateMobileContact,
} from '../lib/mobileContactUtils';

const activeTabClass = 'bg-[var(--c-accent)] text-white shadow-lg shadow-[var(--c-accent)]/20';
const primaryActionClass = 'bg-[var(--c-accent)] text-white shadow-lg shadow-[color:color-mix(in_srgb,var(--c-accent)_24%,transparent)] hover:opacity-95';
const formatAmountInputValue = (value) => {
  if (value === '' || value === null || value === undefined) return '0.00';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toFixed(2);
};

const createEmptyItemBuilder = () => ({
  service: null,
  qty: 1,
  amount: '',
  description: '',
});
const createEmailContact = (overrides = {}) => ({
  id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  value: '',
  emailEnabled: true,
  ...overrides,
});
const toEmailContacts = (contacts = [], fallback = '') => {
  if (Array.isArray(contacts) && contacts.length) {
    return contacts
      .map((item) => createEmailContact({
        value: String(item?.value || '').toLowerCase(),
        emailEnabled: item?.emailEnabled !== false,
      }))
      .slice(0, 3);
  }
  return [createEmailContact({ value: String(fallback || '').toLowerCase() })];
};
const toMobileContacts = (contacts = [], fallbackMobile = '', fallbackCountry = DEFAULT_COUNTRY_PHONE_ISO2) => {
  if (Array.isArray(contacts) && contacts.length) {
    return contacts
      .map((item) => createMobileContact({
        value: String(item?.value || ''),
        countryIso2: item?.countryIso2 || fallbackCountry,
        whatsAppEnabled: item?.whatsAppEnabled !== false,
      }))
      .slice(0, 3);
  }
  return [createMobileContact({
    value: String(fallbackMobile || ''),
    countryIso2: fallbackCountry || DEFAULT_COUNTRY_PHONE_ISO2,
  })];
};
const createEmptyManualClient = () => ({
  clientType: 'company',
  fullName: '',
  tradeName: '',
  tradeLicenseNumber: '',
  registeredEmirate: '',
  idType: 'emirates_id',
  idNumber: '',
  mobileContacts: [createMobileContact()],
  emailContacts: [createEmailContact()],
  emirate: '',
  address: '',
});
const buildManualClientFromSnapshot = (snapshot = {}) => ({
  clientType: String(snapshot?.type || '').toLowerCase() === 'individual' ? 'individual' : 'company',
  fullName: String(snapshot?.name || snapshot?.fullName || '').trim(),
  tradeName: String(snapshot?.tradeName || '').trim(),
  tradeLicenseNumber: String(snapshot?.tradeLicenseNumber || '').toUpperCase().trim(),
  registeredEmirate: String(snapshot?.registeredEmirate || snapshot?.emirate || '').trim(),
  idType: String(snapshot?.identificationMethod || 'emirates_id').trim() === 'emiratesId'
    ? 'emirates_id'
    : (String(snapshot?.identificationMethod || 'emirates_id').trim() || 'emirates_id'),
  idNumber: String(snapshot?.emiratesId || snapshot?.passportNumber || '').trim(),
  mobileContacts: toMobileContacts(snapshot?.mobileContacts, snapshot?.mobile, snapshot?.mobileCountryIso2),
  emailContacts: toEmailContacts(snapshot?.emailContacts, snapshot?.email),
  emirate: String(snapshot?.emirate || '').trim(),
  address: String(snapshot?.address || '').trim(),
});

const toLineItem = (item, index) => {
  const qty = Math.max(1, Number(item?.qty || 1));
  const amount = Math.max(0, Number(item?.amount || 0));
  return {
    rowId: String(item?.rowId || `row-${index}`),
    applicationId: String(item?.applicationId || ''),
    name: String(item?.name || ''),
    iconId: String(item?.iconId || ''),
    iconUrl: String(item?.iconUrl || ''),
    description: String(item?.description || ''),
    qty, amount,
    govCharge: Number(item?.govCharge || 0),
    lineTotal: qty * amount,
  };
};

const ProformaInvoicesPage = () => {
  const lockToUniversalApps = ENFORCE_UNIVERSAL_APPLICATION_UID;
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { layoutMode } = useElectronLayoutMode();
  const statusRef = useRef(null);
  const statusTimerRef = useRef(null);
  const quoteSearchRef = useRef(null);

  // Close quote search dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (quoteSearchRef.current && !quoteSearchRef.current.contains(e.target)) {
        setQuoteSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [rows, setRows] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [portals, setPortals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [isCreateMode, setIsCreateMode] = useState(false);

  const [clientMode, setClientMode] = useState('existing');
  const [existingClient, setExistingClient] = useState(null);
  const [manualClient, setManualClient] = useState(createEmptyManualClient);

  // Items
  const [items, setItems] = useState([]);
  const [itemBuilder, setItemBuilder] = useState(createEmptyItemBuilder());

  // Other form fields
  const [trackingId, setTrackingId] = useState('');
  const [description, setDescription] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advancePortalId, setAdvancePortalId] = useState('');
  const [advanceMethodId, setAdvanceMethodId] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');
  const [sourceQuotationId, setSourceQuotationId] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState([]);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [refreshIncentive, setRefreshIncentive] = useState(0);
  const [isInlineTemplateOpen, setIsInlineTemplateOpen] = useState(false);
  const [proformaDate, setProformaDate] = useState(new Date().toISOString().split('T')[0]);
  const [itemBuilderError, setItemBuilderError] = useState('');
  const [openDescriptionRows, setOpenDescriptionRows] = useState({});
  const [draggedItemRowId, setDraggedItemRowId] = useState('');
  const [dragOverItemRowId, setDragOverItemRowId] = useState('');

  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('info');
  const [actionOverlay, setActionOverlay] = useState({ open: false, kind: 'process', title: '', subtitle: '', status: '' });
  const [confirmDialog, setConfirmDialog] = useState({ open: false });
  const [quotationSearch, setQuotationSearch] = useState('');
  const [quoteSearchOpen, setQuoteSearchOpen] = useState(false);

  const [dependents, setDependents] = useState([]);
  const [selectedDependents, setSelectedDependents] = useState([]);
  const [serviceTemplates, setServiceTemplates] = useState([]);
  const [appIconUrlById, setAppIconUrlById] = useState({});

  const serviceTemplateMap = useMemo(() => {
    const next = {};
    (serviceTemplates || []).forEach((row) => {
      const key = String(row?.id || '').trim();
      if (key) next[key] = row;
    });
    return next;
  }, [serviceTemplates]);

  const tenantUserMap = useMemo(() => {
    const next = {};
    (tenantUsers || []).forEach((u) => {
      const key = String(u.id || u.uid || '').trim();
      if (key) next[key] = u;
    });
    return next;
  }, [tenantUsers]);

  const resolveServiceMeta = useCallback((applicationId) => {
    if (!applicationId) return null;
    return serviceTemplateMap[String(applicationId)] || null;
  }, [serviceTemplateMap]);

  const pushStatus = (msg, type = 'info') => {
    setStatus(msg); 
    setStatusType(type);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      setStatus('');
    }, 12000);
    window.requestAnimationFrame(() => statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  const openConfirm = (opts) => setConfirmDialog({ open: true, isDangerous: false, ...opts });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const loadData = useCallback(async (preferredId = '') => {
    if (!tenantId) return;
    setIsLoading(true);
    const [proRes, quoteRes, portalRes, userRes, serviceRes, iconRes] = await Promise.all([
      fetchTenantProformaInvoices(tenantId),
      fetchTenantQuotations(tenantId),
      fetchTenantPortals(tenantId),
      fetchTenantUsersMap(tenantId),
      fetchMergedServiceTemplates(tenantId),
      fetchApplicationIconLibrary(tenantId),
    ]);
    if (proRes.ok) {
      setRows(proRes.rows || []);
      if (preferredId) setSelectedId(preferredId);
    }
    if (quoteRes.ok) setQuotations(quoteRes.rows || []);
    if (portalRes.ok) setPortals(portalRes.rows || []);
    if (userRes.ok) setTenantUsers((userRes.rows || []).filter(u => !u.deletedAt));
    if (serviceRes.ok) setServiceTemplates(serviceRes.rows || []);
    if (iconRes.ok) {
      const next = {};
      (iconRes.rows || []).forEach((item) => {
        const iconId = String(item?.iconId || '').trim();
        const iconUrl = String(item?.iconUrl || '').trim();
        if (!iconId || !iconUrl) return;
        next[iconId] = iconUrl;
      });
      setAppIconUrlById(next);
    }
    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Hydrate from Quotation Accept navigation state ---
  useEffect(() => {
    const state = location.state;
    if (!state?.fromQuotation) return;

    // Clear the state so refreshing doesn't re-trigger
    window.history.replaceState({}, '');

    setIsCreateMode(true);
    setSelectedId('');
    setSourceQuotationId(state.sourceQuotationId || '');
    setItems((state.items || []).map(toLineItem));
    setItemBuilder(createEmptyItemBuilder());
    setItemBuilderError('');
    setIsInlineTemplateOpen(false);
    setOpenDescriptionRows({});
    setDraggedItemRowId('');
    setDragOverItemRowId('');
    setTrackingId('');
    setDescription(state.description || '');
    setProformaDate(state.proformaDate || new Date().toISOString().split('T')[0]);
    setSelectedDependents(Array.isArray(state.selectedDependents) ? state.selectedDependents : []);
    setQuotationSearch('');
    setQuoteSearchOpen(false);

    const snap = state.clientSnapshot || {};
    const mode = state.clientMode || 'manual';
    const type = state.clientType || snap.type || 'company';
    const incomingClientId = String(state.existingClientId || '').trim();

    if (mode === 'existing' && incomingClientId) {
      setClientMode('existing');
      // Pre-select the existing client
      setExistingClient({
        id: incomingClientId,
        fullName: snap.name || snap.fullName || '',
        tradeName: snap.tradeName || '',
        primaryEmail: snap.email || '',
        type,
      });
      setManualClient(createEmptyManualClient());
    } else {
      setClientMode('manual');
      setExistingClient(null);
      setManualClient(buildManualClientFromSnapshot({
        ...snap,
        type,
      }));
      pushStatus('Unknown quotation client loaded. Complete client details here and continue.', 'warning');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProforma = useMemo(() => rows.find(r => r.id === selectedId) || null, [rows, selectedId]);

  // When user picks an existing proforma to VIEW
  useEffect(() => {
    if (selectedProforma && !isCreateMode) {
      const row = selectedProforma;
      const snap = row.clientSnapshot;
      const rowClientId = String(row.clientId || snap?.id || '').trim();
      if (rowClientId) {
        setClientMode('existing');
        setExistingClient({ id: rowClientId, fullName: snap.name || snap.fullName || '', tradeName: snap.tradeName || '', primaryEmail: snap.email || '' });
        setManualClient(createEmptyManualClient());
      } else {
        setClientMode('manual');
        setExistingClient(null);
        setManualClient(buildManualClientFromSnapshot(snap));
      }
      setItems((row.items || []).map(toLineItem));
      setItemBuilder(createEmptyItemBuilder());
      setItemBuilderError('');
      setIsInlineTemplateOpen(false);
      setOpenDescriptionRows({});
      setDraggedItemRowId('');
      setDragOverItemRowId('');
      setAdvanceAmount(String(row.advanceAmount || 0));
      setAdvancePortalId(row.advancePortalId || '');
      setAdvanceMethodId(row.advanceMethodId || '');
      setAdvanceNote(row.advanceNote || '');
      setDescription(row.description || '');
      setAssignedUserIds(Array.isArray(row.assignedUserIds) ? row.assignedUserIds : []);
      setTrackingId(row.trackingId || '');
      setProformaDate(row.proformaDate || (row.createdAt ? new Date(row.createdAt.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]));
      setSourceQuotationId(row.sourceQuotationId || '');
      setSelectedDependents(row.dependents || []);
      setIsCreateMode(false);
    }
  }, [selectedProforma, isCreateMode]);

  // Fetch dependents when existing client changes
  useEffect(() => {
    const loadDependents = async () => {
      if (clientMode === 'existing' && existingClient?.id && tenantId) {
        const res = await fetchTenantClients(tenantId);
        if (res.ok) {
          const deps = res.rows.filter(c => String(c.type || '').toLowerCase() === 'dependent' && String(c.parentId) === String(existingClient.id));
          setDependents(deps);
        }
      } else {
        setDependents([]);
      }
    };
    loadDependents();
  }, [clientMode, existingClient, tenantId]);

  // When user picks a quotation to convert
  const handleQuotationSelect = (quotationId) => {
    const q = quotations.find(x => x.id === quotationId);
    if (!q) return;
    setIsCreateMode(true);
    setSelectedId('');
    setSourceQuotationId(q.id);
    setItems((q.items || []).map(toLineItem));
    setItemBuilder(createEmptyItemBuilder());
    setItemBuilderError('');
    setIsInlineTemplateOpen(false);
    setOpenDescriptionRows({});
    setDraggedItemRowId('');
    setDragOverItemRowId('');
    setTrackingId('');
    const snap = q.clientSnapshot;
    const quotationClientId = String(q.clientId || snap?.id || '').trim();
    if (quotationClientId) {
      setClientMode('existing');
      setExistingClient({ id: quotationClientId, fullName: snap?.name || snap?.fullName || '', tradeName: snap?.tradeName || '' });
      setManualClient(createEmptyManualClient());
    } else {
      setClientMode('manual');
      setExistingClient(null);
      setManualClient(buildManualClientFromSnapshot(snap));
      pushStatus('Unknown quotation client loaded. Complete client details to continue.', 'warning');
    }
  };

  const handleExistingClientSelect = (client) => {
    setExistingClient(client);
    if (client?.id) setClientMode('existing');
  };

  const resetCreateForm = () => {
    setClientMode('existing');
    setExistingClient(null);
    setManualClient(createEmptyManualClient());
    setItems([]);
    setItemBuilder(createEmptyItemBuilder());
    setItemBuilderError('');
    setIsInlineTemplateOpen(false);
    setOpenDescriptionRows({});
    setDraggedItemRowId('');
    setDragOverItemRowId('');
    setTrackingId('');
    setProformaDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setSelectedDependents([]);
    setAdvanceAmount('');
    setAdvancePortalId('');
    setAdvanceMethodId('');
    setAdvanceNote('');
    setSourceQuotationId('');
    setSelectedId('');
    setQuotationSearch('');
    setQuoteSearchOpen(false);
  };
  
  const toggleDependent = (depId) => {
    setSelectedDependents(prev =>
      prev.includes(depId) ? prev.filter(id => id !== depId) : [...prev, depId]
    );
  };

  const handleAddItem = (service, overrides = {}) => {
    if (!service) return;
    const existingIndex = items.findIndex(i => i.applicationId === service.id);
    if (existingIndex !== -1) {
      // Prompt to increase quantity instead of adding duplicate
      pushStatus(`"${service.name}" is already in the list. Increasing quantity.`, 'info');
      handleItemChange(items[existingIndex].rowId, 'qty', items[existingIndex].qty + 1);
      return;
    }
    const resolvedDescription = normalizeLibraryDescription(overrides.description ?? service.description ?? '');
    setItems(prev => [...prev, toLineItem({
      applicationId: service.id,
      name: service.name,
      iconId: service.iconId || service.globalIconId || '',
      iconUrl: service.iconUrl || '',
      description: resolvedDescription,
      qty: Math.max(1, Number(overrides.qty ?? 1) || 1),
      amount: Math.max(0, Number(overrides.amount ?? service.clientCharge ?? 0) || 0),
      govCharge: Number(service.govCharge || 0),
    }, prev.length)]);
    setItemBuilderError('');
  };

  const handleServiceDraftSelect = (service) => {
    setItemBuilderError('');
    setItemBuilder({
      service,
      qty: 1,
      amount: formatAmountInputValue(service?.clientCharge || 0),
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

  const adjustBuilderQty = (delta) => {
    setItemBuilder((prev) => ({
      ...prev,
      qty: Math.max(1, (Number(prev.qty) || 1) + delta),
    }));
  };

  const handleItemChange = (rowId, field, value) => {
    setItems(prev => prev.map(item => {
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
  };

  const moveItemRow = useCallback((sourceRowId, targetRowId) => {
    if (!sourceRowId || !targetRowId || sourceRowId === targetRowId) return;
    setItems(prev => {
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

  const totalAmount = useMemo(() => items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.amount) || 0), 0), [items]);
  const advanceNum = Math.min(Math.max(0, Number(advanceAmount) || 0), totalAmount);

  const buildClientSnapshot = () => {
    if (clientMode === 'manual') {
      const normalizedName = String(manualClient.fullName || '').trim();
      const primaryMobileContact = getPrimaryMobileContact(manualClient.mobileContacts);
      const normalizedMobile = String(primaryMobileContact?.value || '').trim();
      const normalizedEmailContacts = Array.isArray(manualClient.emailContacts)
        ? manualClient.emailContacts
          .map((item) => ({
            value: String(item?.value || '').trim().toLowerCase(),
            emailEnabled: item?.emailEnabled !== false,
          }))
          .filter((item) => item.value)
          .slice(0, 3)
        : [];
      const primaryEmail = normalizedEmailContacts[0]?.value || '';
      return {
        id: '',
        name: normalizedName,
        fullName: normalizedName,
        tradeName: manualClient.tradeName,
        email: primaryEmail,
        mobile: normalizedMobile,
        mobileCountryIso2: primaryMobileContact?.countryIso2 || DEFAULT_COUNTRY_PHONE_ISO2,
        mobileContacts: serializeMobileContacts(manualClient.mobileContacts || []),
        emailContacts: normalizedEmailContacts,
        emirate: manualClient.emirate,
        registeredEmirate: manualClient.registeredEmirate || manualClient.emirate,
        tradeLicenseNumber: manualClient.tradeLicenseNumber,
        identificationMethod: manualClient.idType,
        emiratesId: manualClient.idType === 'emirates_id' ? String(manualClient.idNumber || '').replace(/\D/g, '') : '',
        passportNumber: manualClient.idType === 'passport' ? String(manualClient.idNumber || '').toUpperCase().trim() : '',
        personCode: manualClient.idType === 'person_code' ? String(manualClient.idNumber || '').trim() : '',
        workPermitNumber: manualClient.idType === 'work_permit' ? String(manualClient.idNumber || '').trim() : '',
        address: manualClient.address,
        type: manualClient.clientType,
      };
    }
    return {
      id: existingClient?.id || '',
      name: existingClient?.fullName || existingClient?.tradeName || '',
      tradeName: existingClient?.tradeName || '',
      email: existingClient?.primaryEmail || '',
      type: existingClient?.type || 'company',
      mobileContacts: [],
      emailContacts: [],
    };
  };

  const validate = () => {
    if (clientMode === 'existing') {
      if (!existingClient?.id) return 'Select an existing client.';
    } else {
      const normalizedName = String(manualClient.fullName || '').trim();
      if (!normalizedName) {
        return manualClient.clientType === 'individual' ? 'Name is required.' : 'Company legal name is required.';
      }
      if (manualClient.clientType === 'company') {
        if (!String(manualClient.tradeLicenseNumber || '').trim()) return 'Trade license number is required.';
        if (!String(manualClient.registeredEmirate || '').trim()) return 'Registered emirate is required.';
      }
      if (manualClient.clientType === 'individual') {
        if (!String(manualClient.idNumber || '').trim()) return 'Identification number is required.';
        if (manualClient.idType === 'emirates_id' && String(manualClient.idNumber || '').replace(/\D/g, '').length !== 15) {
          return 'Emirates ID must be exactly 15 digits.';
        }
        if (manualClient.idType === 'person_code' && String(manualClient.idNumber || '').trim().length !== 14) {
          return 'Person code must be exactly 14 digits.';
        }
      }
      const primaryMobile = getPrimaryMobileContact(manualClient.mobileContacts || []);
      const mobileError = validateMobileContact(
        primaryMobile?.value || '',
        primaryMobile?.countryIso2 || DEFAULT_COUNTRY_PHONE_ISO2,
        'Primary mobile',
      );
      if (mobileError) return mobileError;
      const filledEmails = Array.isArray(manualClient.emailContacts)
        ? manualClient.emailContacts.map((item) => String(item?.value || '').trim().toLowerCase()).filter(Boolean)
        : [];
      if (filledEmails[0] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(filledEmails[0])) {
        return 'Primary email format is invalid.';
      }
    }
    if (items.length === 0) return 'Add at least one application.';
    if (advanceNum > 0 && (!advancePortalId || !advanceMethodId)) return 'Select portal and method for advance payment.';
    return '';
  };

  // Save new proforma
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const isNewDraft = !selectedProforma?.displayRef;
      const displayRef = isNewDraft ? await generateDisplayDocumentRef(tenantId, 'proformaInvoice') : selectedProforma.displayRef;
      const proformaId = isNewDraft ? toSafeDocId(displayRef, 'proforma') : (selectedId || toSafeDocId(displayRef, 'proforma'));

      let clientId = clientMode === 'existing' ? (existingClient?.id || '') : '';
      const clientSnapshot = buildClientSnapshot();

      if (clientMode === 'manual') {
        const nextType = String(clientSnapshot.type || '').toLowerCase() === 'individual' ? 'individual' : 'company';
        if (nextType === 'company') {
          const duplicateCompany = await checkTradeLicenseDuplicate(
            tenantId,
            String(clientSnapshot.tradeLicenseNumber || '').toUpperCase().trim(),
          );
          if (duplicateCompany) {
            throw new Error(`Trade License ${String(clientSnapshot.tradeLicenseNumber || '').toUpperCase().trim()} is already registered.`);
          }
        } else {
          const duplicateIndividual = await checkIndividualDuplicate(tenantId, {
            method: manualClient.idType === 'emirates_id' ? 'emiratesId' : manualClient.idType,
            emiratesId: clientSnapshot.emiratesId || '',
            passportNumber: clientSnapshot.passportNumber || '',
            fullName: String(clientSnapshot.fullName || clientSnapshot.name || '').toUpperCase().trim(),
          });
          if (duplicateIndividual) {
            throw new Error('A client with similar identification already exists.');
          }
        }

        const displayClientId = await generateDisplayClientId(tenantId, nextType);
        clientId = toSafeDocId(displayClientId, 'client');
        const clientRes = await upsertClient(tenantId, clientId, {
          displayClientId,
          type: nextType,
          fullName: clientSnapshot.fullName || clientSnapshot.name || '',
          tradeName: clientSnapshot.tradeName || '',
          emirate: clientSnapshot.emirate || clientSnapshot.registeredEmirate || '',
          registeredEmirate: clientSnapshot.registeredEmirate || '',
          tradeLicenseNumber: clientSnapshot.tradeLicenseNumber || '',
          identificationMethod: clientSnapshot.identificationMethod || '',
          emiratesId: clientSnapshot.emiratesId || '',
          passportNumber: clientSnapshot.passportNumber || '',
          personCode: clientSnapshot.personCode || '',
          workPermitNumber: clientSnapshot.workPermitNumber || '',
          address: clientSnapshot.address || '',
          primaryMobile: clientSnapshot.mobile || '',
          primaryMobileCountry: clientSnapshot.mobileCountryIso2 || DEFAULT_COUNTRY_PHONE_ISO2,
          primaryEmail: clientSnapshot.email || '',
          mobileContacts: clientSnapshot.mobileContacts || [],
          emailContacts: clientSnapshot.emailContacts || [],
          openingBalance: 0,
          balance: 0,
          status: 'active',
          createdBy: user?.uid || '',
        });
        if (!clientRes.ok) {
          throw new Error(clientRes.error || 'Failed to add new client from proforma.');
        }
      }

      const payload = {
        displayRef,
        clientId: clientId || null,
        clientSnapshot: { ...clientSnapshot, id: clientId || '' },
        items: items.map(i => ({ ...i, lineTotal: (Number(i.qty) || 0) * (Number(i.amount) || 0) })),
        totalAmount,
        amountPaid: 0,
        balanceDue: totalAmount,
        sourceQuotationId: sourceQuotationId || null,
        trackingId: trackingId || '',
        description: description,
        isLinkedToTask: selectedProforma?.isLinkedToTask || false,
        assignedUserIds: selectedProforma?.assignedUserIds || [],
        proformaDate,
        dependents: selectedDependents,
        status: selectedProforma?.status || 'drafted',
        createdBy: selectedProforma?.createdBy || user?.uid || '',
        createdAt: selectedProforma?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || '',
      };

      const res = await upsertTenantProformaInvoice(tenantId, proformaId, payload);
      if (!res.ok) throw new Error(res.error || 'Failed to save proforma.');

      if (advanceNum > 0 && clientId) {
        await recordClientPaymentWithFinancials(tenantId, toSafeDocId(`${displayRef}-ADV`, 'pay'), {
          clientId,
          amount: advanceNum,
          type: 'customer_payment',
          category: 'Advance Payment',
          description: `Advance for Proforma ${displayRef}`,
          portalId: advancePortalId,
          methodId: advanceMethodId,
          date: new Date().toISOString(),
          proformaId: proformaId,
          note: advanceNote,
          createdBy: user?.uid || '',
        });
      }

      if (sourceQuotationId) {
        await markQuotationAsConverted(tenantId, sourceQuotationId, proformaId, displayRef, user?.uid);
      }

      await createSyncEvent({ tenantId, eventType: 'create', entityType: 'proformaInvoice', entityId: proformaId, changedFields: Object.keys(payload), createdBy: user?.uid || '' });

      await loadData(proformaId);
      setIsCreateMode(false);
      pushStatus(`Proforma ${displayRef} generated successfully.`, 'success');
    } catch (error) {
      pushStatus(error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedId) return;
    openConfirm({
      title: 'Cancel Proforma Invoice?',
      message: 'This will mark the proforma as CANCELLED and also cancel all associated tasks in the tracking system. This action cannot be undone.',
      isDangerous: true,
      confirmText: 'Yes, Cancel Everything',
      cancelText: 'No, Keep It',
      onConfirm: async () => {
        closeConfirm();
        setActionOverlay({ open: true, kind: 'process', title: 'Cancelling Proforma', subtitle: 'Updating records and linked tasks...', status: 'Processing...' });
        const res = await cancelTenantProformaInvoice(tenantId, selectedId, user?.uid);
        setActionOverlay({ open: false });
        if (res.ok) {
          pushStatus('Proforma and linked tasks cancelled.', 'success');
          loadData(selectedId);
        } else {
          pushStatus(res.error, 'error');
        }
      },
      onCancel: closeConfirm,
    });
  };

  const handleAcceptProforma = async () => {
    if (!selectedId) return;
    setActionOverlay({ open: true, kind: 'process', title: 'Accepting Proforma', subtitle: 'Updating record for operational handoff...', status: 'Processing...' });
    const res = await acceptTenantProformaInvoice(tenantId, selectedId, user?.uid);
    setActionOverlay({ open: false });
    if (res.ok) {
      pushStatus('Proforma accepted and ready for task assignment.', 'success');
      loadData(selectedId);
    } else {
      pushStatus(res.error, 'error');
    }
  };

  const handleTransferToTasks = async () => {
    if (!selectedProforma || isSaving) return;
    if (assignedUserIds.length === 0) {
      pushStatus('Assign at least one responsible personnel.', 'error');
      return;
    }
    setIsSaving(true);
    setActionOverlay({
      open: true,
      kind: 'process',
      title: 'Handoff to Tracking',
      subtitle: 'Transferring applications to operational task management...',
      status: 'Generating Tasks...',
    });
    try {
      const { id: proformaId, displayRef, items, clientId, trackingId } = selectedProforma;
      await Promise.all((items || []).map(item => createTenantTask(tenantId, {
        title: `${item.name} (${displayRef})`,
        description: `Task generated from Proforma ${displayRef}.\n\nApplication: ${item.name}\nQuantity: ${item.qty}`,
        status: 'pending',
        assignedUserIds: assignedUserIds,
        clientId: clientId || '',
        proformaId: proformaId,
        trackingId: trackingId || '',
        transactionNumbersSnapshot: [],
        createdBy: user?.uid || '',
        updatedBy: user?.uid || '',
      })));
      
      const linkRes = await linkProformaToTasks(tenantId, proformaId, assignedUserIds, user?.uid);
      if (!linkRes.ok) throw new Error(linkRes.error || 'Failed to link proforma to tasks.');
      
      pushStatus(`Tasks generated for ${displayRef}. Transferred to tracking system.`, 'success');
      await loadData(proformaId);
    } catch (e) {
      pushStatus(e.message, 'error');
    } finally {
      setIsSaving(false);
      setActionOverlay({ open: false });
    }
  };

  const handleMarkAsSent = async () => {
    if (!selectedId) return;
    const res = await updateTenantProformaInvoiceStatus(tenantId, selectedId, 'sent', user?.uid);
    if (res.ok) {
      pushStatus('Proforma marked as sent.', 'success');
      loadData(selectedId);
    } else {
      pushStatus(res.error, 'error');
    }
  };

  const handleEditMode = () => {
    setIsCreateMode(true);
    pushStatus('Edit mode enabled. Changes will update the current record.', 'info');
  };

  const handleSaveClick = () => {
    const err = validate();
    if (err) { pushStatus(err, 'error'); return; }
    const previewClientName = clientMode === 'existing'
      ? (existingClient?.fullName || existingClient?.tradeName || '')
      : String(manualClient.fullName || '').trim();

    openConfirm({
      title: 'Generate Proforma Invoice',
      message: `Client: ${previewClientName}\nItems: ${items.length} application(s)\nTotal: Dhs ${totalAmount.toFixed(2)}\n\nThis will be saved to the ledger.`,
      confirmText: 'Generate',
      cancelText: 'Cancel',
      onConfirm: () => { closeConfirm(); handleSave(); },
      onCancel: closeConfirm,
    });
  };

  const buildPdfData = (p) => ({
    txId: p.displayRef || p.id,
    date: p.createdAt || new Date().toISOString(),
    recipientName: p.clientSnapshot?.name || p.clientSnapshot?.fullName || p.clientSnapshot?.tradeName || 'Client',
    amount: Number(p.totalAmount || 0),
    description: 'Proforma Invoice',
    items: (p.items || []).map(i => ({ name: i.name, qty: i.qty, price: i.amount, total: i.lineTotal })),
  });

  const handleDownloadPdf = async () => {
    if (!selectedProforma) return;
    setActionOverlay({
      open: true,
      kind: 'pdf',
      title: 'Generating Proforma PDF',
      subtitle: 'Preparing the proforma document for download.',
      status: 'Rendering PDF...',
    });
    try {
      const pdfData = buildPdfData(selectedProforma);
      const res = await generateTenantPdf({ 
        tenantId, 
        documentType: 'nextInvoice', 
        data: pdfData, 
        save: true, 
        returnBase64: true,
        filename: `${selectedProforma.displayRef}.pdf` 
      });

      if (res.ok && res.base64) {
        // Attempt automatic Drive upload if configured
        try {
          const driveRes = await fetchTenantIntegrationConfig(tenantId);
          if (driveRes.ok && driveRes.data?.driveConnected && driveRes.data?.driveRefreshToken) {
            setActionOverlay(prev => ({ ...prev, status: 'Uploading to Google Drive...' }));
            const uploadRes = await window.electron.drive.upload({
              clientId: driveRes.data.driveClientId,
              clientSecret: driveRes.data.driveClientSecret,
              refreshToken: driveRes.data.driveRefreshToken,
              fileName: `${selectedProforma.displayRef}.pdf`,
              base64: res.base64,
              folderId: driveRes.data.driveRootFolderId,
            });
            if (uploadRes.ok) {
              pushStatus('Uploaded to Google Drive.', 'success');
            } else {
              console.warn('[Drive] Auto-upload failed:', uploadRes.error);
              pushStatus(`Drive upload failed: ${uploadRes.error}`, 'error');
            }
          }
        } catch (driveErr) {
          console.error('[Drive] Integration error:', driveErr);
        }
      }

      pushStatus(res.ok ? 'PDF generated.' : (res.error || 'PDF failed.'), res.ok ? 'success' : 'error');
    } finally {
      setActionOverlay((prev) => ({ ...prev, open: false }));
    }
  };

  const handleEmail = async () => {
    if (!selectedProforma) return;
    const email = String(selectedProforma.clientSnapshot?.email || '').trim().toLowerCase();
    if (!email) { pushStatus('No email available.', 'error'); return; }
    setActionOverlay({
      open: true,
      kind: 'email',
      title: 'Sending Proforma Email',
      subtitle: 'Packaging the proforma and delivering it to the selected recipient.',
      status: 'Sending Email...',
    });
    try {
      const pdfRes = await generateTenantPdf({ tenantId, documentType: 'nextInvoice', data: buildPdfData(selectedProforma), save: false, returnBase64: true, filename: `${selectedProforma.displayRef}.pdf` });
      if (!pdfRes.ok) { pushStatus(pdfRes.error || 'PDF failed.', 'error'); return; }
      const emailRes = await sendTenantDocumentEmail(tenantId, email, 'nextInvoice', pdfRes.base64, buildPdfData(selectedProforma));
      pushStatus(emailRes.ok ? `Emailed to ${email}.` : (emailRes.error || 'Email failed.'), emailRes.ok ? 'success' : 'error');
      if (emailRes.ok) await loadData(selectedProforma.id);
    } finally {
      setActionOverlay((prev) => ({ ...prev, open: false }));
    }
  };

  const handleWhatsApp = async () => {
    if (!selectedProforma) return;
    const phoneSnapshot = getPrimaryMobileContact(selectedProforma.clientSnapshot?.mobileContacts || []);
    const phone = phoneSnapshot?.value ? String(phoneSnapshot.value).replace(/\D/g, '') : '';
    
    if (!phone) {
      pushStatus('No mobile number available for WhatsApp.', 'error');
      return;
    }

    setActionOverlay({
      open: true,
      kind: 'process',
      title: 'Sending via WhatsApp',
      subtitle: `Delivering proforma to +${phone}...`,
      status: 'Uploading Document...',
    });

    try {
      // 1. Generate PDF and get public URL
      const pdfRes = await generateTenantPdf({ 
        tenantId, 
        documentType: 'nextInvoice', 
        data: buildPdfData(selectedProforma), 
        save: true, 
        filename: `${selectedProforma.displayRef}.pdf` 
      });
      
      if (!pdfRes.ok || !pdfRes.url) {
        throw new Error(pdfRes.error || 'Failed to generate public PDF URL.');
      }

      // 2. Send via WhatsApp Service
      const waRes = await sendWhatsAppDocument(tenantId, phone, pdfRes.url, `${selectedProforma.displayRef}.pdf`);
      
      if (waRes.ok) {
        pushStatus(`Proforma sent to +${phone} via WhatsApp.`, 'success');
      } else {
        throw new Error(waRes.error);
      }
    } catch (e) {
      pushStatus(e.message, 'error');
    } finally {
      setActionOverlay((prev) => ({ ...prev, open: false }));
    }
  };

  const statusBadgeClass = (status) => {
    if (status === 'partially_paid') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (status === 'canceled') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (status === 'sent') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (status === 'accepted') return 'bg-purple-100 text-purple-700 border-purple-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <PageShell
      title="Proforma Invoices"
      subtitle="Draft and manage proforma invoices before final billing."
      iconKey="proformaInvoices"
      eyebrow="Sales"
      widthPreset="data"
    >
      <div className="space-y-4">
        {status ? (
          <div ref={statusRef} className={`rounded-xl border px-4 py-3 text-sm font-bold animate-in fade-in ${statusType === 'error' ? 'border-rose-300 bg-rose-50 text-rose-700' : statusType === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
            {status}
          </div>
        ) : null}

        <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                resetCreateForm();
                setIsCreateMode(true);
                setSelectedId('');
              }}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${isCreateMode ? activeTabClass : 'bg-[var(--c-panel)] text-[var(--c-muted)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_80%,transparent)]'}`}
            >
              <Plus strokeWidth={1.5} size={14} />
              Create Proforma
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreateMode(false);
                if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
              }}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${!isCreateMode ? activeTabClass : 'bg-[var(--c-panel)] text-[var(--c-muted)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_80%,transparent)]'}`}
            >
              <FileText strokeWidth={1.5} size={14} />
              Existing Proforma
            </button>
          </div>
        </div>

        {isCreateMode ? (
          <div className="relative min-w-[260px]" ref={quoteSearchRef}>
            <div
              className={`flex items-center gap-2 rounded-xl border bg-[var(--c-panel)] px-3 py-2 cursor-pointer transition-all ${
                quoteSearchOpen ? 'border-[var(--c-accent)] ring-2 ring-[var(--c-accent)]/10' : 'border-[var(--c-border)]'
              }`}
              onClick={() => setQuoteSearchOpen(true)}
            >
              <Search strokeWidth={1.5} size={14} className="shrink-0 text-[var(--c-muted)]" />
              <input
                type="text"
                value={quotationSearch}
                onChange={e => { setQuotationSearch(e.target.value); setQuoteSearchOpen(true); }}
                onFocus={() => setQuoteSearchOpen(true)}
                placeholder="Search & load a quotation..."
                className="flex-1 min-w-0 bg-transparent text-xs font-bold text-[var(--c-text)] outline-none placeholder:text-[var(--c-muted)]"
              />
              {quotationSearch ? (
                <button type="button" onClick={e => { e.stopPropagation(); setQuotationSearch(''); }} className="text-[var(--c-muted)] hover:text-rose-400">
                  <X strokeWidth={1.5} size={12} />
                </button>
              ) : null}
              <ChevronDown strokeWidth={1.5} size={12} className={`shrink-0 text-[var(--c-muted)] transition-transform ${quoteSearchOpen ? 'rotate-180' : ''}`} />
            </div>

            {quoteSearchOpen && (() => {
              const available = quotations.filter(q => !q.proformaId && q.status !== 'canceled');
              const q = quotationSearch.trim().toLowerCase();
              const filtered = q
                ? available.filter(x =>
                    String(x.displayRef || '').toLowerCase().includes(q) ||
                    String(x.clientSnapshot?.name || x.clientSnapshot?.tradeName || '').toLowerCase().includes(q) ||
                    String(x.totalAmount || '').includes(q)
                  )
                : available;
              return (
                <div className="absolute left-0 right-0 z-[200] mt-1.5 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {filtered.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs font-bold text-[var(--c-muted)] uppercase">No matching quotations</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      {filtered.map(q => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            handleQuotationSelect(q.id);
                            setQuotationSearch(q.displayRef || '');
                            setQuoteSearchOpen(false);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--c-accent)]/5 transition border-b border-[var(--c-border)]/40 last:border-0"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--c-panel)] text-[var(--c-accent)] text-[10px] font-black border border-[var(--c-border)]">
                            QT
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-[var(--c-text)]">{ q.displayRef }</p>
                            <p className="truncate text-[10px] font-bold text-[var(--c-muted)]">
                              {q.clientSnapshot?.name || q.clientSnapshot?.tradeName || 'Manual Client'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-black text-[var(--c-text)]">
                              <CurrencyValue value={q.totalAmount} iconSize="h-2.5 w-2.5" />
                            </p>
                            <p className="text-[9px] font-bold text-[var(--c-muted)] uppercase">
                              {q.quoteDate || new Date(q.createdAt || '').toLocaleDateString()}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : null}

        <div className={`grid gap-4 ${isCreateMode ? 'grid-cols-1' : 'lg:grid-cols-[340px_1fr]'}`}>
          {/* Left: list */}
          {!isCreateMode ? (
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
              <header className="px-2 pb-2 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Records</p>
                <span className="text-[10px] font-bold text-[var(--c-accent)] bg-[var(--c-accent)]/10 px-1.5 py-0.5 rounded">{rows.length}</span>
              </header>
              {isLoading ? (
                <div className="flex justify-center p-8"><div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--c-accent)] border-t-transparent" /></div>
              ) : rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--c-border)] p-4 text-xs text-[var(--c-muted)] text-center">No records yet.</p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {rows.map(item => {
                    const creator = tenantUserMap[String(item.createdBy || '')];
                    // Handle potential Firestore Timestamps or JS Dates safely
                    const createdAtRaw = item.createdAt;
                    const dateObj = (createdAtRaw?.seconds) ? new Date(createdAtRaw.seconds * 1000) : new Date(createdAtRaw);
                    const dateStr = isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleDateString();

                    return (
                      <button 
                        key={item.id} 
                        type="button" 
                        onClick={() => { setSelectedId(item.id); setIsCreateMode(false); }} 
                        className={`w-full rounded-2xl border p-4 text-left transition-all duration-200 ${selectedId === item.id ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/[0.03] shadow-inner' : 'border-[var(--c-border)] bg-[var(--c-panel)]/40 hover:bg-[var(--c-panel)]/70'}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <p className={`text-[12px] font-black tracking-tight ${selectedId === item.id ? 'text-[var(--c-accent)]' : 'text-[var(--c-text)]'}`}>{item.displayRef || item.id}</p>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${statusBadgeClass(item.status)}`}>{item.status || 'Draft'}</span>
                        </div>
                        
                        <div className="flex items-center justify-between gap-3 mb-4">
                           <div className="min-w-0 flex-1">
                             <p className="truncate text-[11px] font-black text-[var(--c-muted)] uppercase tracking-wider">
                               {item.clientSnapshot?.name || item.clientSnapshot?.fullName || item.clientSnapshot?.tradeName || 'Walk-in Client'}
                             </p>
                           </div>
                           <div className="shrink-0">
                             <CreatedByIdentityCard
                               uid={item.createdBy || ''} 
                               displayName={creator?.displayName || creator?.name || 'Staff'}
                               avatarUrl={creator?.photoURL}
                               role={creator?.role || ''}
                               className="max-w-[220px] shadow-sm transition-opacity group-hover:opacity-100 opacity-90"
                             />
                           </div>
                        </div>

                        <div className="flex justify-between items-center border-t border-[var(--c-border)] pt-3">
                          <div className="flex items-center gap-1.5 grayscale opacity-90">
                            <CurrencyValue value={item.totalAmount} className="text-[12px] font-black text-[var(--c-text)]" iconSize="h-3 w-3" />
                          </div>
                          <p className="text-[9px] font-black text-[var(--c-muted)] uppercase tracking-widest">{dateStr}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <ClientHistoryPanel
              tenantId={tenantId}
              clientId={clientMode === 'existing' ? existingClient?.id : ''}
              onClone={(oldPI) => {
                setItems((oldPI.items || []).map(toLineItem));
                setOpenDescriptionRows({});
                setDraggedItemRowId('');
                setDragOverItemRowId('');
                pushStatus('Items cloned from previous proforma.', 'success');
              }}
            />
          </aside>
          ) : null}

          {/* Right: main editor */}
          <main className="space-y-4">
            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-[var(--c-border)] pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-[var(--c-panel)] text-[var(--c-accent)] border border-[var(--c-border)]">
                    {isCreateMode ? <Plus strokeWidth={1.5} size={18} /> : <FileText strokeWidth={1.5} size={18} />}
                  </div>
                  <div>
                    <h2 className="text-base font-black text-[var(--c-text)]">{isCreateMode ? 'Draft New Proforma' : (selectedProforma?.displayRef || 'Document Viewer')}</h2>
                    <p className="text-[10px] font-bold uppercase text-[var(--c-muted)]">{isCreateMode ? 'Unsaved • Not in ledger yet' : `Status: ${selectedProforma?.status || '—'}`}</p>
                  </div>
                </div>
                {!isCreateMode && selectedProforma && (
                  <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase ${statusBadgeClass(selectedProforma.status)}`}>{selectedProforma.status}</span>
                )}
              </div>

              {/* Client Section */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)]">Client Source</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setClientMode('existing');
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${clientMode === 'existing' ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-surface))]' : 'border-[var(--c-border)] bg-[var(--c-panel)]'}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${clientMode === 'existing' ? 'bg-[var(--c-accent)] text-white' : 'bg-[var(--c-surface)] text-[var(--c-accent)]'}`}>
                      <Users strokeWidth={1.5} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-[var(--c-text)]">Existing Client</span>
                      <span className="block text-[10px] font-bold uppercase text-[var(--c-muted)]">Search from saved clients</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClientMode('manual');
                      setExistingClient(null);
                      setSelectedDependents([]);
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${clientMode === 'manual' ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-surface))]' : 'border-[var(--c-border)] bg-[var(--c-panel)]'}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${clientMode === 'manual' ? 'bg-[var(--c-accent)] text-white' : 'bg-[var(--c-surface)] text-[var(--c-accent)]'}`}>
                      <UserPlus strokeWidth={1.5} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-[var(--c-text)]">Add Client Here</span>
                      <span className="block text-[10px] font-bold uppercase text-[var(--c-muted)]">Create client inline from proforma</span>
                    </span>
                  </button>
                </div>

                {clientMode === 'existing' ? (
                  <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4">
                    <ClientSearchField onSelect={handleExistingClientSelect} selectedId={existingClient?.id} placeholder="Search existing clients..." />
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4">
                    <div className="space-y-2 md:col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)]">Client Type</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setManualClient((prev) => ({ ...prev, clientType: 'company' }))}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-black transition ${manualClient.clientType === 'company' ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-surface))] text-[var(--c-accent)]' : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)]'}`}
                        >
                          <Building2 strokeWidth={1.5} className="h-4 w-4" />
                          Company
                        </button>
                        <button
                          type="button"
                          onClick={() => setManualClient((prev) => ({ ...prev, clientType: 'individual' }))}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-black transition ${manualClient.clientType === 'individual' ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-surface))] text-[var(--c-accent)]' : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)]'}`}
                        >
                          <User strokeWidth={1.5} className="h-4 w-4" />
                          Individual
                        </button>
                      </div>
                    </div>

                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)]">
                      {manualClient.clientType === 'individual' ? 'Name' : 'Company Legal Name'}
                      <InputActionField
                        name="proforma-manual-name"
                        value={manualClient.fullName}
                        onValueChange={(value) => setManualClient((prev) => ({ ...prev, fullName: value }))}
                        forceUppercase
                        placeholder={manualClient.clientType === 'individual' ? 'Full name' : 'Company legal name'}
                        className="mt-1 w-full"
                        inputClassName="text-sm font-bold"
                      />
                    </label>

                    {manualClient.clientType === 'company' ? (
                      <>
                        <label className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)]">
                          Trade Name
                          <InputActionField
                            name="proforma-manual-trade-name"
                            value={manualClient.tradeName}
                            onValueChange={(value) => setManualClient((prev) => ({ ...prev, tradeName: value }))}
                            forceUppercase
                            placeholder="Trade name"
                            className="mt-1 w-full"
                            inputClassName="text-sm font-bold"
                          />
                        </label>
                        <label className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)]">
                          Trade License Number
                          <InputActionField
                            name="proforma-manual-trade-license"
                            value={manualClient.tradeLicenseNumber}
                            onValueChange={(value) => setManualClient((prev) => ({ ...prev, tradeLicenseNumber: value }))}
                            forceUppercase
                            placeholder="Enter trade license number"
                            className="mt-1 w-full"
                            inputClassName="text-sm font-bold"
                          />
                        </label>
                        <label className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)] md:col-span-2">
                          Registered Emirate
                          <div className="mt-1">
                            <EmirateSelect
                              value={manualClient.registeredEmirate}
                              onChange={(next) => setManualClient((prev) => ({ ...prev, registeredEmirate: next, emirate: next || prev.emirate }))}
                              placeholder="Select emirate"
                            />
                          </div>
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)] md:col-span-2">
                          Identification
                          <div className="mt-1">
                            <IdentityDocumentField
                              type={manualClient.idType}
                              number={manualClient.idNumber}
                              onTypeChange={(nextType) => setManualClient((prev) => ({ ...prev, idType: nextType, idNumber: '' }))}
                              onNumberChange={(nextNumber) => setManualClient((prev) => ({ ...prev, idNumber: nextNumber }))}
                              allowedTypes={['emirates_id', 'passport', 'person_code', 'work_permit']}
                            />
                          </div>
                        </label>
                      </>
                    )}

                    <div className="md:col-span-2">
                      <MobileContactsField
                        label="Mobile Numbers"
                        contacts={manualClient.mobileContacts}
                        onChange={(contacts) => setManualClient((prev) => ({ ...prev, mobileContacts: contacts }))}
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <EmailContactsField
                        label="Email Addresses"
                        contacts={manualClient.emailContacts}
                        onChange={(contacts) => setManualClient((prev) => ({ ...prev, emailContacts: contacts }))}
                      />
                    </div>

                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)]">
                      Emirate
                      <div className="mt-1">
                        <EmirateSelect
                          value={manualClient.emirate}
                          onChange={(next) => setManualClient((prev) => ({ ...prev, emirate: next }))}
                          placeholder="Select emirate"
                        />
                      </div>
                    </label>

                    <div className="md:col-span-2">
                      <AddressField
                        value={manualClient.address}
                        onValueChange={(value) => setManualClient((prev) => ({ ...prev, address: value }))}
                      />
                    </div>
                  </div>
                )}

                {clientMode === 'existing' && dependents.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)] mb-2">Dependents (Optional)</p>
                    <div className="flex flex-wrap gap-2">
                      {dependents.map(dep => (
                        <button
                          key={dep.id}
                          type="button"
                          onClick={() => toggleDependent(dep.id)}
                          className={`rounded-full px-3 py-1 text-[11px] font-bold transition border ${selectedDependents.includes(dep.id) ? 'bg-[var(--c-accent)] text-white border-[var(--c-accent)]' : 'bg-[var(--c-panel)] text-[var(--c-muted)] border-[var(--c-border)] hover:border-[var(--c-accent)]/50'}`}
                        >
                          {dep.fullName || dep.tradeName || dep.id}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Description */}
              <div className="mt-5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)]">
                  Description / Notes (Optional)
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter general description or notes for this proforma..."
                    className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm font-bold text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-accent)]/10"
                  />
                </label>
              </div>

              {/* Date & Tracking */}
              <div className="mt-5 grid grid-cols-2 gap-4">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)]">
                  Proforma Date
                  <InputActionField
                    type="date"
                    value={proformaDate}
                    onValueChange={setProformaDate}
                    className="mt-1 w-full"
                    showPasteButton={false}
                  />
                </label>
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)]">
                  Tracking / PO Reference
                  <InputActionField
                    value={trackingId}
                    onValueChange={(val) => setTrackingId(val.toUpperCase())}
                    placeholder="External tracking #"
                    className="mt-1 w-full"
                    forceUppercase
                  />
                </label>
              </div>

              {/* Line Items */}
              <div className="mt-6 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm flex flex-col gap-4">
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
                  <div
                    className="grid gap-3 items-end"
                    style={{
                      gridTemplateColumns: layoutMode === 'mini'
                        ? '1fr'
                        : layoutMode === 'compact'
                          ? 'minmax(200px, 1fr) auto'
                          : layoutMode === 'standard'
                            ? 'minmax(200px, 1fr) auto 100px 140px auto'
                            : 'minmax(200px, 1.9fr) 56px 132px 176px 132px',
                    }}
                  >
                    <div className={layoutMode === 'compact' ? 'col-span-2' : ''}>
                      <p className="text-xs font-black uppercase tracking-wider text-[var(--c-muted)]">Application / Service</p>
                      <div className="mt-2">
                    <ServiceSearchField
                      onSelect={handleServiceDraftSelect}
                      selectedId={itemBuilder.service?.id || null}
                      placeholder="Select service..."
                      onCreateNew={null}
                      refreshKey={refreshIncentive}
                      variant="compact"
                      editableDescription
                      descriptionValue={itemBuilder.description}
                      onDescriptionChange={(value) => setItemBuilder((prev) => ({ ...prev, description: value }))}
                      descriptionPlaceholder="Application description (optional)"
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

                    <label className="text-xs font-black uppercase tracking-wider text-[var(--c-muted)] whitespace-nowrap">
                        Quantity
                        <div className="mt-2 flex h-10 w-full overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] focus-within:border-[var(--c-accent)] focus-within:ring-4 focus-within:ring-[var(--c-accent)]/5">
                          <input
                            type="number"
                            min={1}
                            value={itemBuilder.qty}
                            onChange={(event) => setItemBuilder((prev) => ({ ...prev, qty: Math.max(1, Number(event.target.value) || 1) }))}
                            className="no-spinner min-w-0 flex-1 bg-transparent px-2 text-center text-sm font-bold text-[var(--c-text)] outline-none"
                          />
                          <div className="flex w-7 flex-col border-l border-[var(--c-border)]">
                            <button
                              type="button"
                              onClick={() => adjustBuilderQty(1)}
                              className="flex h-1/2 items-center justify-center bg-[var(--c-surface)] text-[var(--c-muted)] transition hover:text-[var(--c-accent)]"
                              aria-label="Increase quantity"
                            >
                              <ChevronUp strokeWidth={1.5} className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustBuilderQty(-1)}
                              className="flex h-1/2 items-center justify-center border-t border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] transition hover:text-[var(--c-accent)]"
                              aria-label="Decrease quantity"
                            >
                              <ChevronDown strokeWidth={1.5} className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                    </label>
                    <label className="text-xs font-black uppercase tracking-wider text-[var(--c-muted)] whitespace-nowrap">
                        Unit Price
                        <div className="mt-2 flex h-10 w-full overflow-hidden items-center rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] pl-3 pr-2 focus-within:border-[var(--c-accent)] focus-within:ring-4 focus-within:ring-[var(--c-accent)]/5">
                          <DirhamIcon className="mr-3 h-4 w-4 shrink-0 text-[var(--c-muted)]" />
                          <input
                            type="number"
                            min={0}
                            value={itemBuilder.amount}
                            onChange={(event) => setItemBuilder((prev) => ({ ...prev, amount: event.target.value }))}
                            onBlur={(event) => setItemBuilder((prev) => ({ ...prev, amount: formatAmountInputValue(event.target.value) }))}
                            placeholder="0.00"
                            className="no-spinner min-w-0 flex-1 bg-transparent text-sm font-bold text-[var(--c-text)] outline-none placeholder:text-[var(--c-muted)]"
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
                      setRefreshIncentive((prev) => prev + 1);
                      setItemBuilderError('');
                      setItemBuilder({
                        service: createdTemplate,
                        qty: 1,
                        amount: formatAmountInputValue(createdTemplate.clientCharge || 0),
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
                                  <ApplicationIdentityRow
                                    name={resolveItemName(item)}
                                    iconUrl={resolveItemIconUrl(item)}
                                    className="min-w-0 flex-1"
                                  />
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
                                      placeholder="Description for this line item (optional)"
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
                        <span className="text-sm font-black text-[var(--c-text)]">Proforma Total</span>
                        <span className="text-lg font-black text-[var(--c-text)]">
                          <CurrencyValue value={totalAmount} iconSize="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-panel)] p-6 text-center text-xs font-bold uppercase tracking-widest text-[var(--c-muted)]">
                      No applications added yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Task Management Integration — Only for Accepted Proformas not yet linked */}
              {!isCreateMode && selectedProforma?.status === 'accepted' && !selectedProforma?.isLinkedToTask && (
                <div className="mt-6 rounded-2xl border-2 border-[var(--c-accent)] bg-[var(--c-accent)]/5 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-[var(--c-surface)] text-[var(--c-accent)] border border-[var(--c-border)] shadow-sm">
                      <TasksIcon size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-[var(--c-text)]">Hand-off to Tracking</h3>
                      <p className="text-[9px] font-bold text-[var(--c-muted)]">Operational task generation and assignment</p>
                    </div>
                  </div>

                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="rounded-xl bg-white/50 border border-[var(--c-accent)]/10 p-4">
                      <p className="text-[10px] font-bold text-[var(--c-text)] leading-relaxed">
                        Generate individual tasks for each application in this proforma. Assigned personnel will be notified to start processing.
                      </p>
                    </div>
                    
                    <div>
                      <span className="text-[10px] font-black uppercase text-[var(--c-muted)] mb-2 block">Assign Responsible Personnel *</span>
                      <div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-2 sm:grid-cols-2">
                        {tenantUsers.map((u) => {
                          const checked = assignedUserIds.includes(u.uid);
                          return (
                            <label key={u.uid} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${checked ? 'bg-[var(--c-accent)] text-white shadow-sm' : 'bg-[var(--c-panel)] text-[var(--c-text)] border border-transparent hover:border-[var(--c-border)]'}`}>
                              <input
                                type="checkbox"
                                className="accent-white"
                                checked={checked}
                                onChange={() => {
                                  setAssignedUserIds(prev => checked ? prev.filter(uid => uid !== u.uid) : [...prev, u.uid]);
                                }}
                              />
                              <span className="truncate">{u.displayName || u.email || u.uid}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleTransferToTasks}
                      disabled={isSaving || assignedUserIds.length === 0}
                      className="w-full rounded-xl bg-[var(--c-accent)] py-3 text-xs font-black uppercase text-white shadow-lg shadow-[var(--c-accent)]/20 transition hover:opacity-90 disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                      <Plus size={16} strokeWidth={1.5} />
                      Start Operational Tracking
                    </button>
                  </div>
                </div>
              )}

              {/* Advance Payment — only in create mode */}
              {isCreateMode && (
                <div className="mt-6 rounded-2xl border-2 border-[var(--c-accent)]/20 bg-[var(--c-accent)]/5 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <History strokeWidth={1.5} size={16} className="text-[var(--c-accent)]" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-[var(--c-accent)]">Advance Payment (Optional)</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-[var(--c-muted)]">
                        Advance Amount
                        <InputActionField
                          type="number"
                          value={String(advanceAmount)}
                          onValueChange={setAdvanceAmount}
                          placeholder="0.00"
                          className="mt-1 w-full"
                          showPasteButton={false}
                        />
                        {advanceNum > 0 && (
                          <p className="mt-1 text-[9px] text-[var(--c-muted)] font-bold">
                            Balance After: <CurrencyValue value={totalAmount - advanceNum} iconSize="h-2.5 w-2.5" />
                          </p>
                        )}
                      </label>
                      <label className="text-[10px] font-black uppercase text-[var(--c-muted)]">
                        Note
                        <InputActionField
                          value={advanceNote}
                          onValueChange={setAdvanceNote}
                          placeholder="Payment note..."
                          className="mt-1 w-full"
                        />
                      </label>
                    </div>
                    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
                      <PortalTransactionSelector
                        portalLabel="Advance Portal *"
                        methodLabel="Advance Method *"
                        portalId={advancePortalId}
                        methodId={advanceMethodId}
                        onPortalChange={(nextPortalId) => {
                          setAdvancePortalId(nextPortalId);
                          setAdvanceMethodId('');
                        }}
                        onMethodChange={setAdvanceMethodId}
                        portals={portals}
                        portal={portals.find((item) => item.id === advancePortalId) || null}
                        portalPlaceholder="Select payment portal"
                        methodPlaceholder="Select payment method"
                        disabled={!advanceNum}
                        className="p-0 border-none bg-transparent shadow-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="mt-8 flex flex-col gap-4 border-t border-[var(--c-border)] pt-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    type="button" 
                    onClick={() => { resetCreateForm(); setIsCreateMode(false); }} 
                    className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-6 py-2.5 text-[11px] font-black uppercase tracking-wider text-[var(--c-muted)] transition hover:bg-[var(--c-border)] hover:text-[var(--c-text)]"
                  >
                    {isCreateMode ? 'Discard Draft' : 'Clear Form'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
                  {!isCreateMode && selectedProforma && (
                    <>
                      {selectedProforma.status !== 'cancelled' && (
                        <>
                          <button 
                            type="button" 
                            onClick={handleEditMode} 
                            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-tight text-amber-700 transition hover:bg-amber-100"
                          >
                            Edit
                          </button>
                          {(selectedProforma.status === 'drafted' || selectedProforma.status === 'sent') && (
                            <button 
                              type="button" 
                              onClick={handleAcceptProforma} 
                              className="rounded-xl border border-[var(--c-accent)] bg-[var(--c-accent)]/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-tight text-[var(--c-accent)] transition hover:bg-[var(--c-accent)]/20"
                            >
                              Accept
                            </button>
                          )}
                          <button 
                            type="button" 
                            onClick={handleMarkAsSent} 
                            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-tight text-blue-700 transition hover:bg-blue-100"
                          >
                            Mark Sent
                          </button>
                          <button 
                            type="button" 
                            onClick={handleCancel} 
                            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-tight text-rose-700 transition hover:bg-rose-100"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      
                      <div className="h-6 w-px bg-[var(--c-border)] mx-1 hidden sm:block" />

                      <button 
                        type="button" 
                        onClick={handleDownloadPdf} 
                        className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2.5 text-[10px] font-black uppercase tracking-tight text-[var(--c-text)] transition hover:bg-[var(--c-border)] flex items-center gap-2"
                      >
                        <Download strokeWidth={2} size={14} /> PDF
                      </button>
                      
                      <button 
                        type="button" 
                        onClick={handleEmail} 
                        className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2.5 text-[10px] font-black uppercase tracking-tight text-[var(--c-text)] transition hover:bg-[var(--c-border)] flex items-center gap-2"
                      >
                        <Mail strokeWidth={2} size={14} /> Email
                      </button>

                      <button 
                        type="button" 
                        onClick={handleWhatsApp} 
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-tight text-emerald-700 transition hover:bg-emerald-100 flex items-center gap-2"
                      >
                        <WhatsAppColorIcon className="h-4 w-4" /> WhatsApp
                      </button>

                      {selectedProforma.status !== 'cancelled' && (
                        <button 
                          type="button" 
                          onClick={() => navigate(`/t/${tenantId}/receive-payments?proformaId=${selectedId}`)} 
                          className="rounded-xl bg-[var(--c-accent)] px-5 py-2.5 text-[10px] font-black uppercase tracking-tight text-white shadow-lg shadow-[var(--c-accent)]/20 transition hover:opacity-90"
                        >
                          Receive Payment
                        </button>
                      )}
                    </>
                  )}
                  {isCreateMode && (
                    <button 
                      type="button" 
                      onClick={handleSaveClick} 
                      disabled={isSaving} 
                      className="rounded-xl bg-[var(--c-accent)] px-10 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-[var(--c-accent)]/30 flex items-center gap-2 disabled:opacity-50 transition transform active:scale-95"
                    >
                      <Save strokeWidth={2} size={16} /> Generate Proforma
                    </button>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <ActionProgressOverlay
        open={isSaving || actionOverlay.open}
        kind={isSaving ? 'process' : actionOverlay.kind}
        title={isSaving ? 'Proforma Generating' : actionOverlay.title}
        subtitle={isSaving ? 'Finalizing the proforma and synchronizing linked records safely.' : actionOverlay.subtitle}
        status={isSaving ? 'Processing Transaction...' : actionOverlay.status}
      />

      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title || ''}
        message={confirmDialog.message || ''}
        confirmText={confirmDialog.confirmText || 'Confirm'}
        cancelText={confirmDialog.cancelText || 'Cancel'}
        isDangerous={confirmDialog.isDangerous}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />

    </PageShell>
  );
};

export default ProformaInvoicesPage;
