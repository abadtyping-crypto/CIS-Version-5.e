import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutTemplate, Globe, Check } from 'lucide-react';
import SettingCard from './SettingCard';
import { useTenant } from '../../context/useTenant';
import { useAuth } from '../../context/useAuth';
import { toSafeDocId } from '../../lib/idUtils';
import ServiceTemplateEditor from '../common/ServiceTemplateEditor';
import ApplicationIconQuickAddPanel from '../common/ApplicationIconQuickAddPanel';
import {
    fetchMergedServiceTemplates,
    fetchAllGlobalApplications,
    upsertServiceTemplate,
    deleteServiceTemplate,
} from '../../lib/serviceTemplateStore';
import { fetchMergedApplicationIconLibrary } from '../../lib/applicationIconLibraryStore';
import { createSyncEvent } from '../../lib/syncEvents';
import { getTenantSettingDoc, upsertTenantSettingDoc } from '../../lib/backendStore';
import CurrencyValue from '../common/CurrencyValue';
import {
    buildServiceTemplatePayload,
    createEmptyServiceTemplateDraft,
    findServiceTemplateNameConflict,
    hydrateServiceTemplateDraft,
    validateServiceTemplateDraft,
} from '../../lib/serviceTemplateRules';
import { ENFORCE_UNIVERSAL_APPLICATION_UID } from '../../lib/universalLibraryPolicy';

const normalizeNameKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const resolveUniversalTemplateId = (app) => toSafeDocId(String(app?.appName || app?.name || app?.id || ''), 'svc_tpl');
const resolveLegacyUniversalTemplateId = (app) => (app?.id ? `univ_${app.id}` : '');
const getDefaultCharge = (...values) => {
    for (const value of values) {
        if (value === null || value === undefined || value === '') continue;
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};

const ServiceTemplateSection = () => {
    const { tenantId } = useTenant();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();

    const [rows, setRows] = useState([]);
    const [icons, setIcons] = useState([]);
    const [globalApps, setGlobalApps] = useState([]);
    
    const [universalEnabled, setUniversalEnabled] = useState(false);
    const [activeTab, setActiveTab] = useState('local');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    const [isIconQuickAddOpen, setIsIconQuickAddOpen] = useState(false);
    const lockToUniversal = ENFORCE_UNIVERSAL_APPLICATION_UID;

    // Form State
    const [draft, setDraft] = useState(createEmptyServiceTemplateDraft());
    const [editingId, setEditingId] = useState(null);
    
    // Pricing modal state
    const [pricingModal, setPricingModal] = useState({ isOpen: false, globalApp: null, clientCharge: '', govCharge: '', description: '' });

    const loadData = useCallback(async () => {
        setIsLoading(true);
        
        const settingsRes = await getTenantSettingDoc(tenantId, 'branding');
        const isUnivOn = settingsRes.ok ? Boolean(settingsRes.data?.universalAppLibraryEnabled) : false;
        const effectiveUniversal = lockToUniversal ? true : isUnivOn;
        if (lockToUniversal && !isUnivOn) {
            await upsertTenantSettingDoc(tenantId, 'branding', { universalAppLibraryEnabled: true });
        }
        setUniversalEnabled(effectiveUniversal);

        const [templateRes, iconRes] = await Promise.all([
            fetchMergedServiceTemplates(tenantId),
            fetchMergedApplicationIconLibrary(tenantId),
        ]);

        if (templateRes.ok) setRows(templateRes.rows);
        if (iconRes.ok) setIcons(iconRes.rows);
        
        if (effectiveUniversal) {
            const gRes = await fetchAllGlobalApplications();
            if (gRes.ok) setGlobalApps(gRes.rows);
        }

        setIsLoading(false);
    }, [lockToUniversal, tenantId]);

    useEffect(() => {
        const load = async () => {
            if (!tenantId) return;
            await loadData();
        };
        load();
    }, [tenantId, loadData]);

    const resetForm = () => {
        setDraft(createEmptyServiceTemplateDraft());
        setEditingId(null);
        setError('');
        setIsIconQuickAddOpen(false);
    };

    const handleEdit = (row) => {
        if (lockToUniversal) {
            setError('Custom application editing is disabled. Use Universal Applications and configure charges/description only.');
            return;
        }
        setEditingId(row.id);
        setDraft(hydrateServiceTemplateDraft(row));
        setError('');
        setStatus('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async () => {
        if (lockToUniversal) {
            setError('Custom application creation is disabled. Use Universal Applications only.');
            return;
        }
        const validationError = validateServiceTemplateDraft(draft);
        if (validationError) return setError(validationError);

        const duplicateRow = findServiceTemplateNameConflict(rows, draft.name, editingId);
        if (duplicateRow) {
            return setError('Another application already uses this name variant (case/space). Choose a unique name.');
        }

        setIsSaving(true);
        setError('');
        setStatus('');

        const templateId = editingId || toSafeDocId(String(draft.name || '').trim(), 'svc_tpl');
        const payload = buildServiceTemplatePayload(draft, {
            createdBy: user.uid,
            updatedBy: user.uid,
            editing: Boolean(editingId),
        });

        const res = await upsertServiceTemplate(tenantId, templateId, payload);
        if (res.ok) {
            await createSyncEvent({
                tenantId,
                eventType: editingId ? 'update' : 'create',
                entityType: 'serviceTemplate',
                entityId: templateId,
                changedFields: Object.keys(payload),
                createdBy: user.uid,
            });
            setStatus(editingId ? 'Template updated.' : 'Template created.');
            resetForm();
            await loadData();
        } else {
            setError(res.error || 'Failed to save template.');
        }
        setIsSaving(false);
    };

    const handleDelete = async (row) => {
        if (lockToUniversal) {
            setError('Custom application deletion is disabled while Universal UID policy is active.');
            return;
        }
        if (!window.confirm(`Delete template "${row.name}"?`)) return;
        setIsSaving(true);
        const res = await deleteServiceTemplate(tenantId, row.id);
        if (res.ok) {
            await createSyncEvent({
                tenantId,
                eventType: 'delete',
                entityType: 'serviceTemplate',
                entityId: row.id,
                changedFields: ['id'],
                createdBy: user.uid,
            });
            setStatus('Template deleted.');
            await loadData();
        } else {
            setError(res.error || 'Failed to delete template.');
        }
        setIsSaving(false);
    };

    const handleToggleUniversal = async () => {
        setIsSaving(true);
        const nextValue = !universalEnabled;
        setUniversalEnabled(nextValue);
        if (!nextValue) setActiveTab('local');
        await upsertTenantSettingDoc(tenantId, 'branding', { universalAppLibraryEnabled: nextValue });
        await loadData();
        setIsSaving(false);
    };

    const enabledGlobalAppIds = useMemo(() => {
        const ids = new Set();
        rows.forEach(srv => { if (srv.source === 'universal' && srv.globalAppId) ids.add(srv.globalAppId); });
        return ids;
    }, [rows]);

    const groupedGlobalApps = useMemo(() => {
        const groups = {};
        globalApps.forEach(app => {
            const key = app.iconName || 'UNASSIGNED';
            if (!groups[key]) groups[key] = { iconName: key, iconUrl: app.iconUrl, apps: [] };
            groups[key].apps.push(app);
        });
        return Object.values(groups).sort((a, b) => a.iconName.localeCompare(b.iconName));
    }, [globalApps]);

    const handleOpenEnableModal = (globalApp) => {
        const targetId = resolveUniversalTemplateId(globalApp);
        const legacyId = resolveLegacyUniversalTemplateId(globalApp);
        const existing = rows.find((s) => (
            s.source === 'universal' && (
                s.globalAppId === globalApp.id
                || s.id === targetId
                || (legacyId && s.id === legacyId)
                || normalizeNameKey(s.name) === normalizeNameKey(globalApp.appName)
            )
        ));
        setPricingModal({
            isOpen: true,
            globalApp,
            clientCharge: existing ? existing.clientCharge : '',
            govCharge: existing ? existing.govCharge : '',
            description: existing ? existing.description : '',
        });
    };

    const handleEnableApp = async (globalApp) => {
        setIsSaving(true);
        const targetId = resolveUniversalTemplateId(globalApp);
        const existing = rows.find((s) => (
            s.source === 'universal' && (
                s.globalAppId === globalApp.id
                || s.id === targetId
                || normalizeNameKey(s.name) === normalizeNameKey(globalApp.appName)
            )
        ));
        const payload = {
            source: 'universal',
            globalAppId: globalApp.id,
            globalIconId: globalApp.iconId || '',
            clientCharge: existing ? Number(existing.clientCharge) || 0 : getDefaultCharge(globalApp.clientCharge, globalApp.defaultClientCharge),
            govCharge: existing ? Number(existing.govCharge) || 0 : getDefaultCharge(globalApp.govCharge, globalApp.defaultGovCharge),
            description: existing ? String(existing.description || '') : '',
            isActive: true,
            createdAt: existing?.createdAt || new Date().toISOString(),
            createdBy: existing?.createdBy || user.uid,
            updatedBy: user.uid,
            name: globalApp.appName,
        };
        const res = await upsertServiceTemplate(tenantId, targetId, payload);
        if (res.ok) await loadData();
        setIsSaving(false);
    };

    const handleConfirmEnableApp = async () => {
        setIsSaving(true);
        const app = pricingModal.globalApp;
        const templateId = resolveUniversalTemplateId(app);
        const payload = {
            source: 'universal',
            globalAppId: app.id,
            globalIconId: app.iconId || '',
            clientCharge: Number(pricingModal.clientCharge) || 0,
            govCharge: Number(pricingModal.govCharge) || 0,
            description: pricingModal.description || '',
            isActive: true,
            createdAt: rows.find((item) => item.id === templateId)?.createdAt || new Date().toISOString(),
            createdBy: rows.find((item) => item.id === templateId)?.createdBy || user.uid,
            updatedBy: user.uid,
            name: app.appName, 
        };
        const res = await upsertServiceTemplate(tenantId, templateId, payload);
        if (res.ok) await loadData();
        setIsSaving(false);
        setPricingModal({ isOpen: false, globalApp: null, clientCharge: '', govCharge: '', description: '' });
    };

    const handleDisableApp = async (globalApp) => {
        setIsSaving(true);
        const targetId = resolveUniversalTemplateId(globalApp);
        const legacyId = resolveLegacyUniversalTemplateId(globalApp);
        const candidates = rows.filter((s) => (
            s.source === 'universal' && (
                s.globalAppId === globalApp.id
                || s.id === targetId
                || (legacyId && s.id === legacyId)
                || normalizeNameKey(s.name) === normalizeNameKey(globalApp.appName)
            )
        ));
        if (candidates.length) {
            for (const item of candidates) {
                // Keep deletion broad so both legacy random-uid docs and new name-uid docs get disabled together.
                await deleteServiceTemplate(tenantId, item.id);
            }
            await loadData();
        }
        setIsSaving(false);
    };

    const isGroupFullyEnabled = (group) => group.apps.length > 0 && group.apps.every(app => enabledGlobalAppIds.has(app.id));
    const isGroupPartiallyEnabled = (group) => group.apps.some(app => enabledGlobalAppIds.has(app.id)) && !isGroupFullyEnabled(group);

    const handleToggleGroup = async (group) => {
        setIsSaving(true);
        const fullyEnabled = isGroupFullyEnabled(group);
        if (fullyEnabled) {
            for (const app of group.apps) {
                const targetId = resolveUniversalTemplateId(app);
                const legacyId = resolveLegacyUniversalTemplateId(app);
                const candidates = rows.filter((s) => (
                    s.source === 'universal' && (
                        s.globalAppId === app.id
                        || s.id === targetId
                        || (legacyId && s.id === legacyId)
                        || normalizeNameKey(s.name) === normalizeNameKey(app.appName)
                    )
                ));
                for (const item of candidates) {
                    await deleteServiceTemplate(tenantId, item.id);
                }
            }
        } else {
            for (const app of group.apps) {
                if (!enabledGlobalAppIds.has(app.id)) {
                    await upsertServiceTemplate(tenantId, resolveUniversalTemplateId(app), {
                        source: 'universal', globalAppId: app.id, globalIconId: app.iconId || '',
                        clientCharge: 0, govCharge: 0, description: '', isActive: true,
                        createdAt: new Date().toISOString(), createdBy: user.uid, updatedBy: user.uid, name: app.appName,
                    });
                }
            }
        }
        await loadData();
        setIsSaving(false);
    };

    const customOnlyRows = rows.filter(r => r.source !== 'universal');
    const requestedScope = String(searchParams.get('scope') || '').toLowerCase();
    const forceUniversalTab = universalEnabled && (lockToUniversal || requestedScope === 'universal' || requestedScope === 'developer');
    const visibleTab = forceUniversalTab ? 'universal' : activeTab;

    return (
        <SettingCard
            title="Application Templates"
            description={lockToUniversal ? 'Developer-managed application identity is enforced. Tenants can only configure charges and optional description.' : 'Manage your custom applications or use developer-managed universal templates.'}
            showHeader={false}
            showDescription={false}
        >
            <div className="space-y-8">
                {/* Toggle Universal Library */}
                <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-[var(--c-text)]">Universal Application Library</p>
                        <p className="text-xs text-[var(--c-muted)]">
                            {lockToUniversal
                                ? 'Enforced: app name and icon are synced from developer library by UID.'
                                : 'Easily activate managed service definitions without maintaining them manually.'}
                        </p>
                    </div>
                    <button
                        onClick={handleToggleUniversal}
                        disabled={isSaving || lockToUniversal}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${universalEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${universalEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>

                {universalEnabled && !lockToUniversal && (
                    <div className="flex items-center gap-2 border-b border-[var(--c-border)]">
                        <button 
                            onClick={() => setActiveTab('local')}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider ${visibleTab==='local' ? 'text-[var(--c-accent)] border-b-2 border-[var(--c-accent)]' : 'text-[var(--c-muted)] hover:text-[var(--c-text)]'}`}
                        >
                            Custom Applications
                        </button>
                        <button 
                            onClick={() => setActiveTab('universal')}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider ${visibleTab==='universal' ? 'text-[var(--c-accent)] border-b-2 border-[var(--c-accent)]' : 'text-[var(--c-muted)] hover:text-[var(--c-text)]'}`}
                        >
                            Universal Applications
                        </button>
                    </div>
                )}

                {/* Local Editor */}
                {visibleTab === 'local' && !lockToUniversal && (
                    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4">
                        <ServiceTemplateEditor
                            draft={draft}
                            onDraftChange={setDraft}
                            icons={icons}
                            iconActionSlot={(
                                <ApplicationIconQuickAddPanel
                                    tenantId={tenantId}
                                    createdBy={user?.uid || ''}
                                    existingIcons={icons}
                                    suggestedName={draft.name}
                                    isOpen={isIconQuickAddOpen}
                                    onOpen={() => setIsIconQuickAddOpen(true)}
                                    onClose={() => setIsIconQuickAddOpen(false)}
                                    onCreated={(createdIcon) => {
                                        setIcons((prev) => (
                                            [...prev, createdIcon].sort((a, b) => String(a.iconName || '').localeCompare(String(b.iconName || ''), undefined, { sensitivity: 'base' }))
                                        ));
                                        setDraft((prev) => ({ ...prev, iconId: createdIcon.iconId }));
                                        setStatus(`Icon "${createdIcon.iconName}" added and selected.`);
                                        setError('');
                                    }}
                                />
                            )}
                            onSubmit={(event) => {
                                event.preventDefault();
                                void handleSubmit();
                            }}
                            onCancel={resetForm}
                            isSaving={isSaving}
                            error={error}
                            status={status}
                            submitLabel={editingId ? 'Update Template' : 'Save Template'}
                            showCancel={Boolean(editingId)}
                        />
                    </div>
                )}

                {/* Target Content List */}
                <div className="mt-6">
                    <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">
                        {visibleTab === 'universal' ? 'Global Application Directory' : 'Saved Custom Templates'}
                    </p>
                    
                    {isLoading ? (
                        <p className="mt-4 text-center text-sm font-semibold text-[var(--c-muted)] animate-pulse">Loading...</p>
                    ) : visibleTab === 'local' ? (
                        customOnlyRows.length === 0 ? (
                            <div className="mt-4 rounded-2xl border-2 border-[var(--c-border)] p-8 text-center bg-[var(--c-surface)]">
                                <p className="text-sm font-semibold text-[var(--c-muted)]">No custom templates found. Create one above.</p>
                            </div>
                        ) : (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {customOnlyRows.map((row) => (
                                    <div
                                        key={row.id || row.name}
                                        className="group relative flex min-h-[5.5rem] items-stretch gap-0 overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] hover:shadow-md transition"
                                    >
                                        <div className="relative h-auto w-24 shrink-0 overflow-hidden bg-[var(--c-panel)]">
                                            {(icons.find((icon) => icon.iconId === row.iconId)?.iconUrl) ? (
                                                <img src={icons.find((icon) => icon.iconId === row.iconId)?.iconUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center bg-[var(--c-panel)] text-2xl">📄</div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1 p-4">
                                            <p className="truncate text-sm font-bold text-[var(--c-text)]">{row.name}</p>
                                            {row.description && <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-[var(--c-muted)]">{row.description}</p>}
                                            <div className="mt-1 flex gap-3 text-[10px] font-bold uppercase text-[var(--c-muted)]">
                                                <span className="flex items-center gap-1">Gov: <CurrencyValue value={row.govCharge} /></span>
                                                <span className="flex items-center gap-1">Client: <CurrencyValue value={row.clientCharge} /></span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center">
                                            <button onClick={() => handleEdit(row)} className="rounded-lg border border-[var(--c-border)] px-3 py-1.5 text-[10px] font-bold text-[var(--c-text)] hover:bg-[var(--c-panel)]">Edit</button>
                                            <button onClick={() => handleDelete(row)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-bold text-rose-600 hover:bg-rose-100">Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        globalApps.length === 0 ? (
                             <p className="mt-4 p-8 text-center text-sm font-semibold text-[var(--c-muted)] bg-[var(--c-surface)] rounded-2xl border border-[var(--c-border)]">No global applications available at the moment.</p>
                         ) : (
                             <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
                                 <table className="w-full min-w-[700px] text-left text-sm whitespace-nowrap">
                                     <tbody>
                                         {groupedGlobalApps.map(group => {
                                             const fullyEnabled = isGroupFullyEnabled(group);
                                             const partiallyEnabled = isGroupPartiallyEnabled(group);
                                             
                                             return (
                                                 <React.Fragment key={group.iconName}>
                                                      <tr className="bg-[var(--c-panel)] border-b border-[var(--c-border)]">
                                                          <td className="p-3 w-10 text-center">
                                                              <input 
                                                                  type="checkbox"
                                                                  checked={fullyEnabled}
                                                                  ref={el => { if (el) el.indeterminate = partiallyEnabled; }}
                                                                  onChange={() => handleToggleGroup(group)}
                                                                  className="cursor-pointer rounded border-[var(--c-border)]"
                                                              />
                                                          </td>
                                                          <td colSpan={4} className="p-3">
                                                              <div className="flex items-center gap-2">
                                                                   {group.iconUrl && <img src={group.iconUrl} alt={group.iconName} className="h-6 w-6 rounded border border-[var(--c-border)] object-contain bg-white" />}
                                                                   <span className="font-black uppercase tracking-wider text-[var(--c-text)]">{group.iconName} ({group.apps.length} apps)</span>
                                                              </div>
                                                          </td>
                                                      </tr>
                                                      {group.apps.map(app => {
                                                          const isAppEnabled = enabledGlobalAppIds.has(app.id);
                                                          return (
                                                              <tr key={app.id} className="border-b border-[var(--c-border)] bg-[var(--c-surface)] transition hover:bg-[var(--c-panel)]">
                                                                  <td className="p-3 text-center">
                                                                     <div className="ml-4 flex justify-center">
                                                                         <Check className={`h-4 w-4 ${isAppEnabled ? 'text-emerald-500' : 'text-transparent'}`} strokeWidth={3} />
                                                                     </div>
                                                                  </td>
                                                                  <td className="p-3 pl-8">
                                                                      <p className="font-bold text-[var(--c-text)] text-sm">{app.appName}</p>
                                                                      {app.description && <p className="text-[11px] font-semibold text-[var(--c-muted)] max-w-sm truncate" title={app.description}>{app.description}</p>}
                                                                  </td>
                                                                  <td className="p-3">
                                                                      {isAppEnabled ? (
                                                                          <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 uppercase">Active</span>
                                                                      ) : (
                                                                          <span className="inline-flex rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase">Unused</span>
                                                                      )}
                                                                  </td>
                                                                  <td className="p-3 text-right">
                                                                      {isAppEnabled ? null : (
                                                                           <button 
                                                                                onClick={() => handleEnableApp(app)}
                                                                                disabled={isSaving}
                                                                                className="rounded-lg bg-[var(--c-accent)] text-white px-3 py-1 text-[10px] uppercase font-bold hover:opacity-90 transition"
                                                                           >
                                                                               Enable
                                                                           </button>
                                                                      )}
                                                                      
                                                                      {isAppEnabled && (
                                                                          <button 
                                                                               onClick={() => handleOpenEnableModal(app)}
                                                                               disabled={isSaving}
                                                                               className="ml-2 rounded-lg border border-[var(--c-border)] bg-transparent text-[var(--c-text)] px-3 py-1 text-[10px] uppercase font-bold hover:bg-[var(--c-panel)] transition"
                                                                          >
                                                                              Configure
                                                                          </button>
                                                                      )}
                                                                      {isAppEnabled ? (
                                                                           <button 
                                                                                onClick={() => handleDisableApp(app)}
                                                                                disabled={isSaving}
                                                                                className="ml-0 rounded-lg border border-rose-200 text-rose-600 bg-rose-50 px-3 py-1 text-[10px] uppercase font-bold hover:bg-rose-100 transition sm:ml-2"
                                                                           >
                                                                               Disable
                                                                           </button>
                                                                      ) : null}
                                                                  </td>
                                                              </tr>
                                                          )
                                                      })}
                                                 </React.Fragment>
                                             )
                                         })}
                                     </tbody>
                                 </table>
                             </div>
                         )
                    )}
                </div>
            </div>

            {/* Pricing Modal */}
            {pricingModal.isOpen && (
                 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
                      <div className="w-full max-w-md rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 shadow-2xl">
                          <h3 className="text-lg font-black text-[var(--c-accent)] mb-1">Application Configuration</h3>
                          <p className="text-xs font-semibold text-[var(--c-text)] mb-5">{pricingModal.globalApp?.appName}</p>

                          <div className="space-y-4">
                              <label className="block text-xs font-bold uppercase text-[var(--c-muted)] tracking-wider">
                                  Your Client Charge
                                  <input 
                                      type="number"
                                      value={pricingModal.clientCharge}
                                      onChange={(e) => setPricingModal(prev => ({...prev, clientCharge: e.target.value}))}
                                      className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
                                      placeholder="0.00"
                                  />
                              </label>

                              <label className="block text-xs font-bold uppercase text-[var(--c-muted)] tracking-wider">
                                  Your Gov Charge
                                  <input 
                                      type="number"
                                      value={pricingModal.govCharge}
                                      onChange={(e) => setPricingModal(prev => ({...prev, govCharge: e.target.value}))}
                                      className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
                                      placeholder="0.00"
                                  />
                              </label>
                              
                              <label className="block text-xs font-bold uppercase text-[var(--c-muted)] tracking-wider">
                                  Tenant Description (Optional)
                                  <textarea 
                                      value={pricingModal.description}
                                      onChange={(e) => setPricingModal(prev => ({...prev, description: e.target.value}))}
                                      className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
                                      placeholder="Add your tenant-side description"
                                      rows={2}
                                  />
                              </label>

                              <div className="mt-6 flex justify-end gap-3">
                                  <button
                                      type="button"
                                      onClick={() => setPricingModal({isOpen: false, globalApp: null, clientCharge: '', govCharge: '', description: ''})}
                                      className="rounded-xl border border-[var(--c-border)] px-4 py-2 text-xs uppercase font-bold tracking-widest text-[var(--c-text)] hover:bg-[var(--c-panel)] transition"
                                  >
                                      Cancel
                                  </button>
                                  <button
                                      type="button"
                                      onClick={handleConfirmEnableApp}
                                      disabled={isSaving}
                                      className="rounded-xl bg-[var(--c-accent)] px-4 py-2 text-xs uppercase font-bold tracking-widest text-white hover:opacity-90 transition"
                                  >
                                      Save Configuration
                                  </button>
                              </div>
                          </div>
                      </div>
                 </div>
            )}
        </SettingCard>
    );
};

export default ServiceTemplateSection;
