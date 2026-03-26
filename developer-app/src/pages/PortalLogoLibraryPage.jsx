import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Cropper from 'react-easy-crop';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  Check,
  Edit3,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { ProtectedLayout } from '../components/layout/ProtectedLayout';
import { db, storage } from '../lib/firebase';

const toUpperTrim = (value) => String(value || '').trim().toUpperCase();
const inferLogoNameFromFile = (fileName = '') =>
  toUpperTrim(String(fileName).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' '));
const toSafeDocId = (value, fallback = 'portal_logo') => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
};

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
    // Ignore cleanup failures
  }
};

const getCroppedBlob = (imageSrc, pixelCrop, size = 256) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not available.'));
        return;
      }
      // Safety background for visibility on all themes.
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        size,
        size,
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

export const PortalLogoLibraryPage = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState(null); // { mode, file, row? }
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [bulkQueue, setBulkQueue] = useState([]);
  const [bulkIndex, setBulkIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const [form, setForm] = useState({
    logoName: '',
    logoFile: null,
  });
  const [editingRow, setEditingRow] = useState(null);
  const isEditing = Boolean(editingRow);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'acis_global_portal_logos'), orderBy('createdAt', 'desc')));
      const nextRows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      setRows(nextRows);
    } catch (loadError) {
      setError(loadError?.message || 'Failed to load portal logo library.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const rowsById = useMemo(() => {
    const map = {};
    rows.forEach((row) => {
      map[row.id] = row;
    });
    return map;
  }, [rows]);

  const resetForm = () => {
    setForm({ logoName: '', logoFile: null });
    setEditingRow(null);
    setBulkQueue([]);
    setBulkIndex(0);
    setStatus('');
    setError('');
  };

  const openQueueAtIndex = (files, index) => {
    const safeFiles = Array.isArray(files) ? files : [];
    const file = safeFiles[index];
    if (!file) return;
    setBulkQueue(safeFiles);
    setBulkIndex(index);
    setEditingRow(null);
    setForm({ logoName: inferLogoNameFromFile(file.name), logoFile: file });
    openCropDialog(file, 'create', null);
    setStatus(`Queue loaded: ${index + 1}/${safeFiles.length}`);
    setError('');
  };

  const startBulkQueue = (fileList) => {
    const files = Array.from(fileList || []).filter((file) => /^image\//i.test(String(file.type || '')));
    if (!files.length) return;
    openQueueAtIndex(files, 0);
  };

  const openCropDialog = (file, mode, row = null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCropImageSrc(String(event.target?.result || ''));
      setCropTarget({ mode, file, row });
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setIsCropOpen(true);
      setError('');
      setStatus('');
    };
    reader.onerror = () => {
      setError('Unable to read the selected image.');
    };
    reader.readAsDataURL(file);
  };

  const handleCreateFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    setForm((prev) => ({ ...prev, logoFile: file }));
    openCropDialog(file, isEditing ? 'edit' : 'create', editingRow);
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

  const handleSave = async () => {
    const logoName = toUpperTrim(form.logoName);
    if (!logoName) {
      setError('Portal logo name is required.');
      return;
    }
    if (!isEditing && !form.logoFile) {
      setError('Upload a logo image to create a new record.');
      return;
    }

    setIsSaving(true);
    setError('');
    setStatus('');

    const nextId = toSafeDocId(logoName, 'portal_logo');

    try {
      let successMessage = '';
      if (!isEditing) {
        if (!cropImageSrc || !croppedAreaPixels || !cropTarget?.file) {
          throw new Error('Select image and crop before saving.');
        }
        const exists = rowsById[nextId];
        if (exists) throw new Error('A portal logo with this name already exists.');

        const croppedBlob = await getCroppedBlob(cropImageSrc, croppedAreaPixels, 256);
        const storageRef = ref(storage, `acis_global_portal_logos/${nextId}_${Date.now()}.webp`);
        await uploadBytes(storageRef, croppedBlob, { contentType: 'image/webp' });
        const logoUrl = await getDownloadURL(storageRef);

        await setDoc(doc(db, 'acis_global_portal_logos', nextId), {
          logoName,
          logoUrl,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        successMessage = 'Portal logo added to global library.';
      } else {
        const currentId = editingRow.id;
        const isRename = currentId !== nextId;

        let nextLogoUrl = String(editingRow.logoUrl || '');
        const replacingImage = Boolean(cropTarget?.file && croppedAreaPixels && cropImageSrc);
        if (replacingImage) {
          const croppedBlob = await getCroppedBlob(cropImageSrc, croppedAreaPixels, 256);
          const storageRef = ref(storage, `acis_global_portal_logos/${nextId}_${Date.now()}.webp`);
          await uploadBytes(storageRef, croppedBlob, { contentType: 'image/webp' });
          nextLogoUrl = await getDownloadURL(storageRef);
        }

        if (isRename) {
          if (rowsById[nextId]) throw new Error('Another portal logo already uses this UID.');
          await setDoc(doc(db, 'acis_global_portal_logos', nextId), {
            ...editingRow,
            logoName,
            logoUrl: nextLogoUrl,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          await deleteDoc(doc(db, 'acis_global_portal_logos', currentId));
        } else {
          await updateDoc(doc(db, 'acis_global_portal_logos', currentId), {
            logoName,
            logoUrl: nextLogoUrl,
            updatedAt: serverTimestamp(),
          });
        }

        if (replacingImage && editingRow.logoUrl && editingRow.logoUrl !== nextLogoUrl) {
          await safeDeleteByUrl(editingRow.logoUrl);
        }

        successMessage = 'Portal logo updated successfully.';
      }

      const queueMode = !isEditing && bulkQueue.length > 0;
      const nextQueueIndex = bulkIndex + 1;

      setIsCropOpen(false);
      setCropTarget(null);
      setCropImageSrc('');
      await loadRows();

      if (queueMode && nextQueueIndex < bulkQueue.length) {
        openQueueAtIndex(bulkQueue, nextQueueIndex);
        setStatus(`Saved ${nextQueueIndex}/${bulkQueue.length}. Continue with next logo.`);
      } else {
        resetForm();
        if (queueMode) setStatus(`Bulk upload completed (${bulkQueue.length} logos).`);
        else setStatus(successMessage);
      }
    } catch (saveError) {
      setError(saveError?.message || 'Failed to save portal logo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setForm({ logoName: String(row.logoName || ''), logoFile: null });
    setStatus('');
    setError('');
    setCropTarget(null);
    setCropImageSrc('');
    setCroppedAreaPixels(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReplaceImage = (row, event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    setEditingRow(row);
    setForm({ logoName: String(row.logoName || ''), logoFile: file });
    openCropDialog(file, 'edit', row);
  };

  const handleDelete = async (row) => {
    const allow = window.confirm(`Delete portal logo "${row.logoName || row.id}"?`);
    if (!allow) return;
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      await deleteDoc(doc(db, 'acis_global_portal_logos', row.id));
      await safeDeleteByUrl(String(row.logoUrl || ''));
      if (editingRow?.id === row.id) resetForm();
      setStatus('Portal logo deleted.');
      await loadRows();
    } catch (deleteError) {
      setError(deleteError?.message || 'Failed to delete portal logo.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (row) => {
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      await updateDoc(doc(db, 'acis_global_portal_logos', row.id), {
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

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
          <h1 className="text-3xl font-black tracking-tight text-slate-800">Portal Logo Library</h1>
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Developer-managed universal portal logos for tenant portal creation and editing.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">
              Portal Logo Name *
              <input
                value={form.logoName}
                onChange={(event) => setForm((prev) => ({ ...prev, logoName: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                placeholder="Example: EMIRATES NBD"
              />
            </label>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">
              Logo Image {isEditing ? '(optional for rename-only)' : '*'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleCreateFileChange}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
              />
            </label>
          </div>

          {!isEditing ? (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDropFiles}
              className={`mt-4 rounded-xl border-2 border-dashed p-4 transition ${
                isDragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-700">Bulk Upload Queue</p>
                  <p className="text-xs font-semibold text-slate-500">Drag and drop many images, then crop/save one by one.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-400 hover:text-blue-700">
                  <ImagePlus className="h-4 w-4" />
                  Select Multiple
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleBulkQueueChange}
                  />
                </label>
              </div>
              {bulkQueue.length > 0 ? (
                <p className="mt-2 text-xs font-bold text-blue-700">Queue: {bulkIndex + 1}/{bulkQueue.length}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEditing ? 'Save Changes' : 'Add Portal Logo'}
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
            <p className="text-sm font-black uppercase tracking-wider text-slate-700">
              Global Portal Logos ({rows.length})
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
              No portal logos in global library yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <article key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5">
                      {row.logoUrl ? (
                        <img src={row.logoUrl} alt={row.logoName || row.id} className="h-full w-full object-contain" />
                      ) : (
                        <ImagePlus className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{row.logoName || row.id}</p>
                      <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-500">UID: {row.id}</p>
                      <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${row.isActive === false ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>
                        {row.isActive === false ? 'Inactive' : 'Active'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(row)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-400 hover:text-blue-700"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-400 hover:text-blue-700">
                      <ImagePlus className="h-3.5 w-3.5" />
                      Replace
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(event) => handleReplaceImage(row, event)}
                      />
                    </label>
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
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-black text-slate-800">Crop Portal Logo</p>
                <p className="text-xs font-semibold text-slate-500">Adjust crop and save clean 1:1 logo.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCropOpen(false);
                  setCropTarget(null);
                  setCropImageSrc('');
                }}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-500 transition hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative h-[280px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {cropImageSrc ? (
                  <Cropper
                    image={cropImageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="rect"
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
                onClick={() => {
                  setIsCropOpen(false);
                  setCropTarget(null);
                  setCropImageSrc('');
                }}
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
    </ProtectedLayout>
  );
};
