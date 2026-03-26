import { useEffect, useState, useCallback } from 'react';
import { Hash } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useTenant } from '../../context/useTenant';
import { getTenantSettingDoc, upsertTenantSettingDoc } from '../../lib/backendStore';
import { formatDisplayId, normalizeIdRule } from '../../lib/idFormat';
import { createSyncEvent } from '../../lib/syncEvents';
import SettingCard from './SettingCard';

const DATE_FORMAT_OPTIONS = [
  { value: 'YYYYMMDD', label: 'YYYY MM DD' },
  { value: 'DDMMYYYY', label: 'DD MM YYYY' },
  { value: 'MMDDYYYY', label: 'MM DD YYYY' },
  { value: 'YYMMDD', label: 'YY MM DD' },
];

const FILENAME_DATE_FORMAT_OPTIONS = [
  { value: 'YYYYMMDD', label: 'YYYYMMDD' },
  { value: 'DDMMYYYY', label: 'DDMMYYYY' },
  { value: 'YYMMDD', label: 'YYMMDD' },
];

const DEFAULT_RULES = {
  CLID: { prefix: 'CLID', padding: 4, sequenceStart: 1, dateEnabled: false, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'continuous' },
  CCID: { prefix: 'CCID', padding: 4, sequenceStart: 1, dateEnabled: false, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'continuous' },
  ICID: { prefix: 'ICID', padding: 4, sequenceStart: 1, dateEnabled: false, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'continuous' },
  DPID: { prefix: 'DPID', padding: 4, sequenceStart: 1, dateEnabled: false, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'continuous' },
  POR: { prefix: 'POR', padding: 4, sequenceStart: 1, dateEnabled: true, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'continuous' },
  PID: { prefix: 'PID', padding: 4, sequenceStart: 1, dateEnabled: false, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'continuous' },
  EXP: { prefix: 'EXP', padding: 4, sequenceStart: 1, dateEnabled: true, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'continuous' },
  LON: { prefix: 'LON', padding: 4, sequenceStart: 1, dateEnabled: true, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'continuous' },
  LOAN: { prefix: 'LOAN', padding: 4, sequenceStart: 1, dateEnabled: false, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'continuous' },
  TRF: { prefix: 'TRF', padding: 4, sequenceStart: 1, dateEnabled: true, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'continuous' },
  TRK: { prefix: 'TRK', padding: 4, sequenceStart: 1, dateEnabled: true, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'continuous' },
  DTID: { prefix: 'APP', padding: 4, sequenceStart: 1, dateEnabled: true, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'daily' },
};

const DEFAULT_DOC_REFS = {
  proformaInvoice: { prefix: 'PRO', dateEnabled: true, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'continuous', sequenceStart: 1, padding: 4 },
  quotation: { prefix: 'QUOT', dateEnabled: true, dateFormat: 'YYYYMMDD', useSeparator: true, resetMode: 'continuous', sequenceStart: 1, padding: 4 },
  clientPayment: { prefix: 'PAY', dateEnabled: true, dateFormat: 'DDMMYYYY', useSeparator: true, resetMode: 'continuous', sequenceStart: 1, padding: 4 },
  invoice: { prefix: 'INV', dateEnabled: true, dateFormat: 'DDMMYYYY', useSeparator: true, resetMode: 'continuous', sequenceStart: 1, padding: 4 },
  taskAssignment: { prefix: 'TSK', dateEnabled: true, dateFormat: 'DDMMYYYY', useSeparator: true, resetMode: 'continuous', sequenceStart: 1, padding: 4 },
};

