import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Cropper from 'react-easy-crop';
import {
  Check,
  CheckCircle2,
  FileVideo,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  X,
  XCircle
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ProtectedLayout } from '../components/layout/ProtectedLayout';
import { normalizePageID } from '../lib/pageIdNormalization';
import { db, storage } from '../lib/firebase';
import GenericSelectField from '../../../tenant-app/src/components/common/GenericSelectField';

const MAX_VIDEO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';
const SOVEREIGN_PAGE_REGISTRY = Object.freeze([
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'daily-transactions', label: 'Daily Transactions' },
  { route: 'receive-payments', label: 'Receive Payments' },
  { route: 'portal-management', label: 'Portal Management' },
  { route: 'clients-onboarding', label: 'Clients Onboarding' },
  { route: 'expenses', label: 'Expenses' },
  { route: 'invoices', label: 'Invoices' },
]);

const toSafeDocId = (value, fallback = 'instruction') => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
};

const toCleanName = (value) => String(value || '').trim();

const extractStoragePathFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    const marker = '/o/';
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    const encodedPath = parsed.pathname.slice(index + marker.length);
    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
};

const safeDeleteByUrl = async (url) => {
  const path = extractStoragePathFromUrl(url);
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // ignore cleanup failures
  }
};

const getImageBlobFromCrop = (imageSrc, pixelCrop) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const width = Math.max(1, Math.round(pixelCrop.width || 1));
      const height = Math.max(1, Math.round(pixelCrop.height || 1));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not available.'));
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        width,
        height,
      );
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Crop export failed.'));
          return;
        }
        resolve(blob);
      }, 'image/webp', 0.95);
    };
    image.onerror = (err) => reject(err);
  });
};

