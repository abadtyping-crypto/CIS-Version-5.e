import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedLayout } from '../components/layout/ProtectedLayout';
import { Check, Loader2, Save, Search, X } from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizePageID } from '../lib/pageIdNormalization';

const EMPTY_FORM = {
  pageID: '',
  titleText: '',
  descriptionText: '',
  iconUrl: '',
  isHelpEnabled: true,
  instructionID: '',
};

export const HeaderControlCenterPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const [configs, setConfigs] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState('');

  const [instructionRows, setInstructionRows] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const normalizedPageId = useMemo(() => normalizePageID(form.pageID), [form.pageID]);

  const loadConfigs = useCallback(async () => {
    const snap = await getDocs(collection(db, 'global_header_configs'));
    const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    setConfigs(rows);
  }, []);

  const loadInstructions = useCallback(async () => {
    const snap = await getDocs(query(collection(db, 'acis_global_instruction_library'), orderBy('createdAt', 'desc')));
    const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    setInstructionRows(rows);
  }, []);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      setError('');
      try {
        await Promise.all([loadConfigs(), loadInstructions()]);
      } catch (err) {
        setError(err?.message || 'Failed to load Header Control Center data.');
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [loadConfigs, loadInstructions]);

  const selectConfig = async (pageId) => {
    const nextPageId = normalizePageID(pageId);
    if (!nextPageId) return;

    setSelectedPageId(nextPageId);
    setStatus('');
    setError('');

    setIsLoading(true);
    try {
      const snap = await getDoc(doc(db, 'global_header_configs', nextPageId));
      if (snap.exists()) {
        const data = snap.data() || {};
        setForm({
          pageID: nextPageId,
          titleText: String(data.titleText || ''),
          descriptionText: String(data.descriptionText || ''),
          iconUrl: String(data.iconUrl || ''),
          isHelpEnabled: data.isHelpEnabled !== false,
          instructionID: String(data.instructionID || ''),
        });
      } else {
        setForm((prev) => ({ ...EMPTY_FORM, pageID: nextPageId }));
      }
    } catch (err) {
      setError(err?.message || 'Failed to load the selected header config.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLookup = async () => {
    const id = normalizePageID(form.pageID);
    if (!id) {
      setError('Page ID is required.');
      return;
    }
    if (id.includes('/')) {
      setError('Page ID must match a React Router path segment (no slashes).');
      return;
    }
    await selectConfig(id);
  };

  const handleSave = async () => {
    const pageId = normalizePageID(form.pageID);
    if (!pageId) {
      setError('Page ID is required.');
      return;
    }
    if (pageId.includes('/')) {
      setError('Page ID must match a React Router path segment (no slashes).');
      return;
    }

    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const ref = doc(db, 'global_header_configs', pageId);
      const snap = await getDoc(ref);
      const payload = {
        iconUrl: String(form.iconUrl || '').trim(),
        titleText: String(form.titleText || '').trim(),
        descriptionText: String(form.descriptionText || '').trim(),
        isHelpEnabled: Boolean(form.isHelpEnabled),
        instructionID: String(form.instructionID || '').trim(),
        updatedAt: serverTimestamp(),
      };
      if (!snap.exists()) payload.createdAt = serverTimestamp();

      await setDoc(ref, payload, { merge: true });
      setSelectedPageId(pageId);
      setStatus('Saved. global_header_configs updated.');
      await loadConfigs();
    } catch (err) {
      setError(err?.message || 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentConfigFromList = useMemo(
    () => configs.find((row) => normalizePageID(row.id) === normalizePageID(selectedPageId)),
    [configs, selectedPageId],
  );

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-800">Header Control Center</h1>
            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-slate-400">
              Manage global_header_configs by pageID
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedPageId('');
                setForm(EMPTY_FORM);
                setStatus('');
                setError('');
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-blue-400 hover:text-blue-700"
            >
              <span className="inline-flex items-center gap-2">
                <X className="h-4 w-4" />
                New
              </span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </span>
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {error}
          </div>
        ) : null}
        {status ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4" />
              {status}
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Existing PageIDs</p>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStatus('');
                  setIsLoading(true);
                  loadConfigs()
                    .catch((err) => setError(err?.message || 'Failed to refresh header configs.'))
                    .finally(() => setIsLoading(false));
                }}
                disabled={isLoading}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-700 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 max-h-[540px] space-y-2 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm font-semibold text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Loading…
                </div>
              ) : configs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                  No header configs yet.
                </div>
              ) : (
                configs.map((row) => {
                  const isActive = normalizePageID(row.id) === normalizePageID(selectedPageId);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => selectConfig(row.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        isActive ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-sm font-black text-slate-800">{row.id}</p>
                      <p className="mt-1 truncate text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {row.titleText || 'No titleText'}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Page ID (Doc ID)
                      <input
                        value={form.pageID}
                        onChange={(event) => setForm((prev) => ({ ...prev, pageID: event.target.value }))}
                        placeholder="e.g. dashboard, portal-mgmt"
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-400"
                      />
                    </label>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Normalized: <span className="text-slate-700">{normalizedPageId || '—'}</span>
                    </p>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleLookup}
                      disabled={isLoading || !form.pageID}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-blue-400 hover:text-blue-700 disabled:opacity-50"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <Search className="h-4 w-4" />
                        Load
                      </span>
                    </button>
                  </div>
                </div>

                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Title Text
                  <input
                    value={form.titleText}
                    onChange={(event) => setForm((prev) => ({ ...prev, titleText: event.target.value }))}
                    placeholder="Main header title"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-400"
                  />
                </label>

                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Description Text
                  <input
                    value={form.descriptionText}
                    onChange={(event) => setForm((prev) => ({ ...prev, descriptionText: event.target.value }))}
                    placeholder="Subheader description"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-400"
                  />
                </label>

                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Icon URL (Square)
                  <input
                    value={form.iconUrl}
                    onChange={(event) => setForm((prev) => ({ ...prev, iconUrl: event.target.value }))}
                    placeholder="https://..."
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-400"
                  />
                </label>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Help Enabled
                    <select
                      value={form.isHelpEnabled ? 'true' : 'false'}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, isHelpEnabled: event.target.value === 'true' }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-400"
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </label>

                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Instruction Set
                    <select
                      value={form.instructionID}
                      onChange={(event) => setForm((prev) => ({ ...prev, instructionID: event.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-400"
                    >
                      <option value="">None</option>
                      {instructionRows.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.instructionName || row.id}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {currentConfigFromList ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Stored Values</p>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <p className="text-xs font-bold text-slate-700">titleText: {currentConfigFromList.titleText || '—'}</p>
                      <p className="text-xs font-bold text-slate-700">instructionID: {currentConfigFromList.instructionID || '—'}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Preview</p>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      {form.iconUrl ? (
                        <img src={form.iconUrl} alt="icon preview" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Icon
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black text-slate-800">{form.titleText || 'Title Preview'}</p>
                      <p className="mt-1 truncate text-xs font-bold uppercase tracking-widest text-slate-400">
                        {form.descriptionText || 'Description Preview'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Help: {form.isHelpEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                    <p className="mt-2 text-xs font-bold text-slate-700">
                      instructionID: {form.instructionID || 'None'}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
                  <p className="text-xs font-black uppercase tracking-widest text-blue-700">Contract Reminder</p>
                  <p className="mt-2 text-sm font-bold text-blue-700">
                    Document ID must match the React Router path segment (example: portal-mgmt). This page writes to
                    global_header_configs/&lt;pageID&gt;.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
};