const DEFAULT_FILENAME_POLICY = {
  paymentAcknowledgement: {
    label: 'Payment Acknowledgement',
    includeTxId: true,
    includeDocType: true,
    includeClientName: false,
    includeDependentName: false,
    includeDate: true,
    includeRandomSuffix: false,
    dateFormat: 'YYYYMMDD',
    maxLength: 120,
  },
  invoice: {
    label: 'Invoice',
    includeTxId: true,
    includeDocType: true,
    includeClientName: false,
    includeDependentName: false,
    includeDate: true,
    includeRandomSuffix: false,
    dateFormat: 'YYYYMMDD',
    maxLength: 120,
  },
  proformaInvoice: {
    label: 'Proforma Invoice',
    includeTxId: true,
    includeDocType: true,
    includeClientName: false,
    includeDependentName: false,
    includeDate: true,
    includeRandomSuffix: false,
    dateFormat: 'YYYYMMDD',
    maxLength: 120,
  },
  quotation: {
    label: 'Quotation',
    includeTxId: true,
    includeDocType: true,
    includeClientName: false,
    includeDependentName: false,
    includeDate: true,
    includeRandomSuffix: false,
    dateFormat: 'YYYYMMDD',
    maxLength: 120,
  },
  statement: {
    label: 'Statement',
    includeTxId: true,
    includeDocType: true,
    includeClientName: false,
    includeDependentName: false,
    includeDate: true,
    includeRandomSuffix: false,
    dateFormat: 'YYYYMMDD',
    maxLength: 120,
  },
  salesReport: {
    label: 'Sales',
    includeTxId: true,
    includeDocType: true,
    includeClientName: false,
    includeDependentName: false,
    includeDate: true,
    includeRandomSuffix: false,
    dateFormat: 'YYYYMMDD',
    maxLength: 120,
  },
};

const ENTITIES = [
  { type: 'rule', key: 'CLID', label: 'Clients (Co/Ind)' },
  { type: 'rule', key: 'CCID', label: 'Company Clients' },
  { type: 'rule', key: 'ICID', label: 'Individual Clients' },
  { type: 'rule', key: 'DPID', label: 'Dependents' },
  { type: 'rule', key: 'POR', label: 'Portal Trans.' },
  { type: 'rule', key: 'PID', label: 'Portal Creation' },
  { type: 'rule', key: 'EXP', label: 'Expenses' },
  { type: 'rule', key: 'LON', label: 'Loans (Transactions)' },
  { type: 'rule', key: 'LOAN', label: 'Loan Persons' },
  { type: 'rule', key: 'TRF', label: 'Transfers' },
  { type: 'rule', key: 'TRK', label: 'Tracking IDs' },
  { type: 'rule', key: 'DTID', label: 'Daily Trans (APP)' },
  { type: 'doc', key: 'proformaInvoice', label: 'Proforma Invoice' },
  { type: 'doc', key: 'quotation', label: 'Quotation' },
  { type: 'doc', key: 'clientPayment', label: 'Client Payment' },
  { type: 'doc', key: 'invoice', label: 'Invoice' },
  { type: 'doc', key: 'taskAssignment', label: 'Task Assignment' },
];

const toCounterField = (key) => {
  if (key === 'CLID') return 'lastClientSeq';
  if (key === 'CCID') return 'lastCompanySeq';
  if (key === 'ICID') return 'lastIndividualSeq';
  if (key === 'DPID') return 'lastDependentSeq';
  if (key === 'PID') return 'lastPortalSeq';
  if (key === 'TRK') return 'lastTRKSeq';
  if (['POR', 'EXP', 'LON', 'LOAN', 'TRF'].includes(key)) return `last${key}Seq`;
  return key;
};

const sanitizeRuleShape = (raw, fallbackPrefix) => {
  const next = normalizeIdRule(raw, fallbackPrefix);
  return {
    prefix: next.prefix,
    padding: next.padding,
    sequenceStart: next.sequenceStart,
    dateEnabled: next.dateEnabled,
    dateFormat: next.dateFormat,
    useSeparator: next.useSeparator,
    resetMode: next.resetMode,
    skipDate: !next.dateEnabled,
  };
};

