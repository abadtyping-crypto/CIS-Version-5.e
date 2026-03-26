import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BanknoteArrowDown } from 'lucide-react';
import PortalTransactionSelector from '../components/common/PortalTransactionSelector';
import PageShell from '../components/layout/PageShell';
import { useTenant } from '../context/useTenant';
import { useAuth } from '../context/useAuth';
import {
  approveOperationExpenseRequest,
  fetchTenantOperationExpenses,
  fetchTenantPortals,
  fetchTenantUsersMap,
  releaseOperationExpenseWithFinancials,
  submitOperationExpenseRequest,
} from '../lib/backendStore';
import { toSafeDocId } from '../lib/idUtils';
import { generateDisplayTxId } from '../lib/txIdGenerator';
import { canUserPerformAction } from '../lib/userControlPreferences';
import { resolvePortalMethodById } from '../lib/transactionMethodConfig';
import {
  uploadOperationExpenseAttachment,
  validateOperationExpenseAttachment,
} from '../lib/operationExpenseStorage';

const inputClass = 'mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm font-semibold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]';

const FIXED_EXPENSE_CATEGORIES = [
  'Office Expense',
  'Salary',
  'Utility',
  'Travel',
  'Purchase',
  'Maintenance',
  'Other',
];

const formatDate = (value) => {
  if (!value) return '-';
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
  if (typeof value?.toMillis === 'function') return new Date(value.toMillis()).toLocaleString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

const formatAmount = (value) => `Dhs ${(Number(value || 0) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const normalizeStatus = (value) => {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'approved' || status === 'released' || status === 'rejected') return status;
  return 'requested';
};

const OperationExpensesPage = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();

  const [phase, setPhase] = useState('add');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionSaving, setIsActionSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('info');

  const [displayRef, setDisplayRef] = useState('');
  const [portals, setPortals] = useState([]);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [expenseType, setExpenseType] = useState('normal');
  const [category, setCategory] = useState('Office Expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedPortalId, setSelectedPortalId] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [salaryMode, setSalaryMode] = useState('user');
  const [selectedEmployeeUserId, setSelectedEmployeeUserId] = useState('');
  const [manualEmployeeName, setManualEmployeeName] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);

  const hasAutoSelectedRef = useRef(false);

  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedExpenseId, setSelectedExpenseId] = useState('');
  const [approveAmount, setApproveAmount] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [releaseAmount, setReleaseAmount] = useState('');
  const [releasePortalId, setReleasePortalId] = useState('');
  const [releaseMethodId, setReleaseMethodId] = useState('');
  const [releaseNote, setReleaseNote] = useState('');

  const pushStatus = (message, type = 'info') => {
    setStatus(message);
    setStatusType(type);
  };

  const canReleaseExpenses = useMemo(() => {
    const role = String(user?.role || '').trim().toLowerCase();
    if (role === 'accountant' || role === 'admin' || role === 'super admin') return true;
    return canUserPerformAction(tenantId, user, 'directBalanceAdjust');
  }, [tenantId, user]);

  const selectedPortal = useMemo(
    () => portals.find((item) => item.id === selectedPortalId) || null,
    [portals, selectedPortalId],
  );

  const selectedExpense = useMemo(
    () => expenses.find((item) => item.id === selectedExpenseId) || null,
    [expenses, selectedExpenseId],
  );

  const reviewReleasePortal = useMemo(
    () => portals.find((item) => item.id === releasePortalId) || null,
    [portals, releasePortalId],
  );

  const filteredExpenses = useMemo(() => {
    if (filterStatus === 'all') return expenses;
    return expenses.filter((item) => normalizeStatus(item.status) === filterStatus);
  }, [expenses, filterStatus]);

  const applyReviewDefaults = useCallback((expense) => {
    if (!expense) return;
    const amountValue = String(Number(expense.amountApproved || expense.amountRequested || 0) || 0);
    setApproveAmount(amountValue);
    setReleaseAmount(amountValue);
    setReleasePortalId(String(expense.portalId || ''));
    setReleaseMethodId(String(expense.transactionMethodId || ''));
    setApprovalNote('');
    setReleaseNote('');
  }, []);

  const handleSelectExpense = useCallback((expenseId) => {
    hasAutoSelectedRef.current = true;
    setSelectedExpenseId(expenseId);
    const picked = expenses.find((item) => item.id === expenseId) || null;
    applyReviewDefaults(picked);
  }, [expenses, applyReviewDefaults]);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    const [portalRes, usersRes, expensesRes] = await Promise.all([
      fetchTenantPortals(tenantId),
      fetchTenantUsersMap(tenantId),
      fetchTenantOperationExpenses(tenantId),
    ]);

    if (portalRes.ok) setPortals(portalRes.rows || []);
    if (usersRes.ok) {
      setTenantUsers((usersRes.rows || []).filter((row) => !row.deletedAt));
    }
    if (expensesRes.ok) {
      const nextRows = expensesRes.rows || [];
      setExpenses(nextRows);
      if (!hasAutoSelectedRef.current && nextRows.length) {
        hasAutoSelectedRef.current = true;
        setSelectedExpenseId(nextRows[0].id);
        applyReviewDefaults(nextRows[0]);
      }
    }
    setIsLoading(false);
  }, [tenantId, applyReviewDefaults]);

  useEffect(() => {
    if (!tenantId) return;
    generateDisplayTxId(tenantId, 'EXP').then((nextRef) => {
      setDisplayRef(nextRef || `EXP-${Date.now()}`);
    });
  }, [tenantId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadData]);

  const resetAddForm = async () => {
    const nextRef = await generateDisplayTxId(tenantId, 'EXP');
    setDisplayRef(nextRef || `EXP-${Date.now()}`);
    setExpenseType('normal');
    setCategory('Office Expense');
    setAmount('');
    setNote('');
    setSelectedPortalId('');
    setSelectedMethodId('');
    setSalaryMode('user');
    setSelectedEmployeeUserId('');
    setManualEmployeeName('');
    setAttachmentFile(null);
  };

  const handleSubmit = async (intent = 'request') => {
    if (!tenantId || !user?.uid) return;

    const normalizedCategory = FIXED_EXPENSE_CATEGORIES.includes(category) ? category : 'Other';
    const numericAmount = Math.max(0, Number(amount || 0));
    if (!(numericAmount > 0)) return pushStatus('Amount must be greater than zero.', 'error');

    const finalExpenseType = expenseType === 'salary' ? 'salary' : 'normal';
    if (finalExpenseType === 'salary') {
      if (salaryMode === 'user' && !selectedEmployeeUserId) {
        return pushStatus('Select one employee user for salary request.', 'error');
      }
      if (salaryMode === 'manual' && !String(manualEmployeeName || '').trim()) {
        return pushStatus('Enter manual employee name for salary request.', 'error');
      }
    }

    if (intent === 'release') {
      if (!canReleaseExpenses) return pushStatus('You are not authorized to release expenses directly.', 'error');
      if (!selectedPortalId) return pushStatus('Select portal before direct release.', 'error');
      if (!selectedMethodId) return pushStatus('Select transaction method before direct release.', 'error');
    }

    const safeDisplayRef = String(displayRef || '').trim() || `EXP-${Date.now()}`;
    const expenseId = toSafeDocId(safeDisplayRef, 'exp');

    setIsSaving(true);
    let attachment = null;

    if (attachmentFile) {
      const validationError = validateOperationExpenseAttachment(attachmentFile);
      if (validationError) {
        pushStatus(validationError, 'error');
        setIsSaving(false);
        return;
      }
      const uploadRes = await uploadOperationExpenseAttachment({
        tenantId,
        expenseId,
        fileBlob: attachmentFile,
      });
      if (!uploadRes.ok) {
        pushStatus(uploadRes.error || 'Attachment upload failed.', 'error');
        setIsSaving(false);
        return;
      }
      attachment = uploadRes.attachment;
    }

    const selectedUser = tenantUsers.find((item) => item.uid === selectedEmployeeUserId) || null;
    const payload = {
      displayRef: safeDisplayRef,
      expenseType: finalExpenseType,
      category: normalizedCategory,
      amountRequested: numericAmount,
      description: String(note || '').trim(),
      requestedBy: user.uid,
      requestedByDisplayName: user.displayName || user.email || user.uid,
      salaryMode: finalExpenseType === 'salary' ? salaryMode : '',
      employeeUserId: finalExpenseType === 'salary' && salaryMode === 'user' ? selectedEmployeeUserId : '',
      employeeName: finalExpenseType === 'salary'
        ? (salaryMode === 'user'
          ? (selectedUser?.displayName || selectedUser?.email || selectedEmployeeUserId)
          : String(manualEmployeeName || '').trim())
        : '',
      attachment,
    };

    const res = intent === 'release'
      ? await releaseOperationExpenseWithFinancials(tenantId, expenseId, {
        ...payload,
        createIfMissing: true,
        amountApproved: numericAmount,
        amountReleased: numericAmount,
        approvedBy: user.uid,
        releasedBy: user.uid,
        releaseNote: String(note || '').trim(),
        portalId: selectedPortalId,
        portalName: selectedPortal?.name || selectedPortalId,
        transactionMethodId: selectedMethodId,
        transactionMethodName: resolvePortalMethodById(selectedMethodId, selectedPortal?.customMethods || [])?.label || selectedMethodId,
      })
      : await submitOperationExpenseRequest(tenantId, expenseId, payload);

    if (!res.ok) {
      pushStatus(res.error || 'Failed to save operation expense.', 'error');
      setIsSaving(false);
      return;
    }

    pushStatus(intent === 'release' ? 'Operation expense released successfully.' : 'Expense request submitted successfully.', 'success');
    await loadData();
    await resetAddForm();
    setIsSaving(false);
  };

  const handleApprove = async () => {
    if (!selectedExpense || !canReleaseExpenses || !user?.uid) return;
    const numericAmount = Math.max(0, Number(approveAmount || 0));
    if (!(numericAmount > 0)) return pushStatus('Approved amount must be greater than zero.', 'error');

    setIsActionSaving(true);
    const res = await approveOperationExpenseRequest(tenantId, selectedExpense.id, {
      approvedBy: user.uid,
      amountApproved: numericAmount,
      approvalNote,
    });
    if (!res.ok) {
      pushStatus(res.error || 'Approval failed.', 'error');
      setIsActionSaving(false);
      return;
    }

    pushStatus('Expense approved. Funds not released yet.', 'success');
    await loadData();
    setIsActionSaving(false);
  };

  const handleRelease = async () => {
    if (!selectedExpense || !canReleaseExpenses || !user?.uid) return;
    if (!releasePortalId) return pushStatus('Select release portal.', 'error');
    if (!releaseMethodId) return pushStatus('Select transaction method.', 'error');

    const normalizedStatus = normalizeStatus(selectedExpense.status);
    if (normalizedStatus === 'released' || selectedExpense.portalTransactionId) {
      return pushStatus('Released expense cannot be released twice.', 'error');
    }

    const numericAmount = Math.max(0, Number(releaseAmount || 0));
    if (!(numericAmount > 0)) return pushStatus('Release amount must be greater than zero.', 'error');

    setIsActionSaving(true);
    const selectedPortalForRelease = portals.find((item) => item.id === releasePortalId) || null;
    const methodLabel = resolvePortalMethodById(releaseMethodId, selectedPortalForRelease?.customMethods || [])?.label || releaseMethodId;

    const res = await releaseOperationExpenseWithFinancials(tenantId, selectedExpense.id, {
      releasedBy: user.uid,
      amountReleased: numericAmount,
      releaseNote,
      portalId: releasePortalId,
      portalName: selectedPortalForRelease?.name || releasePortalId,
      transactionMethodId: releaseMethodId,
      transactionMethodName: methodLabel,
    });

    if (!res.ok) {
      pushStatus(res.error || 'Release failed.', 'error');
      setIsActionSaving(false);
      return;
    }

    pushStatus('Expense released. Portal balance adjusted exactly once.', 'success');
    await loadData();
    setIsActionSaving(false);
  };

  return (
    <PageShell
      title="Operation Expenses"
      subtitle="Submit requests, approve, and release operation expenses with safe financial controls."
      iconKey="operationExpenses"
      eyebrow="Finance"
      widthPreset="data"
    >
      <div className="space-y-4">
        {status ? (
          <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${statusType === 'error' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
            {status}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPhase('add')}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${phase === 'add' ? 'bg-[var(--c-accent)] text-white' : 'border border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)]'}`}
          >
            Add Expense / Request Expense
          </button>
          <button
            type="button"
            onClick={() => setPhase('review')}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${phase === 'review' ? 'bg-[var(--c-accent)] text-white' : 'border border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)]'}`}
          >
            Existing Expenses / Review
          </button>
        </div>

        {phase === 'add' ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit('request');
            }}
            className="space-y-4 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4"
          >
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                Expense Ref
                <input className={`${inputClass} bg-transparent`} value={displayRef} readOnly />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                Type
                <select className={inputClass} value={expenseType} onChange={(event) => {
                  const nextType = event.target.value === 'salary' ? 'salary' : 'normal';
                  setExpenseType(nextType);
                  if (nextType === 'salary') {
                    setCategory('Salary');
                  }
                }}>
                  <option value="normal">Normal Operation Expense</option>
                  <option value="salary">Salary</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                Category
                <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
                  {FIXED_EXPENSE_CATEGORIES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                Amount
                <input type="number" min={0} step="0.01" className={inputClass} value={amount} onChange={(event) => setAmount(event.target.value)} required />
              </label>
            </div>

            {expenseType === 'salary' ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                  Salary Source
                  <select className={inputClass} value={salaryMode} onChange={(event) => setSalaryMode(event.target.value === 'manual' ? 'manual' : 'user')}>
                    <option value="user">System User</option>
                    <option value="manual">Manual Employee</option>
                  </select>
                </label>
                {salaryMode === 'user' ? (
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                    Employee User
                    <select
                      className={inputClass}
                      value={selectedEmployeeUserId}
                      onChange={(event) => {
                        const nextUid = event.target.value;
                        setSelectedEmployeeUserId(nextUid);
                        if (!amount && nextUid) {
                          const nextUser = tenantUsers.find((item) => item.uid === nextUid);
                          const salaryPrefill = Number(
                            nextUser?.salaryAmount || nextUser?.salary || nextUser?.monthlySalary || nextUser?.basicSalary || 0,
                          );
                          if (salaryPrefill > 0) setAmount(String(salaryPrefill));
                        }
                      }}
                    >
                      <option value="">Select employee user</option>
                      {tenantUsers.map((item) => (
                        <option key={item.uid} value={item.uid}>{item.displayName || item.email || item.uid}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                    Manual Employee Name
                    <input className={inputClass} value={manualEmployeeName} onChange={(event) => setManualEmployeeName(event.target.value)} placeholder="Employee name" />
                  </label>
                )}
              </div>
            ) : null}

            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
              Description / Note
              <textarea
                className={`${inputClass} min-h-[96px] resize-y`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Enter note or description"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                Attachment (Optional, image only)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className={inputClass}
                  onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
                />
              </label>
              <div className="md:col-span-2">
                <PortalTransactionSelector
                  portalLabel="Portal (required for release)"
                  methodLabel="Transaction Method (required for release)"
                  portalId={selectedPortalId}
                  methodId={selectedMethodId}
                  onPortalChange={(nextPortalId) => {
                    setSelectedPortalId(nextPortalId);
                    setSelectedMethodId('');
                  }}
                  onMethodChange={setSelectedMethodId}
                  portals={portals}
                  portal={selectedPortal}
                  portalPlaceholder="Select portal"
                  methodPlaceholder="Select method"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSubmit('request')}
                disabled={isSaving}
                className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2 text-sm font-semibold text-[var(--c-text)] disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Submit Expense Request'}
              </button>
              {canReleaseExpenses ? (
                <button
                  type="button"
                  onClick={() => void handleSubmit('release')}
                  disabled={isSaving}
                  className="rounded-xl bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSaving ? 'Processing...' : 'Direct Release'}
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <article className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--c-text)]">Existing Expenses</p>
                <select
                  value={filterStatus}
                  onChange={(event) => setFilterStatus(event.target.value)}
                  className="rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] px-2.5 py-1.5 text-xs font-semibold text-[var(--c-text)]"
                >
                  <option value="all">All</option>
                  <option value="requested">Requested</option>
                  <option value="approved">Approved</option>
                  <option value="released">Released</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="space-y-2">
                {isLoading ? (
                  <p className="py-4 text-center text-xs text-[var(--c-muted)]">Loading expenses...</p>
                ) : filteredExpenses.length === 0 ? (
                  <p className="py-4 text-center text-xs text-[var(--c-muted)]">No expenses found.</p>
                ) : (
                  filteredExpenses.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectExpense(item.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left ${selectedExpenseId === item.id ? 'border-[var(--c-accent)] bg-[var(--c-panel)]' : 'border-[var(--c-border)] bg-transparent'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[var(--c-text)]">{item.displayRef || item.id}</p>
                          <p className="truncate text-[11px] text-[var(--c-muted)]">{item.category || 'Other'} • {item.expenseType === 'salary' ? 'Salary' : 'Normal'}</p>
                        </div>
                        <p className="text-xs font-semibold text-[var(--c-text)]">{formatAmount(item.amountReleased || item.amountApproved || item.amountRequested || 0)}</p>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-[11px] text-[var(--c-muted)]">{formatDate(item.createdAt || item.requestedAt)}</p>
                        <p className="text-[11px] font-semibold uppercase text-[var(--c-muted)]">{normalizeStatus(item.status)}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
              {!selectedExpense ? (
                <p className="py-8 text-center text-xs text-[var(--c-muted)]">Select an expense to review.</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--c-text)]">{selectedExpense.displayRef || selectedExpense.id}</p>
                    <p className="text-xs text-[var(--c-muted)]">{selectedExpense.category} • {selectedExpense.expenseType === 'salary' ? 'Salary' : 'Normal'} • {normalizeStatus(selectedExpense.status)}</p>
                  </div>

                  <div className="grid gap-2 text-xs text-[var(--c-text)]">
                    <p><span className="text-[var(--c-muted)]">Requested:</span> {formatAmount(selectedExpense.amountRequested || 0)}</p>
                    <p><span className="text-[var(--c-muted)]">Approved:</span> {formatAmount(selectedExpense.amountApproved || 0)}</p>
                    <p><span className="text-[var(--c-muted)]">Released:</span> {formatAmount(selectedExpense.amountReleased || 0)}</p>
                    <p><span className="text-[var(--c-muted)]">Portal:</span> {selectedExpense.portalName || selectedExpense.portalId || '-'}</p>
                    <p><span className="text-[var(--c-muted)]">Method:</span> {selectedExpense.transactionMethodName || selectedExpense.transactionMethodId || '-'}</p>
                    {selectedExpense.expenseType === 'salary' ? (
                      <p><span className="text-[var(--c-muted)]">Employee:</span> {selectedExpense.employeeName || selectedExpense.employeeUserId || '-'}</p>
                    ) : null}
                    {selectedExpense.attachment?.url ? (
                      <a href={selectedExpense.attachment.url} target="_blank" rel="noreferrer" className="text-[var(--c-accent)] underline">View Attachment</a>
                    ) : (
                      <p><span className="text-[var(--c-muted)]">Attachment:</span> None</p>
                    )}
                  </div>

                  {canReleaseExpenses ? (
                    <>
                      {normalizeStatus(selectedExpense.status) !== 'released' && !selectedExpense.portalTransactionId ? (
                        <>
                          <div className="grid gap-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                              Approve Amount
                              <input type="number" min={0} step="0.01" className={inputClass} value={approveAmount} onChange={(event) => setApproveAmount(event.target.value)} />
                            </label>
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                              Approval Note
                              <textarea className={`${inputClass} min-h-[72px]`} value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} />
                            </label>
                            <button
                              type="button"
                              onClick={() => void handleApprove()}
                              disabled={isActionSaving}
                              className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm font-semibold text-[var(--c-text)] disabled:opacity-60"
                            >
                              {isActionSaving ? 'Saving...' : 'Approve (No Release)'}
                            </button>
                          </div>

                          <div className="mt-2 grid gap-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                              Release Amount
                              <input type="number" min={0} step="0.01" className={inputClass} value={releaseAmount} onChange={(event) => setReleaseAmount(event.target.value)} />
                            </label>
                            <PortalTransactionSelector
                              portalLabel="Release Portal"
                              methodLabel="Transaction Method"
                              portalId={releasePortalId}
                              methodId={releaseMethodId}
                              onPortalChange={(nextPortalId) => {
                                setReleasePortalId(nextPortalId);
                                setReleaseMethodId('');
                              }}
                              onMethodChange={setReleaseMethodId}
                              portals={portals}
                              portal={reviewReleasePortal}
                              portalPlaceholder="Select portal"
                              methodPlaceholder="Select method"
                            />
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                              Release Note
                              <textarea className={`${inputClass} min-h-[72px]`} value={releaseNote} onChange={(event) => setReleaseNote(event.target.value)} />
                            </label>
                            <button
                              type="button"
                              onClick={() => void handleRelease()}
                              disabled={isActionSaving}
                              className="rounded-xl bg-[var(--c-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {isActionSaving ? 'Releasing...' : 'Release Expense'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                          This expense is already released. Duplicate release is blocked.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-xs text-[var(--c-muted)]">
                      You can review records but release actions are restricted.
                    </p>
                  )}
                </div>
              )}
            </article>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default OperationExpensesPage;
