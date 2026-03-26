import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CalendarIcon,
  CreditCardIcon,
  ExpenseIcon,

  HomeIcon,
  InvoiceIcon,
  LibraryIcon,
  PortalIcon,
  QuotationIcon,
  ReceiptIcon,
  SettingsIcon,
  StarIcon,
  TasksIcon,
  UserPlusIcon,
} from '../components/icons/AppIcons';
import PageShell from '../components/layout/PageShell';
import { isVisibleOnPlatform, SEARCH_ITEMS } from '../config/appNavigation';
import { fetchTenantPortals } from '../lib/backendStore';
import { getRuntimePlatform } from '../lib/runtimePlatform';
import { resolvePortalTypeIcon } from '../lib/transactionMethodConfig';

const SEARCH_FAVORITES_KEY = 'acis_search_favorites_v1';

const iconByKey = {
  dashboard: HomeIcon,
  settings: SettingsIcon,
  appIconLibrary: LibraryIcon,
  clientOnboarding: UserPlusIcon,
  dailyTransactions: ReceiptIcon,
  tasksTracking: TasksIcon,
  quotations: QuotationIcon,
  proformaInvoices: InvoiceIcon,
  receivePayments: CreditCardIcon,
  proformaQuotation: QuotationIcon,
  invoiceManagement: InvoiceIcon,
  operationExpenses: ExpenseIcon,
  portalManagement: PortalIcon,
  createPortal: PortalIcon,
  documentCalendar: CalendarIcon,
};

const categoryByKey = {
  settings: 'Settings',
  appIconLibrary: 'Settings',
  quotations: 'Finance',
  proformaInvoices: 'Finance',
  receivePayments: 'Finance',
  portalManagement: 'Portals',
  createPortal: 'Portals',
  documentCalendar: 'Calendar',
};

const fallbackPortalIcon = (type) => {
  return resolvePortalTypeIcon(type);
};

const readFavorites = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SEARCH_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((value) => String(value || ''));
  } catch {
    return [];
  }
};

const SearchPage = () => {
  const { tenantId } = useParams();
  const [query, setQuery] = useState('');
  const [favoriteKeys, setFavoriteKeys] = useState(() => readFavorites());
  const [portalItems, setPortalItems] = useState([]);
  const runtimePlatform = getRuntimePlatform();

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    fetchTenantPortals(tenantId).then((res) => {
      if (!active || !res.ok) return;
      const nextPortals = (res.rows || []).map((portal) => ({
        key: `portal:${portal.id}`,
        label: portal.name || portal.displayPortalId || portal.id,
        description: `${portal.type || 'Portal'} portal`,
        path: `portal-management/${portal.id}`,
        icon: portal.iconUrl || fallbackPortalIcon(portal.type),
        category: 'Portal Records',
        searchText: [
          portal.name,
          portal.displayPortalId,
          portal.id,
          portal.type,
          portal.status,
        ].filter(Boolean).join(' '),
      }));
      setPortalItems(nextPortals);
    });
    return () => {
      active = false;
    };
  }, [tenantId]);

  const visibleSearchItems = useMemo(
    () => [
      ...SEARCH_ITEMS.filter((item) => isVisibleOnPlatform(item, runtimePlatform)),
      ...portalItems,
    ],
    [runtimePlatform, portalItems],
  );

  const favoriteSet = useMemo(() => new Set(favoriteKeys), [favoriteKeys]);

  const saveFavorites = (next) => {
    setFavoriteKeys(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SEARCH_FAVORITES_KEY, JSON.stringify(next));
    }
  };

  const toggleFavorite = (key) => {
    const next = favoriteSet.has(key)
      ? favoriteKeys.filter((item) => item !== key)
      : [...favoriteKeys, key];
    saveFavorites(next);
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? visibleSearchItems
      : visibleSearchItems.filter((item) =>
        `${item.label} ${item.description} ${item.searchText || ''}`.toLowerCase().includes(q),
      );

    return [...filtered].sort((a, b) => {
      const aFav = favoriteSet.has(a.key) ? 1 : 0;
      const bFav = favoriteSet.has(b.key) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return a.label.localeCompare(b.label);
    });
  }, [query, visibleSearchItems, favoriteSet]);

  return (
    <PageShell title="Search Apps" subtitle="Icon-first app launcher with quick favorites." iconKey="search">
      <div className="rounded-2xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_82%,transparent)] p-3">
        <div className="relative">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search all pages..."
            className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 pr-10 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-ring)]"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--c-muted)]">
            {results.length}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {results.map((item) => {
          const Icon = typeof item.icon === 'string' ? null : (iconByKey[item.key] || SettingsIcon);
          return (
            <article
              key={item.path}
              className="relative overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_86%,transparent)] p-3 shadow-[0_14px_30px_-24px_rgba(12,32,66,0.8)]"
            >
              <button
                type="button"
                onClick={() => toggleFavorite(item.key)}
                className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                  favoriteSet.has(item.key)
                    ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/20 text-[var(--c-accent)]'
                    : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)]'
                }`}
                aria-label={favoriteSet.has(item.key) ? 'Remove from favorites' : 'Add to favorites'}
                title={favoriteSet.has(item.key) ? 'Remove favorite' : 'Add favorite'}
              >
                <StarIcon className={`h-4 w-4 ${favoriteSet.has(item.key) ? 'fill-current' : ''}`} />
              </button>

              <Link to={`/t/${tenantId}/${item.path}`} className="block">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-accent)]">
                  {typeof item.icon === 'string' ? (
                    <img src={item.icon} alt="" className="h-6 w-6 object-contain" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] font-bold leading-tight text-[var(--c-text)]">{item.label}</p>
                <p className="mt-0.5 text-[11px] font-medium text-[var(--c-muted)]">{item.category || categoryByKey[item.key] || 'All Pages'}</p>
              </Link>
            </article>
          );
        })}
      </div>

      {results.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] p-4 text-sm text-[var(--c-muted)]">
          No apps found.
        </p>
      ) : null}
    </PageShell>
  );
};

export default SearchPage;
