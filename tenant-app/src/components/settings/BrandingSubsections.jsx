import React from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { Building2, Plus, Trash2, Share2, Banknote, Image, MessageSquare, Facebook, Instagram, Twitter, Linkedin, Layout, Library, ChevronDown, Phone, Mail, MapPin, X } from 'lucide-react';
import IconSelect from '../common/IconSelect';
import InputActionField from '../common/InputActionField';
import EmirateSelect from '../common/EmirateSelect';
import MobileContactsField from '../common/MobileContactsField';
import AddressField from '../common/AddressField';
import CountryPhoneField from '../common/CountryPhoneField';
import EmailContactsField from '../common/EmailContactsField';

export const WhatsAppIcon = ({ className }) => (
  <svg
    viewBox="0 0 16 16"
    fill="currentColor"
    className={`${className || ''} overflow-visible`}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M13.601 2.326A7.854 7.854 0 0 0 8.034 0C3.641 0 .067 3.574.065 7.965A7.902 7.902 0 0 0 1.141 12L0 16l4.111-1.074a7.9 7.9 0 0 0 3.923 1.007h.003c4.393 0 7.967-3.573 7.968-7.965a7.9 7.9 0 0 0-2.404-5.642zM8.037 14.54h-.003a6.49 6.49 0 0 1-3.312-.908l-.237-.14-2.438.637.651-2.373-.154-.243a6.51 6.51 0 0 1-1.007-3.496C1.539 4.43 4.459 1.51 8.038 1.51c1.73 0 3.356.674 4.578 1.896a6.44 6.44 0 0 1 1.895 4.576c-.002 3.58-2.922 6.498-6.474 6.498z" />
    <path d="M11.615 9.401c-.196-.098-1.16-.572-1.34-.638-.18-.066-.312-.098-.443.098-.131.196-.508.638-.623.77-.115.131-.23.147-.426.049-.195-.098-.824-.304-1.57-.97-.58-.517-.972-1.156-1.087-1.352-.115-.196-.012-.302.086-.4.088-.087.196-.23.295-.345.098-.114.131-.196.196-.327.066-.131.033-.245-.016-.344-.05-.098-.443-1.068-.607-1.463-.16-.386-.322-.333-.442-.339l-.377-.007a.727.727 0 0 0-.525.245c-.18.196-.689.672-.689 1.639s.705 1.902.803 2.033c.098.131 1.388 2.12 3.363 2.971.47.203.837.324 1.123.414.472.151.902.13 1.242.079.379-.057 1.16-.474 1.324-.932.163-.458.163-.85.114-.932-.05-.082-.18-.131-.377-.229z" />
  </svg>
);