export const InstructionsLibraryPage = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const [pageRegistry, setPageRegistry] = useState(() =>
    SOVEREIGN_PAGE_REGISTRY.map(({ route, label }) => ({
      route: normalizePageID(route),
      label,
      instructionUID: '',
      isHelpEnabled: false,
    })),
  );
  const [isRegistryLoading, setIsRegistryLoading] = useState(true);
  const [isRegistrySaving, setIsRegistrySaving] = useState(false);
  const [registryStatus, setRegistryStatus] = useState('');
  const [registryError, setRegistryError] = useState('');

  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [form, setForm] = useState({
    instructionName: '',
    mediaType: 'image',
    mediaFile: null,
  });
  const [editingRow, setEditingRow] = useState(null);
  const isEditing = Boolean(editingRow);

  const [bulkQueue, setBulkQueue] = useState([]);
  const [bulkIndex, setBulkIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // High-Visibility Progress State
  const [actionStatus, setActionStatus] = useState({
    active: false,
    type: 'loading',
    title: '',
    message: '',
    current: 0,
    total: 0
  });

  const closeActionStatus = () => setActionStatus(prev => ({ ...prev, active: false }));

  const generatedUid = useMemo(
    () => toSafeDocId(form.instructionName, 'instruction'),
    [form.instructionName],
  );

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'acis_global_instruction_library'), orderBy('createdAt', 'desc')));
      const nextRows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      setRows(nextRows);
    } catch (loadError) {
      setError(loadError?.message || 'Failed to load instructions library.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    const run = async () => {
      setIsRegistryLoading(true);
      setRegistryError('');
      setRegistryStatus('');
      try {
        const nextRegistry = await Promise.all(
          SOVEREIGN_PAGE_REGISTRY.map(async ({ route, label }) => {
            const normalizedRoute = normalizePageID(route);
            const snap = await getDoc(doc(db, 'global_page_instructions', normalizedRoute));
            const data = snap.exists() ? (snap.data() || {}) : {};
            return {
              route: normalizedRoute,
              label,
              instructionUID: String(data?.instructionUID || '').trim(),
              isHelpEnabled: data?.isHelpEnabled === true,
            };
          }),
        );
        setPageRegistry(nextRegistry);
      } catch (err) {
        setRegistryError(err?.message || 'Failed to load Sovereign Page Registry.');
      } finally {
        setIsRegistryLoading(false);
      }
    };
    void run();
  }, []);

  const rowsById = useMemo(() => {
    const map = {};
    rows.forEach((row) => {
      map[row.id] = row;
    });
    return map;
  }, [rows]);

  const instructionOptions = useMemo(() => (
    rows.map((row) => ({
      value: row.id,
      label: `${row.instructionName || row.id} (${row.id})`,
    }))
  ), [rows]);

  const resetCropState = () => {
    setIsCropOpen(false);
    setCropImageSrc('');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const resetForm = () => {
    setForm({
      instructionName: '',
      mediaType: 'image',
      mediaFile: null,
    });
    setEditingRow(null);
    setBulkQueue([]);
    setBulkIndex(0);
    setStatus('');
    setError('');
    resetCropState();
  };

  const openQueueAtIndex = (files, index) => {
    const file = files[index];
    if (!file) return;
    
    const isVideo = /^video\//i.test(String(file.type || ''));
    setBulkQueue(files);
    setBulkIndex(index);
    setEditingRow(null);
    setForm({
      instructionName: toCleanName(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')).toUpperCase(),
      mediaType: isVideo ? 'video' : 'image',
      mediaFile: file,
    });
    
    if (!isVideo) {
      openCropDialogForImage(file);
    } else {
      resetCropState();
    }
  };

  const startBulkQueue = (fileList) => {
    const files = Array.from(fileList || []).filter(f => 
      /^image\//i.test(String(f.type || '')) || /^video\//i.test(String(f.type || ''))
    );
    if (!files.length) return;
    openQueueAtIndex(files, 0);
  };

  const openCropDialogForImage = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      setCropImageSrc(String(event.target?.result || ''));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setIsCropOpen(true);
      setError('');
      setStatus('');
    };
    reader.onerror = () => {
      setError('Unable to read selected image.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    setError('');
    setStatus('');
    
    const isVideo = /^video\//i.test(String(file.type || ''));
    setForm((prev) => ({ 
      ...prev, 
      mediaFile: file,
      mediaType: isVideo ? 'video' : 'image'
    }));

    if (isVideo) {
      if (file.size > MAX_VIDEO_SIZE_BYTES) {
        setError('Video must be 2MB or smaller.');
        setForm((prev) => ({ ...prev, mediaFile: null }));
        return;
      }
      resetCropState();
      return;
    }

    openCropDialogForImage(file);
  };

  const handleBulkQueueChange = (event) => {
    const files = event.target.files;
    event.target.value = '';
    if (!files?.length) return;
    startBulkQueue(files);
  };

  const handleDropFiles = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    if (isEditing) return;
    const files = event.dataTransfer?.files;
    if (!files?.length) return;
    startBulkQueue(files);
  };

  const getStorageExt = (mediaType) => (mediaType === 'video' ? 'mp4' : 'webp');

  const uploadMediaAsset = async ({ uid, mediaType, mediaFile }) => {
    if (!mediaFile) throw new Error('Select media file first.');

    if (mediaType === 'video') {
      const mime = String(mediaFile.type || '').toLowerCase();
      const isAllowedVideo = mime.includes('mp4') || mime.includes('webm') || mime.includes('quicktime');
      if (!isAllowedVideo) throw new Error('Unsupported video format. Use MP4 or WEBM.');
      if (mediaFile.size > MAX_VIDEO_SIZE_BYTES) throw new Error('Video must be 2MB or smaller.');
    } else if (!cropImageSrc || !croppedAreaPixels) {
      throw new Error('Crop image before saving.');
    }

    const ext = getStorageExt(mediaType);
    const storageRef = ref(storage, `acis_global_instruction_library/${uid}_${Date.now()}.${ext}`);
    if (mediaType === 'video') {
      await uploadBytes(storageRef, mediaFile, { contentType: mediaFile.type || 'video/mp4' });
    } else {
      const imageBlob = await getImageBlobFromCrop(cropImageSrc, croppedAreaPixels);
      await uploadBytes(storageRef, imageBlob, { contentType: 'image/webp' });
    }
    const mediaUrl = await getDownloadURL(storageRef);
    return mediaUrl;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.instructionName || (!isEditing && !form.mediaFile)) {
      return setError('Name and Media are required.');
    }

    const queueMode = !isEditing && bulkQueue.length > 0;
    
    // Only show global progress for bulk queue
    if (queueMode) {
      setActionStatus({
        active: true,
        type: 'loading',
        title: 'Instructions Sync',
        message: 'Processing multi-media batch...',
        current: bulkIndex,
        total: bulkQueue.length
      });
    }

    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const uid = generatedUid;
      let nextMediaUrl = editingRow?.mediaUrl || '';
      const replacingFile = !!form.mediaFile;

      if (replacingFile) {
        if (queueMode) setActionStatus(prev => ({ ...prev, message: `Uploading ${form.instructionName}...` }));
        nextMediaUrl = await uploadMediaAsset({
          uid,
          mediaType: form.mediaType,
          mediaFile: form.mediaFile,
        });
      }

      const payload = {
        instructionName: form.instructionName.toUpperCase(),
        mediaType: form.mediaType,
        mediaUrl: nextMediaUrl,
        isActive: form.isActive !== false,
        updatedAt: serverTimestamp(),
      };

      if (isEditing) {
        await updateDoc(doc(db, 'acis_global_instruction_library', editingRow.id), payload);
        if (replacingFile && editingRow.mediaUrl && editingRow.mediaUrl !== nextMediaUrl) {
          await safeDeleteByUrl(editingRow.mediaUrl);
        }
      } else {
        await setDoc(doc(db, 'acis_global_instruction_library', uid), {
          ...payload,
          createdAt: serverTimestamp(),
        }, { merge: true });
      }

      const nextQueueIndex = bulkIndex + 1;

      if (queueMode && nextQueueIndex < bulkQueue.length) {
        resetCropState();
        openQueueAtIndex(bulkQueue, nextQueueIndex);
        setStatus(`Saved ${nextQueueIndex}/${bulkQueue.length}. Continue with next item.`);
      } else {
        resetForm();
        if (queueMode) {
          setActionStatus({
            active: true,
            type: 'success',
            title: 'Batch Complete',
            message: `Successfully added ${bulkQueue.length} instructions.`,
            current: bulkQueue.length,
            total: bulkQueue.length
          });
          setTimeout(closeActionStatus, 3000);
        } else {
          setStatus(isEditing ? 'Instruction item updated successfully.' : 'Instruction item added successfully.');
        }
      }
      await loadRows();
    } catch (saveError) {
      if (queueMode) setActionStatus({ active: true, type: 'error', title: 'Sync Failed', message: saveError.message });
      setError(saveError?.message || 'Failed to save instruction item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setForm({
      instructionName: String(row.instructionName || ''),
      mediaType: String(row.mediaType || 'image'),
      mediaFile: null,
    });
    setStatus('');
    setError('');
    resetCropState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (row) => {
    const allow = window.confirm(`Delete instruction "${row.instructionName || row.id}"?`);
    if (!allow) return;
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      await deleteDoc(doc(db, 'acis_global_instruction_library', row.id));
      await safeDeleteByUrl(String(row.mediaUrl || ''));
      if (editingRow?.id === row.id) resetForm();
      setStatus('Instruction item deleted.');
      await loadRows();
    } catch (deleteError) {
      setError(deleteError?.message || 'Failed to delete instruction item.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (row) => {
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      await updateDoc(doc(db, 'acis_global_instruction_library', row.id), {
        isActive: row.isActive === false,
        updatedAt: serverTimestamp(),
      });
      await loadRows();
    } catch (toggleError) {
      setError(toggleError?.message || 'Failed to update status.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} items(s)?`)) return;
    
    setIsDeletingBulk(true);
    try {
      for (const id of selectedIds) {
        const row = rowsById[id];
        if (row) {
          await deleteDoc(doc(db, 'acis_global_instruction_library', id));
          if (row.mediaUrl) await safeDeleteByUrl(row.mediaUrl);
        }
      }
      await loadRows();
      setSelectedIds([]);
      setStatus(`Deleted ${selectedIds.length} items(s).`);
    } catch (err) {
      setError(err.message || 'Bulk delete failed.');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const updatePageRegistryRow = (route, patch) => {
    const normalizedRoute = normalizePageID(route);
    setPageRegistry((prev) => prev.map((item) => (
      item.route === normalizedRoute ? { ...item, ...patch } : item
    )));
  };

  const handleSavePageRegistry = async () => {
    setIsRegistrySaving(true);
    setRegistryError('');
    setRegistryStatus('');
    try {
      await Promise.all(
        pageRegistry.map(async (item) => {
          const ref = doc(db, 'global_page_instructions', item.route);
          const snap = await getDoc(ref);
          const payload = {
            routeName: item.route,
            instructionUID: String(item.instructionUID || '').trim(),
            isHelpEnabled: Boolean(item.isHelpEnabled),
            updatedAt: serverTimestamp(),
          };
          if (!snap.exists()) payload.createdAt = serverTimestamp();
          await setDoc(ref, payload, { merge: true });
        }),
      );
      setRegistryStatus('Saved. Sovereign Page Registry updated.');
    } catch (err) {
      setRegistryError(err?.message || 'Failed to save Sovereign Page Registry.');
    } finally {
      setIsRegistrySaving(false);
    }
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
          <h1 className="text-3xl font-black tracking-tight text-slate-800">Instructions Library</h1>
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Upload reusable image/video guidance files for help buttons and onboarding hints.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-800">Sovereign Page Registry</p>
              <p className="text-xs font-semibold text-slate-600">
                Centralized help routing for tenant pages via <span className="font-black">global_page_instructions/&lt;route_name&gt;</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleSavePageRegistry}
              disabled={isRegistrySaving || isRegistryLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {isRegistrySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Registry
            </button>
          </div>

          {registryError ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
              {registryError}
            </div>
          ) : null}

          {registryStatus ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
              {registryStatus}
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-2xl border border-blue-100 bg-white">
            <div className="grid h-14 grid-cols-[1.15fr_2fr_0.95fr] items-center gap-4 border-b border-blue-100 bg-blue-100/70 px-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">
              <span>Tenant Route</span>
              <span>InstructionUID</span>
              <span>Help Enabled</span>
            </div>
            {pageRegistry.map((item) => (
              <div
                key={item.route}
                className="grid h-14 grid-cols-[1.15fr_2fr_0.95fr] items-center gap-4 border-b border-slate-100 px-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-800">{item.label}</p>
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{item.route}</p>
                </div>
                <GenericSelectField
                  value={item.instructionUID}
                  onChange={(value) => updatePageRegistryRow(item.route, { instructionUID: String(value || '') })}
                  options={instructionOptions}
                  placeholder="Map instruction UID"
                  disabled={isRegistryLoading || isLoading}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updatePageRegistryRow(item.route, { isHelpEnabled: !item.isHelpEnabled })}
                    disabled={isRegistryLoading}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full border transition ${
                      item.isHelpEnabled
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-slate-300 bg-slate-200'
                    }`}
                    aria-pressed={item.isHelpEnabled}
                    aria-label={`Toggle help for ${item.label}`}
                  >
                    <span
                      className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${
                        item.isHelpEnabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">
                    {item.isHelpEnabled ? 'On' : 'Off'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-blue-700">
            Legacy help mapping via <span className="font-black">global_header_configs</span> is deprecated. Tenant help now resolves from the Sovereign Page Registry.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">
              Instruction Name *
              <input
                value={form.instructionName}
                onChange={(event) => setForm((prev) => ({ ...prev, instructionName: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                placeholder="Example: Quotation Application Add Help"
              />
            </label>

            <label className="text-xs font-black uppercase tracking-wider text-slate-500">
              UID (Auto)
              <input
                value={generatedUid}
                readOnly
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none"
              />
            </label>

            <label className="text-xs font-black uppercase tracking-wider text-slate-500">
              Media Type *
              <select
                value={form.mediaType}
                onChange={(event) => {
                  const nextType = event.target.value === 'video' ? 'video' : 'image';
                  setForm((prev) => ({ ...prev, mediaType: nextType, mediaFile: null }));
                  resetCropState();
                }}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="image">Image / Animation</option>
                <option value="video">Short Video (max 2MB)</option>
              </select>
            </label>

            <label className="text-xs font-black uppercase tracking-wider text-slate-500">
              Media File {isEditing ? '(optional for rename-only)' : '*'}
              <input
                type="file"
                accept={form.mediaType === 'video' ? VIDEO_ACCEPT : IMAGE_ACCEPT}
                onChange={handleFileChange}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
              />
            </label>
          </div>

          {!isEditing && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDropFiles}
              className={`mt-4 rounded-xl border-2 border-dashed p-4 transition ${
                isDragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-700">Bulk Upload Queue</p>
                  <p className="text-xs font-semibold text-slate-500">Drag and drop images/videos to upload sequentially.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-400 hover:text-blue-700">
                  <ImagePlus className="h-4 w-4" />
                  Select Multiple
                  <input
                    type="file"
                    accept={`${IMAGE_ACCEPT},${VIDEO_ACCEPT}`}
                    multiple
                    className="hidden"
                    onChange={handleBulkQueueChange}
                  />
                </label>
              </div>
              {bulkQueue.length > 0 && (
                <p className="mt-2 text-xs font-bold text-blue-700">Queue: {bulkIndex + 1}/{bulkQueue.length}</p>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isEditing ? 'Save Changes' : 'Add Instruction'}
            </button>
            {isEditing ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            ) : bulkQueue.length > 0 ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Clear Queue
              </button>
            ) : null}
          </div>

          {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p> : null}
          {status ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{status}</p> : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                checked={rows.length > 0 && selectedIds.length === rows.length}
                onChange={(e) => setSelectedIds(e.target.checked ? rows.map(r => r.id) : [])}
                className="h-4 w-4 rounded border-slate-300"
              />
              <p className="text-sm font-black uppercase tracking-wider text-slate-700">
                Global Instructions ({rows.length})
              </p>
            </div>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={isDeletingBulk}
                className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
              >
                {isDeletingBulk ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
              No instruction items in library yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <article key={row.id} className={`relative rounded-xl border p-3 transition ${selectedIds.includes(row.id) ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 bg-slate-50'}`}>
                  <input 
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={(e) => setSelectedIds(prev => e.target.checked ? [...prev, row.id] : prev.filter(id => id !== row.id))}
                    className="absolute right-3 top-3 z-10 h-4 w-4 rounded border-slate-300"
                  />
                  <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5">
                      {row.mediaType === 'video' ? (
                        row.mediaUrl ? (
                          <video src={row.mediaUrl} className="h-full w-full object-cover rounded-lg" muted loop autoPlay playsInline />
                        ) : (
                          <FileVideo className="h-5 w-5 text-slate-400" />
                        )
                      ) : row.mediaUrl ? (
                        <img src={row.mediaUrl} alt={row.instructionName || row.id} className="h-full w-full object-contain" />
                      ) : (
                        <ImagePlus className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{row.instructionName || row.id}</p>
                      <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-500">UID: {row.id}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <p className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-700">
                          {row.mediaType || 'image'}
                        </p>
                        <p className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${row.isActive === false ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>
                          {row.isActive === false ? 'Inactive' : 'Active'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(row)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-400 hover:text-blue-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(row)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-bold transition ${row.isActive === false ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {row.isActive === false ? 'Enable' : 'Disable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row)}
                      className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {isCropOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 lg:left-64">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-black text-slate-800">Crop Instruction Image</p>
                <p className="text-xs font-semibold text-slate-500">Flexible crop area, not forced square.</p>
              </div>
              <button
                type="button"
                onClick={resetCropState}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-500 transition hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative h-[320px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {cropImageSrc ? (
                  <Cropper
                    image={cropImageSrc}
                    crop={crop}
                    zoom={zoom}
                    showGrid={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                  />
                ) : null}
              </div>

              <div className="mt-4">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Zoom
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
                    className="mt-2 w-full accent-blue-600"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={resetCropState}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCropOpen(false);
                  setStatus('Crop ready. Click save to finalize.');
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white"
              >
                Use This Crop
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* GLOBAL ACTION PROGRESS OVERLAY */}
      {actionStatus.active && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 transition-opacity backdrop-blur-sm lg:left-64">
          <div className="w-full max-w-sm transform overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all">
            <div className="flex flex-col items-center text-center">
              
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
                {actionStatus.type === 'loading' && (
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                )}
                {actionStatus.type === 'success' && (
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                )}
                {actionStatus.type === 'error' && (
                  <XCircle className="h-8 w-8 text-rose-500" />
                )}
              </div>

              <h3 className="text-lg font-black text-slate-800">{actionStatus.title}</h3>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">{actionStatus.message}</p>

              {actionStatus.type === 'loading' && actionStatus.total > 0 && (
                <div className="mt-6 w-full">
                  <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>Progress</span>
                    <span>{Math.round((actionStatus.current / actionStatus.total) * 100)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300 ease-out"
                      style={{ width: `${(actionStatus.current / actionStatus.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {actionStatus.type === 'error' && (
                <button
                  onClick={closeActionStatus}
                  className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:opacity-90"
                >
                  Dismiss
                </button>
              )}

            </div>
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
};
