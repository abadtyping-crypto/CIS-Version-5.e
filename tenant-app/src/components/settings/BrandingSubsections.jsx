  import React from 'react';
  import Cropper from 'react-easy-crop';
  import { Building2, Plus, Trash2, Share2, Banknote, Image, MessageSquare, Facebook, Instagram, Twitter, Linkedin, Layout, Library, ChevronDown, Phone, Mail, MapPin, X, ArrowLeft, MoreVertical, RotateCcw } from 'lucide-react';
  import IconSelect from '../common/IconSelect';
  import InputActionField from '../common/InputActionField';
  import EmirateSelect from '../common/EmirateSelect';
  import MobileContactsField from '../common/MobileContactsField';
  import AddressField from '../common/AddressField';
  import CountryPhoneField from '../common/CountryPhoneField';
  import EmailContactsField from '../common/EmailContactsField';
  
  export const ToggleSwitch = ({ checked, onChange }) => (
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

  export const TikTokIcon = ({ className }) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className || ''}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M14.5 3c.3 1.7 1.4 3.2 3 4 1 .5 2 .8 3.1.8v3a9 9 0 0 1-3.1-.6v5.8a6.5 6.5 0 1 1-6.5-6.5c.4 0 .8 0 1.2.1v3.1a3.5 3.5 0 1 0 2.3 3.3V3h3Z" />
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
        <div className="auto-fit-span-full grid gap-4 md:grid-cols-[2fr_1fr]">
          <label className={labelClass}>
            Company Name <span className="text-rose-500">*</span>
            <InputActionField
              value={form.companyName}
              onValueChange={(val) => updateField('companyName', val)}
              forceUppercase
              placeholder="ENTER OFFICIAL COMPANY NAME"
              showPasteButton
              className="mt-1 font-bold text-sm min-h-[56px] bg-(--c-accent)/5 border-(--c-accent)/20"
            />
            {errors.companyName ? <p className="mt-1 text-xs text-rose-600 font-bold">{errors.companyName}</p> : null}
          </label>

          <div className="flex flex-col gap-1">
            <label className={labelClass}>
              Brand Name (Short)
            </label>
            <InputActionField
              value={form.brandName}
              onValueChange={(val) => updateField('brandName', val)}
              forceUppercase
              placeholder="BRAND NAME"
              className="mt-1 font-bold text-sm min-h-[56px]"
            />
            {errors.brandName ? <p className="mt-1 text-xs text-rose-600 font-bold">{errors.brandName}</p> : null}
          </div>
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
        </div>

        <MobileContactsField
          label={<><span>Mobile Numbers </span><span className="text-rose-500">*</span></>}
          contacts={form.mobileContacts}
          onChange={updateMobileContacts}
          className="flex flex-col gap-2"
        />
        {errors.phones ? <p className="mt-1 text-xs text-rose-600 font-bold uppercase">{errors.phones}</p> : null}

        <div className="auto-fit-span-full flex flex-col gap-2">
          <span className={labelClass}>Company Address</span>
          <div className="space-y-3">
            <div className="flex items-stretch gap-2">
              <div className="flex-1">
                <AddressField
                  label="Branch / Brand Address"
                  value={form.addresses[0] || ''}
                  onValueChange={(v) => updateArrayField('addresses', 0, v)}
                  placeholder="Enter branch address..."
                  fieldClassName="h-[72px]"
                />
              </div>
            </div>
          </div>
          {errors.addresses ? <p className="mt-1 text-xs text-rose-600 font-bold uppercase">{errors.addresses}</p> : null}
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
            label={<><span>Official Email Addresses</span></>}
            contacts={form.emails}
            onChange={(contacts) => updateField('emails', contacts)}
          />
          {errors.emails ? <p className="mt-1 text-xs text-rose-600 font-bold uppercase">{errors.emails}</p> : null}
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
      <div className="flex items-center gap-2 border-b border-(--c-border) pb-2 text-(--c-accent)">
        <div className="flex items-center gap-2">
          <Share2 strokeWidth={1.5} className="h-5 w-5" />
          <span className="text-sm font-bold uppercase tracking-wider text-(--c-text)">Social Media</span>
        </div>
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
                  <InputActionField
                    value={form[key]}
                    onValueChange={(val) => updateField(key, val.toLowerCase())}
                    placeholder=""
                    showPasteButton
                    className="mt-0"
                  />
                </div>
              </div>
            );
          })}
        </div>
        {(() => {
          const lastKey = activeSocialKeys[activeSocialKeys.length - 1];
          const isLastFilled = lastKey && form[lastKey] && String(form[lastKey]).trim().length > 0;
          
          if (activeSocialKeys.length < socialPlatforms.length && isLastFilled) {
            return (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={addSocialPlatform}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-(--c-border) bg-(--c-panel) text-(--c-accent) transition hover:bg-(--c-surface) hover:shadow-md"
                  aria-label="Add social link"
                  title="Add Link"
                >
                  <Plus strokeWidth={1.5} className="h-5 w-5" />
                </button>
              </div>
            );
          }
          return null;
        })()}
      </div>
    </section>
  ));

  SocialMediaSection.displayName = 'SocialMediaSection';

  export const BankDetailsSection = React.memo(({
    form,
    errors,
    updateField,
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
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--c-muted)">
            {form.isBankDetailsEnabled === true ? 'Enabled' : 'Disabled'}
          </span>
          <ToggleSwitch
            checked={form.isBankDetailsEnabled === true}
            onChange={(v) => updateField('isBankDetailsEnabled', v)}
          />
        </div>
      </div>

      {form.isBankDetailsEnabled === true ? (
        <div className="space-y-4">
        {(form.bankDetails || []).map((bank, index) => {
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
                  Bank Name <span className="text-rose-500">*</span>
                  <InputActionField
                    value={bank.bankName || ''}
                    onValueChange={(val) => updateBankDetailField(index, 'bankName', val)}
                    placeholder="E.g., Emirates NBD"
                    showPasteButton
                    className="mt-1"
                  />
                </label>
                <label className={labelClass}>
                  Account Name <span className="text-rose-500">*</span>
                  <InputActionField
                    value={bank.bankAccountName || ''}
                    onValueChange={(val) => updateBankDetailField(index, 'bankAccountName', val)}
                    placeholder=""
                    showPasteButton
                    className="mt-1"
                  />
                  {errors[`bankAccountName_${index}`] ? <p className="mt-1 text-xs text-rose-600">{errors[`bankAccountName_${index}`]}</p> : null}
                </label>
                <label className={labelClass}>
                  Account Number <span className="text-rose-500">*</span>
                  <InputActionField
                    value={bank.bankAccountNumber || ''}
                    onValueChange={(val) => updateBankDetailField(index, 'bankAccountNumber', val)}
                    placeholder=""
                    showPasteButton
                    className="mt-1"
                  />
                  {errors[`bankAccountNumber_${index}`] ? <p className="mt-1 text-xs text-rose-600">{errors[`bankAccountNumber_${index}`]}</p> : null}
                </label>
                <label className={labelClass}>
                  IBAN <span className="text-rose-500">*</span>
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
                    placeholder=""
                    showPasteButton
                    className="mt-1"
                  />
                </label>
              </div>
              {(() => {
                const isAllFilled = [
                  bank.bankName,
                  bank.bankAccountName,
                  bank.bankAccountNumber,
                  bank.bankIban,
                ].every((v) => String(v || '').trim().length > 0);
  
                if (isLast && isAllFilled) {
                  return (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={addBankDetail}
                        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-(--c-border) bg-(--c-panel) px-4 py-3 text-xs font-bold text-(--c-muted) transition hover:bg-(--c-surface) hover:text-(--c-text)"
                      >
                        <Plus strokeWidth={1.5} className="h-4 w-4" />
                        Add Next Bank Option
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          );
        })}
        </div>
      ) : (
        <div className="rounded-2xl border border-(--c-border) bg-(--c-panel) px-4 py-5 text-sm text-(--c-muted)">
          Bank details are hidden until you enable them.
        </div>
      )}
    </section>
  ));

  BankDetailsSection.displayName = 'BankDetailsSection';

  export const LogoLibrarySection = React.memo(({
    form,
    errors,
    updateField,
    visibleLogoSlots,
    logoErrors,
    logoUploading,
    activeLogoSlotId,
    setActiveLogoSlotId,
    openLogoEditor,
    removeLogoSlot,
    updateLogoSlot,
    onAddLogoSlot
  }) => {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-(--c-border) pb-2">
          <div className="flex items-center gap-2 text-(--c-accent)">
            <Library strokeWidth={1.5} className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-wider text-(--c-text)">Logo Library</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-(--c-muted)">
                {form.isLogoLibraryEnabled === true ? 'Enabled' : 'Disabled'}
              </span>
              <ToggleSwitch
                checked={form.isLogoLibraryEnabled === true}
                onChange={(v) => updateField('isLogoLibraryEnabled', v)}
              />
            </div>
            {form.isLogoLibraryEnabled === true && visibleLogoSlots.length < 10 && visibleLogoSlots[visibleLogoSlots.length - 1]?.url && (
              <button
                onClick={onAddLogoSlot}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-(--c-accent)/20 bg-(--c-accent)/10 text-(--c-accent) transition hover:bg-(--c-accent)/20"
                title="Add next logo slot"
              >
                <Plus strokeWidth={1.5} className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {form.isLogoLibraryEnabled === true ? (
          <div className="rounded-xl border border-(--c-border) bg-(--c-panel) p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-(--c-muted) underline decoration-dotted">Maintain a centralized library of branded logos (Standard size: 512x512px).</p>
              </div>
            </div>

          <div className="grid max-h-[280px] grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-2 overflow-y-auto pr-1">
            {visibleLogoSlots.map((slot, index) => {
              const previousSlot = index > 0 ? visibleLogoSlots[index - 1] : null;
              const canUploadThisSlot = index === 0 || Boolean(previousSlot?.url);

              return (
                <div key={slot.slotId} className="group relative overflow-hidden rounded-2xl border border-(--c-border) bg-(--c-surface) shadow-sm transition hover:shadow-md">
                  <div className="flex min-h-[7rem]">
                  <div className="relative flex aspect-square w-28 shrink-0 items-center justify-center overflow-hidden bg-(--c-panel) font-bold text-(--c-muted)">
                    {logoUploading[slot.slotId] ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--c-accent) border-t-transparent" />
                        <span className="text-[10px] font-bold tracking-tighter text-(--c-accent) uppercase">Uploading...</span>
                      </div>
                    ) : slot.url ? (
                      <div className="relative h-full w-full">
                        <img src={slot.url} alt={slot.name} className="h-full w-full object-cover" />
                        <div className="absolute right-2 top-2">
                          <button
                            type="button"
                            onClick={() => setActiveLogoSlotId(slot.slotId)}
                            className={`flex h-6 w-6 items-center justify-center rounded-full shadow-lg transition-all ${
                              activeLogoSlotId === slot.slotId
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white/90 text-slate-300 hover:text-slate-400'
                            }`}
                            title={activeLogoSlotId === slot.slotId ? 'Active Logo' : 'Set as Active'}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 opacity-40">
                        <Image strokeWidth={1.5} className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">No Logo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-center space-y-2 p-3">
                    <input
                      className="w-full rounded-xl border border-(--c-border) bg-(--c-panel) px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-(--c-text) outline-none placeholder:text-(--c-muted)/40 focus:border-(--c-accent) focus:ring-2 focus:ring-(--c-accent)/10"
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
                        title={!canUploadThisSlot ? 'Complete the previous slot first.' : (slot.url ? 'Change logo' : 'Name this logo, then browse media')}
                        className="flex-1 rounded-xl border border-(--c-border) bg-(--c-panel) py-1.5 text-[10px] font-bold uppercase tracking-tighter text-(--c-text) transition hover:bg-(--c-accent) hover:text-white hover:border-(--c-accent) shadow-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-(--c-panel) disabled:hover:text-(--c-text) disabled:hover:border-(--c-border)"
                      >
                        {slot.url ? 'Change' : 'Browse'}
                      </button>
                      {slot.url && (
                        <button
                          type="button"
                          onClick={() => removeLogoSlot(slot.slotId)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 transition hover:bg-rose-500 hover:text-white"
                        >
                          <Trash2 strokeWidth={1.5} className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {!canUploadThisSlot ? (
                      <p className="text-[10px] font-semibold text-amber-500">Upload previous slot first.</p>
                    ) : null}
                  </div>
                  </div>
                  {(logoErrors[slot.slotId] || errors[`logoName_${slot.slotId}`]) && (
                    <p className="border-t border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-bold uppercase leading-none text-rose-500">
                      {logoErrors[slot.slotId] || errors[`logoName_${slot.slotId}`]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        ) : (
          <div className="rounded-2xl border border-(--c-border) bg-(--c-panel) px-4 py-5 text-sm text-(--c-muted)">
            Logo Management is hidden until you enable it.
          </div>
        )}
      </section>
    );
  });

  LogoLibrarySection.displayName = 'LogoLibrarySection';

  export const LogoUsageSection = React.memo(({
    logoUsage,
    logoFunctions,
    assignedOptions,
    setLogoUsage
  }) => {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-(--c-border) pb-2 text-(--c-accent)">
          <Layout strokeWidth={1.5} className="h-5 w-5" />
          <span className="text-sm font-bold uppercase tracking-wider text-(--c-text)">Integration Mapping</span>
        </div>

        <div className="rounded-xl border border-(--c-border) bg-(--c-panel) p-4">
          <div className="mb-4">
            <p className="text-xs text-(--c-muted)">Assign your uploaded logos to the main app surfaces only.</p>
          </div>

          <div className="auto-fit-grid-compact">
            {logoFunctions.map((func) => (
              <div key={func.key} className="flex flex-col gap-3 rounded-2xl border border-(--c-border) bg-(--c-surface) p-4 shadow-sm transition hover:shadow-md">
                <span className="text-[10px] font-bold uppercase tracking-widest text-(--c-text)/80">{func.label}</span>
                <div className="flex flex-col gap-2">
                  {(() => {
                    const currentSlot = logoUsage[func.key] || '';
                    if (assignedOptions.length === 0) {
                      return (
                        <div className="flex items-center gap-2 rounded-xl border border-dashed border-(--c-border) bg-(--c-panel)/50 p-3 opacity-60">
                          <Image strokeWidth={1.5} className="h-4 w-4 text-(--c-muted)" />
                          <span className="text-[10px] font-bold uppercase text-(--c-muted)">No logos uploaded yet</span>
                        </div>
                      );
                    }
                    return assignedOptions.map((opt) => {
                      const isSelected = opt.slotId === currentSlot;
                      return (
                        <button
                          key={opt.slotId}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setLogoUsage((prev) => ({ ...prev, [func.key]: '' }));
                            } else {
                              setLogoUsage((prev) => ({ ...prev, [func.key]: opt.slotId }));
                            }
                          }}
                          className={`flex min-h-16 items-stretch overflow-hidden rounded-xl border p-0 text-left transition-all ${
                            isSelected
                              ? 'border-(--c-accent) bg-(--c-accent)/5 ring-1 ring-(--c-accent)'
                              : 'border-(--c-border) bg-(--c-panel) hover:border-(--c-accent)/50'
                          }`}
                        >
                          <div className="flex w-16 shrink-0 items-center justify-center overflow-hidden bg-(--c-panel)">
                            {opt.url ? (
                              <img src={opt.url} alt={opt.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full bg-slate-100" />
                            )}
                          </div>
                          <div className="flex min-w-0 flex-1 items-center px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className={`text-[10px] font-bold uppercase tracking-tight ${isSelected ? 'text-(--c-accent)' : 'text-(--c-text)'}`}>
                                {opt.name || `Logo Slot ${opt.slotId.split('_')[1]}`}
                              </p>
                              {isSelected && <p className="text-[8px] font-bold text-(--c-accent) uppercase tracking-tighter">Assigned</p>}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="mr-3 mt-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--c-accent) text-white">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
                <p className="border-t border-(--c-border)/50 pt-2 text-[9px] font-bold leading-tight text-(--c-muted) uppercase tracking-tighter">
                  Click the assigned logo again to disable this surface.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  });

  LogoUsageSection.displayName = 'LogoUsageSection';

  export const LogoEditorSection = React.memo(({
    activeLogoEditorSlotId,
    logoSourceUrl,
    logoZoom,
    setLogoZoom,
    logoRotation,
    setRotationWrapper,
    onCropComplete,
    onLogoEditorFileChange,
    applyLogoEditor,
    closeLogoEditor,
    logoUploading,
    logoErrors
  }) => {
    const [cropPosition, setCropPosition] = React.useState({ x: 0, y: 0 });
    if (!activeLogoEditorSlotId) return null;

    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-black p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-300">
        <div className="absolute inset-0" onClick={closeLogoEditor} />
        
        {/* Header - Google Style with Integrated Save */}
        <header className="relative z-10 flex w-full max-w-2xl items-center justify-between px-4 py-4 text-white">
          <div className="flex items-center gap-4">
            <button onClick={closeLogoEditor} className="h-10 w-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all">
              <ArrowLeft strokeWidth={2} className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-medium">Crop and rotate</h2>
          </div>
          <button
            onClick={applyLogoEditor}
            disabled={logoUploading[activeLogoEditorSlotId] || !logoSourceUrl}
            className="h-10 px-6 rounded-full bg-[#a8c7fa] text-[#062e6f] font-bold text-sm shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:grayscale"
          >
            {logoUploading[activeLogoEditorSlotId] ? 'Saving...' : 'Done'}
          </button>
        </header>

        {/* Immersive Editor Area */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center w-full max-w-2xl px-4 py-8">
          <div className="relative aspect-square w-full max-w-[440px] overflow-hidden rounded-md">
            {logoSourceUrl ? (
              <>
                <Cropper
                  image={logoSourceUrl}
                  crop={cropPosition}
                  zoom={logoZoom || 1}
                  rotation={logoRotation || 0}
                  aspect={1}
                  cropShape="rect"
                  showGrid={false}
                  zoomSpeed={0.1}
                  minZoom={1}
                  maxZoom={3}
                  onCropChange={setCropPosition}
                  onZoomChange={setLogoZoom}
                  onRotationChange={setRotationWrapper}
                  onCropComplete={onCropComplete}
                  classes={{ 
                    containerClassName: 'h-full w-full bg-black',
                    cropAreaClassName: 'border-2 border-white/50 !rounded-2xl !shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]'
                  }}
                />
                {/* Thick corner handles - Google Style overlay - Adjusted to match the crop area better */}
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
                  <div className="relative aspect-square w-full max-w-[400px]">
                    <div className="absolute -left-1.5 -top-1.5 h-6 w-6 border-l-[6px] border-t-[6px] border-[#a8c7fa] rounded-tl-sm shadow-xl" />
                    <div className="absolute -right-1.5 -top-1.5 h-6 w-6 border-r-[6px] border-t-[6px] border-[#a8c7fa] rounded-tr-sm shadow-xl" />
                    <div className="absolute -left-1.5 -bottom-1.5 h-6 w-6 border-l-[6px] border-b-[6px] border-[#a8c7fa] rounded-bl-sm shadow-xl" />
                    <div className="absolute -right-1.5 -bottom-1.5 h-6 w-6 border-r-[6px] border-b-[6px] border-[#a8c7fa] rounded-br-sm shadow-xl" />
                  </div>
                </div>
              </>
            ) : (
              <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-4 bg-white/5 rounded-2xl border-2 border-dashed border-white/10 transition hover:bg-white/10">
                <div className="h-16 w-16 flex items-center justify-center rounded-full bg-white/5 text-white/40 border border-white/10">
                  <Plus strokeWidth={1.5} className="h-8 w-8" />
                </div>
                <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Load Media</span>
                <input type="file" hidden accept="image/*" onChange={onLogoEditorFileChange} />
              </label>
            )}
          </div>

          {logoSourceUrl && (
            <div className="mt-8 flex flex-col items-center gap-6 w-full">
              <button
                type="button"
                onClick={() => setRotationWrapper((logoRotation + 90) % 360)}
                className="flex flex-col items-center gap-1 text-white group"
              >
                <div className="h-14 w-14 flex items-center justify-center rounded-xl bg-white/10 group-hover:bg-white/20 transition-all border border-white/5">
                  <RotateCcw strokeWidth={1.5} className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Rotate</span>
              </button>

              <div className="flex items-center gap-4 w-64">
                <span className="text-[10px] font-bold text-white/40 uppercase">Zoom</span>
                <input
                  type="range"
                  value={logoZoom || 1}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(e) => setLogoZoom(Number(e.target.value))}
                  className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--c-accent)]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Area - Optional Metadata */}
        <footer className="relative z-10 flex w-full max-w-2xl justify-center items-center px-4 pb-8 pt-4">
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Adjust with Precision</p>
        </footer>

        {logoErrors[activeLogoEditorSlotId] && (
          <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[110] rounded-xl bg-rose-500/90 px-4 py-2 text-white shadow-2xl backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase flex items-center gap-2">
              <Trash2 className="h-3 w-3" /> {logoErrors[activeLogoEditorSlotId]}
            </p>
          </div>
        )}
      </div>
    );
  });

  LogoEditorSection.displayName = 'LogoEditorSection';
