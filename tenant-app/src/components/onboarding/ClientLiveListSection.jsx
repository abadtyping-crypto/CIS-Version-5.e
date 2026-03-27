import { useEffect, useMemo, useState } from 'react';
import { Edit3, ExternalLink, RefreshCcw, Save, Search, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  deleteTenantClientCascade,
  fetchTenantClients,
  updateTenantClient,
} from '../../lib/backendStore';
import { getEmirateIcon } from '../../lib/clientIcons';
import RelationSelect from '../common/RelationSelect';
import { getRelationIcon } from '../../lib/relationData';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../../lib/systemAssetsCache';

const resolveSystemIcon = (snapshot, key, fallback) => {
  return snapshot[key]?.iconUrl || fallback;
};

const PAGE_SIZES = [50, 100];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('0') ? digits.slice(1) : digits;
};

const toTitleCase = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');

const getStatusBadgeClass = (statusValue) => {
  const status = String(statusValue || 'active').toLowerCase();
  if (status === 'active') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (status === 'pending') return 'border-amber-300 bg-amber-50 text-amber-700';
  if (status === 'tracking') return 'border-sky-300 bg-sky-50 text-sky-700';
  if (status === 'blocked' || status === 'frozen') return 'border-rose-300 bg-rose-50 text-rose-700';
  return 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)]';
};

