import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderOpen,
  HardDrive,
  LayoutDashboard,
  ReceiptText,
  Users,
} from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import { useTenant } from '../context/useTenant';
import { fetchTenantClients } from '../lib/backendStore';
import { fetchProformas, fetchTasks } from '../lib/workflowStore';
import { fetchClientDocuments, openLocalFile } from '../lib/documentLibraryStore';
import { getRuntimePlatform, PLATFORM_ELECTRON } from '../lib/runtimePlatform';

export default function ClientDetailsPageV2() {
  const { tenantId } = useTenant();
  const { clientId } = useParams(); // The unique UID of the client

  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState(null);
  const [records, setRecords] = useState({
    proformas: [],
    tasks: [],
    dependents: [],
    documents: [],
  });
  const [libView, setLibView] = useState('cloud');
  const platform = getRuntimePlatform();

  useEffect(() => {
    if (!tenantId || !clientId) return;
    let active = true;

    const load360Data = async () => {
      setLoading(true);

      const [cRes, pRes, tRes, dRes] = await Promise.all([
        fetchTenantClients(tenantId),
        fetchProformas(tenantId),
        fetchTasks(tenantId),
        fetchClientDocuments(tenantId, clientId),
      ]);

      if (!active) return;

      if (cRes.ok && pRes.ok && tRes.ok) {
        const rows = Array.isArray(cRes.rows) ? cRes.rows : [];
        const current = rows.find((c) => String(c?.id || '') === String(clientId));
        setClientData(current || null);

        const proformas = (pRes.rows || []).filter((p) => String(p?.clientId || '') === String(clientId));
        const tasks = (tRes.rows || []).filter((t) => String(t?.clientId || '') === String(clientId));
        const dependents = rows.filter((c) => String(c?.parentId || '') === String(clientId));
        const documents = dRes.ok ? dRes.rows : [];

        setRecords({ proformas, tasks, dependents, documents });
      } else {
        setClientData(null);
        setRecords({ proformas: [], tasks: [], dependents: [], documents: [] });
      }

      setLoading(false);
    };

    void load360Data();

    return () => {
      active = false;
    };
  }, [tenantId, clientId]);

  const pageTitle = useMemo(() => (
    clientData?.fullName
    || clientData?.tradeName
    || clientData?.companyName
    || 'Client Hub'
  ), [clientData]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center font-black animate-pulse text-[var(--c-muted)]">
        INITIALIZING 360 HUB...
      </div>
    );
  }

  return (
    <PageShell
      title={pageTitle}
      subtitle={`System UID: ${clientId}`}
      iconKey="clientOnboarding"
      widthPreset="data" // Enforces 1200px Iron Box
    >
      <div className="flex flex-col gap-6">
        {/* TOP STATS: FINANCIAL & OPS SUMMARY */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatBox title="Active Tasks" value={records.tasks.length} icon={Briefcase} color="text-orange-500" />
          <StatBox
            title="Outstanding"
            value={records.proformas.filter((p) => String(p?.status || '').toLowerCase() !== 'paid').length}
            icon={ReceiptText}
            color="text-blue-500"
          />
          <StatBox title="Dependents" value={records.dependents.length} icon={Users} color="text-purple-500" />
          <StatBox title="Compliance" value="Active" icon={LayoutDashboard} color="text-emerald-500" />
        </div>

        {/* NAVIGATION TABS */}
        <div className="w-fit rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-1">
          {['summary', 'financials', 'library'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-6 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab
                  ? 'bg-[var(--c-accent)] text-white shadow-lg'
                  : 'text-[var(--c-muted)] hover:bg-[var(--c-surface)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* DYNAMIC CONTENT AREA */}
        <div className="min-h-[400px]">
          {activeTab === 'summary' ? (
            <div className="grid gap-6 animate-in fade-in duration-500 lg:grid-cols-3">
              <div className="flex flex-col gap-6 lg:col-span-2">
                <SimpleList title="Urgent Tasks" items={records.tasks.slice(0, 5)} type="task" />
                <SimpleList title="Recent Invoices" items={records.proformas.slice(0, 5)} type="proforma" />
              </div>
              <div className="flex flex-col gap-6">
                <DependentList dependents={records.dependents} />
              </div>
            </div>
          ) : null}

          {activeTab === 'financials' ? (
            <div className="compact-card glass border border-[var(--c-border)] p-8 text-center animate-in fade-in duration-500">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--c-text)]">Financials</h3>
              <p className="mt-2 text-xs text-[var(--c-muted)]">
                Placeholder for billing, receivables, and ledger drilldowns.
              </p>
            </div>
          ) : null}

          {activeTab === 'library' ? (
            <div className="animate-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex gap-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-1">
                  <button
                    onClick={() => setLibView('cloud')}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase transition-all ${libView === 'cloud' ? 'bg-[var(--c-surface)] text-[var(--c-accent)] shadow-sm' : 'text-[var(--c-muted)]'}`}
                  >
                    <FolderOpen size={14} /> Cloud Files
                  </button>
                  <button
                    onClick={() => setLibView('local')}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase transition-all ${libView === 'local' ? 'bg-[var(--c-surface)] text-[var(--c-accent)] shadow-sm' : 'text-[var(--c-muted)]'}`}
                  >
                    <HardDrive size={14} /> Local Archive
                  </button>
                </div>
                {platform === PLATFORM_ELECTRON && libView === 'local' && (
                   <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase text-emerald-600 border border-emerald-100">
                     <CheckCircle2 size={10} /> Electron Bridge Active
                   </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {records.documents
                  .filter(doc => libView === 'local' ? doc.isLocal : !doc.isLocal)
                  .map((docItem) => (
                    <div key={docItem.id} className="compact-card glass border border-[var(--c-border)] p-4 flex flex-col gap-3 group">
                      <div className="flex items-start justify-between">
                        <div className="rounded-xl bg-white p-2.5 shadow-inner text-[var(--c-accent)]">
                          <FileText size={18} />
                        </div>
                        {docItem.expiryDate && (
                          <div className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase ${new Date(docItem.expiryDate) < new Date() ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                            <AlertCircle size={10} /> {new Date(docItem.expiryDate) < new Date() ? 'Expired' : 'Expiring'}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">{docItem.documentType || 'Document'}</p>
                        <p className="text-xs font-bold text-[var(--c-text)] truncate">{docItem.fileName || docItem.id}</p>
                      </div>
                      <div className="mt-auto pt-2 flex items-center justify-between border-t border-[var(--c-border)]/50">
                        <span className="text-[9px] font-bold text-[var(--c-muted)]">{new Date(docItem.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                        <button
                          onClick={() => docItem.isLocal ? openLocalFile(docItem.localPath) : window.open(docItem.cloudUrl, '_blank')}
                          className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[var(--c-accent)] hover:underline"
                        >
                          View <ExternalLink size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                
                {records.documents.filter(doc => libView === 'local' ? doc.isLocal : !doc.isLocal).length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <FolderOpen size={48} className="mx-auto mb-4 text-[var(--c-muted)] opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">No {libView} files found for this client</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}

// Sub-Components for the 360 View
const StatBox = ({ title, value, icon: Icon, color }) => (
  <div className="compact-card glass flex items-center gap-4 border border-[var(--c-border)] p-5 shadow-sm transition hover:shadow-md">
    <div className={`rounded-xl bg-white p-3 shadow-inner ${color}`}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">{title}</p>
      <p className="text-xl font-black text-[var(--c-text)]">{value}</p>
    </div>
  </div>
);

const SimpleList = ({ title, items, type }) => (
  <div className="compact-card glass overflow-hidden border border-[var(--c-border)]">
    <div className="border-b border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-panel)_50%,transparent)] px-5 py-3">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--c-text)]">{title}</h3>
    </div>
    <div className="divide-y divide-[var(--c-border)]">
      {items.length === 0 ? (
        <p className="p-10 text-center text-[10px] font-bold uppercase text-[var(--c-muted)]">No active {type}s</p>
      ) : (
        items.map((item, i) => (
          <div
            key={String(item?.id || `${type}-${i}`)}
            className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[var(--c-surface)]"
          >
            <p className="text-xs font-bold text-[var(--c-text)]">{item?.applicationName || item?.id}</p>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-black uppercase">
              {item?.status || 'open'}
            </span>
          </div>
        ))
      )}
    </div>
  </div>
);

const DependentList = ({ dependents }) => (
  <div className="compact-card glass border border-[var(--c-border)] p-4">
    <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Linked Dependents</h3>
    <div className="flex flex-col gap-2">
      {dependents.length === 0 ? (
        <p className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-[10px] font-bold uppercase text-[var(--c-muted)]">
          No dependents linked
        </p>
      ) : (
        dependents.map((dep) => (
          <div
            key={dep.id}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent p-2 transition-all hover:border-[var(--c-border)] hover:bg-[var(--c-panel)]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-[10px] font-bold uppercase text-gray-400">
              {dep.fullName?.[0] || dep.tradeName?.[0] || 'D'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[var(--c-text)]">{dep.fullName || dep.tradeName || 'Dependent'}</p>
              <p className="text-[9px] font-medium text-[var(--c-muted)]">UID: {dep.id}</p>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);
