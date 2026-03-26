import { useCallback, useEffect, useMemo, useState } from 'react';
import PageShell from '../components/layout/PageShell';
import { TasksIcon } from '../components/icons/AppIcons';
import { useTenant } from '../context/useTenant';
import { useAuth } from '../context/useAuth';
import {
  createTenantTask,
  fetchRecentDailyTransactions,
  fetchTenantClients,
  fetchTenantProformaInvoices,
  fetchTenantTasks,
  fetchTenantUsersMap,
  updateTenantTask,
  updateTenantTaskStatus,
} from '../lib/backendStore';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const emptyDraft = {
  title: '',
  description: '',
  status: 'pending',
  assignedUserIds: [],
  clientId: '',
  dependentId: '',
  proformaId: '',
  dailyTransactionId: '',
  trackingId: '',
  trackingNumber: '',
  transactionNumbersSnapshot: [],
};

const statusBadgeClass = (status) => {
  if (status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'in_progress') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (status === 'cancelled') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
};

const TasksTrackingPage = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [proformas, setProformas] = useState([]);
  const [dailyTransactions, setDailyTransactions] = useState([]);

  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedTask = useMemo(() => tasks.find((item) => item.id === selectedTaskId) || null, [tasks, selectedTaskId]);

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter((item) => String(item.status || 'pending') === statusFilter);
  }, [tasks, statusFilter]);

  const clientOptions = useMemo(
    () => (clients || []).filter((item) => {
      const type = String(item.type || '').toLowerCase();
      return type === 'company' || type === 'individual';
    }),
    [clients],
  );

  const dependentOptions = useMemo(
    () => (clients || []).filter((item) => {
      if (String(item.type || '').toLowerCase() !== 'dependent') return false;
      if (!draft.clientId) return false;
      return String(item.parentId || '') === String(draft.clientId);
    }),
    [clients, draft.clientId],
  );

  const proformaOptions = useMemo(() => {
    const clientId = String(draft.clientId || '');
    if (!clientId) return proformas;
    return (proformas || []).filter((item) => String(item.clientId || '') === clientId);
  }, [draft.clientId, proformas]);

  const dailyTransactionOptions = useMemo(() => {
    const clientId = String(draft.clientId || '');
    const dependentId = String(draft.dependentId || '');
    return (dailyTransactions || []).filter((item) => {
      if (clientId && String(item.clientId || '') !== clientId) return false;
      if (dependentId && String(item.dependentId || '') !== dependentId) return false;
      return true;
    });
  }, [dailyTransactions, draft.clientId, draft.dependentId]);

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    tasks.forEach((task) => {
      const status = String(task.status || 'pending');
      if (counts[status] !== undefined) counts[status] += 1;
    });
    return counts;
  }, [tasks]);

  const hydrateDraftFromTask = (task) => {
    if (!task) return emptyDraft;
    return {
      title: String(task.title || ''),
      description: String(task.description || ''),
      status: String(task.status || 'pending'),
      assignedUserIds: Array.isArray(task.assignedUserIds) ? task.assignedUserIds : [],
      clientId: String(task.clientId || ''),
      dependentId: String(task.dependentId || ''),
      proformaId: String(task.proformaId || ''),
      dailyTransactionId: String(task.dailyTransactionId || ''),
      trackingId: String(task.trackingId || ''),
      trackingNumber: String(task.trackingNumber || ''),
      transactionNumbersSnapshot: Array.isArray(task.transactionNumbersSnapshot) ? task.transactionNumbersSnapshot : [],
    };
  };

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    const [taskRes, userRes, clientRes, proformaRes, dailyTxRes] = await Promise.all([
      fetchTenantTasks(tenantId),
      fetchTenantUsersMap(tenantId),
      fetchTenantClients(tenantId),
      fetchTenantProformaInvoices(tenantId),
      fetchRecentDailyTransactions(tenantId, 200),
    ]);

    if (taskRes.ok) setTasks(taskRes.rows || []);
    if (userRes.ok) setTenantUsers((userRes.rows || []).filter((item) => !item.deletedAt));
    if (clientRes.ok) setClients(clientRes.rows || []);
    if (proformaRes.ok) setProformas((proformaRes.rows || []).filter((item) => !item.deletedAt));
    if (dailyTxRes.ok) setDailyTransactions(dailyTxRes.rows || []);
    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadData]);

  const startCreate = () => {
    setSelectedTaskId('');
    setIsEditMode(false);
    setDraft(emptyDraft);
    setError('');
    setSuccess('');
  };

  const toggleAssignee = (uid) => {
    setDraft((prev) => {
      const current = new Set(prev.assignedUserIds || []);
      if (current.has(uid)) current.delete(uid);
      else current.add(uid);
      return { ...prev, assignedUserIds: Array.from(current) };
    });
  };

  const handleDailyTransactionChange = (dailyTransactionId) => {
    const linkedTx = dailyTransactions.find((item) => String(item.id) === String(dailyTransactionId)) || null;
    setDraft((prev) => ({
      ...prev,
      dailyTransactionId,
      trackingId: linkedTx ? String(linkedTx.trackingId || '') : '',
      trackingNumber: linkedTx ? String(linkedTx.trackingNumber || '') : '',
      transactionNumbersSnapshot: linkedTx
        ? (Array.isArray(linkedTx.transactionNumbers) ? linkedTx.transactionNumbers : []).map((item) => String(item || '')).filter(Boolean)
        : [],
    }));
  };

  const handleClientChange = (clientId) => {
    setDraft((prev) => ({
      ...prev,
      clientId,
      dependentId: '',
      proformaId: '',
      dailyTransactionId: '',
      trackingId: '',
      trackingNumber: '',
      transactionNumbersSnapshot: [],
    }));
  };

  const handleDependentChange = (dependentId) => {
    const linkedTx = dailyTransactions.find((item) => String(item.id) === String(draft.dailyTransactionId)) || null;
    const shouldClearDailyLink = Boolean(
      linkedTx && String(linkedTx.dependentId || '') !== String(dependentId || ''),
    );

    setDraft((prev) => ({
      ...prev,
      dependentId,
      dailyTransactionId: shouldClearDailyLink ? '' : prev.dailyTransactionId,
      trackingId: shouldClearDailyLink ? '' : prev.trackingId,
      trackingNumber: shouldClearDailyLink ? '' : prev.trackingNumber,
      transactionNumbersSnapshot: shouldClearDailyLink ? [] : prev.transactionNumbersSnapshot,
    }));
  };

  const handleSave = async () => {
    if (!tenantId || !user?.uid) return;
    if (!String(draft.title || '').trim()) {
      setError('Task title is required.');
      return;
    }
    if (!Array.isArray(draft.assignedUserIds) || draft.assignedUserIds.length === 0) {
      setError('Assign at least one user.');
      return;
    }

    if (draft.proformaId && !proformaOptions.some((item) => String(item.id) === String(draft.proformaId))) {
      setError('Selected proforma does not match the selected client context.');
      return;
    }

    if (draft.dailyTransactionId && !dailyTransactionOptions.some((item) => String(item.id) === String(draft.dailyTransactionId))) {
      setError('Selected daily transaction does not match the selected client/dependent context.');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      ...draft,
      status: STATUS_OPTIONS.some((item) => item.value === draft.status) ? draft.status : 'pending',
      createdBy: user.uid,
      updatedBy: user.uid,
    };

    const res = isEditMode && selectedTaskId
      ? await updateTenantTask(tenantId, selectedTaskId, payload)
      : await createTenantTask(tenantId, payload);

    if (!res.ok) {
      setError(res.error || 'Failed to save task.');
      setIsSaving(false);
      return;
    }

    setSuccess(isEditMode ? 'Task updated.' : 'Task created.');
    await loadData();

    if (isEditMode && selectedTaskId) {
      const refreshed = (await fetchTenantTasks(tenantId)).rows || [];
      const latest = refreshed.find((item) => item.id === selectedTaskId);
      if (latest) setDraft(hydrateDraftFromTask(latest));
    } else {
      startCreate();
    }

    setIsSaving(false);
  };

  const handleStatusChange = async (nextStatus) => {
    if (!tenantId || !selectedTaskId || !user?.uid) return;
    const allowed = STATUS_OPTIONS.some((item) => item.value === nextStatus);
    if (!allowed) return;
    const res = await updateTenantTaskStatus(tenantId, selectedTaskId, nextStatus, user.uid);
    if (!res.ok) {
      setError(res.error || 'Failed to update status.');
      return;
    }
    setDraft((prev) => ({ ...prev, status: nextStatus }));
    setTasks((prev) => prev.map((item) => (
      item.id === selectedTaskId ? { ...item, status: nextStatus } : item
    )));
    setSuccess(`Status changed to ${nextStatus}.`);
    await loadData();
  };

  const renderTaskMeta = (task) => {
    const chips = [];
    if (task.clientId) chips.push(`Client: ${task.clientId}`);
    if (task.dependentId) chips.push(`Dependent: ${task.dependentId}`);
    if (task.proformaId) chips.push(`Proforma: ${task.proformaId}`);
    if (task.dailyTransactionId) chips.push(`Daily TX: ${task.dailyTransactionId}`);
    if (task.trackingId) chips.push(`Tracking ID: ${task.trackingId}`);
    if (task.trackingNumber) chips.push(`Tracking No: ${task.trackingNumber}`);
    return chips;
  };

  return (
    <PageShell
      title="Task / Tracking"
      subtitle="Create, assign, and track operational tasks with optional client and document linkage."
      iconKey="tasksTracking"
      eyebrow="Operations"
      widthPreset="data"
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          {STATUS_OPTIONS.map((item) => (
            <div key={item.value} className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--c-muted)]">{item.label}</p>
              <p className="mt-1 text-lg font-semibold text-[var(--c-text)]">{statusCounts[item.value]}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="compact-field rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-xs font-semibold text-[var(--c-text)]"
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={startCreate}
                className="compact-action rounded-xl bg-[var(--c-accent)] px-3 text-xs font-semibold text-white"
              >
                + New
              </button>
            </div>

            {isLoading ? (
              <p className="p-3 text-xs font-semibold text-[var(--c-muted)]">Loading tasks...</p>
            ) : filteredTasks.length === 0 ? (
              <p className="p-3 text-xs font-semibold text-[var(--c-muted)]">No tasks found for this filter.</p>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setDraft(hydrateDraftFromTask(task));
                      setIsEditMode(true);
                      setError('');
                      setSuccess('');
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                      selectedTaskId === task.id
                        ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/10'
                        : 'border-[var(--c-border)] bg-[var(--c-panel)] hover:border-[var(--c-accent)]/40'
                    }`}
                  >
                    <p className="truncate text-sm font-semibold text-[var(--c-text)]">{task.title || 'Untitled task'}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${statusBadgeClass(String(task.status || 'pending'))}`}>
                        {String(task.status || 'pending')}
                      </span>
                      <span className="text-[10px] font-semibold text-[var(--c-muted)]">
                        {Array.isArray(task.assignedUserIds) ? task.assignedUserIds.length : 0} assignee(s)
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--c-text)]">{isEditMode ? 'Edit Task' : 'Create Task'}</h3>
              {isEditMode && selectedTaskId ? (
                <div className="flex flex-wrap items-center gap-1">
                  {STATUS_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleStatusChange(item.value)}
                      className={`rounded-lg px-2 py-1 text-[10px] font-semibold uppercase ${
                        draft.status === item.value ? 'bg-[var(--c-accent)] text-white' : 'bg-[var(--c-panel)] text-[var(--c-text)]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold text-[var(--c-text)]">
                Title *
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                  className="compact-field mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-sm font-semibold"
                />
              </label>
              <label className="text-xs font-semibold text-[var(--c-text)]">
                Status
                <select
                  value={draft.status}
                  onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value }))}
                  className="compact-field mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-sm font-semibold"
                >
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-[var(--c-text)] md:col-span-2">
                Description
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm font-semibold text-[var(--c-text)] outline-none"
                />
              </label>

              <div className="md:col-span-2">
                <p className="text-xs font-semibold text-[var(--c-text)]">Assign Users *</p>
                <div className="mt-1 grid max-h-36 gap-2 overflow-y-auto rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-2 sm:grid-cols-2">
                  {tenantUsers.map((item) => {
                    const checked = draft.assignedUserIds.includes(item.uid);
                    return (
                      <label key={item.uid} className="flex items-center gap-2 rounded-lg bg-[var(--c-surface)] px-2 py-1 text-xs font-semibold text-[var(--c-text)]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAssignee(item.uid)}
                        />
                        <span className="truncate">{item.displayName || item.email || item.uid}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="text-xs font-semibold text-[var(--c-text)]">
                Client (Optional)
                <select
                  value={draft.clientId}
                  onChange={(event) => handleClientChange(event.target.value)}
                  className="compact-field mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-sm font-semibold"
                >
                  <option value="">None</option>
                  {clientOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.fullName || item.tradeName || item.id}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-[var(--c-text)]">
                Dependent (Optional)
                <select
                  value={draft.dependentId}
                  onChange={(event) => handleDependentChange(event.target.value)}
                  className="compact-field mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-sm font-semibold"
                  disabled={!draft.clientId}
                >
                  <option value="">None</option>
                  {dependentOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.fullName || item.tradeName || item.id}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-[var(--c-text)]">
                Proforma Link (Optional)
                <select
                  value={draft.proformaId}
                  onChange={(event) => setDraft((prev) => ({ ...prev, proformaId: event.target.value }))}
                  className="compact-field mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-sm font-semibold"
                >
                  <option value="">None</option>
                  {proformaOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.displayRef || item.id}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-[var(--c-text)]">
                Daily Transaction Link (Optional)
                <select
                  value={draft.dailyTransactionId}
                  onChange={(event) => handleDailyTransactionChange(event.target.value)}
                  className="compact-field mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-sm font-semibold"
                >
                  <option value="">None</option>
                  {dailyTransactionOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.transactionId || item.id}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-[var(--c-text)]">
                Tracking ID
                <input
                  type="text"
                  value={draft.trackingId}
                  readOnly
                  className="compact-field mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-sm font-semibold opacity-80"
                />
              </label>

              <label className="text-xs font-semibold text-[var(--c-text)]">
                Tracking Number
                <input
                  type="text"
                  value={draft.trackingNumber}
                  readOnly
                  className="compact-field mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-sm font-semibold opacity-80"
                />
              </label>

              <div className="md:col-span-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
                <p className="text-xs font-semibold text-[var(--c-text)]">Transaction Numbers Snapshot (Display-only)</p>
                {draft.transactionNumbersSnapshot.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {draft.transactionNumbersSnapshot.map((item) => (
                      <span key={item} className="rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--c-text)]">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs font-semibold text-[var(--c-muted)]">No linked transaction numbers.</p>
                )}
              </div>

              {isEditMode && selectedTask ? (
                <div className="md:col-span-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
                  <p className="text-xs font-semibold text-[var(--c-text)]">Saved Linkage Overview</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {renderTaskMeta(selectedTask).length ? renderTaskMeta(selectedTask).map((item) => (
                      <span key={item} className="rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--c-text)]">
                        {item}
                      </span>
                    )) : <span className="text-xs font-semibold text-[var(--c-muted)]">No linkage set.</span>}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              {isEditMode ? (
                <button
                  type="button"
                  onClick={startCreate}
                  className="compact-action rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 text-xs font-semibold text-[var(--c-text)]"
                >
                  Create New Instead
                </button>
              ) : null}
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="compact-action rounded-xl bg-[var(--c-accent)] px-4 text-xs font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : isEditMode ? 'Update Task' : 'Create Task'}
              </button>
            </div>

            {error ? <p className="mt-3 text-xs font-semibold text-rose-500">{error}</p> : null}
            {success ? <p className="mt-3 text-xs font-semibold text-emerald-600">{success}</p> : null}
          </section>
        </div>
      </div>
    </PageShell>
  );
};

export default TasksTrackingPage;