const ClientLiveListSection = ({ tenantId, user, refreshKey = 0 }) => {
  const [rows, setRows] = useState([]);
  const [usersByUid, setUsersByUid] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingRow, setEditingRow] = useState(null);
  const [draft, setDraft] = useState({});

  const loadRows = async () => {
    setIsLoading(true);
    const res = await fetchTenantClients(tenantId);
    if (!res.ok) {
      setStatus({ type: 'error', message: res.error || 'Failed to load live list.' });
      setRows([]);
      setUsersByUid({});
      setIsLoading(false);
      return;
    }
    setRows(res.rows || []);
    setUsersByUid(res.usersByUid || {});
    setIsLoading(false);
  };

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, refreshKey]);

  useEffect(() => {
    getSystemAssets().then(setSystemAssets).catch(() => {});
  }, []);

  const parentById = useMemo(() => {
    const map = {};
    rows.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const searchStr = search.trim().toLowerCase();
    return rows.filter((item) => {
      const type = String(item.type || '').toLowerCase();
      if (typeFilter === 'clients' && !['company', 'individual'].includes(type)) return false;
      if (typeFilter === 'dependent' && type !== 'dependent') return false;

      if (!searchStr) return true;
      const searchPool = [
        item.displayClientId,
        item.tradeName,
        item.fullName,
        item.primaryMobile,
        item.secondaryMobile,
        item.emiratesId,
        item.tradeLicenseNumber,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return searchPool.includes(searchStr);
    });
  }, [rows, search, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, pageSize]);

  const getTypeLabel = (item) => {
    const type = String(item.type || '').toLowerCase();
    if (type === 'company') return 'Company';
    if (type === 'individual') return 'Individual';
    return 'Dependent';
  };

  const getCompanyVisualIcon = (item) => {
    const emirateIcon = getEmirateIcon(item.registeredEmirate || item.poBoxEmirate, systemAssets);
    return emirateIcon || resolveSystemIcon(systemAssets, 'icon_main_company', '/company.png');
  };

  const getTypeIcon = (item) => {
    const type = String(item.type || '').toLowerCase();
    if (type === 'company') return getCompanyVisualIcon(item);
    if (type === 'individual') return resolveSystemIcon(systemAssets, 'icon_main_individual', '/individual.png');

    const relationRaw = String(item.relationship || '').toLowerCase();
    const relation = relationRaw || 'dependent';
    return resolveSystemIcon(
      systemAssets,
      getRelationIcon(relation, item.parentClientType || parentById[item.parentId]?.type || 'individual'),
      '/dependent.png',
    );
  };

  const getEntryBadge = (item) => {
    const type = String(item.type || '').toLowerCase();
    if (type === 'company') {
      return {
        label: 'Company',
        icon: resolveSystemIcon(systemAssets, 'icon_main_company', '/company.png'),
        className: 'border-amber-300 bg-amber-50 text-amber-700',
        meta: '',
      };
    }
    if (type === 'individual') {
      return {
        label: 'Individual',
        icon: resolveSystemIcon(systemAssets, 'icon_main_individual', '/individual.png'),
        className: 'border-sky-300 bg-sky-50 text-sky-700',
        meta: '',
      };
    }

    const relationRaw = String(item.relationship || '').toLowerCase();
    const relation = relationRaw || 'dependent';

    return {
      label: toTitleCase(relation),
      icon: resolveSystemIcon(
        systemAssets,
        getRelationIcon(relation, item.parentClientType || parentById[item.parentId]?.type || 'individual'),
        '/dependent.png',
      ),
      className: 'border-violet-300 bg-violet-50 text-violet-700',
      meta: item.parentName ? `of ${item.parentName}` : '',
    };
  };

  const getCreator = (item) => {
    const rawUid = item?.createdBy;
    const uid = typeof rawUid === 'string' ? rawUid.trim() : '';
    const creator = uid ? usersByUid[uid] : null;
    return {
      uid,
      name: creator?.displayName || creator?.email || uid,
      avatar: creator?.photoURL || '/avatar.png',
    };
  };

  const openEdit = (item) => {
    setEditingRow(item);
    setDraft({
      tradeName: item.tradeName || '',
      fullName: item.fullName || '',
      relationship: item.relationship || '',
      registeredEmirate: item.registeredEmirate || '',
      primaryMobile: item.primaryMobile || '',
      secondaryMobile: item.secondaryMobile || '',
      primaryEmail: item.primaryEmail || '',
      secondaryEmail: item.secondaryEmail || '',
      address: item.address || '',
      poBox: item.poBox || '',
      poBoxEmirate: item.poBoxEmirate || '',
      nationality: item.nationality || '',
      gender: item.gender || '',
      dateOfBirth: item.dateOfBirth || '',
      status: item.status || 'active',
      trackingNumber: item.trackingNumber || '',
    });
  };

  const validateDraft = (item, formData) => {
    const primaryMobile = normalizePhone(formData.primaryMobile);
    const secondaryMobile = normalizePhone(formData.secondaryMobile);
    if (primaryMobile && primaryMobile.length < 8) return 'Primary mobile must be at least 8 digits.';
    if (secondaryMobile && secondaryMobile.length < 8) return 'Secondary mobile must be at least 8 digits.';
    if (formData.primaryEmail && !emailRegex.test(formData.primaryEmail)) return 'Primary email is invalid.';
    if (formData.secondaryEmail && !emailRegex.test(formData.secondaryEmail)) return 'Secondary email is invalid.';

    const type = String(item.type || '').toLowerCase();
    if (type === 'company' && !String(formData.tradeName || '').trim()) return 'Trade name is required.';
    if (type !== 'company' && !String(formData.fullName || '').trim()) return 'Full name is required.';
    return '';
  };

  const handleSaveEdit = async () => {
    if (!editingRow) return;
    const validationError = validateDraft(editingRow, draft);
    if (validationError) {
      setStatus({ type: 'error', message: validationError });
      return;
    }

    const type = String(editingRow.type || '').toLowerCase();
    const payload = {
      tradeName: type === 'company' ? String(draft.tradeName || '').toUpperCase().trim() : undefined,
      fullName: type !== 'company' ? String(draft.fullName || '').toUpperCase().trim() : undefined,
      relationship: type === 'dependent' ? String(draft.relationship || '').trim() : undefined,
      registeredEmirate: String(draft.registeredEmirate || '').trim(),
      primaryMobile: normalizePhone(draft.primaryMobile),
      secondaryMobile: normalizePhone(draft.secondaryMobile),
      primaryEmail: String(draft.primaryEmail || '').trim().toLowerCase(),
      secondaryEmail: String(draft.secondaryEmail || '').trim().toLowerCase(),
      address: String(draft.address || '').trim(),
      poBox: String(draft.poBox || '').trim(),
      poBoxEmirate: String(draft.poBoxEmirate || '').trim(),
      nationality: String(draft.nationality || '').trim(),
      gender: String(draft.gender || '').trim(),
      dateOfBirth: String(draft.dateOfBirth || '').trim(),
      status: String(draft.status || 'active').trim() || 'active',
      trackingNumber: String(draft.trackingNumber || '').trim(),
      updatedBy: user?.uid || '',
    };

    const res = await updateTenantClient(tenantId, editingRow.id, payload);
    if (!res.ok) {
      setStatus({ type: 'error', message: res.error || 'Failed to update client.' });
      return;
    }

    setStatus({ type: 'success', message: `Updated ${editingRow.displayClientId || editingRow.id}.` });
    setEditingRow(null);
    await loadRows();
  };

  const handleDelete = async (item) => {
    const label = item.displayClientId || item.fullName || item.tradeName || item.id;
    const type = String(item.type || '').toLowerCase();
    const confirmText =
      type === 'dependent'
        ? `Delete dependent ${label}?`
        : `Delete client ${label} and all linked dependents?`;
    if (!window.confirm(confirmText)) return;

    const res = await deleteTenantClientCascade(tenantId, item.id, user?.uid || '');
    if (!res.ok) {
      setStatus({ type: 'error', message: res.error || 'Delete failed.' });
      return;
    }

    const suffix = res.deletedDependents ? ` (${res.deletedDependents} dependents removed)` : '';
    setStatus({ type: 'success', message: `Deleted ${label}${suffix}.` });
    await loadRows();
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--c-text)]">Live List</h2>
          <p className="text-[13px] text-[var(--c-muted)]">Unified view of clients and dependents with edit/delete controls.</p>
        </div>
        <button
          type="button"
          onClick={loadRows}
          className="compact-action inline-flex items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-xs font-semibold text-[var(--c-text)] hover:border-[var(--c-accent)]"
        >
          <RefreshCcw strokeWidth={1.5} size={14} />
          Refresh
        </button>
      </div>

      {status.message ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${status.type === 'error'
            ? 'border-rose-300 bg-rose-50 text-rose-700'
            : 'border-emerald-300 bg-emerald-50 text-emerald-700'
            }`}
        >
          {status.message}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-12">
        <label className="md:col-span-4">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">Search</span>
          <div className="relative">
            <Search strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--c-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, CLID/DPID, mobile"
              className="compact-field w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] pl-9 pr-3 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
            />
          </div>
        </label>
        <label className="md:col-span-4">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">Type</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="compact-field w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
          >
            <option value="all">All</option>
            <option value="clients">Clients</option>
            <option value="dependent">Dependent</option>
          </select>
        </label>
        <label className="md:col-span-4">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">Per Page</span>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="compact-field w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 space-y-3 lg:hidden">
        {isLoading ? (
          <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4 text-center text-sm text-[var(--c-muted)]">
            Loading live list...
          </div>
        ) : null}
        {!isLoading && pageRows.length === 0 ? (
          <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4 text-center text-sm text-[var(--c-muted)]">
            No records found for current filters.
          </div>
        ) : null}
        {!isLoading ? pageRows.map((item) => {
          const creator = getCreator(item);
          const typeLabel = getTypeLabel(item);
          const nameLabel = item.tradeName || item.fullName || item.displayClientId || item.id;
          const badge = getEntryBadge(item);
          const isDependent = String(item.type || '').toLowerCase() === 'dependent';
          const targetPath = isDependent && item.parentId
            ? `/t/${tenantId}/clients/${item.parentId}/dependents/${item.id}`
            : `/t/${tenantId}/clients/${item.id}`;

          return (
            <article key={`card-${item.id}`} className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <img src={getTypeIcon(item)} alt={typeLabel} className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <Link
                    to={targetPath}
                    className="block text-sm font-semibold leading-5 text-[var(--c-text)] hover:text-[var(--c-accent)] hover:underline"
                  >
                    {nameLabel}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold leading-5 ${badge.className}`}>
                      <img src={badge.icon} alt={badge.label} className="h-3.5 w-3.5 rounded object-contain" />
                      {badge.label}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] px-2 py-0.5 text-[11px] font-bold leading-5 text-[var(--c-accent)]">
                      {item.displayClientId || item.id}
                    </span>
                    {badge.meta ? <span className="text-xs text-[var(--c-muted)]">{badge.meta}</span> : null}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Link
                  to={`/t/${tenantId}/profile`}
                  className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-[var(--c-border)] bg-[var(--c-panel)] px-2 py-1 pr-3 text-xs text-[var(--c-text)] hover:border-[var(--c-accent)]"
                >
                  <img src={creator.avatar} alt={creator.name} className="h-6 w-6 shrink-0 rounded-full object-cover" />
                  <span className="truncate">{creator.name}</span>
                  <ExternalLink strokeWidth={1.5} size={12} />
                </Link>
                <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold leading-5 ${getStatusBadgeClass(item.status)}`}>
                  {toTitleCase(item.status || 'active')}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--c-border)] px-2.5 text-xs font-semibold text-[var(--c-text)] hover:border-[var(--c-accent)]"
                >
                  <Edit3 strokeWidth={1.5} size={13} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 strokeWidth={1.5} size={13} />
                  Delete
                </button>
              </div>
            </article>
          );
        }) : null}
      </div>

      <div className="desktop-table-scroll mt-4 hidden overflow-x-auto rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)]/25 lg:block">
        <table className="compact-table w-full min-w-[1020px] table-auto text-xs">
          <thead className="sticky top-0 z-10 bg-[var(--c-panel)]">
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-[var(--c-muted)]">
              <th className="font-semibold">Entry</th>
              <th className="w-[130px] font-semibold">ID</th>
              <th className="w-[210px] font-semibold">Created By</th>
              <th className="w-[110px] font-semibold">Status</th>
              <th className="w-[170px] text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-[var(--c-muted)]">
                  Loading live list...
                </td>
              </tr>
            ) : null}
            {!isLoading && pageRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-[var(--c-muted)]">
                  No records found for current filters.
                </td>
              </tr>
            ) : null}
            {!isLoading
              ? pageRows.map((item) => {
                const creator = getCreator(item);
                const typeLabel = getTypeLabel(item);
                const nameLabel = item.tradeName || item.fullName || item.displayClientId || item.id;
                const badge = getEntryBadge(item);
                const isDependent = String(item.type || '').toLowerCase() === 'dependent';
                const targetPath = isDependent && item.parentId
                  ? `/t/${tenantId}/clients/${item.parentId}/dependents/${item.id}`
                  : `/t/${tenantId}/clients/${item.id}`;
                return (
                  <tr key={item.id} className="border-t border-[var(--c-border)] align-top transition hover:bg-[color:color-mix(in_srgb,var(--c-panel)_38%,transparent)]">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <img src={getTypeIcon(item)} alt={typeLabel} className="h-8.5 w-8.5 shrink-0 rounded-xl object-cover" />
                        <div className="min-w-0">
                          <Link
                            to={targetPath}
                            className="block font-semibold leading-5 text-[var(--c-text)] hover:text-[var(--c-accent)] hover:underline"
                          >
                            {nameLabel}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold leading-5 ${badge.className}`}>
                              <img src={badge.icon} alt={badge.label} className="h-3.5 w-3.5 rounded object-contain" />
                              {badge.label}
                            </span>
                            {badge.meta ? <span className="text-xs text-[var(--c-muted)]">{badge.meta}</span> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] px-2 py-0.5 text-[11px] font-bold leading-5 text-[var(--c-accent)]">
                        {item.displayClientId || item.id}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        to={creator.uid ? `/t/${tenantId}/profile/edit?uid=${encodeURIComponent(creator.uid)}` : `/t/${tenantId}/profile`}
                        className="inline-flex max-w-[210px] items-center gap-2 rounded-full border border-[var(--c-border)] bg-[var(--c-panel)] px-2 py-1 pr-3 text-xs text-[var(--c-text)] hover:border-[var(--c-accent)]"
                      >
                        <img src={creator.avatar} alt={creator.name} className="h-6 w-6 shrink-0 rounded-full object-cover" />
                        <span className="truncate">{creator.name}</span>
                        <ExternalLink strokeWidth={1.5} size={12} />
                      </Link>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold leading-5 ${getStatusBadgeClass(item.status)}`}>
                        {toTitleCase(item.status || 'active')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--c-border)] px-2 text-[11px] font-semibold text-[var(--c-text)] hover:border-[var(--c-accent)]"
                        >
                          <Edit3 strokeWidth={1.5} size={13} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 strokeWidth={1.5} size={13} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
              : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--c-muted)]">
        <p>
          Showing {filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-
          {Math.min(safePage * pageSize, filteredRows.length)} of {filteredRows.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            className="rounded-lg border border-[var(--c-border)] px-2.5 py-1.5 disabled:opacity-40"
          >
            Prev
          </button>
          <span>
            Page {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            className="rounded-lg border border-[var(--c-border)] px-2.5 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {editingRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="compact-dialog w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--c-text)]">Edit {editingRow.displayClientId || editingRow.id}</h3>
                <p className="text-xs text-[var(--c-muted)]">System ID and financial fields are locked.</p>
              </div>
              <button type="button" onClick={() => setEditingRow(null)} className="compact-icon-action rounded-lg border border-[var(--c-border)]">
                <X strokeWidth={1.5} size={16} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {String(editingRow.type || '').toLowerCase() === 'company' ? (
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-[var(--c-muted)]">Trade Name</span>
                  <input
                    value={draft.tradeName || ''}
                    onChange={(event) => setDraft((prev) => ({ ...prev, tradeName: event.target.value }))}
                    className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm"
                  />
                </label>
              ) : (
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-[var(--c-muted)]">Full Name</span>
                  <input
                    value={draft.fullName || ''}
                    onChange={(event) => setDraft((prev) => ({ ...prev, fullName: event.target.value }))}
                    className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm"
                  />
                </label>
              )}

              {String(editingRow.type || '').toLowerCase() === 'dependent' ? (
                <label>
                  <span className="mb-1 block text-xs font-semibold text-[var(--c-muted)]">Relationship</span>
                  <RelationSelect
                    value={draft.relationship || ''}
                    onChange={(nextRelation) => setDraft((prev) => ({ ...prev, relationship: nextRelation }))}
                    parentType={parentById[editingRow.parentId]?.type || editingRow.parentClientType || 'individual'}
                    placeholder="Select relation"
                  />
                </label>
              ) : null}

              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--c-muted)]">Primary Mobile</span>
                <input
                  value={draft.primaryMobile || ''}
                  onChange={(event) => setDraft((prev) => ({ ...prev, primaryMobile: event.target.value }))}
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--c-muted)]">Secondary Mobile</span>
                <input
                  value={draft.secondaryMobile || ''}
                  onChange={(event) => setDraft((prev) => ({ ...prev, secondaryMobile: event.target.value }))}
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--c-muted)]">Primary Email</span>
                <input
                  value={draft.primaryEmail || ''}
                  onChange={(event) => setDraft((prev) => ({ ...prev, primaryEmail: event.target.value }))}
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--c-muted)]">Secondary Email</span>
                <input
                  value={draft.secondaryEmail || ''}
                  onChange={(event) => setDraft((prev) => ({ ...prev, secondaryEmail: event.target.value }))}
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-[var(--c-muted)]">Address</span>
                <input
                  value={draft.address || ''}
                  onChange={(event) => setDraft((prev) => ({ ...prev, address: event.target.value }))}
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--c-muted)]">Application Status</span>
                <select
                  value={draft.status || 'active'}
                  onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value }))}
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm font-bold"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="tracking">Tracking</option>
                  <option value="blocked">Blocked</option>
                  <option value="frozen">Frozen</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--c-muted)]">Reference / Tracking #</span>
                <input
                  value={draft.trackingNumber || ''}
                  onChange={(event) => setDraft((prev) => ({ ...prev, trackingNumber: event.target.value }))}
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm font-bold"
                  placeholder="e.g. TX-123456"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="rounded-xl border border-[var(--c-border)] px-4 py-2 text-sm font-semibold text-[var(--c-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                <Save strokeWidth={1.5} size={15} />
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default ClientLiveListSection;