const IDRulesSection = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [docRefs, setDocRefs] = useState(DEFAULT_DOC_REFS);
  const [clientIdMode, setClientIdMode] = useState('unified');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [filenamePolicies, setFilenamePolicies] = useState(DEFAULT_FILENAME_POLICY);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const res = await getTenantSettingDoc(tenantId, 'transactionIdRules');
      if (res.ok && res.data) {
        setClientIdMode(res.data.clientIdMode === 'separate' ? 'separate' : 'unified');
        setRules((prev) => {
          const merged = { ...prev };
          Object.keys(DEFAULT_RULES).forEach((key) => {
            merged[key] = { ...prev[key], ...sanitizeRuleShape(res.data[key] || {}, prev[key].prefix || key) };
          });
          return merged;
        });
        if (res.data.docRefCodes) {
          setDocRefs((prev) => {
            const merged = { ...prev };
            Object.keys(DEFAULT_DOC_REFS).forEach((key) => {
              merged[key] = { ...prev[key], ...sanitizeRuleShape(res.data.docRefCodes[key] || {}, prev[key].prefix || key) };
            });
            return merged;
          });
        }
        if (res.data.filenamePolicies) {
          setFilenamePolicies((prev) => ({ ...prev, ...res.data.filenamePolicies }));
        }
      }
      setIsLoading(false);
    };
    fetchData();
  }, [tenantId]);

  const handleRuleChange = (key, field, value) => {
    setRules((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleDocRefChange = (key, field, value) => {
    setDocRefs((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setStatus({ type: 'info', message: 'Updating ID rules...' });

    const sanitizedRules = {};
    Object.entries(rules).forEach(([key, value]) => {
      sanitizedRules[key] = sanitizeRuleShape(value, DEFAULT_RULES[key]?.prefix || key);
    });

    const sanitizedDocRefs = {};
    Object.entries(docRefs).forEach(([key, value]) => {
      sanitizedDocRefs[key] = sanitizeRuleShape(value, DEFAULT_DOC_REFS[key]?.prefix || key);
    });

    const payload = {
      clientIdMode,
      ...sanitizedRules,
      docRefCodes: sanitizedDocRefs,
      filenamePolicies,
      updatedBy: user?.uid,
    };

    const res = await upsertTenantSettingDoc(tenantId, 'transactionIdRules', payload);

    if (res.ok) {
      await createSyncEvent({
        tenantId,
        eventType: 'update',
        entityType: 'settingsIdRules',
        entityId: 'transactionIdRules',
        changedFields: Object.keys(payload),
        createdBy: user?.uid,
      });
      setStatus({ type: 'success', message: 'Unified ID controls saved successfully.' });
    } else {
      setStatus({ type: 'error', message: res.error || 'Failed to update rules.' });
    }
    setIsSaving(false);
  }, [tenantId, clientIdMode, rules, docRefs, filenamePolicies, user]);

  const handleUpdateCounter = useCallback(async (field, newVal) => {
    const val = parseInt(newVal, 10);
    if (Number.isNaN(val)) return;

    if (!window.confirm(`Are you sure you want to manually set ${field} to ${val}? This may cause ID collisions.`)) return;

    setIsSaving(true);
    setStatus({ type: 'info', message: `Updating ${field}...` });

    const payload = { [field]: val, updatedBy: user?.uid };
    const res = await upsertTenantSettingDoc(tenantId, 'transactionIdRules', payload);

    if (res.ok) {
      await createSyncEvent({
        tenantId,
        eventType: 'update',
        entityType: 'settingsIdRules',
        entityId: 'transactionIdRules',
        changedFields: [field],
        createdBy: user?.uid,
      });
      setRules((prev) => ({ ...prev, [field]: val }));
      setStatus({ type: 'success', message: `${field} updated to ${val}` });
    } else {
      setStatus({ type: 'error', message: res.error || 'Failed to update counter.' });
    }
    setIsSaving(false);
  }, [tenantId, user]);

  if (isLoading) return <p className="text-xs text-[var(--c-muted)]">Loading system rules...</p>;

  const getCounterVal = (key) => {
    const rule = normalizeIdRule(rules[key] || {}, DEFAULT_RULES[key]?.prefix || key);
    const currentBase = Number(rules[toCounterField(key)] || 0);
    if (rule.resetMode === 'daily') {
      const dailyField = `${toCounterField(key)}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
      return Number(rules[dailyField] || currentBase || 0);
    }
    return currentBase;
  };

  const renderEntityCard = (item) => {
    if (!item) return null;
    const isRule = item.type === 'rule';
    const rawConfig = isRule ? rules[item.key] || {} : docRefs[item.key] || {};
    const fallbackPrefix = isRule ? DEFAULT_RULES[item.key]?.prefix || item.key : DEFAULT_DOC_REFS[item.key]?.prefix || item.key;
    const config = normalizeIdRule(rawConfig, fallbackPrefix);
    const currentSeq = getCounterVal(item.key);
    const field = isRule ? toCounterField(item.key) : null;
    const nextSeq = String(Math.max(currentSeq + (isRule ? 1 : 0), config.sequenceStart)).padStart(config.padding, '0');

    const preview = formatDisplayId({
      prefix: config.prefix,
      seq: Number(nextSeq),
      padding: config.padding,
      dateFormat: config.dateEnabled ? config.dateFormat : 'NONE',
      useSeparator: config.useSeparator,
    });

    return (
      <div key={item.key} className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--c-text)]">{item.label}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--c-muted)]">{item.key}</p>
          </div>
          <span className="inline-flex w-fit rounded-md border border-[var(--c-accent)]/15 bg-[var(--c-accent)]/5 px-2 py-1 text-[11px] font-black tracking-wider text-[var(--c-accent)] break-all">
            {preview}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label className="text-xs font-semibold text-[var(--c-muted)]">
            Prefix
            <input
              type="text"
              maxLength={8}
              value={config.prefix}
              onChange={(e) => (isRule
                ? handleRuleChange(item.key, 'prefix', e.target.value.toUpperCase())
                : handleDocRefChange(item.key, 'prefix', e.target.value.toUpperCase()))}
              className="mt-1 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-xs font-black text-[var(--c-accent)] outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20"
            />
          </label>

          <label className="text-xs font-semibold text-[var(--c-muted)]">
            Date
            <select
              value={config.dateEnabled ? 'enabled' : 'disabled'}
              onChange={(e) => (isRule
                ? handleRuleChange(item.key, 'dateEnabled', e.target.value === 'enabled')
                : handleDocRefChange(item.key, 'dateEnabled', e.target.value === 'enabled'))}
              className="mt-1 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-xs font-bold text-[var(--c-text)] outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20"
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-[var(--c-muted)]">
            Date Format
            <select
              value={config.dateFormat}
              disabled={!config.dateEnabled}
              onChange={(e) => (isRule
                ? handleRuleChange(item.key, 'dateFormat', e.target.value)
                : handleDocRefChange(item.key, 'dateFormat', e.target.value))}
              className="mt-1 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-xs font-bold text-[var(--c-text)] outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 disabled:opacity-50"
            >
              {DATE_FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-[var(--c-muted)]">
            Dash Style
            <select
              value={config.useSeparator ? 'dash' : 'plain'}
              onChange={(e) => (isRule
                ? handleRuleChange(item.key, 'useSeparator', e.target.value === 'dash')
                : handleDocRefChange(item.key, 'useSeparator', e.target.value === 'dash'))}
              className="mt-1 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-xs font-bold text-[var(--c-text)] outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20"
            >
              <option value="dash">PAY-11</option>
              <option value="plain">PAY11</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-[var(--c-muted)]">
            Counter Mode
            <select
              value={config.resetMode}
              onChange={(e) => (isRule
                ? handleRuleChange(item.key, 'resetMode', e.target.value)
                : handleDocRefChange(item.key, 'resetMode', e.target.value))}
              className="mt-1 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-xs font-bold text-[var(--c-text)] outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20"
            >
              <option value="continuous">Continue</option>
              <option value="daily">Daily Reset</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-[var(--c-muted)]">
            Seq Start
            <input
              type="number"
              min={1}
              max={999999}
              value={config.sequenceStart}
              onChange={(e) => (isRule
                ? handleRuleChange(item.key, 'sequenceStart', e.target.value)
                : handleDocRefChange(item.key, 'sequenceStart', e.target.value))}
              className="mt-1 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-xs font-bold text-[var(--c-text)] outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20"
            />
          </label>

          <label className="text-xs font-semibold text-[var(--c-muted)]">
            Padding
            <input
              type="number"
              min={2}
              max={8}
              value={config.padding}
              onChange={(e) => (isRule
                ? handleRuleChange(item.key, 'padding', e.target.value)
                : handleDocRefChange(item.key, 'padding', e.target.value))}
              className="mt-1 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-xs font-bold text-[var(--c-text)] outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20"
            />
          </label>

          <div className="text-xs font-semibold text-[var(--c-muted)]">
            Current Seq
            <div className="mt-1 flex h-[38px] items-center justify-between rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2">
              {field ? (
                <>
                  <span className="font-mono text-sm font-bold text-[var(--c-text)]">{currentSeq}</span>
                  <button
                    onClick={() => {
                      const next = prompt(`Update ${item.label} counter:`, currentSeq);
                      if (next !== null && field) handleUpdateCounter(field, next);
                    }}
                    className="text-[11px] font-bold text-[var(--c-accent)] hover:underline"
                  >
                    Edit
                  </button>
                </>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)]">Auto</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const normalizeFileNameToken = (value) =>
    String(value || '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9_-]/g, '');

  const buildDateToken = (format) => {
    const d = new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    if (format === 'DDMMYYYY') return `${dd}${mm}${yyyy}`;
    if (format === 'YYMMDD') return `${yyyy.slice(2)}${mm}${dd}`;
    return `${yyyy}${mm}${dd}`;
  };

  const updateFilenamePolicy = (key, field, value) => {
    setFilenamePolicies((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const renderFilenamePolicyCard = (docKey) => {
    const policy = filenamePolicies[docKey];
    if (!policy) return null;

    const sampleTokens = [];
    if (policy.includeTxId) sampleTokens.push('TXN-20260311-0001');
    if (policy.includeDocType) sampleTokens.push(normalizeFileNameToken(policy.label.toUpperCase()));
    if (policy.includeClientName) sampleTokens.push('ABAD_COMMERCIAL_INFORMATION_SERVICES');
    if (policy.includeDependentName) sampleTokens.push('MOHAMMED_ABDUL_RAHMAN_LONG_NAME');
    if (policy.includeDate) sampleTokens.push(buildDateToken(policy.dateFormat));
    if (policy.includeRandomSuffix) sampleTokens.push('X7A9');
    if (sampleTokens.length === 0) sampleTokens.push('DOCUMENT');

    const rawFileName = `${sampleTokens.join('-')}.pdf`;
    const maxLength = Number(policy.maxLength) || 120;
    const trimmedFileName =
      rawFileName.length > maxLength ? `${rawFileName.slice(0, Math.max(1, maxLength - 4))}.pdf` : rawFileName;
    const exceeds = rawFileName.length > maxLength;

    return (
      <div key={docKey} className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
        <div className="mb-3">
          <p className="text-sm font-bold text-[var(--c-text)]">{policy.label}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--c-muted)]">{docKey}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--c-text)]">
            <input type="checkbox" checked={policy.includeTxId} onChange={(e) => updateFilenamePolicy(docKey, 'includeTxId', e.target.checked)} />
            Transaction ID
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--c-text)]">
            <input type="checkbox" checked={policy.includeDocType} onChange={(e) => updateFilenamePolicy(docKey, 'includeDocType', e.target.checked)} />
            Document Type
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--c-text)]">
            <input type="checkbox" checked={policy.includeClientName} onChange={(e) => updateFilenamePolicy(docKey, 'includeClientName', e.target.checked)} />
            Client Name
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--c-text)]">
            <input type="checkbox" checked={policy.includeDependentName} onChange={(e) => updateFilenamePolicy(docKey, 'includeDependentName', e.target.checked)} />
            Dependent Name
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--c-text)]">
            <input type="checkbox" checked={policy.includeDate} onChange={(e) => updateFilenamePolicy(docKey, 'includeDate', e.target.checked)} />
            Date
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--c-text)]">
            <input type="checkbox" checked={policy.includeRandomSuffix} onChange={(e) => updateFilenamePolicy(docKey, 'includeRandomSuffix', e.target.checked)} />
            Random Suffix
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[var(--c-muted)]">
            Date Format
            <select
              value={policy.dateFormat}
              disabled={!policy.includeDate}
              onChange={(e) => updateFilenamePolicy(docKey, 'dateFormat', e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-xs font-bold text-[var(--c-text)] outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 disabled:opacity-50"
            >
              {FILENAME_DATE_FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--c-muted)]">
            Max Filename Length
            <input
              type="number"
              min={30}
              max={180}
              value={policy.maxLength}
              onChange={(e) => updateFilenamePolicy(docKey, 'maxLength', e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-xs font-bold text-[var(--c-text)] outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20"
            />
          </label>
        </div>

        <div className="mt-3 rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)]/40 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--c-muted)]">Preview</p>
          <p className="mt-1 break-all font-mono text-xs text-[var(--c-text)]">{trimmedFileName}</p>
          {exceeds && (
            <p className="mt-1 text-[11px] font-semibold text-amber-600">
              Safety: preview exceeded max length and was auto-trimmed.
            </p>
          )}
        </div>
      </div>
    );
  };

  const coreRuleKeys = ['DPID', 'POR', 'PID', 'EXP', 'LON', 'LOAN', 'TRF', 'TRK', 'DTID'];
  const ruleEntities = ENTITIES.filter((item) => item.type === 'rule' && coreRuleKeys.includes(item.key));
  const docEntities = ENTITIES.filter((item) => item.type === 'doc');

  return (
    <div className="space-y-6">
      <SettingCard
        title="Consolidated ID Prefixing & Control"
        description="Universal ID logic for prefix, dash mode, date mode, sequence behavior, and counter strategy."
        icon={Hash}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-panel)_42%,transparent)] p-3">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Client ID Strategy</p>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs font-semibold text-[var(--c-muted)] md:col-span-1">
                Client ID Mode
                <select
                  value={clientIdMode}
                  onChange={(e) => setClientIdMode(e.target.value === 'separate' ? 'separate' : 'unified')}
                  className="mt-1 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-xs font-bold text-[var(--c-text)] outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20"
                >
                  <option value="unified">Unified (Default: both use CLID)</option>
                  <option value="separate">Separate (Company/Individual)</option>
                </select>
              </label>
              <div className="text-xs text-[var(--c-muted)] md:col-span-2 md:pt-6">
                {clientIdMode === 'unified'
                  ? 'Company and individual clients will continue with one shared rule and counter (CLID).'
                  : 'Company and individual clients will use separate rules and separate counters (CCID/ICID).'}
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {renderEntityCard(ENTITIES.find((item) => item.key === 'CLID'))}
              {clientIdMode === 'separate' && (
                <>
                  {renderEntityCard(ENTITIES.find((item) => item.key === 'CCID'))}
                  {renderEntityCard(ENTITIES.find((item) => item.key === 'ICID'))}
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-panel)_42%,transparent)] p-3">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Core Transaction Rules</p>
            <div className="space-y-3">
              {ruleEntities.map((item) => renderEntityCard(item))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-panel)_42%,transparent)] p-3">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Document Reference Rules</p>
            <div className="space-y-3">
              {docEntities.map((item) => renderEntityCard(item))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-panel)_42%,transparent)] p-3">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Document Filename Policy</p>
            <p className="mb-3 text-xs text-[var(--c-muted)]">
              Configure how PDF files are named automatically. Now connected and fully functional.
            </p>
            <div className="space-y-3">
              {Object.keys(filenamePolicies).map((docKey) => renderFilenamePolicyCard(docKey))}
            </div>
          </div>

          <div className="mt-2 flex justify-end px-1">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-xl bg-[var(--c-accent)] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--c-accent)]/20 transition hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? 'Committing...' : 'Commit All Unified Rules'}
            </button>
          </div>
        </div>
      </SettingCard>

      {status.message && (
        <div className={`rounded-xl border p-4 text-center text-sm font-bold animate-in fade-in slide-in-from-top-2 ${status.type === 'error' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-emerald-500 bg-emerald-50 text-emerald-700'}`}>
          {status.message}
        </div>
      )}
    </div>
  );
};

export default IDRulesSection;


