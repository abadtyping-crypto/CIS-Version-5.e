import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SettingCard from './SettingCard';
import { useTenant } from '../../context/useTenant';
import { useAuth } from '../../context/useAuth';
import { toSafeDocId } from '../../lib/idUtils';
import useIsDesktopLayout from '../../hooks/useIsDesktopLayout';
import { normalizeLibraryTitle } from '../../lib/serviceTemplateRules';
import {
  deleteApplicationIcon,
  fetchMergedApplicationIconLibrary,
  fetchAllGlobalIcons,
  getApplicationIconById,
  upsertApplicationIcon,
} from '../../lib/applicationIconLibraryStore';
import { getTenantSettingDoc, upsertTenantSettingDoc } from '../../lib/backendStore';
import { Layout, Library, Globe, Check } from 'lucide-react';
import {
  deleteApplicationIconAssetByUrl,
  uploadApplicationIconAsset,
  validateApplicationIconFile,
} from '../../lib/applicationIconStorage';
import { createSyncEvent } from '../../lib/syncEvents';
import { ENFORCE_UNIVERSAL_ICON_UID } from '../../lib/universalLibraryPolicy';
import ImageStudio from '../common/ImageStudio';
import { getCroppedImg } from '../../lib/imageStudioUtils';

const inputClass =
  'mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-ring)]';

const normalizeNameForCompare = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]/g, '');

const sanitizeIconName = (value) =>
  normalizeLibraryTitle(value);

