import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import IconSelect from '../components/common/IconSelect';
import CurrencyValue from '../components/common/CurrencyValue';
import DirhamIcon from '../components/common/DirhamIcon';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PortalTransactionSelector from '../components/common/PortalTransactionSelector';
import ProgressVideoOverlay from '../components/common/ProgressVideoOverlay';
import ActionProgressOverlay from '../components/common/ActionProgressOverlay';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import {
  createPortalBalanceAdjustmentRequest,
  executeInternalTransfer,
  fetchPortalTransactions,
  fetchTenantPortals,
  fetchTenantUsersMap,
  sendTenantDocumentEmail,
  upsertTenantNotification,
  upsertTenantPortal,
} from '../lib/backendStore';
import { createSyncEvent } from '../lib/syncEvents';
import { fetchApplicationIconLibrary } from '../lib/applicationIconLibraryStore';
import { generateDisplayTxId } from '../lib/txIdGenerator';
import { generateTenantPdf } from '../lib/pdfGenerator';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../lib/systemAssetsCache';
import { canUserPerformAction } from '../lib/userControlPreferences';
import { buildNotificationPayload, generateNotificationId } from '../lib/notificationTemplate';
import { sendUniversalNotification } from '../lib/notificationDrafting';
import {
  DEFAULT_PORTAL_ICON,
  buildMethodIconMap,
  resolveDefaultTransactionMethodIcon,
  resolvePortalCategories,
  resolvePortalCategory,
  resolvePortalMethodDefinitions,
  resolveMethodIconUrl,
  resolvePortalTypeIcon,
} from '../lib/transactionMethodConfig';

const EMPTY_LEDGER_CELL = '—';

const toDateText = (value) => {
  if (!value) return EMPTY_LEDGER_CELL;
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
  if (typeof value?.toMillis === 'function') return new Date(value.toMillis()).toLocaleString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? EMPTY_LEDGER_CELL : parsed.toLocaleString();
};

const toDateOnlyText = (value) => {
  if (!value) return EMPTY_LEDGER_CELL;
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? EMPTY_LEDGER_CELL : d.toISOString().slice(0, 10);
  }
  if (typeof value?.toMillis === 'function') {
    const d = new Date(value.toMillis());
    return Number.isNaN(d.getTime()) ? EMPTY_LEDGER_CELL : d.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? EMPTY_LEDGER_CELL : parsed.toISOString().slice(0, 10);
};

const METHOD_ASSET_MAP = {
  cashByHand: ['icon_method_cash'],
  bankTransfer: ['icon_method_bank_transfer'],
  cdmDeposit: ['icon_method_cdm_deposit', 'icon_method_bank_transfer'],
  checqueDeposit: ['icon_method_cheque'],
  onlinePayment: ['icon_method_online'],
  cashWithdrawals: ['icon_method_cash_withdrawals', 'icon_method_cash'],
  tabby: ['icon_method_tabby'],
  tamara: ['icon_method_tamara'],
};

const CATEGORY_ASSET_MAP = {
  Bank: 'icon_portal_bank',
  'Card Payment': 'icon_portal_card',
  'Petty Cash': 'icon_portal_cash',
  Portals: 'icon_portal_portals',
  Terminal: 'icon_portal_terminal',
};

const resolvePortalTypeAsset = (type, systemAssets) => {
  const key = CATEGORY_ASSET_MAP[String(type || '').trim()];
  return (key && systemAssets?.[key]?.iconUrl) || resolvePortalTypeIcon(type) || DEFAULT_PORTAL_ICON;
};

const resolveMethodAsset = (method, iconMap, systemAssets) => {
  const systemKeys = METHOD_ASSET_MAP[method?.id] || [];
  for (const key of systemKeys) {
    if (key && systemAssets?.[key]?.iconUrl) return systemAssets[key].iconUrl;
  }
  return method?.iconUrl || resolveMethodIconUrl(iconMap, method?.id) || resolveDefaultTransactionMethodIcon(method?.id);
};

const waitForMinimumProgress = async (startedAt, minimumMs = 2400) => {
  const elapsed = Date.now() - startedAt;
  if (elapsed >= minimumMs) return;
  await new Promise((resolve) => window.setTimeout(resolve, minimumMs - elapsed));
};

const getStatusBadgeClass = (statusValue) => {
  const status = String(statusValue || 'active').toLowerCase();
  if (status === 'active') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (status === 'pending') return 'border-amber-300 bg-amber-50 text-amber-700';
  if (status === 'blocked' || status === 'frozen' || status === 'inactive') return 'border-rose-300 bg-rose-50 text-rose-700';
  return 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)]';
};

