import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Image as ImageIcon, Search } from 'lucide-react';
import DirhamIcon from './DirhamIcon';
import InputActionField from './InputActionField';

const buildToneClasses = (tone) => {
  if (tone === 'modal') {
    return {
      wrapper: 'space-y-5',
      section: 'rounded-[1.35rem] border border-sky-500/35 bg-slate-900/70 p-4',
      sectionTitle: 'text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300',
      label: 'text-xs font-semibold text-slate-200',
      input:
        'mt-2 w-full rounded-xl border border-slate-600 bg-slate-700/80 px-3 py-2.5 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20',
      textarea:
        'mt-2 w-full rounded-xl border border-slate-600 bg-slate-700/80 px-3 py-2.5 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20',
      pickerFrame: 'mt-2 rounded-2xl border border-slate-600 bg-slate-900/70 p-3',
      pickerTile: 'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-600 bg-slate-800 text-slate-400',
      helperTitle: 'text-sm font-semibold text-slate-100',
      helperText: 'text-xs font-semibold text-slate-400',
      chooseButton: 'compact-action rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white transition hover:bg-sky-400',
      chargeFrame: 'mt-2 w-full max-w-[170px]',
      chargeIcon: 'flex h-14 w-14 shrink-0 items-center justify-center text-slate-300',
      chargeInput: 'font-bold',
      error: 'text-xs font-bold text-rose-400',
      status: 'text-xs font-bold text-emerald-400',
      submit: 'compact-action rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50',
      cancel: 'compact-action rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 disabled:opacity-50',
      pickerPanel: 'absolute left-0 right-0 top-[calc(100%+0.65rem)] z-[90] overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl',
      pickerSearch: 'w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-400 focus:border-sky-400',
      pickerOption: 'flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-800',
      pickerOptionActive: 'bg-sky-500/10',
      empty: 'px-3 py-4 text-sm font-semibold text-slate-400',
    };
  }

  return {
    wrapper: 'space-y-5',
    section: 'rounded-[1.35rem] border border-[var(--c-border)] bg-[var(--c-surface)] p-4',
    sectionTitle: 'text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--c-accent)]',
    label: 'text-xs font-semibold text-[var(--c-text)]',
    input:
      'mt-2 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm font-semibold text-[var(--c-text)] outline-none transition placeholder:text-[var(--c-muted)] focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-ring)]',
    textarea:
      'mt-2 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm font-semibold text-[var(--c-text)] outline-none transition placeholder:text-[var(--c-muted)] focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-ring)]',
    pickerFrame: 'mt-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3',
    pickerTile: 'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--c-border)] bg-white text-[var(--c-muted)]',
    helperTitle: 'text-sm font-semibold text-[var(--c-text)]',
    helperText: 'text-xs font-semibold text-[var(--c-muted)]',
    chooseButton: 'compact-action rounded-xl bg-[var(--c-accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90',
    chargeFrame: 'mt-2 w-full max-w-[170px]',
    chargeIcon: 'flex h-14 w-14 shrink-0 items-center justify-center text-[var(--c-muted)]',
    chargeInput: 'font-bold',
    error: 'text-xs font-bold text-rose-500',
    status: 'text-xs font-bold text-emerald-500',
    submit: 'compact-action rounded-xl bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50',
    cancel: 'compact-action rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2.5 text-sm font-semibold text-[var(--c-text)] disabled:opacity-50',
    pickerPanel: 'absolute left-0 right-0 top-[calc(100%+0.65rem)] z-[90] overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl',
    pickerSearch: 'w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm font-semibold text-[var(--c-text)] outline-none placeholder:text-[var(--c-muted)] focus:border-[var(--c-accent)]',
    pickerOption: 'flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--c-panel)]',
    pickerOptionActive: 'bg-[var(--c-accent-soft)]',
    empty: 'px-3 py-4 text-sm font-semibold text-[var(--c-muted)]',
  };
};