export const CompanyInfoSection = React.memo(({ 
  form, 
  errors, 
  updateField, 
  addArrayField, 
  removeArrayField, 
  handlePhoneArrayChange, 
  updateMobileContacts,
  handlePoBoxChange, 
  updateArrayField,
  poBoxDisabled,
  labelClass,
  inputClass
}) => (
  <section className="space-y-3">
    <div className="flex items-center gap-2 border-b border-(--c-border) pb-2 text-(--c-accent)">
      <Building2 strokeWidth={1.5} className="h-5 w-5" />
      <span className="text-sm font-bold uppercase tracking-wider text-(--c-text)">Company Information</span>
    </div>
    
    <div className="auto-fit-grid">
      <label className={labelClass}>
        Company Name
        <input
          className={inputClass}
          value={form.companyName}
          onChange={(event) => updateField('companyName', event.target.value.toUpperCase())}
          placeholder="COMPANY NAME"
        />
        {errors.companyName ? <p className="mt-1 text-xs text-rose-600">{errors.companyName}</p> : null}
      </label>

      <label className={labelClass}>
        Brand Name (Short)
        <input
          className={inputClass}
          value={form.brandName}
          onChange={(event) => updateField('brandName', event.target.value.toUpperCase())}
          placeholder="BRAND NAME"
        />
        {errors.brandName ? <p className="mt-1 text-xs text-rose-600">{errors.brandName}</p> : null}
      </label>

      <div className="auto-fit-span-full">
        <label className="flex items-center gap-3 p-4 rounded-2xl bg-(--c-panel) border border-(--c-border) cursor-pointer transition hover:bg-(--c-surface)">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-(--c-accent)/10 text-(--c-accent)">
            <MapPin strokeWidth={1.5} className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-(--c-text)">Branding Address Source</p>
            <p className="text-[10px] text-(--c-muted)">Choose if PDFs use the tenant profile address or a custom branding address.</p>
          </div>
          <select 
            value={form.addressSource || 'tenant'} 
            onChange={(e) => updateField('addressSource', e.target.value)}
            className="rounded-xl bg-(--c-surface) border border-(--c-border) px-4 py-2 text-xs font-bold text-(--c-text) outline-none focus:ring-2 focus:ring-(--c-accent)/20 transition"
          >
            <option value="tenant">Tenant Profile</option>
            <option value="custom">Brand Specific Address</option>
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={labelClass}>Landline Numbers</span>
        </div>
        <div className="space-y-2.5">
          {form.landlines.map((val, idx) => {
            const isLast = idx === form.landlines.length - 1;
            const hasValue = String(val || '').trim().length > 0;
            const canAppend = isLast && hasValue;
            return (
              <div key={`landline-${idx}`} className="flex items-stretch gap-2">
                <div className="flex-1">
                  <CountryPhoneField
                    countryIso2="ae"
                    value={val}
                    onValueChange={(v) => handlePhoneArrayChange('landlines', idx, v)}
                    placeholder="4xxxxxxx"
                    onAppend={canAppend ? () => addArrayField('landlines') : undefined}
                  />
                </div>
                {idx > 0 && (
                  <button 
                    type="button" 
                    onClick={() => removeArrayField('landlines', idx)} 
                    className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-2xl bg-[var(--c-surface)] text-[var(--c-muted)] transition-all duration-300 hover:bg-rose-500/10 hover:text-rose-400 border border-[var(--c-border)]"
                  >
                    <Trash2 strokeWidth={1.5} className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {errors.phones ? <p className="mt-1 text-xs text-rose-600 font-bold uppercase">{errors.phones}</p> : null}
      </div>

      <MobileContactsField
        label="Mobile Numbers"
        contacts={form.mobileContacts}
        onChange={updateMobileContacts}
        className="flex flex-col gap-2"
      />

      <div className="auto-fit-span-full flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={labelClass}>Company Addresses</span>
              <button type="button" onClick={() => addArrayField('addresses')} className="text-xs font-semibold text-(--c-accent) hover:underline flex items-center gap-1">
                <Plus strokeWidth={1.5} className="w-3 h-3" /> Add Address
              </button>
            </div>
        <div className="space-y-3">
          {form.addresses.map((val, idx) => (
            <div key={`address-${idx}`} className="flex items-stretch gap-2">
              <div className="flex-1">
                <AddressField
                  label={idx === 0 ? "Primary Address" : `Secondary Address ${idx}`}
                  value={val}
                  onValueChange={(v) => updateArrayField('addresses', idx, v)}
                  placeholder="Building, Street, Area..."
                  fieldClassName="h-[72px]"
                />
              </div>
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => removeArrayField('addresses', idx)}
                  className="flex h-[72px] w-[56px] mt-6 shrink-0 items-center justify-center rounded-2xl bg-[var(--c-surface)] text-[var(--c-muted)] transition-all duration-300 hover:bg-rose-500/10 hover:text-rose-400 border border-[var(--c-border)]"
                >
                  <Trash2 strokeWidth={1.5} className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelClass}>Operating Emirate</span>
        <div className="mt-1">
          <EmirateSelect
            value={form.emirate}
            onChange={(val) => updateField('emirate', val)}
            placeholder="Select Emirate"
          />
        </div>
      </div>

      <label className={labelClass}>
        P.O. Box Number
        <input
          className={inputClass}
          value={form.poBoxNumber}
          onChange={(event) => handlePoBoxChange(event.target.value)}
          inputMode="numeric"
          maxLength={8}
          placeholder="Digits only"
        />
        {errors.poBoxNumber ? <p className="mt-1 text-xs text-rose-600 font-bold uppercase">{errors.poBoxNumber}</p> : null}
      </label>

      <div className="flex flex-col gap-1">
        <span className={labelClass}>P.O. Box Emirate</span>
        <div className="mt-1">
          <EmirateSelect
            value={form.poBoxEmirate}
            onChange={(val) => updateField('poBoxEmirate', val)}
            placeholder="Select Emirate"
            disabled={poBoxDisabled}
          />
        </div>
      </div>

      <div className="auto-fit-span-full">
        <EmailContactsField
          label="Official Email Addresses"
          contacts={form.emails}
          onChange={(contacts) => updateField('emails', contacts)}
        />
      </div>

      <label className={labelClass}>
        Web Address
        <InputActionField
          value={form.webAddress}
          onValueChange={(val) => updateField('webAddress', val.toLowerCase())}
          placeholder="www.example.com"
          showPasteButton
          className="mt-1"
        />
      </label>

      <label className={`${labelClass} auto-fit-span-full`}>
        Google Maps Location Pin (URL)
        <div className="mt-1 flex items-center gap-2">
          <InputActionField
            value={form.locationPin}
            onValueChange={(val) => updateField('locationPin', val)}
            placeholder="https://maps.google.com/..."
            showPasteButton
            className="flex-1"
          />
          {form.locationPin && (
            <button
              type="button"
              onClick={() => {
                window.open(form.locationPin, 'MapTest', 'width=1000,height=800,menubar=no,status=no,toolbar=no,location=no,resizable=yes');
              }}
              className="whitespace-nowrap rounded-2xl bg-(--c-accent)/12 px-3 py-2 text-xs font-bold text-(--c-accent) transition hover:bg-(--c-accent)/18"
            >
              Test Pin
            </button>
          )}
        </div>
        <p className="mt-1 text-[10px] text-(--c-muted)">
          Paste the Google Maps "Share" link or "Plus Code" here for future reference.
        </p>
      </label>
    </div>
  </section>
));

CompanyInfoSection.displayName = 'CompanyInfoSection';

export const SocialMediaSection = React.memo(({ 
  activeSocialKeys, 
  form, 
  updateField, 
  addSocialPlatform,
  removeSocialPlatform, 
  changeSocialPlatform,
  socialPlatforms
}) => (
  <section className="space-y-4">
    <div className="flex items-center justify-between gap-2 border-b border-(--c-border) pb-2 text-(--c-accent)">
      <div className="flex items-center gap-2">
        <Share2 strokeWidth={1.5} className="h-5 w-5" />
        <span className="text-sm font-bold uppercase tracking-wider text-(--c-text)">Social Media</span>
      </div>
      {activeSocialKeys.length < socialPlatforms.length ? (
        <button
          type="button"
          onClick={addSocialPlatform}
          className="flex items-center gap-1.5 rounded-lg bg-(--c-accent)/10 px-3 py-1.5 text-xs font-bold text-(--c-accent) transition hover:bg-(--c-accent)/20"
        >
          <Plus strokeWidth={1.5} className="h-3.5 w-3.5" />
          Add Link
        </button>
      ) : null}
    </div>
    
    <div className="rounded-xl border border-(--c-border) bg-(--c-panel) p-4">
      <div className="auto-fit-grid-compact">
        {activeSocialKeys.map((key) => {
          const platform = socialPlatforms.find(p => p.key === key);
          const availableOptions = socialPlatforms.filter(p => p.key === key || !activeSocialKeys.includes(p.key)).map(p => ({
            value: p.key,
            label: p.label,
            icon: p.icon
          }));

          return (
          <div key={key} className="flex min-w-0 flex-col gap-3 rounded-xl border border-(--c-border) bg-(--c-surface) p-4 shadow-sm transition hover:shadow-md">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <IconSelect
                    value={key}
                    onChange={(newKey) => {
                      if (newKey === key) return;
                      changeSocialPlatform(key, newKey);
                    }}
                    options={availableOptions}
                    className="!border-none !bg-transparent !shadow-none !rounded-none !p-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeSocialPlatform(key)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--c-panel) text-(--c-muted) border border-(--c-border) hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 transition shadow-sm"
                  title="Remove link"
                >
                  <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-(--c-muted) opacity-70">
                  {platform?.label} Link
                </label>
                <input
                  className="w-full rounded-xl border border-(--c-border)/60 bg-(--c-panel) px-4 py-3 text-sm text-(--c-text) outline-none focus:border-(--c-accent) focus:ring-4 focus:ring-(--c-accent)/10 transition placeholder:text-(--c-muted)/30 font-medium"
                  value={form[key]}
                  onChange={(event) => updateField(key, event.target.value.toLowerCase())}
                  placeholder={`https://...`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </section>
));

SocialMediaSection.displayName = 'SocialMediaSection';

export const BankDetailsSection = React.memo(({ 
  form, 
  errors, 
  updateBankDetailField,
  addBankDetail,
  removeBankDetail,
  labelClass
}) => (
  <section className="space-y-4">
    <div className="flex items-center justify-between gap-2 border-b border-(--c-border) pb-2 text-(--c-accent)">
      <div className="flex items-center gap-2">
        <Banknote strokeWidth={1.5} className="h-5 w-5" />
        <span className="text-sm font-bold uppercase tracking-wider text-(--c-text)">Bank Details</span>
      </div>
      <button
        type="button"
        onClick={addBankDetail}
        className="flex items-center gap-1.5 rounded-lg bg-(--c-accent)/10 px-3 py-1.5 text-xs font-bold text-(--c-accent) transition hover:bg-(--c-accent)/20"
        style={{ display: 'none' }}
      >
        <Plus strokeWidth={1.5} className="h-3.5 w-3.5" />
        Add Bank
      </button>
    </div>

    <div className="space-y-4">
      {(form.bankDetails || []).map((bank, index) => {
        const hasContent = [
          bank.bankName,
          bank.bankAccountName,
          bank.bankAccountNumber,
          bank.bankIban,
          bank.bankSwift,
          bank.bankBranch,
        ].some((v) => String(v || '').trim().length > 0);
        const isLast = index === (form.bankDetails || []).length - 1;
        return (
          <div key={`bank-${index}`} className="rounded-xl border border-(--c-border) bg-(--c-panel) p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-(--c-muted)">{index === 0 ? 'Bank' : `Bank ${index + 1}`}</p>
              {(form.bankDetails || []).length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeBankDetail(index)}
                  className="flex h-[32px] items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-500/20"
                >
                  <Trash2 strokeWidth={1.5} className="h-3.5 w-3.5" />
                  Remove
                </button>
              ) : null}
            </div>
            <div className="auto-fit-grid">
              <label className={labelClass}>
                Bank Name
                <InputActionField
                  value={bank.bankName || ''}
                  onValueChange={(val) => updateBankDetailField(index, 'bankName', val)}
                  placeholder="E.g., Emirates NBD"
                  showPasteButton
                  className="mt-1"
                />
              </label>
              <label className={labelClass}>
                Account Name
                <InputActionField
                  value={bank.bankAccountName || ''}
                  onValueChange={(val) => updateBankDetailField(index, 'bankAccountName', val)}
                  placeholder="E.g., ACIS AG AJMAN"
                  showPasteButton
                  className="mt-1"
                />
              </label>
              <label className={labelClass}>
                Account Number
                <InputActionField
                  value={bank.bankAccountNumber || ''}
                  onValueChange={(val) => updateBankDetailField(index, 'bankAccountNumber', val)}
                  placeholder="Digits only"
                  showPasteButton
                  className="mt-1"
                />
              </label>
              <label className={labelClass}>
                IBAN
                <InputActionField
                  value={bank.bankIban || ''}
                  onValueChange={(val) => updateBankDetailField(index, 'bankIban', val.toUpperCase())}
                  placeholder="AE..."
                  showPasteButton
                  className="mt-1"
                />
                {errors[`bankIban_${index}`] ? <p className="mt-1 text-xs text-rose-600">{errors[`bankIban_${index}`]}</p> : null}
              </label>
              <label className={labelClass}>
                SWIFT Code
                <InputActionField
                  value={bank.bankSwift || ''}
                  onValueChange={(val) => updateBankDetailField(index, 'bankSwift', val.toUpperCase())}
                  placeholder="BIC/SWIFT"
                  showPasteButton
                  className="mt-1"
                />
                {errors[`bankSwift_${index}`] ? <p className="mt-1 text-xs text-rose-600">{errors[`bankSwift_${index}`]}</p> : null}
              </label>
              <label className={labelClass}>
                Branch Name
                <InputActionField
                  value={bank.bankBranch || ''}
                  onValueChange={(val) => updateBankDetailField(index, 'bankBranch', val)}
                  placeholder="E.g., Ajman Main Branch"
                  showPasteButton
                  className="mt-1"
                />
              </label>
            </div>
            {isLast && hasContent ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={addBankDetail}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-(--c-accent) bg-(--c-accent)/10 px-3 py-2 text-[11px] font-bold text-(--c-accent) transition hover:bg-(--c-accent)/16"
                >
                  <Plus strokeWidth={1.5} className="h-3.5 w-3.5" />
                  Add Bank
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  </section>
));

BankDetailsSection.displayName = 'BankDetailsSection';

export const LogoLibrarySection = React.memo(({ 
  visibleLogoSlots, 
  logoErrors, 
  logoUploading, 
  openLogoEditor, 
  removeLogoSlot, 
  updateLogoSlot
}) => {
  return (
    <section className="space-y-4">
    <div className="flex items-center gap-2 border-b border-(--c-border) pb-2 text-(--c-accent)">
      <Library strokeWidth={1.5} className="h-5 w-5" />
      <span className="text-sm font-bold uppercase tracking-wider text-(--c-text)">Logo Library</span>
    </div>

    <div className="rounded-xl border border-(--c-border) bg-(--c-panel) p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs text-(--c-muted) underline decoration-dotted">Maintain a centralized library of branded logos (Standard size: 512x512px).</p>
        </div>
      </div>

      <div className="grid max-h-[240px] grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-2 overflow-y-auto pr-1">
        {visibleLogoSlots.map((slot, index) => {
          const previousSlot = index > 0 ? visibleLogoSlots[index - 1] : null;
          const canUploadThisSlot = index === 0 || Boolean(previousSlot?.url);

          return (
          <div key={slot.slotId} className="group relative overflow-hidden rounded-lg border border-(--c-border) bg-(--c-surface) p-2 shadow-sm transition hover:shadow-md">
            <div className="mb-2 flex h-16 items-center justify-center rounded-md border border-(--c-border)/50 bg-(--c-panel) font-bold text-(--c-muted) shadow-inner">
              {logoUploading[slot.slotId] ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--c-accent) border-t-transparent" />
                  <span className="text-[10px] font-bold tracking-tighter text-(--c-accent) uppercase">Uploading...</span>
                </div>
              ) : slot.url ? (
                <img src={slot.url} alt={slot.name} className="h-full w-full object-contain p-1" />
              ) : (
                <div className="flex flex-col items-center gap-1 opacity-40">
                  <Image strokeWidth={1.5} className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">No Logo</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <input
                className="w-full bg-transparent text-[10px] font-bold uppercase tracking-widest text-(--c-text) outline-none placeholder:text-(--c-muted)/30"
                value={slot.name}
                onChange={(e) => updateLogoSlot(slot.slotId, { name: e.target.value })}
                placeholder="LOGO NAME"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!canUploadThisSlot) return;
                    openLogoEditor(slot.slotId);
                  }}
                  disabled={!canUploadThisSlot}
                  title={!canUploadThisSlot ? 'Complete the previous slot first.' : (slot.url ? 'Change logo' : 'Upload logo')}
                  className="flex-1 rounded-md border border-(--c-border) bg-(--c-panel) py-1 text-[10px] font-bold uppercase tracking-tighter text-(--c-text) transition hover:bg-(--c-accent) hover:text-white hover:border-(--c-accent) shadow-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-(--c-panel) disabled:hover:text-(--c-text) disabled:hover:border-(--c-border)"
                >
                  {slot.url ? 'Change' : 'Upload'}
                </button>
                {slot.url && (
                  <button
                    type="button"
                    onClick={() => removeLogoSlot(slot.slotId)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-500/10 text-rose-500 transition hover:bg-rose-500 hover:text-white"
                  >
                    <Trash2 strokeWidth={1.5} className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {!canUploadThisSlot ? (
                <p className="text-[10px] font-semibold text-amber-500">Upload previous slot first.</p>
              ) : null}
            </div>
            {logoErrors[slot.slotId] && <p className="mt-2 text-[10px] font-bold text-rose-500 uppercase">{logoErrors[slot.slotId]}</p>}
          </div>
        );
        })}
      </div>
    </div>
  </section>
  );
});

LogoLibrarySection.displayName = 'LogoLibrarySection';

export const LogoUsageSection = React.memo(({ 
  logoUsage, 
  logoFunctions, 
  assignedOptions, 
  setLogoUsage
}) => (
  <section className="space-y-4">
    <div className="flex items-center gap-2 border-b border-(--c-border) pb-2 text-(--c-accent)">
      <Layout strokeWidth={1.5} className="h-5 w-5" />
      <span className="text-sm font-bold uppercase tracking-wider text-(--c-text)">Integration Mapping</span>
    </div>

    <div className="rounded-xl border border-(--c-border) bg-(--c-panel) p-4">
      <div className="mb-4">
        <p className="text-xs text-(--c-muted)">Assign your library logos to specific application features.</p>
      </div>

      <div className="auto-fit-grid-compact">
        {logoFunctions.map((func) => (
          <div key={func.key} className="flex flex-col gap-2 rounded-xl border border-(--c-border) bg-(--c-surface) p-3 shadow-sm transition hover:shadow-md">
            <span className="text-[10px] font-bold uppercase tracking-widest text-(--c-muted)">{func.label}</span>
            <div className="relative">
              <select
                className="w-full appearance-none rounded-lg border border-(--c-border) bg-(--c-panel) px-3 py-2 text-xs font-bold text-(--c-text) outline-none focus:ring-2 focus:ring-(--c-accent)/20 transition cursor-pointer pr-8"
                value={logoUsage[func.key] || 'logo_1'}
                onChange={(e) => setLogoUsage(prev => ({ ...prev, [func.key]: e.target.value }))}
              >
                {assignedOptions.map(opt => (
                  <option key={opt.slotId} value={opt.slotId}>{opt.name || `Logo Slot ${opt.slotId.split('_')[1]}`}</option>
                ))}
              </select>
              <ChevronDown strokeWidth={1.5} className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-(--c-muted) pointer-events-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
));

LogoUsageSection.displayName = 'LogoUsageSection';

export const LogoEditorSection = React.memo(({
  activeLogoEditorSlotId,
  logoLibrary,
  logoSourceUrl,
  logoZoom,
  setLogoZoom,
  logoRotation,
  setRotationWrapper,
  onCropComplete,
  onLogoEditorFileChange,
  onLogoEditorReset,
  applyLogoEditor,
  closeLogoEditor,
  logoUploading,
  logoErrors
}) => {
  const [cropPosition, setCropPosition] = React.useState({ x: 0, y: 0 });
  if (!activeLogoEditorSlotId) return null;
  const targetSlot = logoLibrary.find(s => s.slotId === activeLogoEditorSlotId);
  
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-md p-3">
      <div className="relative w-full max-w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e12] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.9)] transition-all">
        {/* Compact Tool Header */}
        <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 flex items-center justify-center rounded-lg bg-(--c-accent) text-white shadow-lg shadow-(--c-accent)/20">
              <Image strokeWidth={1.5} className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-tight">Quick Crop</h3>
              <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest">{targetSlot?.name || 'Logo'}</p>
            </div>
          </div>
          <button onClick={closeLogoEditor} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <X strokeWidth={1.5} className="h-4 w-4" /> 
          </button>
        </div>

        {/* Minimalist Editor Area */}
        <div className="p-3">
          <div className="relative h-[170px] w-full overflow-hidden rounded-xl border border-white/5 bg-black">
            {logoSourceUrl ? (
              <Cropper
                image={logoSourceUrl}
                crop={cropPosition}
                zoom={logoZoom || 1}
                rotation={logoRotation || 0}
                aspect={1}
                onCropChange={setCropPosition}
                onZoomChange={setLogoZoom}
                onRotationChange={setRotationWrapper}
                onCropComplete={onCropComplete}
                classes={{ containerClassName: 'h-full w-full' }}
              />
            ) : (
              <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-4 transition hover:bg-white/[0.04]">
                <div className="h-12 w-12 flex items-center justify-center rounded-full bg-white/5 text-white/20 border border-dashed border-white/10">
                  <Plus strokeWidth={1.5} className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Click to load image</span>
                <input type="file" hidden accept="image/*" onChange={onLogoEditorFileChange} />
              </label>
            )}
          </div>
          {logoSourceUrl ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70 hover:bg-white/5">
                Change Image
                <input type="file" hidden accept="image/*" onChange={onLogoEditorFileChange} />
              </label>
              <button
                type="button"
                onClick={onLogoEditorReset}
                className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:bg-white/5 hover:text-white"
              >
                Reset
              </button>
            </div>
          ) : null}

          {logoErrors[activeLogoEditorSlotId] && (
            <div className="mt-3 rounded-xl bg-rose-500/10 p-3">
              <p className="text-[10px] font-bold text-rose-400 uppercase flex items-center gap-2">
                <Trash2 strokeWidth={1.5} className="h-3.5 w-3.5" /> {logoErrors[activeLogoEditorSlotId]}
              </p>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2 border-t border-white/5 bg-white/[0.02] p-3">
          <button 
            onClick={closeLogoEditor} 
            className="flex-1 rounded-xl border border-white/5 px-3 py-2 text-[10px] font-bold text-white/40 uppercase tracking-widest transition hover:bg-white/5 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={applyLogoEditor}
            disabled={logoUploading[activeLogoEditorSlotId] || !logoSourceUrl}
            className="flex-[2] rounded-xl bg-(--c-accent) px-3 py-2 text-[10px] font-black text-white shadow-xl shadow-(--c-accent)/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-30 disabled:grayscale"
          >
            {logoUploading[activeLogoEditorSlotId] ? 'uploading...' : 'CONFIRM & SAVE'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

LogoEditorSection.displayName = 'LogoEditorSection';