const ApplicationIconLibrarySection = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isDesktop = useIsDesktopLayout();

  const [rows, setRows] = useState([]);
  const [globalIcons, setGlobalIcons] = useState([]);
  const [universalEnabled, setUniversalEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState('local'); // 'local', 'universal'

  const [isLoading, setIsLoading] = useState(true);
  const [iconName, setIconName] = useState('');
  const [iconFile, setIconFile] = useState(null);
  const [editingIconId, setEditingIconId] = useState('');
  const [editingOldUrl, setEditingOldUrl] = useState('');
  const [iconRawUrl, setIconRawUrl] = useState('');
  const [iconCropPixels, setIconCropPixels] = useState(null);
  const [iconZoom, setIconZoom] = useState(1);
  const [iconRotation, setIconRotation] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const lockToUniversal = ENFORCE_UNIVERSAL_ICON_UID;

  const isEditing = Boolean(editingIconId);

  const filterLocalRows = useMemo(() => rows.filter(r => r.source !== 'universal'), [rows]);
  const enabledGlobalIconIds = useMemo(() => {
    const ids = new Set();
    rows.forEach(r => { if (r.source === 'universal') ids.add(r.globalIconId); });
    return ids;
  }, [rows]);

  const resetForm = () => {
    setIconName('');
    setIconFile(null);
    if (iconRawUrl && iconRawUrl.startsWith('blob:')) {
      URL.revokeObjectURL(iconRawUrl);
    }
    setIconRawUrl('');
    setIconCropPixels(null);
    setIconZoom(1);
    setIconRotation(0);
    setEditingIconId('');
    setEditingOldUrl('');
  };

  useEffect(() => () => {
    if (iconRawUrl && iconRawUrl.startsWith('blob:')) {
      URL.revokeObjectURL(iconRawUrl);
    }
  }, [iconRawUrl]);

  const loadRows = useCallback(async () => {
    setIsLoading(true);

    const settingsRes = await getTenantSettingDoc(tenantId, 'branding');
    const isUnivOn = settingsRes.ok ? Boolean(settingsRes.data?.universalIconLibraryEnabled) : false;
    const effectiveUniversal = lockToUniversal ? true : isUnivOn;
    if (lockToUniversal && !isUnivOn) {
      await upsertTenantSettingDoc(tenantId, 'branding', { universalIconLibraryEnabled: true });
    }
    setUniversalEnabled(effectiveUniversal);

    const res = await fetchMergedApplicationIconLibrary(tenantId);
    if (res.ok) {
      setRows(res.rows || []);
      setError('');
    } else {
      setError(res.error || 'Failed to load icon library.');
    }

    if (effectiveUniversal) {
      const gRes = await fetchAllGlobalIcons();
      if (gRes.ok) setGlobalIcons(gRes.rows);
    }

    setIsLoading(false);
  }, [lockToUniversal, tenantId]);

  useEffect(() => {
    const load = async () => {
        if (!tenantId) return;
        await loadRows();
    };
    load();
  }, [tenantId, loadRows]);

  const editingRow = useMemo(
    () => rows.find((item) => item.iconId === editingIconId) || null,
    [rows, editingIconId],
  );
  const requestedScope = String(searchParams.get('scope') || '').toLowerCase();
  const forceUniversalTab = universalEnabled && (lockToUniversal || requestedScope === 'universal' || requestedScope === 'developer');
  const visibleTab = forceUniversalTab ? 'universal' : activeTab;

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    const validationError = validateApplicationIconFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setIconFile(file);
    const objectUrl = URL.createObjectURL(file);
    if (iconRawUrl && iconRawUrl.startsWith('blob:')) URL.revokeObjectURL(iconRawUrl);
    setIconRawUrl(objectUrl);
    setIconCropPixels(null);
    setIconZoom(1);
    setIconRotation(0);
  };

  const handleStartEdit = (row) => {
    if (lockToUniversal) {
      setError('Icon editing is disabled. Universal icon UID policy is active.');
      return;
    }
    if (row.source === 'universal') return; // Cannot edit universal
    setActiveTab('local');
    setIconName(String(row.iconName || ''));
    setEditingIconId(row.iconId);
    setEditingOldUrl(String(row.iconUrl || ''));
    setIconFile(null);
    if (iconRawUrl && iconRawUrl.startsWith('blob:')) URL.revokeObjectURL(iconRawUrl);
    setIconRawUrl('');
    setIconCropPixels(null);
    setIconZoom(1);
    setIconRotation(0);
    setStatus('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (lockToUniversal) {
      setError('Local icon creation is disabled. Use Universal Icons only.');
      return;
    }
    const trimmedName = sanitizeIconName(iconName);
    if (!trimmedName) {
      setError('Icon Name is mandatory.');
      return;
    }

    if (!isEditing && !iconFile) {
      setError('Select an icon image before saving.');
      return;
    }

    const nextIconId = toSafeDocId(trimmedName, 'app_icon');
    const nextNameKey = normalizeNameForCompare(trimmedName);
    setIsSaving(true);
    setError('');
    setStatus('');

    const currentId = editingIconId || nextIconId;
    const currentUrl = editingRow ? String(editingRow.iconUrl || '') : '';
    const isRename = isEditing && nextIconId !== currentId;

    try {
      const duplicateByNameVariant = rows.some((row) => {
        if (!row?.iconId) return false;
        if (isEditing && row.iconId === currentId) return false;
        return normalizeNameForCompare(row.iconName || row.iconId) === nextNameKey;
      });
      if (duplicateByNameVariant) {
        throw new Error('Another icon already uses this name variant (case/space). Choose a unique name.');
      }

      if (isRename) {
        const existing = await getApplicationIconById(tenantId, nextIconId);
        if (!existing.ok) throw new Error(existing.error || 'Unable to validate target icon id.');
        if (existing.exists) throw new Error('Another icon already uses this name. Choose a different name.');
      }

      let nextIconUrl = currentUrl;
      if (iconFile) {
        let iconBlobForUpload = iconFile;
        if (iconRawUrl && iconCropPixels) {
          const croppedBlob = await getCroppedImg(iconRawUrl, iconCropPixels, iconRotation, 'none');
          if (croppedBlob) iconBlobForUpload = croppedBlob;
        }
        const postCropValidation = validateApplicationIconFile(iconBlobForUpload);
        if (postCropValidation) throw new Error(postCropValidation);

        const uploadRes = await uploadApplicationIconAsset({
          tenantId,
          iconId: nextIconId,
          fileBlob: iconBlobForUpload,
          oldUrl: isRename ? '' : currentUrl,
        });
        if (!uploadRes.ok) throw new Error(uploadRes.error || 'Icon upload failed.');
        nextIconUrl = uploadRes.iconUrl;
      }

      if (isRename) {
        const createRes = await upsertApplicationIcon(
          tenantId,
          nextIconId,
          {
            iconName: trimmedName,
            iconUrl: nextIconUrl,
            createdBy: user.uid,
            updatedBy: user.uid,
          },
          { isCreate: true },
        );
        if (!createRes.ok) throw new Error(createRes.error || 'Failed to create renamed icon.');

        const deleteRes = await deleteApplicationIcon(tenantId, currentId);
        if (!deleteRes.ok) throw new Error(deleteRes.error || 'Failed to remove old icon record.');

        if (iconFile && editingOldUrl && editingOldUrl !== nextIconUrl) {
          await deleteApplicationIconAssetByUrl(editingOldUrl);
        }
      } else {
        const saveRes = await upsertApplicationIcon(
          tenantId,
          currentId,
          {
            iconName: trimmedName,
            iconUrl: nextIconUrl,
            createdBy: editingRow?.createdBy || user.uid,
            updatedBy: user.uid,
          },
          { isCreate: !isEditing },
        );
        if (!saveRes.ok) throw new Error(saveRes.error || 'Failed to save icon.');
      }

      await createSyncEvent({
        tenantId,
        eventType: isEditing ? 'update' : 'create',
        entityType: 'applicationIcon',
        entityId: nextIconId,
        changedFields: ['iconName', 'iconUrl', 'updatedBy'],
        createdBy: user.uid,
      });

      setStatus(isEditing ? 'Icon updated successfully.' : 'Icon added successfully.');
      resetForm();
      await loadRows();
    } catch (saveError) {
      setError(saveError?.message || 'Failed to save icon.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (lockToUniversal) {
      setError('Local icon deletion is disabled while Universal UID policy is active.');
      return;
    }
    if (row.source === 'universal') return;
    const allow = window.confirm(`Delete icon "${row.iconName}"?`);
    if (!allow) return;
    setIsSaving(true);
    setError('');
    setStatus('');
    const deleteRes = await deleteApplicationIcon(tenantId, row.iconId);
    if (!deleteRes.ok) {
      setError(deleteRes.error || 'Failed to delete icon.');
      setIsSaving(false);
      return;
    }
    await deleteApplicationIconAssetByUrl(String(row.iconUrl || ''));
    await createSyncEvent({
      tenantId,
      eventType: 'delete',
      entityType: 'applicationIcon',
      entityId: row.iconId,
      changedFields: ['iconId'],
      createdBy: user.uid,
    });
    if (editingIconId === row.iconId) resetForm();
    setStatus('Icon deleted.');
    setIsSaving(false);
    await loadRows();
  };

  const handleToggleUniversal = async () => {
    if (lockToUniversal) {
      return;
    }
    setIsSaving(true);
    const nextValue = !universalEnabled;
    setUniversalEnabled(nextValue);
    if (!nextValue) setActiveTab('local');
    await upsertTenantSettingDoc(tenantId, 'branding', { universalIconLibraryEnabled: nextValue });
    await loadRows();
    setIsSaving(false);
  };

  const handleEnableGlobal = async (globalIcon) => {
    setIsSaving(true);
    const targetId = String(globalIcon.iconId || toSafeDocId(globalIcon.iconName, 'icon')).trim();
    const legacyId = `univ_${targetId}`;
    await upsertApplicationIcon(tenantId, targetId, {
        source: 'universal',
        globalIconId: globalIcon.iconId,
        iconName: globalIcon.iconName,
        createdBy: user.uid,
        updatedBy: user.uid,
    }, { isCreate: !rows.some((r) => r.iconId === targetId) });
    const legacyRows = rows.filter((r) => r.source === 'universal' && r.iconId === legacyId);
    for (const item of legacyRows) {
      await deleteApplicationIcon(tenantId, item.iconId);
    }
    await loadRows();
    setIsSaving(false);
  };

  const handleDisableGlobal = async (globalIcon) => {
    setIsSaving(true);
    const targetId = String(globalIcon.iconId || toSafeDocId(globalIcon.iconName, 'icon')).trim();
    const legacyId = `univ_${targetId}`;
    const candidates = rows.filter((r) => (
      r.source === 'universal' && (
        r.globalIconId === globalIcon.iconId
        || r.iconId === targetId
        || r.iconId === legacyId
      )
    ));
    if (candidates.length) {
      for (const item of candidates) {
        await deleteApplicationIcon(tenantId, item.iconId);
      }
      await loadRows();
    }
    setIsSaving(false);
  };

  return (
    <SettingCard
      title="Applications Icon Library"
      description={lockToUniversal ? 'Developer-managed icon identity is enforced by UID. Tenants can only enable/disable universal icons.' : 'Upload reusable app/module icons or import them from the Universal Library.'}
      showHeader={false}
      showDescription={false}
    >
      <div className="space-y-8">
        {/* Toggle Universal Library */}
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4 flex items-center justify-between">
            <div>
                <p className="text-sm font-bold text-[var(--c-text)]">Universal Icon Library</p>
                <p className="text-xs text-[var(--c-muted)]">
                  {lockToUniversal
                    ? 'Enforced: icon name/image are synced from developer library by icon UID.'
                    : 'Allow use of developer-managed icon pack in your application definitions.'}
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
                    Local Icons
                </button>
                <button 
                  onClick={() => setActiveTab('universal')}
                  className={`px-4 py-2 text-sm font-bold uppercase tracking-wider ${visibleTab==='universal' ? 'text-[var(--c-accent)] border-b-2 border-[var(--c-accent)]' : 'text-[var(--c-muted)] hover:text-[var(--c-text)]'}`}
                >
                    Universal Icons
                </button>
            </div>
        )}

        {/* Section 1: Add/Edit Icon Form (Only visible in Local tab) */}
        {visibleTab === 'local' && !lockToUniversal && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--c-border)] pb-2 text-[var(--c-accent)]">
              <Layout className="h-5 w-5" />
              <span className="text-sm font-bold uppercase tracking-wider text-[var(--c-text)]">
                {isEditing ? 'Edit Icon Details' : 'Add New Icon'}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-[var(--c-muted)]">
                  Icon Name *
                  <input
                    className={inputClass}
                    value={iconName}
                    onChange={(event) => setIconName(event.target.value)}
                    placeholder="Example: Invoice Management"
                  />
                </label>

                <label className="text-sm text-[var(--c-muted)]">
                  Icon Image {isEditing ? '(optional for rename only)' : '*'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleFileChange}
                    className={inputClass}
                  />
                </label>
              </div>

              {iconRawUrl ? (
                <div className="mt-4">
                  <ImageStudio
                    sourceUrl={iconRawUrl}
                    onReset={() => {
                      if (iconRawUrl && iconRawUrl.startsWith('blob:')) URL.revokeObjectURL(iconRawUrl);
                      setIconFile(null);
                      setIconRawUrl('');
                      setIconCropPixels(null);
                      setIconZoom(1);
                      setIconRotation(0);
                    }}
                    onFileChange={handleFileChange}
                    onCropComplete={(_, pixels) => setIconCropPixels(pixels)}
                    zoom={iconZoom}
                    setZoom={setIconZoom}
                    rotation={iconRotation}
                    setRotation={setIconRotation}
                    filter="natural"
                    setFilter={() => {}}
                    filterMap={{}}
                    title="Icon Crop Studio"
                    aspect={1}
                    cropShape="rect"
                    showFilters={false}
                    workspaceHeightClass="h-[220px] sm:h-[260px]"
                    minZoom={0.5}
                    maxZoom={4}
                  />
                </div>
              ) : null}

              {isEditing && editingRow ? <p className="mt-2 text-xs text-[var(--c-muted)]">Editing selected icon.</p> : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="rounded-xl bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[var(--c-accent)]/20 transition hover:scale-105 active:scale-95 disabled:opacity-60"
                >
                  {isEditing ? 'Update Icon' : 'Add Icon'}
                </button>
                {isEditing ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={isSaving}
                    className="rounded-xl border border-[var(--c-border)] px-4 py-2 text-sm font-semibold text-[var(--c-text)] transition hover:bg-[var(--c-panel)]"
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>
              
              {error ? (
                <p className={`mt-3 rounded-lg border px-3 py-2 text-sm font-semibold ${isDesktop ? 'border-rose-200 bg-white text-rose-600' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>
                  {error}
                </p>
              ) : null}
              {status ? (
                <p className={`mt-3 rounded-lg border px-3 py-2 text-sm font-semibold ${isDesktop ? 'border-emerald-200 bg-white text-emerald-700' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
                  {status}
                </p>
              ) : null}
            </div>
          </section>
        )}

        {/* Section 2: Library Items */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--c-border)] pb-2 text-[var(--c-accent)]">
            <Library className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-wider text-[var(--c-text)]">
               {visibleTab === 'universal' ? 'Universal Developer Icons' : 'Local Library Items'}
            </span>
          </div>

          <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
            {visibleTab === 'local' && <p className="text-xs text-[var(--c-muted)] mb-3">Upload reusable app/module icons. Icon Name is used as the document ID.</p>}
            
            {isLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--c-accent)] border-t-transparent" />
                <p className="text-sm text-[var(--c-muted)]">Loading icons...</p>
              </div>
            ) : visibleTab === 'local' ? (
               filterLocalRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--c-muted)]">No icons added yet.</p>
               ) : (
                  <div className={`grid gap-4 ${isDesktop ? 'md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                    {filterLocalRows.map((row) => (
                      <article key={row.iconId} className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg p-1 border border-[var(--c-border)]/30 ${isDesktop ? 'bg-white' : 'bg-[var(--c-panel)]'}`}>
                            {row.iconUrl ? (
                              <img src={row.iconUrl} alt="Icon preview" className="h-full w-full object-contain" />
                            ) : (
                              <span className="text-[10px] font-semibold text-[var(--c-muted)]">No Icon</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-[var(--c-text)]">{row.iconName || row.iconId}</p>
                            <p className="truncate text-[10px] font-medium text-[var(--c-muted)]">Local Library</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(row)}
                            className="flex-1 rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--c-text)] hover:bg-[var(--c-surface)] transition"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
               )
            ) : (
               // Universal Icons Tab
               globalIcons.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--c-muted)]">No universal icons available from developer yet.</p>
               ) : (
                  <div className={`grid gap-4 ${isDesktop ? 'md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                    {globalIcons.map((row) => {
                      const isEnabled = enabledGlobalIconIds.has(row.iconId);
                      return (
                          <article key={row.iconId} className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg p-1 border border-[var(--c-border)]/30 ${isDesktop ? 'bg-white' : 'bg-[var(--c-panel)]'}`}>
                                {row.iconUrl ? (
                                  <img src={row.iconUrl} alt="Icon preview" className="h-full w-full object-contain" />
                                ) : (
                                  <span className="text-[10px] font-semibold text-[var(--c-muted)]">No Icon</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-[var(--c-text)]">{row.iconName}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                   <Globe className="h-3 w-3 text-sky-500" />
                                   <p className="truncate text-[10px] font-medium text-sky-500 uppercase tracking-widest">Universal</p>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              {isEnabled ? (
                                   <button 
                                        onClick={() => handleDisableGlobal(row)}
                                        disabled={isSaving}
                                        className="w-full rounded-lg border border-rose-200 text-rose-600 bg-rose-50 px-3 py-1.5 text-xs font-bold hover:bg-rose-100 transition"
                                   >
                                       Disable Icon
                                   </button>
                              ) : (
                                   <button 
                                        onClick={() => handleEnableGlobal(row)}
                                        disabled={isSaving}
                                        className="w-full rounded-lg bg-[var(--c-accent)] text-white px-3 py-1.5 text-xs font-bold hover:opacity-90 transition"
                                   >
                                       Enable Icon
                                   </button>
                              )}
                            </div>
                          </article>
                      );
                    })}
                  </div>
               )
            )}
          </div>
        </section>
      </div>
    </SettingCard>
  );
};

export default ApplicationIconLibrarySection;
