import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toSafeDocId } from '../../lib/idUtils';
import { normalizeLibraryTitle } from '../../lib/serviceTemplateRules';
import {
  getApplicationIconById,
  upsertApplicationIcon,
} from '../../lib/applicationIconLibraryStore';
import {
  uploadApplicationIconAsset,
  validateApplicationIconFile,
} from '../../lib/applicationIconStorage';
import { createSyncEvent } from '../../lib/syncEvents';
import { getCroppedImg } from '../../lib/imageStudioUtils';
import ImageStudio from './ImageStudio';

const panelClass =
  'rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4';
const inputClass =
  'mt-2 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5 text-sm font-semibold text-[var(--c-text)] outline-none transition placeholder:text-[var(--c-muted)] focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-ring)]';

const normalizeNameForCompare = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]/g, '');

const ApplicationIconQuickAddPanel = ({
  tenantId,
  createdBy = '',
  existingIcons = [],
  suggestedName = '',
  isOpen = false,
  onOpen,
  onCreated,
  onClose,
}) => {
  const [iconName, setIconName] = useState('');
  const [iconFile, setIconFile] = useState(null);
  const [rawUrl, setRawUrl] = useState('');
  const [cropPixels, setCropPixels] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [filter, setFilter] = useState('natural');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => () => {
    if (rawUrl && rawUrl.startsWith('blob:')) {
      URL.revokeObjectURL(rawUrl);
    }
  }, [rawUrl]);

  const resetState = () => {
    setIconName(normalizeLibraryTitle(suggestedName || ''));
    setIconFile(null);
    if (rawUrl && rawUrl.startsWith('blob:')) {
      URL.revokeObjectURL(rawUrl);
    }
    setRawUrl('');
    setCropPixels(null);
    setZoom(1);
    setRotation(0);
    setFilter('natural');
    setError('');
    setStatus('');
    setIsSaving(false);
  };

  const handleClose = () => {
    if (isSaving) return;
    resetState();
    onClose?.();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    const validationError = validateApplicationIconFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    if (rawUrl && rawUrl.startsWith('blob:')) URL.revokeObjectURL(rawUrl);
    setIconFile(file);
    setRawUrl(objectUrl);
    setCropPixels(null);
    setZoom(1);
    setRotation(0);
    setFilter('natural');
    setError('');
    setStatus('');
  };

  const handleSave = async () => {
    const trimmedName = normalizeLibraryTitle(iconName || suggestedName || '');
    if (!tenantId || !createdBy) {
      setError('Missing tenant or user context.');
      return;
    }
    if (!trimmedName) {
      setError('Icon Name is mandatory.');
      return;
    }
    if (!iconFile) {
      setError('Select an icon image before saving.');
      return;
    }

    const duplicateByVariant = (existingIcons || []).some((item) => (
      normalizeNameForCompare(item?.iconName || item?.iconId) === normalizeNameForCompare(trimmedName)
    ));
    if (duplicateByVariant) {
      setError('Another icon already uses this name variant (case/space). Choose a unique name.');
      return;
    }

    setIsSaving(true);
    setError('');
    setStatus('');

    let uploadBlob = iconFile;
    if (rawUrl && cropPixels) {
      const cropped = await getCroppedImg(rawUrl, cropPixels, rotation, 'none');
      if (cropped) uploadBlob = cropped;
    }

    const validationError = validateApplicationIconFile(uploadBlob);
    if (validationError) {
      setError(validationError);
      setIsSaving(false);
      return;
    }

    const iconId = toSafeDocId(trimmedName, 'app_icon');
    const existing = await getApplicationIconById(tenantId, iconId);
    if (!existing.ok) {
      setError(existing.error || 'Failed to validate icon name.');
      setIsSaving(false);
      return;
    }
    if (existing.exists) {
      setError('Another icon already uses this exact name. Choose a different name.');
      setIsSaving(false);
      return;
    }

    const uploadRes = await uploadApplicationIconAsset({
      tenantId,
      iconId,
      fileBlob: uploadBlob,
    });
    if (!uploadRes.ok) {
      setError(uploadRes.error || 'Icon upload failed.');
      setIsSaving(false);
      return;
    }

    const saveIconRes = await upsertApplicationIcon(
      tenantId,
      iconId,
      {
        iconName: trimmedName,
        iconUrl: uploadRes.iconUrl,
        createdBy,
      },
      { isCreate: true },
    );
    if (!saveIconRes.ok) {
      setError(saveIconRes.error || 'Failed to save icon.');
      setIsSaving(false);
      return;
    }

    await createSyncEvent({
      tenantId,
      eventType: 'create',
      entityType: 'applicationIcon',
      entityId: iconId,
      changedFields: ['iconName', 'iconUrl', 'createdBy'],
      createdBy,
    });

    const createdIcon = {
      iconId,
      iconName: trimmedName,
      iconUrl: uploadRes.iconUrl,
      createdBy,
    };
    setStatus('Icon added successfully.');
    onCreated?.(createdIcon);
    resetState();
    onClose?.();
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIconName(normalizeLibraryTitle(suggestedName || ''));
          setError('');
          setStatus('');
          onOpen?.();
        }}
        className="compact-action inline-flex items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-xs font-semibold text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
      >
        <Plus strokeWidth={1.5} className="h-4 w-4" />
        Add New Icon
      </button>
    );
  }

  return (
    <div className={panelClass}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--c-accent)]">Add New Icon</p>
          <p className="text-xs font-semibold text-[var(--c-muted)]">Create and auto-select a reusable icon without leaving this page.</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] transition hover:text-[var(--c-text)]"
          aria-label="Close icon add panel"
        >
          <X strokeWidth={1.5} className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        <label className="block text-xs font-bold text-[var(--c-text)]">
          Icon Image *
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileChange}
            className={inputClass}
          />
        </label>

        {rawUrl ? (
          <ImageStudio
            sourceUrl={rawUrl}
            onReset={() => {
              if (rawUrl && rawUrl.startsWith('blob:')) URL.revokeObjectURL(rawUrl);
              setIconFile(null);
              setRawUrl('');
              setCropPixels(null);
              setZoom(1);
              setRotation(0);
              setFilter('natural');
            }}
            onFileChange={handleFileChange}
            onCropComplete={(_, pixels) => setCropPixels(pixels)}
            zoom={zoom}
            setZoom={setZoom}
            rotation={rotation}
            setRotation={setRotation}
            filter={filter}
            setFilter={setFilter}
            filterMap={{ natural: { label: 'Natural' } }}
            title="Icon Crop Studio"
            aspect={1}
            cropShape="rect"
            showFilters={false}
            workspaceHeightClass="h-[220px] sm:h-[260px]"
            minZoom={0.5}
            maxZoom={4}
          />
        ) : null}

        <label className="block text-xs font-bold text-[var(--c-text)]">
          Icon Name *
          <input
            className={inputClass}
            value={iconName}
            onChange={(event) => setIconName(event.target.value)}
            placeholder={`Example: ${normalizeLibraryTitle(suggestedName || 'Invoice Management')}`}
          />
        </label>

        {error ? <p className="text-xs font-bold text-rose-500">{error}</p> : null}
        {status ? <p className="text-xs font-bold text-emerald-500">{status}</p> : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="compact-action rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 text-sm font-semibold text-[var(--c-text)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="compact-action rounded-xl bg-[var(--c-accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Add Icon'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationIconQuickAddPanel;
