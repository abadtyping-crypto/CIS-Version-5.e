import { useEffect, useState } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { useTenant } from '../../context/useTenant';
import { useAuth } from '../../context/useAuth';
import { toSafeDocId } from '../../lib/idUtils';
import { createSyncEvent } from '../../lib/syncEvents';
import ImageStudio from '../common/ImageStudio';
import ServiceTemplateEditor from '../common/ServiceTemplateEditor';
import { getCroppedImg } from '../../lib/imageStudioUtils';
import {
  fetchApplicationIconLibrary,
  getApplicationIconById,
  upsertApplicationIcon,
} from '../../lib/applicationIconLibraryStore';
import { fetchServiceTemplates, upsertServiceTemplate } from '../../lib/serviceTemplateStore';
import {
  uploadApplicationIconAsset,
  validateApplicationIconFile,
} from '../../lib/applicationIconStorage';
import {
  buildServiceTemplatePayload,
  createEmptyServiceTemplateDraft,
  findServiceTemplateNameConflict,
  validateServiceTemplateDraft,
} from '../../lib/serviceTemplateRules';
import { ENFORCE_UNIVERSAL_APPLICATION_UID } from '../../lib/universalLibraryPolicy';
import InputActionField from '../common/InputActionField';

const QuickAddServiceTemplateModal = ({ isOpen, onClose, onCreated }) => {
  const lockToUniversalApps = ENFORCE_UNIVERSAL_APPLICATION_UID;
  const { tenantId } = useTenant();
  const { user } = useAuth();

  const [draft, setDraft] = useState(createEmptyServiceTemplateDraft());
  const [newIconName, setNewIconName] = useState('');
  const [newIconFile, setNewIconFile] = useState(null);
  const [newIconRawUrl, setNewIconRawUrl] = useState('');
  const [newIconZoom, setNewIconZoom] = useState(1);
  const [newIconRotation, setNewIconRotation] = useState(0);
  const [newIconFilter, setNewIconFilter] = useState('natural');
  const [newIconCropPixels, setNewIconCropPixels] = useState(null);
  const [icons, setIcons] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !tenantId) return;
    let active = true;
    fetchApplicationIconLibrary(tenantId).then((res) => {
      if (!active) return;
      if (res.ok) setIcons(res.rows || []);
    });
    return () => {
      active = false;
    };
  }, [isOpen, tenantId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !lockToUniversalApps) return;
    onClose?.();
  }, [isOpen, lockToUniversalApps, onClose]);

  const resetState = () => {
    setDraft(createEmptyServiceTemplateDraft());
    setNewIconName('');
    setNewIconFile(null);
    if (newIconRawUrl && newIconRawUrl.startsWith('blob:')) {
      URL.revokeObjectURL(newIconRawUrl);
    }
    setNewIconRawUrl('');
    setNewIconZoom(1);
    setNewIconRotation(0);
    setNewIconFilter('natural');
    setNewIconCropPixels(null);
    setError('');
    setIsSaving(false);
  };

  useEffect(() => {
    return () => {
      if (newIconRawUrl && newIconRawUrl.startsWith('blob:')) {
        URL.revokeObjectURL(newIconRawUrl);
      }
    };
  }, [newIconRawUrl]);

  const handleClose = () => {
    if (isSaving) return;
    resetState();
    onClose?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (lockToUniversalApps) {
      setError('Custom application creation is disabled. Use Universal Application Library only.');
      return;
    }
    const validationError = validateServiceTemplateDraft(draft);
    if (validationError) return setError(validationError);
    if (!tenantId || !user?.uid) return setError('Missing tenant or user context.');
    const trimmedName = String(draft.name || '').trim();

    setIsSaving(true);
    setError('');

    let resolvedIconId = draft.iconId || '';
    if (newIconFile) {
      let iconBlobForUpload = newIconFile;
      if (newIconRawUrl && newIconCropPixels) {
        const croppedBlob = await getCroppedImg(newIconRawUrl, newIconCropPixels, newIconRotation, 'none');
        if (croppedBlob) iconBlobForUpload = croppedBlob;
      }

      const validationError = validateApplicationIconFile(iconBlobForUpload);
      if (validationError) {
        setError(validationError);
        setIsSaving(false);
        return;
      }

      const iconNameToUse = String(newIconName || trimmedName).trim();
      const iconId = toSafeDocId(iconNameToUse, 'app_icon');
      const exists = await getApplicationIconById(tenantId, iconId);
      if (!exists.ok) {
        setError(exists.error || 'Failed to validate icon name.');
        setIsSaving(false);
        return;
      }
      if (exists.exists) {
        setError('Icon name already exists. Use a different icon name.');
        setIsSaving(false);
        return;
      }

      const uploadRes = await uploadApplicationIconAsset({
        tenantId,
        iconId,
        fileBlob: iconBlobForUpload,
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
          iconName: iconNameToUse,
          iconUrl: uploadRes.iconUrl,
          createdBy: user.uid,
        },
        { isCreate: true },
      );
      if (!saveIconRes.ok) {
        setError(saveIconRes.error || 'Failed to save icon library entry.');
        setIsSaving(false);
        return;
      }

      await createSyncEvent({
        tenantId,
        eventType: 'create',
        entityType: 'applicationIcon',
        entityId: iconId,
        changedFields: ['iconName', 'iconUrl', 'createdBy'],
        createdBy: user.uid,
      });

      resolvedIconId = iconId;
    }

    const templateId = toSafeDocId(trimmedName, 'svc_tpl');
    const existingTemplatesRes = await fetchServiceTemplates(tenantId);
    if (!existingTemplatesRes.ok) {
      setError(existingTemplatesRes.error || 'Failed to validate application uniqueness.');
      setIsSaving(false);
      return;
    }

    const duplicateRow = findServiceTemplateNameConflict(existingTemplatesRes.rows || [], trimmedName);
    if (duplicateRow) {
      setError('Another application already uses this name variant (case/space). Choose a unique name.');
      setIsSaving(false);
      return;
    }

    const payload = {
      ...buildServiceTemplatePayload(
        { ...draft, iconId: resolvedIconId },
        { createdBy: user.uid, editing: false },
      ),
      iconId: resolvedIconId,
    };

    const res = await upsertServiceTemplate(tenantId, templateId, payload);
    if (!res.ok) {
      setError(res.error || 'Failed to create template.');
      setIsSaving(false);
      return;
    }

    await createSyncEvent({
      tenantId,
      eventType: 'create',
      entityType: 'serviceTemplate',
      entityId: templateId,
      changedFields: Object.keys(payload),
      createdBy: user.uid,
    });

    const createdTemplate = {
      id: templateId,
      ...payload,
    };
    resetState();
    onCreated?.(createdTemplate);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-sky-500/40 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/35 bg-sky-500/15 text-sky-300">
              <ImageIcon strokeWidth={1.5} className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-widest text-sky-300 uppercase">Application Studio</p>
              <p className="text-xs text-slate-400">Create reusable application without leaving this page.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-slate-600 bg-slate-800 p-2 text-slate-300 transition hover:text-white"
            aria-label="Close quick add"
          >
            <X strokeWidth={1.5} className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <ServiceTemplateEditor
            draft={draft}
            onDraftChange={setDraft}
            icons={icons}
            onSubmit={handleSubmit}
            onCancel={handleClose}
            isSaving={isSaving}
            error={error}
            submitLabel={isSaving ? 'Saving...' : 'Save Application'}
            showCancel
            tone="modal"
            wrapInForm={false}
          >
            <label className="text-xs font-bold uppercase tracking-widest text-slate-300">
              Upload New Icon (Optional)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="compact-field mt-1 w-full rounded-xl border border-slate-500/40 bg-slate-700/60 px-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  event.target.value = '';
                  if (!file) return;
                  const fileValidationError = validateApplicationIconFile(file);
                  if (fileValidationError) {
                    setError(fileValidationError);
                    return;
                  }
                  const objectUrl = URL.createObjectURL(file);
                  if (newIconRawUrl && newIconRawUrl.startsWith('blob:')) URL.revokeObjectURL(newIconRawUrl);
                  setNewIconFile(file);
                  setNewIconRawUrl(objectUrl);
                  setNewIconZoom(1);
                  setNewIconRotation(0);
                  setNewIconFilter('natural');
                  setNewIconCropPixels(null);
                  setError('');
                }}
              />
            </label>

            {newIconRawUrl ? (
              <div className="mt-4">
                <ImageStudio
                  sourceUrl={newIconRawUrl}
                  onReset={() => {
                    if (newIconRawUrl && newIconRawUrl.startsWith('blob:')) URL.revokeObjectURL(newIconRawUrl);
                    setNewIconFile(null);
                    setNewIconRawUrl('');
                    setNewIconCropPixels(null);
                    setNewIconZoom(1);
                    setNewIconRotation(0);
                    setNewIconFilter('natural');
                  }}
                  onFileChange={() => { }}
                  onCropComplete={(_, pixels) => setNewIconCropPixels(pixels)}
                  zoom={newIconZoom}
                  setZoom={setNewIconZoom}
                  rotation={newIconRotation}
                  setRotation={setNewIconRotation}
                  filter={newIconFilter}
                  setFilter={setNewIconFilter}
                  filterMap={{ natural: { label: 'Natural' } }}
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

            {newIconFile ? (
              <label className="mt-4 block text-xs font-bold uppercase tracking-widest text-slate-300">
                New Icon Name (Required for Upload)
                <InputActionField
                  className="mt-1"
                  value={newIconName}
                  onValueChange={setNewIconName}
                  placeholder={`Default: ${String(draft.name || '').trim() || 'Application Name'}`}
                  showPasteButton={false}
                />
              </label>
            ) : null}
          </ServiceTemplateEditor>
        </form>
      </div>
    </div>
  );
};

export default QuickAddServiceTemplateModal;