const formatValue = (value) => {
  if (value === null || value === undefined) return EMPTY_LEDGER_CELL;
  if (typeof value?.toDate === 'function' || typeof value?.toMillis === 'function') return toDateText(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const toFieldLabel = (key) => {
  return String(key || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
};

const PortalDetailPage = () => {
  const { tenantId, portalId } = useParams();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const [portal, setPortal] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'Bank',
    status: 'active',
    methods: [],
    customCategories: [],
    customMethods: [],
  });
  const [txRows, setTxRows] = useState([]);
  const [usersByUid, setUsersByUid] = useState({});
  const [portalsById, setPortalsById] = useState({});
  const [methodIconMap, setMethodIconMap] = useState({});
  const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isTransferSaving, setIsTransferSaving] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isStatementPreviewOpen, setIsStatementPreviewOpen] = useState(false);
  const [statementPreviewUrl, setStatementPreviewUrl] = useState('');
  const [statementEmail, setStatementEmail] = useState(user?.email || '');
  const [isStatementSending, setIsStatementSending] = useState(false);
  const [isStatementPreviewLoading, setIsStatementPreviewLoading] = useState(false);
  const [isStatementGenerating, setIsStatementGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [confirmDialog, setConfirmDialog] = useState({ open: false });
  const [selectedTx, setSelectedTx] = useState(null);
  const [isBalanceAdjustOpen, setIsBalanceAdjustOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromPortalId: '',
    fromMethodId: '',
    toPortalId: '',
    toMethodId: '',
    amount: '',
    fee: '0',
    description: '',
  });
  const [balanceAdjustForm, setBalanceAdjustForm] = useState({
    direction: 'add',
    methodId: '',
    amount: '',
    reason: '',
  });
  const [isBalanceAdjustSaving, setIsBalanceAdjustSaving] = useState(false);
  const [showTransferSourceBalance, setShowTransferSourceBalance] = useState(false);
  const [showTransferDestinationBalance, setShowTransferDestinationBalance] = useState(false);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [statementRange, setStatementRange] = useState({
    start: (() => {
      const now = new Date();
      const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      return start.toISOString().slice(0, 10);
    })(),
    end: todayIso,
  });
  const [minTxDate, setMinTxDate] = useState(todayIso);
  const [maxTxDate] = useState(todayIso);
  const openConfirm = (options) => setConfirmDialog({ open: true, isDangerous: false, ...options });
  const closeConfirm = () => setConfirmDialog((prev) => ({ ...prev, open: false }));

  useEffect(() => {
    getSystemAssets().then(setSystemAssets).catch(() => { });
  }, []);

  const loadData = useCallback(async () => {
    if (!tenantId || !portalId) return;
    setIsLoading(true);
    const [portalRes, txRes, iconRes, usersRes] = await Promise.all([
      fetchTenantPortals(tenantId),
      fetchPortalTransactions(tenantId, portalId),
      fetchApplicationIconLibrary(tenantId),
      fetchTenantUsersMap(tenantId),
    ]);

    if (portalRes.ok) {
      const map = {};
      (portalRes.rows || []).forEach((row) => {
        if (!row?.id) return;
        map[row.id] = row;
      });
      setPortalsById(map);
      const selected = (portalRes.rows || []).find((row) => row.id === portalId) || null;
      setPortal(selected);
      if (selected) {
        setForm({
          name: selected.name || '',
          type: selected.type || 'Bank',
          status: selected.status || 'active',
          methods: Array.isArray(selected.methods) ? selected.methods : [],
          customCategories: Array.isArray(selected.customCategories) ? selected.customCategories : [],
          customMethods: Array.isArray(selected.customMethods) ? selected.customMethods : [],
        });
      }
    }
    if (txRes.ok) setTxRows(txRes.rows || []);
    if (iconRes.ok) {
      setMethodIconMap(buildMethodIconMap(iconRes.rows || []));
    }
    if (usersRes?.ok) {
      const nextUsers = {};
      (usersRes.rows || []).forEach((item) => {
        if (!item?.uid) return;
        nextUsers[item.uid] = item;
      });
      setUsersByUid(nextUsers);
    } else {
      setUsersByUid({});
    }
    const minDateMillis = (txRes.ok ? (txRes.rows || []) : []).reduce((min, row) => {
      const ts = toMillis(row.date || row.createdAt || row.updatedAt);
      if (!ts) return min;
      return min === 0 ? ts : Math.min(min, ts);
    }, 0);
    if (minDateMillis > 0) {
      const iso = new Date(minDateMillis).toISOString().slice(0, 10);
      setMinTxDate(iso);
      setStatementRange((prev) => ({
        ...prev,
        start: prev.start < iso ? iso : prev.start,
      }));
    }
    setIsLoading(false);
  }, [tenantId, portalId]);

  const getCreator = useCallback((uid) => {
    const creator = usersByUid[String(uid || '')];
    if (!creator) return { name: uid || 'Unknown user', avatar: '/avatar.png' };
    return {
      name: creator.displayName || creator.email || uid || 'Unknown user',
      avatar: creator.photoURL || '/avatar.png',
    };
  }, [usersByUid]);

  const renderTxValue = useCallback((key, value) => {
    if (key === 'createdBy') {
      const creator = getCreator(value);
      return (
        <Link
          to={`/t/${tenantId}/profile/edit?uid=${encodeURIComponent(String(value || ''))}`}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--c-border)] bg-[var(--c-panel)] px-2 py-1 pr-3 text-xs text-[var(--c-text)] hover:border-[var(--c-accent)]"
          aria-label={`Open profile of ${creator.name}`}
        >
          <img src={creator.avatar} alt={creator.name} className="h-6 w-6 rounded-full object-cover" />
          <span>{creator.name}</span>
          <ExternalLink strokeWidth={1.5} size={12} />
        </Link>
      );
    }

    if (key === 'portalId') {
      const p = portalsById[String(value || '')];
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--c-border)] bg-[var(--c-panel)] px-2 py-1 pr-3 text-xs text-[var(--c-text)]">
          <img
            src={p?.logoUrl || p?.iconUrl || resolvePortalTypeAsset(p?.type, systemAssets)}
            alt={p?.name || 'Portal'}
            className="h-6 w-6 rounded object-cover"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_PORTAL_ICON;
            }}
          />
          <span>{p?.name || 'Portal'}</span>
        </div>
      );
    }

    if (key === 'displayTransactionId' || key === 'id') {
      return (
        <span className="inline-flex rounded-md border border-[var(--c-border)] bg-[var(--c-panel)] px-2 py-1 text-xs font-semibold text-[var(--c-accent)]">
          {formatValue(value)}
        </span>
      );
    }

    if (key === 'date' || key === 'createdAt' || key === 'updatedAt') {
      return <span>{toDateText(value)}</span>;
    }

    return <span>{formatValue(value)}</span>;
  }, [getCreator, portalsById, tenantId, systemAssets]);

  const handlePrintTx = useCallback(() => {
    if (!selectedTx) return;
    const creator = getCreator(selectedTx.createdBy);
    const portalRef = portalsById[String(selectedTx.portalId || '')] || null;
    const amount = Number(selectedTx.amount || 0);
    const amountLabel = Number.isFinite(amount)
      ? `${amount < 0 ? '-' : ''}<img src="/dirham.svg" class="dh-icon" alt="Dhs"> ${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : EMPTY_LEDGER_CELL;

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Transaction Slip</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #f8fafc; }
            .slip { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; }
            .head { padding: 16px 18px; border-bottom: 1px solid #e2e8f0; background: #f1f5f9; }
            .title { margin: 0; font-size: 18px; font-weight: 700; }
            .sub { margin: 4px 0 0; font-size: 12px; color: #475569; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top; }
            td:first-child { width: 180px; font-weight: 700; background: #f8fafc; color: #334155; text-transform: uppercase; }
            .amt { font-weight: 800; color: ${amount < 0 ? '#be123c' : '#047857'}; }
            .foot { padding: 12px 14px; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
            .dh-icon { height: 1em; width: 1em; vertical-align: middle; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="slip">
            <div class="head">
              <h1 class="title">Transaction Slip</h1>
              <p class="sub">${String(selectedTx.displayTransactionId || selectedTx.id || EMPTY_LEDGER_CELL)}</p>
            </div>
            <table>
              <tr><td>Portal</td><td>${String(portalRef?.name || selectedTx.portalId || EMPTY_LEDGER_CELL)}</td></tr>
              <tr><td>Type</td><td>${String(selectedTx.type || EMPTY_LEDGER_CELL)}</td></tr>
              <tr><td>Amount</td><td class="amt">${amountLabel}</td></tr>
              <tr><td>Date</td><td>${toDateText(selectedTx.date || selectedTx.createdAt)}</td></tr>
              <tr><td>Created By</td><td>${String(creator.name || EMPTY_LEDGER_CELL)}</td></tr>
              <tr><td>Description</td><td>${String(selectedTx.description || EMPTY_LEDGER_CELL)}</td></tr>
            </table>
            <div class="foot">
              <span>Printed: ${new Date().toLocaleString()}</span>
              <span>ACIS Workspace</span>
            </div>
          </div>
        </body>
      </html>
    `;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 250);
  }, [selectedTx, getCreator, portalsById]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const methodMetaById = useMemo(() => {
    const methodPool = resolvePortalMethodDefinitions(portal?.customMethods || []);
    const map = {};
    methodPool.forEach((method) => {
      map[method.id] = {
        label: method.label,
        icon: resolveMethodAsset(method, methodIconMap, systemAssets),
        Icon: method.Icon,
      };
    });
    return map;
  }, [methodIconMap, portal?.customMethods, systemAssets]);

  const allPortals = useMemo(
    () => Object.entries(portalsById).map(([id, item]) => ({ id, ...(item || {}) })),
    [portalsById],
  );
  const selectedTransferSourcePortal = portalsById[transferForm.fromPortalId] || null;
  const selectedTransferDestinationPortal = portalsById[transferForm.toPortalId] || null;
  const transferAmountPreview = Math.max(0, Number(transferForm.amount || 0));
  const transferFeePreview = Math.max(0, Number(transferForm.fee || 0));
  const transferSourceProjectedBalance = selectedTransferSourcePortal
    ? Number(selectedTransferSourcePortal.balance || 0) - transferAmountPreview - transferFeePreview
    : null;
  const transferDestinationProjectedBalance = selectedTransferDestinationPortal
    ? Number(selectedTransferDestinationPortal.balance || 0) + transferAmountPreview
    : null;

  const portalTypeOptions = useMemo(
    () => resolvePortalCategories(form.customCategories).map((item) => ({
      value: item.id,
      label: item.label,
      icon: item?.isCustom ? (item.icon || DEFAULT_PORTAL_ICON) : resolvePortalTypeAsset(item.id, systemAssets),
      meta: '',
    })),
    [form.customCategories, systemAssets],
  );

  useEffect(() => {
    if (!selectedTransferSourcePortal) {
      setShowTransferSourceBalance(false);
      return;
    }
    if (transferForm.fromMethodId && Array.isArray(selectedTransferSourcePortal.methods) && selectedTransferSourcePortal.methods.includes(transferForm.fromMethodId)) return;
    setTransferForm((prev) => ({
      ...prev,
      fromMethodId: Array.isArray(selectedTransferSourcePortal.methods) && selectedTransferSourcePortal.methods.length
        ? selectedTransferSourcePortal.methods[0]
        : '',
    }));
  }, [selectedTransferSourcePortal, transferForm.fromMethodId]);

  useEffect(() => {
    if (!selectedTransferDestinationPortal) {
      setShowTransferDestinationBalance(false);
      return;
    }
  }, [selectedTransferDestinationPortal]);

  useEffect(() => {
    if (!selectedTransferDestinationPortal) return;
    if (transferForm.toMethodId && Array.isArray(selectedTransferDestinationPortal.methods) && selectedTransferDestinationPortal.methods.includes(transferForm.toMethodId)) return;
    setTransferForm((prev) => ({
      ...prev,
      toMethodId: Array.isArray(selectedTransferDestinationPortal.methods) && selectedTransferDestinationPortal.methods.length
        ? selectedTransferDestinationPortal.methods[0]
        : '',
    }));
  }, [selectedTransferDestinationPortal, transferForm.toMethodId]);

  useEffect(() => {
    if (!portal) return;
    const methods = Array.isArray(portal.methods) ? portal.methods : [];
    if (!methods.length) {
      setBalanceAdjustForm((prev) => ({ ...prev, methodId: '' }));
      return;
    }
    if (balanceAdjustForm.methodId && methods.includes(balanceAdjustForm.methodId)) return;
    setBalanceAdjustForm((prev) => ({ ...prev, methodId: methods[0] }));
  }, [portal, balanceAdjustForm.methodId]);

  const transactionMethods = useMemo(
    () => resolvePortalMethodDefinitions(form.customMethods),
    [form.customMethods],
  );

  const monthOptions = useMemo(() => {
    const result = [];
    const minDate = new Date(minTxDate);
    const maxDate = new Date(maxTxDate);
    minDate.setUTCDate(1);
    maxDate.setUTCDate(1);
    const cursor = new Date(maxDate);
    while (cursor >= minDate) {
      const value = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
      const label = cursor.toLocaleString('default', { month: 'long', year: 'numeric' });
      result.push({ value, label });
      cursor.setUTCMonth(cursor.getUTCMonth() - 1);
    }
    return result;
  }, [minTxDate, maxTxDate]);

  const openTransfer = () => {
    setTransferForm({
      fromPortalId: portalId || '',
      fromMethodId: '',
      toPortalId: '',
      toMethodId: '',
      amount: '',
      fee: '0',
      description: '',
    });
    setShowTransferSourceBalance(false);
    setShowTransferDestinationBalance(false);
    setIsTransferOpen(true);
  };

  const computeStatement = useCallback(() => {
    const startMillis = toMillis(statementRange.start);
    const endMillis = toMillis(statementRange.end) + 24 * 60 * 60 * 1000 - 1;
    const sorted = [...txRows].sort((a, b) => toMillis(a.date || a.createdAt || a.updatedAt) - toMillis(b.date || b.createdAt || b.updatedAt));

    const openingBalance = sorted.reduce((sum, row) => {
      const ts = toMillis(row.date || row.createdAt || row.updatedAt);
      if (!ts || ts >= startMillis) return sum;
      const amount = Number(row.amount || 0);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);

    const inRange = sorted.filter((row) => {
      const ts = toMillis(row.date || row.createdAt || row.updatedAt);
      return ts && ts >= startMillis && ts <= endMillis;
    });

    const creditTotal = inRange.reduce((sum, r) => {
      const amt = Number(r.amount || 0);
      return amt > 0 ? sum + amt : sum;
    }, 0);
    const debitTotal = inRange.reduce((sum, r) => {
      const amt = Number(r.amount || 0);
      return amt < 0 ? sum + Math.abs(amt) : sum;
    }, 0);
    const closingBalance = openingBalance + inRange.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return { inRange, openingBalance, closingBalance, creditTotal, debitTotal, startMillis, endMillis };
  }, [statementRange, txRows]);

  const handleMonthSelect = (value) => {
    if (!value) return;
    const [year, month] = value.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    const max = new Date(`${maxTxDate}T23:59:59Z`);
    const clampedEnd = end > max ? max : end;
    setStatementRange({
      start: start.toISOString().slice(0, 10),
      end: clampedEnd.toISOString().slice(0, 10),
    });
  };

  const base64ToPdfBlob = (base64) => {
    const binary = window.atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'application/pdf' });
  };

  useEffect(() => {
    return () => {
      if (statementPreviewUrl) {
        URL.revokeObjectURL(statementPreviewUrl);
      }
    };
  }, [statementPreviewUrl]);

  const handlePrintStatement = async () => {
    setIsStatementGenerating(true);
    const data = buildStatementPdfData();
    const pdfRes = await generateTenantPdf({
      tenantId,
      documentType: 'portalStatement',
      data: {
        txId: data.txId,
        date: statementRange.end,
        amount: data.closingBalance,
        recipientName: portal?.name || portalId,
        description: `Portal statement ${statementRange.start} to ${statementRange.end}`,
        items: data.items,
        statementRows: data.statementRows,
        portalLogoUrl: portal?.logoUrl || portal?.iconUrl || '',
      },
      save: false,
      returnBase64: true,
      filename: `portalStatement_${portalId}_${statementRange.start}_${statementRange.end}.pdf`,
    });

    if (!pdfRes.ok || !pdfRes.base64) {
      setIsStatementGenerating(false);
      setMessageType('error');
      setMessage(pdfRes.error || 'Failed to print statement.');
      return;
    }

    const hasElectronNativePrint = Boolean(window.electron?.documents?.printPdfBase64);
    if (hasElectronNativePrint) {
      const nativePrint = await window.electron.documents.printPdfBase64({
        base64: pdfRes.base64,
        jobName: `Portal Statement ${portalId} (${statementRange.start} to ${statementRange.end})`,
      });
      if (nativePrint?.ok) {
        setIsStatementGenerating(false);
        setMessageType('success');
        setMessage('Statement sent to printer.');
        void notifyStatementAction({
          actionKey: 'printed',
          actorHint: `Hi ${resolveActorName()}, you have printed the statement for ${portal?.name || portalId} successfully.`,
          teamHint: `${resolveActorName()} printed portal statement for ${portal?.name || portalId}.`,
        });
        return;
      }
    }

    const pdfBlob = base64ToPdfBlob(pdfRes.base64);
    const blobUrl = URL.createObjectURL(pdfBlob);
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.src = blobUrl;
    document.body.appendChild(frame);

    frame.onload = () => {
      setIsStatementGenerating(false);
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      void notifyStatementAction({
        actionKey: 'printed',
        actorHint: `Hi ${resolveActorName()}, you have printed the statement for ${portal?.name || portalId} successfully.`,
        teamHint: `${resolveActorName()} printed portal statement for ${portal?.name || portalId}.`,
      });
      window.setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        document.body.removeChild(frame);
      }, 1000);
    };
  };

  const resolveActorName = () => {
    const displayName = String(user?.displayName || '').trim();
    if (displayName) return displayName;
    const email = String(user?.email || '').trim();
    if (email.includes('@')) return email.split('@')[0];
    return 'User';
  };

  const notifyStatementAction = async ({
    actionKey = 'generated',
    actorHint = '',
    teamHint = '',
  } = {}) => {
    if (!tenantId || !user?.uid) return;
    const portalName = String(portal?.name || portalId || 'Portal').trim();
    const actorName = resolveActorName();
    const statementPeriod = `${statementRange.start} to ${statementRange.end}`;
    const routePath = `/t/${tenantId}/portal-management/${portalId}`;

    const actorNotificationId = `${generateNotificationId({ topic: 'documents', subTopic: 'statement', at: Date.now() })}-ACT`;
    const teamNotificationId = `${generateNotificationId({ topic: 'documents', subTopic: 'statement', at: Date.now() + 1 })}-TEAM`;

    await Promise.allSettled([
      sendUniversalNotification({
        tenantId,
        notificationId: actorNotificationId,
        topic: 'documents',
        subTopic: 'statement',
        type: 'success',
        title: `Statement ${actionKey}`,
        message: actorHint || `Hi ${actorName}, your statement action was completed successfully.`,
        detail: `${portalName} statement (${statementPeriod}) completed.`,
        createdBy: user.uid,
        routePath,
        pageKey: 'portalManagement',
        sectionKey: 'statement',
        eventType: 'statementAction',
        entityType: 'portal',
        entityId: portalId,
        entityLabel: portalName,
        entityMeta: {
          iconUrl: portal?.logoUrl || portal?.iconUrl || resolvePortalTypeAsset(portal?.type, systemAssets),
          logoId: portal?.logoId || portalId,
          name: portalName,
          type: portal?.type,
          status: portal?.status,
          balance: portal?.balance || 0,
        },
        quickView: {
          badge: 'Statement',
          title: `Portal Statement ${actionKey}`,
          subtitle: portalName,
          description: `Statement period: ${statementPeriod}`,
          fields: [
            { label: 'Action', value: actionKey },
            { label: 'Portal', value: portalName },
            { label: 'Requested By', value: actorName },
            { label: 'Period', value: statementPeriod },
          ],
        },
        extra: {
          targetUsers: [user.uid],
        },
      }),
      sendUniversalNotification({
        tenantId,
        notificationId: teamNotificationId,
        topic: 'documents',
        subTopic: 'statement',
        type: 'info',
        title: 'Staff statement request',
        message: teamHint || `${actorName} performed a statement PDF action.`,
        detail: `Portal: ${portalName} | Period: ${statementPeriod}`,
        createdBy: user.uid,
        routePath,
        pageKey: 'portalManagement',
        sectionKey: 'statement',
        eventType: 'statementAction',
        entityType: 'portal',
        entityId: portalId,
        entityLabel: portalName,
        quickView: {
          badge: 'Team Alert',
          title: 'Statement request by staff',
          subtitle: portalName,
          description: `${actorName} completed a statement action.`,
          fields: [
            { label: 'Staff', value: actorName },
            { label: 'Action', value: actionKey },
            { label: 'Period', value: statementPeriod },
          ],
        },
        extra: {
          excludedUsers: [user.uid],
        },
      }),
    ]);
  };

  const buildStatementPdfData = () => {
    const { inRange, openingBalance, closingBalance, creditTotal, debitTotal } = computeStatement();
    const txId = `${portalId}_${statementRange.start}_${statementRange.end}`;
    let runningBalance = openingBalance;
    const statementRows = [
      {
        date: toDateOnlyText(statementRange.start),
        description: 'Opening Balance',
        debit: 0,
        credit: 0,
        balance: openingBalance,
      },
      ...inRange.map((row) => {
        const amount = Number(row.amount || 0);
        if (Number.isFinite(amount)) {
          runningBalance += amount;
        }
        return {
          date: toDateOnlyText(row.date || row.createdAt || row.updatedAt),
          description: row.description || row.displayTransactionId || row.id || row.type || EMPTY_LEDGER_CELL,
          debit: amount < 0 ? Math.abs(amount) : 0,
          credit: amount > 0 ? amount : 0,
          balance: runningBalance,
        };
      }),
      {
        date: toDateOnlyText(statementRange.end),
        description: 'Closing Balance',
        debit: 0,
        credit: 0,
        balance: closingBalance,
      },
    ];

    const items = [
      { name: 'Opening Balance', qty: 1, price: openingBalance, total: openingBalance },
      ...inRange.map((row) => ({
        name: `${toDateText(row.date || row.createdAt || row.updatedAt)} • ${row.displayTransactionId || row.id} • ${row.type || ''}`,
        qty: 1,
        price: Number(row.amount || 0),
        total: Number(row.amount || 0),
      })),
      { name: 'Total Credits', qty: 1, price: creditTotal, total: creditTotal },
      { name: 'Total Debits', qty: 1, price: -debitTotal, total: -debitTotal },
      { name: 'Closing Balance', qty: 1, price: closingBalance, total: closingBalance },
    ];
    return { txId, items, statementRows, closingBalance };
  };

  const handleDownloadStatementPdf = async () => {
    setIsStatementGenerating(true);
    const data = buildStatementPdfData();
    const pdfRes = await generateTenantPdf({
      tenantId,
      documentType: 'portalStatement',
      data: {
        txId: data.txId,
        date: statementRange.end,
        amount: data.closingBalance,
        recipientName: portal?.name || portalId,
        description: `Portal statement ${statementRange.start} to ${statementRange.end}`,
        items: data.items,
        statementRows: data.statementRows,
        portalLogoUrl: portal?.logoUrl || portal?.iconUrl || '',
      },
      save: true,
      returnBase64: false,
      filename: `portalStatement_${portalId}_${statementRange.start}_${statementRange.end}.pdf`,
    });
    if (!pdfRes.ok) {
      setIsStatementGenerating(false);
      setMessageType('error');
      setMessage(pdfRes.error || 'Failed to generate statement PDF.');
      return;
    }
    setIsStatementGenerating(false);
    setMessageType('success');
    setMessage('Statement PDF generated successfully.');
    void notifyStatementAction({
      actionKey: 'downloaded',
      actorHint: `Hi ${resolveActorName()}, you have generated the statement for ${portal?.name || portalId} successfully.`,
      teamHint: `${resolveActorName()} generated/downloaded portal statement for ${portal?.name || portalId}.`,
    });
  };

  const closeStatementPreview = () => {
    if (statementPreviewUrl) {
      URL.revokeObjectURL(statementPreviewUrl);
    }
    setStatementPreviewUrl('');
    setIsStatementPreviewOpen(false);
  };

  const handlePreviewStatementPdf = async () => {
    setIsStatementPreviewLoading(true);
    const data = buildStatementPdfData();
    const pdfRes = await generateTenantPdf({
      tenantId,
      documentType: 'portalStatement',
      data: {
        txId: data.txId,
        date: statementRange.end,
        amount: data.closingBalance,
        recipientName: portal?.name || portalId,
        description: `Portal statement ${statementRange.start} to ${statementRange.end}`,
        items: data.items,
        statementRows: data.statementRows,
        portalLogoUrl: portal?.logoUrl || portal?.iconUrl || '',
      },
      save: false,
      returnBase64: true,
      filename: `portalStatement_${portalId}_${statementRange.start}_${statementRange.end}.pdf`,
    });
    setIsStatementPreviewLoading(false);

    if (!pdfRes.ok || !pdfRes.base64) {
      setMessageType('error');
      setMessage(pdfRes.error || 'Failed to prepare statement preview.');
      return;
    }

    if (statementPreviewUrl) {
      URL.revokeObjectURL(statementPreviewUrl);
    }
    const blobUrl = URL.createObjectURL(base64ToPdfBlob(pdfRes.base64));
    setStatementPreviewUrl(blobUrl);
    setIsStatementPreviewOpen(true);
    void notifyStatementAction({
      actionKey: 'previewed',
      actorHint: `Hi ${resolveActorName()}, you have viewed the statement preview for ${portal?.name || portalId} successfully.`,
      teamHint: `${resolveActorName()} previewed portal statement for ${portal?.name || portalId}.`,
    });
  };

  const handleEmailStatementPdf = async () => {
    const data = buildStatementPdfData();
    setIsStatementSending(true);
    const pdfRes = await generateTenantPdf({
      tenantId,
      documentType: 'portalStatement',
      data: {
        txId: data.txId,
        date: statementRange.end,
        amount: data.closingBalance,
        recipientName: portal?.name || portalId,
        description: `Portal statement ${statementRange.start} to ${statementRange.end}`,
        items: data.items,
        statementRows: data.statementRows,
        portalLogoUrl: portal?.logoUrl || portal?.iconUrl || '',
      },
      save: false,
      returnBase64: true,
      filename: `portalStatement_${portalId}_${statementRange.start}_${statementRange.end}.pdf`,
    });
    if (!pdfRes.ok) {
      setIsStatementSending(false);
      setMessageType('error');
      setMessage(pdfRes.error || 'Failed to generate statement PDF.');
      return;
    }
    const email = statementEmail || user?.email;
    if (!email) {
      setIsStatementSending(false);
      setMessageType('error');
      setMessage('Please provide an email to send the statement.');
      return;
    }
    const emailRes = await sendTenantDocumentEmail(
      tenantId,
      email,
      'portalStatement',
      pdfRes.base64,
      {
        txId: data.txId,
        recipientName: portal?.name || portalId
      }
    );
    setIsStatementSending(false);
    if (!emailRes.ok) {
      setMessageType('error');
      setMessage(emailRes.error || 'Failed to send email.');
      return;
    }
    setMessageType('success');
    setMessage(`Statement emailed to ${email}.`);
    void notifyStatementAction({
      actionKey: 'emailed',
      actorHint: `Hi ${resolveActorName()}, you have emailed the statement for ${portal?.name || portalId} successfully. Please check your email.`,
      teamHint: `${resolveActorName()} emailed portal statement for ${portal?.name || portalId}.`,
    });
  };

  const performTransfer = async () => {
    if (!tenantId || !user?.uid) return;
    setIsTransferSaving(true);
    const startedAt = Date.now();
    const displayTxId = await generateDisplayTxId(tenantId, 'TRF');
    const res = await executeInternalTransfer(tenantId, {
      ...transferForm,
      amount: Number(transferForm.amount),
      fee: Number(transferForm.fee || 0),
      displayTxId,
      createdBy: user.uid,
    });
    if (!res.ok) {
      setMessageType('error');
      setMessage(res.error || 'Transfer failed.');
      setIsTransferSaving(false);
      return;
    }

    await waitForMinimumProgress(startedAt);
    const finalTxId = res.displayTxId || displayTxId;
    setMessageType('success');
    setMessage(`Transfer successful. ID: ${finalTxId}`);
    setIsTransferSaving(false);
    setIsTransferOpen(false);
    setTransferForm({
      fromPortalId: portalId || '',
      fromMethodId: '',
      toPortalId: '',
      toMethodId: '',
      amount: '',
      fee: '0',
      description: '',
    });
    setShowTransferSourceBalance(false);
    setShowTransferDestinationBalance(false);
    loadData();
  };

  const handleTransfer = (event) => {
    event.preventDefault();
    if (!tenantId || !user?.uid) return;
    if (!transferForm.fromPortalId || !transferForm.fromMethodId || !transferForm.toPortalId || !transferForm.toMethodId || !transferForm.amount) {
      setMessageType('error');
      setMessage('Please fill source, destination and amount for transfer.');
      return;
    }
    if (transferForm.fromPortalId === transferForm.toPortalId) {
      setMessageType('error');
      setMessage('Source and destination portals must be different.');
      return;
    }

    openConfirm({
      title: 'Confirm Internal Transfer?',
      message: 'Please confirm this transfer between selected portals.',
      confirmText: 'Transfer',
      onConfirm: async () => {
        closeConfirm();
        await performTransfer();
      },
    });
  };

  const onTypeChange = (nextType) => {
    const typeConfig = resolvePortalCategory(nextType, form.customCategories);
    setForm((prev) => ({
      ...prev,
      type: nextType,
      methods: typeConfig ? (typeConfig.methodIds || []) : prev.methods,
    }));
  };

  const performSave = async () => {
    if (!tenantId || !portalId || !user?.uid) return;
    setIsSaving(true);
    const startedAt = Date.now();
    const payload = {
      name: form.name.trim(),
      type: form.type,
      status: form.status,
      methods: form.methods,
      customCategories: form.customCategories,
      customMethods: form.customMethods,
      updatedBy: user.uid,
    };
    const res = await upsertTenantPortal(tenantId, portalId, payload);
    if (!res.ok) {
      setMessageType('error');
      setMessage(res.error || 'Failed to save portal changes.');
      setIsSaving(false);
      return;
    }

    await createSyncEvent({
      tenantId,
      eventType: 'update',
      entityType: 'portal',
      entityId: portalId,
      changedFields: Object.keys(payload),
      createdBy: user.uid,
    });

    await upsertTenantNotification(
      tenantId,
      generateNotificationId({ topic: 'finance', subTopic: 'portal' }),
      {
        ...buildNotificationPayload({
          topic: 'finance',
          subTopic: 'portal',
          type: 'update',
          title: 'Portal Updated',
          detail: `${form.name.trim()} settings were updated.`,
          createdBy: user.uid,
          routePath: `/t/${tenantId}/portal-management/${portalId}`,
          actions: [
            { label: 'View Details', actionType: 'quickView' },
            { label: 'View', actionType: 'link', route: `/t/${tenantId}/portal-management/${portalId}` },
          ],
        }),
        eventType: 'update',
        entityType: 'portal',
        entityId: portalId,
        entityLabel: form.name.trim(),
        pageKey: 'portalManagement',
        sectionKey: 'balanceAdjustment',
        quickView: {
          badge: 'Portal',
          title: form.name.trim(),
          subtitle: portalId,
          description: 'Portal settings were updated from the portal detail workspace.',
          fields: [
            { label: 'Portal Type', value: form.type },
            { label: 'Status', value: form.status },
            { label: 'Methods', value: Array.isArray(form.methods) && form.methods.length ? form.methods.join(', ') : 'Not specified' },
          ],
        },
      },
    ).catch(() => null);

    await waitForMinimumProgress(startedAt);
    setMessageType('success');
    setMessage('Portal settings saved.');
    setIsSaving(false);
    setIsEditMode(false);
    loadData();
  };

  const onSave = () => {
    if (!tenantId || !portalId || !user?.uid) return;
    if (!form.name.trim()) {
      setMessageType('error');
      setMessage('Portal name is required.');
      return;
    }
    openConfirm({
      title: 'Save Portal Changes?',
      message: `Confirm updating portal "${form.name.trim()}".`,
      confirmText: 'Save',
      onConfirm: async () => {
        closeConfirm();
        await performSave();
      },
    });
  };

  const performDirectBalanceAdjustment = async () => {
    if (!tenantId || !portalId || !user?.uid) return;
    const normalizedMethod = String(balanceAdjustForm.methodId || '').trim();
    const amountValue = Math.abs(Number(balanceAdjustForm.amount || 0));
    const reason = String(balanceAdjustForm.reason || '').trim();
    const direction = balanceAdjustForm.direction === 'subtract' ? 'subtract' : 'add';

    if (!normalizedMethod) {
      setMessageType('error');
      setMessage('Please choose a transaction method for balance adjustment.');
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setMessageType('error');
      setMessage('Please enter a valid adjustment amount greater than zero.');
      return;
    }
    if (!reason) {
      setMessageType('error');
      setMessage('Reason is required for direct balance adjustment.');
      return;
    }

    setIsBalanceAdjustSaving(true);
    const startedAt = Date.now();
    const result = await createPortalBalanceAdjustmentRequest(tenantId, {
      portalId,
      methodId: normalizedMethod,
      amount: amountValue,
      direction,
      reason,
      requestedBy: user.uid,
    });

    if (!result?.ok) {
      setMessageType('error');
      setMessage(result?.error || 'Balance adjustment request failed.');
      setIsBalanceAdjustSaving(false);
      return;
    }

    await waitForMinimumProgress(startedAt);
    setMessageType('success');
    setMessage('Balance adjustment request sent for approval.');
    loadData();
    setBalanceAdjustForm((prev) => ({
      ...prev,
      amount: '',
      reason: '',
    }));
    setIsBalanceAdjustSaving(false);
  };

  const onDirectBalanceAdjust = () => {
    openConfirm({
      title: 'Confirm Balance Adjustment?',
      message: 'This action will be audited and may require approval based on user role.',
      confirmText: 'Submit',
      onConfirm: async () => {
        closeConfirm();
        await performDirectBalanceAdjustment();
      },
    });
  };

  const canRequestDirectAdjustment = (() => {
    const role = String(user?.role || '').trim().toLowerCase();
    if (role === 'super admin' || role === 'superadmin') return true;
    return canUserPerformAction(tenantId, user, 'directBalanceAdjust');
  })();

  if (!user) return null;

  return (
    <PageShell title="Portal Detail" subtitle={portal?.name || portalId} iconKey="portalManagement">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(`/t/${tenantId}/portal-management`)}
            className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-xs font-semibold text-[var(--c-text)]"
          >
            Back to Portal Management
          </button>
          <button
            type="button"
            onClick={loadData}
            className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-xs font-semibold text-[var(--c-text)]"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <p className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 text-sm text-[var(--c-muted)]">
            Loading portal detail...
          </p>
        ) : !portal ? (
          <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-600">
            Portal not found.
          </p>
        ) : (
          <>
            <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={portal.logoUrl || portal.iconUrl || resolvePortalTypeAsset(portal.type, systemAssets)}
                    alt={portal.name}
                    className="h-24 w-24 rounded-2xl object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = DEFAULT_PORTAL_ICON;
                    }}
                  />
                  <div>
                    <p className="text-xl font-black text-[var(--c-text)]">{portal.name}</p>
                    <div className="mt-1 text-sm text-[var(--c-muted)]">
                      <span className="mr-1 font-semibold text-[var(--c-text)]">Balance:</span>
                      <CurrencyValue value={portal?.balance || 0} iconSize="h-4 w-4" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <div className="flex flex-wrap items-center gap-3 justify-end">
                    <div className="flex min-h-[56px] items-stretch overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] shadow-sm">
                      <div className="flex w-16 shrink-0 items-center justify-center overflow-hidden border-r border-[var(--c-border)] bg-white">
                        {(() => {
                          const typeCategory = resolvePortalCategory(portal.type, portal.customCategories);
                          const typeIcon = typeCategory?.isCustom
                            ? (typeCategory.icon || DEFAULT_PORTAL_ICON)
                            : resolvePortalTypeAsset(portal.type, systemAssets);
                          return (
                            <img
                              src={typeIcon}
                              alt={portal.type || 'Portal'}
                            className="h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = DEFAULT_PORTAL_ICON;
                              }}
                            />
                          );
                        })()}
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">Type</p>
                        <span className="text-sm font-bold text-[var(--c-text)]">{portal.type || EMPTY_LEDGER_CELL}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-bold shadow-sm min-h-[58px] ${getStatusBadgeClass(portal.status)}`}>
                      {String(portal.status || 'active').charAt(0).toUpperCase() + String(portal.status || 'active').slice(1)}
                    </span>
                  </div>
                  {!isEditMode ? (
                    <div className="flex items-center gap-2">
                      {canRequestDirectAdjustment ? (
                        <button
                          type="button"
                          onClick={() => setIsBalanceAdjustOpen((prev) => !prev)}
                          className="flex h-14 items-center rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-6 text-sm font-bold text-[var(--c-text)] shadow-sm hover:border-[var(--c-accent)] transition-colors"
                        >
                          Direct Balance
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={openTransfer}
                        disabled={!canUserPerformAction(tenantId, user, 'internalTransfer')}
                        className="flex h-14 items-center rounded-2xl border border-[var(--c-accent)] bg-[var(--c-accent)]/10 px-6 text-sm font-bold text-[var(--c-accent)] shadow-sm disabled:opacity-50 hover:bg-[var(--c-accent)]/20 transition-colors"
                      >
                        Internal Transfer
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsStatementOpen(true)}
                        className="flex h-14 items-center rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-6 text-sm font-bold text-[var(--c-text)] shadow-sm hover:border-[var(--c-accent)] transition-colors"
                      >
                        Print Statement
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditMode(true)}
                        className="flex h-14 items-center rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-6 text-sm font-bold text-[var(--c-text)] shadow-sm hover:border-[var(--c-accent)] transition-colors"
                      >
                        Edit Portal
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {isEditMode ? (
                <>
                  <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
                    <label className="text-xs font-semibold text-[var(--c-muted)]">
                      Name
                      <input
                        type="text"
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none"
                      />
                    </label>
                    <div>
                      <p className="text-xs font-semibold text-[var(--c-muted)]">Type</p>
                      <div className="mt-1">
                        <IconSelect
                          value={form.type}
                          onChange={onTypeChange}
                          options={portalTypeOptions}
                          placeholder="Select Type"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[var(--c-muted)]">Status</p>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        {['active', 'inactive'].map((statusOption) => {
                          const selected = form.status === statusOption;
                          const label = statusOption.charAt(0).toUpperCase() + statusOption.slice(1);
                          return (
                            <button
                              key={statusOption}
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, status: statusOption }))}
                              className={`flex h-14 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition ${selected
                                ? getStatusBadgeClass(statusOption)
                                : 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)] hover:border-[var(--c-accent)]/25 hover:text-[var(--c-text)]'
                                }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                    <div className="mt-3">
                    <p className="mb-2 text-xs font-semibold text-[var(--c-muted)]">Allowed Methods</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {transactionMethods.map((method) => {
                        const selected = form.methods.includes(method.id);
                        const iconUrl = resolveMethodAsset(method, methodIconMap, systemAssets);
                        const MethodIcon = method.Icon;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setForm((prev) => ({
                              ...prev,
                              methods: selected ? prev.methods.filter((id) => id !== method.id) : [...prev.methods, method.id],
                            }))}
                            className={`group flex min-h-[56px] items-stretch overflow-hidden rounded-2xl border transition-colors ${selected
                              ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_12%,var(--c-panel))] shadow-sm'
                              : 'border-[var(--c-border)] bg-[var(--c-panel)] hover:border-[var(--c-accent)]/50'
                              }`}
                          >
                            <div className={`flex w-16 shrink-0 items-center justify-center overflow-hidden border-r ${selected ? 'border-[var(--c-accent)]/30' : 'border-[var(--c-border)]'} bg-white`}>
                              {iconUrl ? (
                                <img
                                  src={iconUrl}
                                  alt={method.label}
                                  className="h-full w-full object-cover"
                                />
                              ) : MethodIcon ? (
                                <MethodIcon className="h-5 w-5 text-[var(--c-accent)]" />
                              ) : null}
                            </div>
                            <div className="flex min-w-0 flex-1 items-center px-4 py-3 text-left">
                              <span className="block text-sm font-black text-[var(--c-text)]">{method.label}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onSave}
                      disabled={isSaving}
                      className="rounded-xl bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isSaving ? 'Saving...' : 'Save Portal'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditMode(false);
                        if (portal) {
                          setForm({
                            name: portal.name || '',
                            type: portal.type || 'Bank',
                            status: portal.status || 'active',
                            methods: Array.isArray(portal.methods) ? portal.methods : [],
                            customCategories: Array.isArray(portal.customCategories) ? portal.customCategories : [],
                            customMethods: Array.isArray(portal.customMethods) ? portal.customMethods : [],
                          });
                        }
                      }}
                      className="rounded-xl border border-[var(--c-border)] px-4 py-2 text-sm font-semibold text-[var(--c-text)]"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--c-muted)] mb-3">Portal Methods</p>
                  {(portal.methods || []).length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(portal.methods || []).map((methodId) => {
                        const methodMeta = methodMetaById[methodId] || {
                          label: String(methodId || ''),
                          icon: '',
                          Icon: null,
                        };
                        const MethodIcon = methodMeta.Icon;
                        return (
                          <div
                            key={methodId}
                            className="flex min-h-[56px] items-stretch overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)]"
                          >
                            <div className="flex w-16 shrink-0 items-center justify-center overflow-hidden border-r border-[var(--c-border)] bg-white">
                              {methodMeta.icon ? (
                                <img
                                  src={methodMeta.icon}
                                  alt={methodMeta.label}
                                  className="h-full w-full object-cover"
                                />
                              ) : MethodIcon ? (
                                <MethodIcon className="h-5 w-5 text-[var(--c-accent)]" />
                              ) : null}
                            </div>
                            <div className="flex min-w-0 flex-1 items-center px-4 py-3">
                              <span className="text-sm font-black text-[var(--c-text)]">{methodMeta.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-[var(--c-muted)]">No methods allowed</p>
                  )}
                </div>
              )}
            </section>

            {message ? (
              <p className={`rounded-xl border p-3 text-sm ${messageType === 'error'
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-600'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                }`}>
                {message}
              </p>
            ) : null}

            {isBalanceAdjustOpen ? (
              <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--c-text)]">Direct Balance Adjustment</p>
                    <p className="text-xs text-[var(--c-muted)]">
                      Requests are raised universally and require second-person approval before posting to portal transactions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBalanceAdjustOpen(false)}
                    className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-xs font-bold text-[var(--c-text)] transition hover:border-[var(--c-accent)]"
                  >
                    Close
                  </button>
                </div>
                {canRequestDirectAdjustment ? (
                  <>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-xs font-semibold text-[var(--c-muted)]">Direction</p>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        {[
                          { value: 'add', label: 'Add' },
                          { value: 'subtract', label: 'Subtract' },
                        ].map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => setBalanceAdjustForm((prev) => ({ ...prev, direction: item.value }))}
                            className={`flex h-14 items-center justify-center rounded-2xl border px-4 text-xs font-bold transition ${
                              balanceAdjustForm.direction === item.value
                                ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/12 text-[var(--c-accent)]'
                                : 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)] hover:text-[var(--c-text)]'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="text-xs font-semibold text-[var(--c-muted)]">
                      Method
                      <select
                        value={balanceAdjustForm.methodId}
                        onChange={(event) => setBalanceAdjustForm((prev) => ({ ...prev, methodId: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none"
                      >
                        <option value="">Select method</option>
                        {(portal?.methods || []).map((methodId) => {
                          const label = methodMetaById?.[methodId]?.label || String(methodId || '');
                          return (
                            <option key={methodId} value={methodId}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-[var(--c-muted)]">
                      Amount
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={balanceAdjustForm.amount}
                        onChange={(event) => setBalanceAdjustForm((prev) => ({ ...prev, amount: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none"
                        placeholder="0.00"
                      />
                    </label>
                    <label className="text-xs font-semibold text-[var(--c-muted)] md:col-span-1">
                      Reason
                      <input
                        type="text"
                        value={balanceAdjustForm.reason}
                        onChange={(event) => setBalanceAdjustForm((prev) => ({ ...prev, reason: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none"
                        placeholder="Reason for adjustment"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={onDirectBalanceAdjust}
                      disabled={isBalanceAdjustSaving}
                      className="flex h-14 items-center rounded-2xl bg-[var(--c-accent)] px-8 text-sm font-black text-white shadow-lg shadow-[var(--c-accent)]/25 transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                    >
                      {isBalanceAdjustSaving ? 'Submitting...' : 'Submit Adjustment'}
                    </button>
                  </div>
                  </>
                ) : (
                  <p className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3 text-sm text-[var(--c-muted)]">
                    You do not have permission to request direct balance adjustment.
                  </p>
                )}
              </section>
            ) : null}

            <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
              <p className="mb-3 text-sm font-bold text-[var(--c-text)]">Portal Transaction History</p>
              {txRows.length === 0 ? (
                <p className="text-sm text-[var(--c-muted)]">No transactions found for this portal.</p>
              ) : (
                <div className="desktop-table-scroll overflow-x-auto">
                  <table className="w-full min-w-[740px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase text-[var(--c-muted)]">
                        <th className="py-2">Tx ID</th>
                        <th className="py-2">Type</th>
                        <th className="py-2">Amount</th>
                        <th className="py-2">Created By</th>
                        <th className="py-2">Description</th>
                        <th className="py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txRows.map((row) => {
                        const creator = getCreator(row.createdBy);
                        const amt = Number(row.amount || 0);
                        return (
                          <tr key={row.id} className="border-t border-[var(--c-border)]">
                            <td className="py-2 pr-2">
                              <button
                                type="button"
                                onClick={() => setSelectedTx(row)}
                                className="rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] px-2 py-1 text-xs font-bold text-[var(--c-accent)] hover:border-[var(--c-accent)]"
                                aria-label="View full transaction details"
                              >
                                {row.displayTransactionId || row.id}
                              </button>
                            </td>
                            <td className="py-2 pr-2 text-[var(--c-muted)]">{row.type || EMPTY_LEDGER_CELL}</td>
                            <td className={`py-2 pr-2 font-semibold ${amt < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                              {amt === 0 ? EMPTY_LEDGER_CELL : <CurrencyValue value={amt} iconSize="h-3.5 w-3.5" />}
                            </td>
                            <td className="py-2 pr-2">
                              <Link
                                to={`/t/${tenantId}/profile`}
                                className="inline-flex items-center gap-2 rounded-full border border-[var(--c-border)] bg-[var(--c-panel)] px-2 py-1 pr-3 text-xs text-[var(--c-text)] hover:border-[var(--c-accent)]"
                                aria-label={`Open profile of ${creator.name}`}
                              >
                                <img src={creator.avatar} alt={creator.name} className="h-6 w-6 rounded-full object-cover" />
                                <span>{creator.name}</span>
                                <ExternalLink strokeWidth={1.5} size={12} />
                              </Link>
                            </td>
                            <td className="py-2 pr-2 text-[var(--c-muted)]">{row.description || EMPTY_LEDGER_CELL}</td>
                            <td className="py-2 text-[var(--c-muted)]">{toDateText(row.date || row.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
      {selectedTx ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[var(--c-text)]">
                Transaction Detail: {selectedTx.displayTransactionId || selectedTx.id}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintTx}
                  className="flex h-14 items-center rounded-2xl border border-[var(--c-accent)] bg-[var(--c-accent)]/10 px-6 text-sm font-bold text-[var(--c-accent)]"
                >
                  Print Slip
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="flex h-14 items-center rounded-2xl border border-[var(--c-border)] px-6 text-sm font-bold text-[var(--c-text)]"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-[var(--c-border)]">
              <table className="w-full text-left text-sm">
                <tbody>
                  {Object.entries(selectedTx)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, value]) => (
                      <tr key={key} className="border-t border-[var(--c-border)] align-top">
                        <td className="w-48 bg-[var(--c-panel)] px-3 py-2 text-xs font-bold uppercase text-[var(--c-muted)]">{toFieldLabel(key)}</td>
                        <td className="px-3 py-2 text-xs text-[var(--c-text)] break-all">{renderTxValue(key, value)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
      {isTransferOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[var(--c-text)]">Internal Transfer</h3>
              <button
                type="button"
                onClick={() => setIsTransferOpen(false)}
                className="rounded-lg border border-[var(--c-border)] px-2 py-1 text-xs font-semibold text-[var(--c-text)]"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleTransfer} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <PortalTransactionSelector
                  portalLabel="Source Portal"
                  methodLabel="Sending Method"
                  portalId={transferForm.fromPortalId}
                  methodId={transferForm.fromMethodId}
                  onPortalChange={(nextFromPortalId) => setTransferForm((prev) => ({
                    ...prev,
                    fromPortalId: nextFromPortalId,
                    fromMethodId: '',
                    toPortalId: prev.toPortalId === nextFromPortalId ? '' : prev.toPortalId,
                    toMethodId: prev.toPortalId === nextFromPortalId ? '' : prev.toMethodId,
                  }))}
                  onMethodChange={(nextMethodId) => setTransferForm((prev) => ({ ...prev, fromMethodId: nextMethodId }))}
                  portals={allPortals}
                  portal={selectedTransferSourcePortal}
                  portalPlaceholder="Select Source"
                  methodPlaceholder="Select Sending Method"
                  showBalancePanel
                  showBalance={showTransferSourceBalance}
                  onToggleBalance={() => setShowTransferSourceBalance((prev) => !prev)}
                  projectedBalance={transferSourceProjectedBalance}
                  className="p-0 border-none bg-transparent shadow-none"
                />
                <PortalTransactionSelector
                  portalLabel="Destination Portal"
                  methodLabel="Receiving Method"
                  portalId={transferForm.toPortalId}
                  methodId={transferForm.toMethodId}
                  onPortalChange={(nextToPortalId) => setTransferForm((prev) => ({ ...prev, toPortalId: nextToPortalId, toMethodId: '' }))}
                  onMethodChange={(nextMethodId) => setTransferForm((prev) => ({ ...prev, toMethodId: nextMethodId }))}
                  portals={allPortals}
                  portal={selectedTransferDestinationPortal}
                  excludePortalId={transferForm.fromPortalId}
                  portalPlaceholder={transferForm.fromPortalId ? 'Select Destination' : 'Select source first'}
                  methodPlaceholder="Select Receiving Method"
                  disabled={!transferForm.fromPortalId}
                  showBalancePanel={Boolean(transferForm.toPortalId)}
                  showBalance={showTransferDestinationBalance}
                  onToggleBalance={() => setShowTransferDestinationBalance((prev) => !prev)}
                  projectedBalance={transferDestinationProjectedBalance}
                  className="p-0 border-none bg-transparent shadow-none"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[var(--c-muted)]">Transfer Amount</label>
                  <div className="mt-1 flex items-center rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3">
                    <DirhamIcon className="mr-2 h-4 w-4 shrink-0 text-[var(--c-muted)]" />
                    <input
                      type="number"
                      required
                      value={transferForm.amount}
                      onChange={(event) => setTransferForm((prev) => ({ ...prev, amount: event.target.value }))}
                      className="w-full bg-transparent py-2 text-sm font-semibold text-[var(--c-text)] outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[var(--c-muted)]">Transfer Fee (Optional)</label>
                  <div className="mt-1 flex items-center rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3">
                    <DirhamIcon className="mr-2 h-4 w-4 shrink-0 text-[var(--c-muted)]" />
                    <input
                      type="number"
                      value={transferForm.fee}
                      onChange={(event) => setTransferForm((prev) => ({ ...prev, fee: event.target.value }))}
                      className="w-full bg-transparent py-2 text-sm font-semibold text-[var(--c-text)] outline-none"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[var(--c-muted)]">Reference / Note</label>
                <textarea
                  rows={2}
                  value={transferForm.description}
                  onChange={(event) => setTransferForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-xs font-semibold text-[var(--c-text)] outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isTransferSaving}
                className="w-full rounded-xl bg-[var(--c-accent)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isTransferSaving ? 'Processing...' : 'Confirm Transfer'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
      {isStatementOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[var(--c-text)]">Print Portal Statement</h3>
              <button
                type="button"
                onClick={() => {
                  setIsStatementOpen(false);
                  setMessage('');
                }}
                className="rounded-lg border border-[var(--c-border)] px-2 py-1 text-xs font-semibold text-[var(--c-text)]"
              >
                Close
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-[10px] font-bold uppercase text-[var(--c-muted)]">
                Quick Select Month
                <select
                  className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none"
                  value=""
                  onChange={(e) => {
                    handleMonthSelect(e.target.value);
                    e.target.value = '';
                  }}
                >
                  <option value="">Choose month…</option>
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[10px] font-bold uppercase text-[var(--c-muted)]">
                  From
                  <input
                    type="date"
                    min={minTxDate}
                    max={maxTxDate}
                    value={statementRange.start}
                    onChange={(e) => setStatementRange((prev) => ({ ...prev, start: e.target.value }))}
                    style={{ colorScheme: 'light' }}
                    className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none"
                  />
                </label>
                <label className="text-[10px] font-bold uppercase text-[var(--c-muted)]">
                  To
                  <input
                    type="date"
                    min={minTxDate}
                    max={maxTxDate}
                    value={statementRange.end}
                    onChange={(e) => setStatementRange((prev) => ({ ...prev, end: e.target.value }))}
                    style={{ colorScheme: 'light' }}
                    className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none"
                  />
                </label>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handlePrintStatement}
                  className="flex-1 rounded-xl bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-white"
                >
                  Print Statement
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setStatementRange({
                      start: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10),
                      end: todayIso,
                    });
                  }}
                  className="rounded-xl border border-[var(--c-border)] px-3 py-2 text-sm font-semibold text-[var(--c-text)]"
                >
                  Reset
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleDownloadStatementPdf}
                  className="rounded-xl border border-[var(--c-accent)] bg-[var(--c-accent)]/10 px-3 py-2 text-sm font-semibold text-[var(--c-accent)] hover:border-[var(--c-accent)]"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={handlePreviewStatementPdf}
                  disabled={isStatementPreviewLoading}
                  className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm font-semibold text-[var(--c-text)] disabled:opacity-50"
                >
                  {isStatementPreviewLoading ? 'Opening...' : 'View PDF'}
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-[var(--c-muted)]">Send by Email</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={statementEmail}
                    onChange={(e) => setStatementEmail(e.target.value)}
                    placeholder={user?.email || 'recipient@example.com'}
                    className="flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleEmailStatementPdf}
                    disabled={isStatementSending}
                    className="rounded-xl bg-[var(--c-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isStatementSending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>

              {message && (
                <div className={`rounded-xl border p-2 text-center text-xs font-bold animate-in fade-in slide-in-from-top-1 ${messageType === 'error'
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-500'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                  }`}>
                  {message}
                </div>
              )}
              <p className="text-[11px] text-[var(--c-muted)]">
                Dates are limited to portal transaction history (min {minTxDate}) through today ({maxTxDate}). Service fees are highlighted automatically.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {isStatementPreviewOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
          <div className="flex h-[92vh] w-full max-w-6xl flex-col rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--c-border)] px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--c-text)]">Portal Statement Preview</h3>
                <p className="text-[11px] text-[var(--c-muted)]">
                  {portal?.name || portalId} | {statementRange.start} to {statementRange.end}
                </p>
              </div>
              <button
                type="button"
                onClick={closeStatementPreview}
                className="rounded-lg border border-[var(--c-border)] px-3 py-1.5 text-xs font-semibold text-[var(--c-text)]"
              >
                Close
              </button>
            </div>
            <div className="h-full w-full overflow-hidden rounded-b-2xl bg-white">
              {statementPreviewUrl ? (
                <iframe
                  title="Portal Statement PDF Preview"
                  src={statementPreviewUrl}
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-600">
                  Unable to load statement preview.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onCancel={closeConfirm}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDangerous={confirmDialog.isDangerous}
      />
      <ProgressVideoOverlay
        open={isSaving || isTransferSaving}
        dismissible={false}
        minimal
        title={isTransferSaving ? 'Your transfer is in progress' : 'Your portal update is in progress'}
        subtitle="Please wait while we complete the portal action."
        videoSrc="/Video/portalManagmentProgress.mp4"
        frameWidthClass="max-w-[30rem]"
        backdropClassName="bg-[rgba(255,255,255,0.94)] backdrop-blur-sm"
      />
      <ActionProgressOverlay
        open={isStatementGenerating || isStatementPreviewLoading || isStatementSending}
        kind={isStatementSending ? 'email' : 'pdf'}
        title={isStatementSending ? 'Sending Portal Statement Email' : 'Generating Portal Statement PDF'}
        subtitle={isStatementSending ? 'Preparing the PDF and sending it to the selected email address.' : 'Preparing statement document with current date range and transactions.'}
        status={isStatementSending ? 'Sending Email...' : 'Generating PDF...'}
      />
    </PageShell>
  );
};

export default PortalDetailPage;
