import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import {
  Building2,
  Trash2,
  Share2,
  Banknote,
  Image as ImageIcon,
  CheckCircle2,
  Plus,
  X,
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import { useAuth } from '../../context/useAuth';
import { useTenant } from '../../context/useTenant';
import { getTenantSettingDoc, upsertTenantSettingDoc } from '../../lib/backendStore';
import { createSyncEvent } from '../../lib/syncEvents';
import { uploadBrandLogoAsset } from '../../lib/brandLogoStorage';
import { getCroppedImg } from '../../lib/imageStudioUtils';
import SettingCard from './SettingCard';
import InputActionField from '../common/InputActionField';

// 1. DATA INTEGRITY - Recursive cleanPayload helper
const cleanPayload = (data) => {
  if (Array.isArray(data)) {
    return data
      .map((v) => (typeof v === 'object' && v !== null ? cleanPayload(v) : v))
      .filter((v) => v !== '' && v !== null && v !== undefined);
  }
  if (typeof data === 'object' && data !== null) {
    return Object.fromEntries(
      Object.entries(data)
        .map(([k, v]) => [k, typeof v === 'object' && v !== null ? cleanPayload(v) : v])
        .filter((entry) => entry[1] !== '' && entry[1] !== null && entry[1] !== undefined)
    );
  }
  return data;
};

// Toggle Switch Component (40px width)
const ToggleSwitch = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? 'bg-(--c-accent)' : 'bg-(--c-muted)/30'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-[1.125rem] w-[1.125rem] transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-[16px]' : 'translate-x-0'
      }`}
    />
  </button>
);

// SOCIAL PLATFORMS LIST
const SOCIAL_OPTIONS = ['Instagram', 'Facebook', 'X (Twitter)', 'LinkedIn', 'TikTok', 'WhatsApp UAE'];

// Zod schema aligned with 'No Rubbish' rule (all optional/nullable to prevent crash)
const BrandingSchema = z.object({
  companyName: z.string().min(1, 'Company Name is mandatory.').optional().nullable(),
  brandName: z.string().optional().nullable(),
  isBankDetailsEnabled: z.boolean().optional().nullable(),
  mobiles: z.array(z.string()).optional().nullable(),
  addresses: z.array(z.string()).optional().nullable(),
  emails: z.array(z.string()).optional().nullable(),
  bankDetails: z
    .array(
      z.object({
        accountNumber: z.string().optional().nullable(),
        iban: z.string().optional().nullable(),
        bankName: z.string().optional().nullable(),
        accountName: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  socials: z
    .array(
      z.object({
        platform: z.string().optional().nullable(),
        handle: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  activeLogoUrl: z.string().optional().nullable(),
  logo1Url: z.string().optional().nullable(),
  logo2Url: z.string().optional().nullable(),
  activeLogoSlot: z.number().optional().nullable(),
});

const BrandingSovereign = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();

  const [form, setForm] = useState({
    companyName: '',
    brandName: '',
    isBankDetailsEnabled: false,
    mobiles: [''],
    addresses: [''],
    emails: [''],
    bankDetails: [{ accountNumber: '', iban: '', bankName: '', accountName: '' }],
    socials: [{ platform: 'Instagram', handle: '' }],
  });

  const [logos, setLogos] = useState({
    1: { url: '', file: null },
    2: { url: '', file: null },
  });
  const [activeLogoSlot, setActiveLogoSlot] = useState(1);

  const [errors, setErrors] = useState({});
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Logo Cropper State
  const [editorState, setEditorState] = useState({
    isOpen: false,
    slotId: null,
    sourceUrl: '',
    zoom: 1,
    cropPosition: { x: 0, y: 0 },
    croppedAreaPixels: null,
  });

  useEffect(() => {
    let active = true;
    getTenantSettingDoc(tenantId, 'branding').then((result) => {
      if (!active || !result.ok || !result.data) return;
      const d = result.data;
      setForm((prev) => ({
        ...prev,
        companyName: d.companyName || '',
        brandName: d.brandName || '',
        isBankDetailsEnabled: d.isBankDetailsEnabled || false,
        mobiles: d.mobiles?.length ? d.mobiles : [''],
        addresses: d.addresses?.length ? d.addresses : [''],
        emails: d.emails?.length ? d.emails : [''],
        bankDetails: d.bankDetails?.length
          ? d.bankDetails
          : [{ accountNumber: '', iban: '', bankName: '', accountName: '' }],
        socials: d.socials?.length ? d.socials : [{ platform: 'Instagram', handle: '' }],
      }));
      setLogos({
        1: { url: d.logo1Url || '', file: null },
        2: { url: d.logo2Url || '', file: null },
      });
      setActiveLogoSlot(d.activeLogoSlot || 1);
    });
    return () => {
      active = false;
    };
  }, [tenantId]);

  const updateField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleArrayChange = (key, idx, val) => {
    setForm((p) => {
      const arr = [...p[key]];
      arr[idx] = val;
      return { ...p, [key]: arr };
    });
  };

  const handleBankChange = (idx, field, val) => {
    setForm((p) => {
      const next = [...p.bankDetails];
      next[idx] = { ...next[idx], [field]: val };
      return { ...p, bankDetails: next };
    });
  };

  const handleSocialChange = (idx, field, val) => {
    setForm((p) => {
      const next = [...p.socials];
      next[idx] = { ...next[idx], [field]: val };
      return { ...p, socials: next };
    });
  };

  const canAddBank = () => {
    const last = form.bankDetails[form.bankDetails.length - 1];
    return last && last.accountNumber && last.iban && last.bankName && last.accountName;
  };

  const canAddSocial = () => {
    const last = form.socials[form.socials.length - 1];
    return last && last.platform && last.handle;
  };

  // 3. GOOGLE-STYLE LOGO CROPPER Logic
  const openEditor = (slotId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const src = URL.createObjectURL(file);
    setEditorState({
      isOpen: true,
      slotId,
      sourceUrl: src,
      zoom: 1,
      cropPosition: { x: 0, y: 0 },
      croppedAreaPixels: null,
    });
  };

  const applyCrop = async () => {
    if (!editorState.croppedAreaPixels || !editorState.sourceUrl) return;
    try {
      const blob = await getCroppedImg(editorState.sourceUrl, editorState.croppedAreaPixels, 0);
      const url = URL.createObjectURL(blob);
      setLogos((p) => ({
        ...p,
        [editorState.slotId]: { url, file: blob },
      }));
      setEditorState({ isOpen: false, slotId: null, sourceUrl: '', zoom: 1, cropPosition: { x: 0, y: 0 }, croppedAreaPixels: null });
    } catch (e) {
      console.error(e);
    }
  };

  const onSave = async () => {
    setIsSaving(true);
    setErrors({});
    
    // 5. VALIDATION SCHEMA - Check mandatory fields manually to prevent schema bloat
    const localErrors = {};
    if (!form.companyName?.trim()) localErrors.companyName = 'Company name is mandatory.';
    if (!form.mobiles[0]?.trim()) localErrors.mobiles = 'At least one mobile is mandatory.';
    if (!form.addresses[0]?.trim()) localErrors.addresses = 'At least one address is mandatory.';
    if (!form.emails[0]?.trim()) localErrors.emails = 'At least one email is mandatory.';
    
    // Validate schema
    const parsed = BrandingSchema.safeParse(form);
    if (!parsed.success || Object.keys(localErrors).length > 0) {
      setErrors({ ...localErrors });
      setSaveMessage('Fix validation errors.');
      setIsSaving(false);
      return;
    }

    // Upload logos if there are new files
    let logo1Final = logos[1].url;
    let logo2Final = logos[2].url;

    if (logos[1].file) {
      const r1 = await uploadBrandLogoAsset({ tenantId, slotId: 'logo_1', fileBlob: logos[1].file });
      if (r1.ok) logo1Final = r1.url;
    }
    if (logos[2].file) {
      const r2 = await uploadBrandLogoAsset({ tenantId, slotId: 'logo_2', fileBlob: logos[2].file });
      if (r2.ok) logo2Final = r2.url;
    }

    const rawPayload = {
      ...form,
      logo1Url: logo1Final,
      logo2Url: logo2Final,
      activeLogoSlot,
      activeLogoUrl: activeLogoSlot === 1 ? logo1Final : logo2Final,
      updatedBy: user.uid,
    };

    // ALL writes MUST be wrapped in cleanPayload helper to remove empty/null values
    const cleanedPayload = cleanPayload(rawPayload);

    const write = await upsertTenantSettingDoc(tenantId, 'branding', cleanedPayload);
    if (!write.ok) {
      setSaveMessage('Save failed.');
    } else {
      setSaveMessage('Branding protocols preserved.');
      await createSyncEvent({
        tenantId,
        eventType: 'update',
        entityType: 'settingsBranding',
        entityId: 'branding',
        changedFields: Object.keys(cleanedPayload),
        createdBy: user.uid,
      });
    }
    setIsSaving(false);
  };

  const labelClass = 'text-[10px] font-bold uppercase tracking-widest text-(--c-muted)';

  return (
    <div className="space-y-6">
      <SettingCard
        title="Sovereign Brand Identity"
        description="Maintain zero-drift compliance by managing strict, high-fidelity brand points."
        icon={Building2}
      >
        <div className="space-y-8">
          {/* COMPANY INFO */}
          <section>
            <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-(--c-accent)">
              <Building2 className="h-4 w-4" /> Company Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* COMPANY NAME: Text-lg, font-bold, col-span-2. Auto-capitalize. give it 2x space */}
              <div className="col-span-1 md:col-span-2 space-y-1">
                <label className={labelClass}>Company Name *</label>
                <InputActionField
                  value={form.companyName}
                  onValueChange={(v) => updateField('companyName', v)}
                  forceUppercase
                  className="font-bold text-lg [&>input]:text-lg"
                  placeholder="AUTHORITY CORP LLC"
                />
                {errors.companyName && <p className="text-[10px] text-rose-500">{errors.companyName}</p>}
              </div>

              <div className="col-span-1 space-y-1">
                <label className={labelClass}>Brand Name</label>
                <InputActionField
                  value={form.brandName}
                  onValueChange={(v) => updateField('brandName', v)}
                  forceUppercase
                  className="font-bold text-lg [&>input]:text-lg"
                  placeholder="SHORT NAME"
                />
              </div>

              <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Primary Mobile *</label>
                  <InputActionField
                    value={form.mobiles[0] || ''}
                    onValueChange={(v) => handleArrayChange('mobiles', 0, v)}
                    maxLength={15}
                    inputMode="numeric"
                  />
                  {errors.mobiles && <p className="text-[10px] text-rose-500">{errors.mobiles}</p>}
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Official Email *</label>
                  <InputActionField
                    value={form.emails[0] || ''}
                    onValueChange={(v) => handleArrayChange('emails', 0, v.toLowerCase())}
                  />
                  {errors.emails && <p className="text-[10px] text-rose-500">{errors.emails}</p>}
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>HQ Address *</label>
                  <InputActionField
                    value={form.addresses[0] || ''}
                    onValueChange={(v) => handleArrayChange('addresses', 0, v)}
                  />
                  {errors.addresses && <p className="text-[10px] text-rose-500">{errors.addresses}</p>}
                </div>
              </div>
            </div>
          </section>

          {/* LOGO STUDIO */}
          <section>
            <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-(--c-accent)">
              <ImageIcon className="h-4 w-4" /> Logo Studio
            </h3>
            <div className="flex flex-wrap gap-4">
              {/* LOGO 1 */}
              <div
                className={`flex w-40 flex-col gap-2 rounded-2xl border-2 p-3 transition ${
                  activeLogoSlot === 1 ? 'border-(--c-accent) bg-(--c-accent)/5' : 'border-(--c-border)'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-(--c-muted)">LOGO 1</span>
                  {logos[1].url && activeLogoSlot !== 1 && (
                    <button onClick={() => setActiveLogoSlot(1)}>
                      <CheckCircle2 className="h-4 w-4 text-(--c-muted) hover:text-(--c-text)" />
                    </button>
                  )}
                  {activeLogoSlot === 1 && <CheckCircle2 className="h-4 w-4 text-(--c-accent)" />}
                </div>
                <label className="flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-(--c-border) bg-(--c-surface) hover:bg-(--c-panel)">
                  {logos[1].url ? (
                    <img src={logos[1].url} alt="L1" className="h-full w-full object-contain p-2" />
                  ) : (
                    <Plus className="h-6 w-6 text-(--c-muted)" />
                  )}
                  <input type="file" hidden accept="image/*" onChange={(e) => openEditor(1, e)} />
                </label>
              </div>

              {/* LOGO 2 - MUTUALLY EXCLUSIVE. ONLY SHOW PLUS IF LOGO 1 EXISTS */}
              {logos[1].url && (
                <div
                  className={`flex w-40 flex-col gap-2 rounded-2xl border-2 p-3 transition ${
                    activeLogoSlot === 2 ? 'border-(--c-accent) bg-(--c-accent)/5' : 'border-(--c-border)'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-(--c-muted)">LOGO 2</span>
                    {logos[2].url && activeLogoSlot !== 2 && (
                      <button onClick={() => setActiveLogoSlot(2)}>
                        <CheckCircle2 className="h-4 w-4 text-(--c-muted) hover:text-(--c-text)" />
                      </button>
                    )}
                    {activeLogoSlot === 2 && <CheckCircle2 className="h-4 w-4 text-(--c-accent)" />}
                  </div>
                  <label className="flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-(--c-border) bg-(--c-surface) hover:bg-(--c-panel)">
                    {logos[2].url ? (
                      <img src={logos[2].url} alt="L2" className="h-full w-full object-contain p-2" />
                    ) : (
                      <Plus className="h-6 w-6 text-(--c-muted)" />
                    )}
                    <input type="file" hidden accept="image/*" onChange={(e) => openEditor(2, e)} />
                  </label>
                  {logos[2].url && (
                    <button
                      className="mt-1 flex items-center justify-center text-[10px] text-rose-500 hover:underline"
                      onClick={() => {
                        setLogos((p) => ({ ...p, 2: { url: '', file: null } }));
                        setActiveLogoSlot(1);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="mt-2 text-[10px] font-semibold text-(--c-muted)">
              Upload high-quality squares. Ticking a logo makes it the mutually exclusive active logo for all outputs.
            </p>
          </section>

          {/* BANK MANDATE */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-(--c-accent)">
                <Banknote className="h-4 w-4" /> Bank Mandate
              </h3>
              <ToggleSwitch
                checked={form.isBankDetailsEnabled}
                onChange={(v) => updateField('isBankDetailsEnabled', v)}
              />
            </div>
            {form.isBankDetailsEnabled && (
              <div className="space-y-4">
                {form.bankDetails.map((b, i) => (
                  <div key={i} className="rounded-2xl border border-(--c-border) bg-(--c-panel) p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className={labelClass}>Bank Name *</label>
                        <InputActionField value={b.bankName} onValueChange={(v) => handleBankChange(i, 'bankName', v)} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelClass}>Account Name *</label>
                        <InputActionField value={b.accountName} onValueChange={(v) => handleBankChange(i, 'accountName', v)} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelClass}>Account Number *</label>
                        <InputActionField value={b.accountNumber} onValueChange={(v) => handleBankChange(i, 'accountNumber', v)} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelClass}>IBAN *</label>
                        <InputActionField value={b.iban} onValueChange={(v) => handleBankChange(i, 'iban', v.toUpperCase())} forceUppercase />
                      </div>
                    </div>
                  </div>
                ))}
                {canAddBank() && (
                  <button
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        bankDetails: [...p.bankDetails, { accountNumber: '', iban: '', bankName: '', accountName: '' }],
                      }))
                    }
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-(--c-border) text-xs font-bold text-(--c-muted) hover:bg-(--c-surface) hover:text-(--c-text)"
                  >
                    <Plus className="h-4 w-4" /> Add Next Bank
                  </button>
                )}
              </div>
            )}
          </section>

          {/* SOCIAL MEDIA */}
          <section>
            <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-(--c-accent)">
              <Share2 className="h-4 w-4" /> Social Protocol
            </h3>
            <div className="space-y-3">
              {form.socials.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={s.platform}
                    onChange={(e) => handleSocialChange(i, 'platform', e.target.value)}
                    className="h-14 rounded-2xl border border-(--c-border) bg-(--c-panel) px-4 text-sm font-semibold text-(--c-text) outline-none"
                  >
                    {SOCIAL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <div className="flex-1">
                    <InputActionField value={s.handle} onValueChange={(v) => handleSocialChange(i, 'handle', v)} placeholder="@handle or URL" />
                  </div>
                  {form.socials.length > 1 && (
                    <button
                      onClick={() =>
                        setForm((p) => ({ ...p, socials: p.socials.filter((_, idx) => idx !== i) }))
                      }
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-(--c-border) hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {canAddSocial() && (
                <button
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      socials: [...p.socials, { platform: 'Instagram', handle: '' }],
                    }))
                  }
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-(--c-border) text-xs font-bold text-(--c-muted) hover:bg-(--c-surface) hover:text-(--c-text)"
                >
                  <Plus className="h-4 w-4" /> Add Next Social
                </button>
              )}
            </div>
          </section>

          <div className="flex items-center gap-4 border-t border-(--c-border) pt-6">
            <button
              onClick={onSave}
              disabled={isSaving}
              className="rounded-2xl bg-(--c-accent) px-8 py-3.5 text-sm font-black text-white shadow-xl hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? 'ENCRYPTING...' : 'COMMIT BRAND PROTOCOL'}
            </button>
            <span className="text-xs font-bold text-(--c-muted)">{saveMessage}</span>
          </div>
        </div>
      </SettingCard>

      {/* Editor Modal for Image Crop */}
      {editorState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0e12] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/5 p-4">
              <span className="text-xs font-bold uppercase tracking-widest text-white">SQUARE CROP 1:1</span>
              <button
                onClick={() => setEditorState((p) => ({ ...p, isOpen: false, sourceUrl: '' }))}
                className="text-white/40 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative h-64 w-full bg-black">
              <Cropper
                image={editorState.sourceUrl}
                crop={editorState.cropPosition}
                zoom={editorState.zoom}
                aspect={1}
                onCropChange={(pos) => setEditorState((p) => ({ ...p, cropPosition: pos }))}
                onZoomChange={(zoom) => setEditorState((p) => ({ ...p, zoom }))}
                onCropComplete={(_, croppedAreaPixels) =>
                  setEditorState((p) => ({ ...p, croppedAreaPixels }))
                }
              />
            </div>
            <div className="flex items-center gap-3 border-t border-white/5 bg-white/5 p-4">
              <span className="text-[10px] font-bold uppercase text-white/50">ZOOM</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={editorState.zoom}
                onChange={(e) => setEditorState((p) => ({ ...p, zoom: Number(e.target.value) }))}
                className="flex-1 accent-(--c-accent)"
              />
            </div>
            <div className="p-4 pt-0">
              <button
                onClick={applyCrop}
                className="w-full rounded-2xl bg-(--c-accent) py-3 text-xs font-black uppercase text-white shadow-xl transition-transform active:scale-95"
              >
                CONFIRM MANDATE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandingSovereign;