const IconLibraryPicker = ({
  icons,
  value,
  onChange,
  theme,
  placeholder = 'Search icon library',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const rootRef = useRef(null);
  const selectedIcon = icons.find((item) => item.iconId === value) || null;

  const filteredIcons = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return icons;
    return icons.filter((item) => String(item.iconName || '').toLowerCase().includes(query));
  }, [icons, searchQuery]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <div className={theme.pickerFrame}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={theme.pickerTile}>
              {selectedIcon?.iconUrl ? (
                <img src={selectedIcon.iconUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[color:color-mix(in_srgb,var(--c-accent)_10%,transparent)] text-[var(--c-muted)]">
                  <ImageIcon strokeWidth={1.5} className="h-4 w-4" />
                  <span className="text-[8px] font-semibold uppercase tracking-[0.16em]">No Icon</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className={theme.helperTitle}>{selectedIcon ? selectedIcon.iconName : 'No icon selected'}</p>
              <p className={theme.helperText}>
                {selectedIcon ? 'Reusable icon from library' : 'Choose from library or upload'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className={`${theme.chooseButton} inline-flex items-center gap-2`}
          >
            Choose
            <ChevronDown strokeWidth={1.5} className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className={theme.pickerPanel}>
          <div className="border-b border-inherit p-3">
            <div className="relative">
              <InputActionField
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder={placeholder}
                className="w-full"
                inputClassName="pl-12"
                showPasteButton={false}
                leadIcon={Search}
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearchQuery('');
              }}
              className={`${theme.pickerOption} ${value ? '' : theme.pickerOptionActive}`}
            >
              <div className={theme.pickerTile}>
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[color:color-mix(in_srgb,var(--c-accent)_10%,transparent)] text-[var(--c-muted)]">
                  <ImageIcon strokeWidth={1.5} className="h-4 w-4" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">No library icon</p>
                <p className={theme.helperText}>Use clean fallback tile</p>
              </div>
              {!value ? <Check strokeWidth={1.5} className="h-4 w-4 shrink-0" /> : null}
            </button>

            {filteredIcons.length === 0 ? (
              <div className={theme.empty}>No icon found.</div>
            ) : (
              filteredIcons.map((icon) => {
                const isSelected = icon.iconId === value;
                return (
                  <button
                    key={icon.iconId}
                    type="button"
                    onClick={() => {
                      onChange(icon.iconId);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`${theme.pickerOption} ${isSelected ? theme.pickerOptionActive : ''}`}
                  >
                    <div className={theme.pickerTile}>
                      {icon.iconUrl ? (
                        <img src={icon.iconUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[color:color-mix(in_srgb,var(--c-accent)_10%,transparent)] text-[var(--c-muted)]">
                          <ImageIcon strokeWidth={1.5} className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{icon.iconName}</p>
                    </div>
                    {isSelected ? <Check strokeWidth={1.5} className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const ChargeInput = ({
  label,
  value,
  onChange,
  theme,
}) => (
  <label className={theme.label}>
    {label}
    <div className={theme.chargeFrame}>
      <InputActionField
        type="number"
        value={value}
        onValueChange={(val) => onChange?.({ target: { value: val } })}
        placeholder="0.00"
        className="w-full"
        inputClassName={theme.chargeInput}
        showPasteButton={false}
        leadIcon={DirhamIcon}
      />
    </div>
  </label>
);

const ServiceTemplateEditor = ({
  draft,
  onDraftChange,
  icons = [],
  iconActionSlot = null,
  onSubmit,
  onCancel,
  isSaving = false,
  error = '',
  status = '',
  submitLabel = 'Save Application',
  cancelLabel = 'Cancel',
  showCancel = false,
  tone = 'surface',
  wrapInForm = true,
  children,
}) => {
  const theme = buildToneClasses(tone);
  const RootTag = wrapInForm ? 'form' : 'div';

  const updateField = (field, value) => {
    onDraftChange?.((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <RootTag onSubmit={wrapInForm ? onSubmit : undefined} className={theme.wrapper}>
      <div className={theme.section}>
        <div className="space-y-4">
          <label className={theme.label}>
            Application Name *
            <InputActionField
              className="mt-2"
              value={draft.name}
              onValueChange={(val) => updateField('name', val)}
              placeholder="Enter application or service name"
              showPasteButton={theme.pickerSearch ? false : true}
            />
          </label>

          <label className={theme.label}>
            Description (Optional)
            <InputActionField
              multiline
              rows={2}
              className="mt-2"
              value={draft.description}
              onValueChange={(val) => updateField('description', val)}
              placeholder="Service details, rules or notes..."
              showPasteButton={theme.pickerSearch ? false : true}
            />
          </label>

          <div>
            <p className={theme.sectionTitle}>Application Icon (Reusable / Optional)</p>
            <IconLibraryPicker
              icons={icons}
              value={draft.iconId}
              onChange={(nextValue) => updateField('iconId', nextValue)}
              theme={theme}
            />
            {iconActionSlot ? <div className="mt-3">{iconActionSlot}</div> : null}
          </div>

          {children ? <div>{children}</div> : null}

          <div className="grid gap-4 sm:grid-cols-[minmax(0,170px)_minmax(0,170px)]">
            <ChargeInput
              label="Default Client"
              value={draft.clientCharge}
              onChange={(event) => updateField('clientCharge', event.target.value)}
              theme={theme}
            />
            <ChargeInput
              label="Default Gov"
              value={draft.govCharge}
              onChange={(event) => updateField('govCharge', event.target.value)}
              theme={theme}
            />
          </div>
        </div>
      </div>

      {error ? <p className={theme.error}>{error}</p> : null}
      {status ? <p className={theme.status}>{status}</p> : null}

      <div className="flex items-center justify-end gap-2">
        {showCancel ? (
          <button type="button" onClick={onCancel} disabled={isSaving} className={theme.cancel}>
            {cancelLabel}
          </button>
        ) : null}
        <button
          type={wrapInForm ? 'submit' : 'button'}
          onClick={wrapInForm ? undefined : onSubmit}
          disabled={isSaving}
          className={theme.submit}
        >
          {submitLabel}
        </button>
      </div>
    </RootTag>
  );
};

export default ServiceTemplateEditor;
