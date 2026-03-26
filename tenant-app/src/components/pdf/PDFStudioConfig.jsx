import { useEffect, useMemo, useState } from 'react';

const sectionTitleClass = 'text-xs font-black uppercase tracking-widest text-[var(--c-text)]';
const sectionShellClass = 'rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm';
const fieldLabelClass = 'text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]';
const inputClass =
  'mt-2 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-ring)]';

const ToggleRow = ({ label, checked, onChange }) => (
  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2">
    <span className="text-sm font-semibold text-[var(--c-text)]">{label}</span>
    <input
      type="checkbox"
      className="h-5 w-5 accent-[var(--c-accent)]"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  </label>
);

const PDFStudioConfig = ({ onConfigChange }) => {
  const defaults = useMemo(
    () => ({
      // Brand Settings
      showEmail: false,
      showPhone: false,
      showLandline: false,
      showBankDetails: false,

      // Layout & Design
      logoPosition: 'top-left',
      primaryColor: '#0f172a',
      borderThickness: 2,

      // Watermark & Safety
      enableWatermark: false,
      watermarkOpacity: 0.08,

      // Financial Options
      showPayable: true,
      showAmountInWords: false,
      showSignature: false,

      // Terms
      terms: [''],
    }),
    [],
  );

  const [config, setConfig] = useState(defaults);

  useEffect(() => {
    onConfigChange?.(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      onConfigChange?.(next);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-title text-xl font-black tracking-tight text-[var(--c-text)]">PDF Studio</h2>
        <p className="mt-1 text-sm font-semibold text-[var(--c-muted)]">
          Configure branding, layout safety, and invoice options with live preview.
        </p>
      </div>

      {/* A. Brand Settings (Toggles) */}
      <section className={sectionShellClass}>
        <p className={sectionTitleClass}>Brand Settings</p>
        <div className="mt-3 flex flex-col gap-2">
          <ToggleRow label="Email" checked={config.showEmail} onChange={(v) => update({ showEmail: v })} />
          <ToggleRow label="Phone" checked={config.showPhone} onChange={(v) => update({ showPhone: v })} />
          <ToggleRow label="Landline" checked={config.showLandline} onChange={(v) => update({ showLandline: v })} />
          <ToggleRow label="Bank Details" checked={config.showBankDetails} onChange={(v) => update({ showBankDetails: v })} />
        </div>
      </section>

      {/* B. Layout & Design */}
      <section className={sectionShellClass}>
        <p className={sectionTitleClass}>Layout &amp; Design</p>

        <div className="mt-4">
          <label className={fieldLabelClass} htmlFor="pdf-logo-position">
            Logo Position
          </label>
          <select
            id="pdf-logo-position"
            className={inputClass}
            value={config.logoPosition}
            onChange={(e) => update({ logoPosition: e.target.value })}
          >
            <option value="top-left">Top Left</option>
            <option value="top-right">Top Right</option>
            <option value="center">Center</option>
          </select>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className={fieldLabelClass} htmlFor="pdf-primary-color">
              Primary Color
            </label>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2">
              <input
                id="pdf-primary-color"
                type="color"
                value={config.primaryColor}
                onChange={(e) => update({ primaryColor: e.target.value })}
                className="h-10 w-10 cursor-pointer rounded-lg border border-[var(--c-border)] bg-transparent p-0"
              />
              <input
                type="text"
                value={config.primaryColor}
                onChange={(e) => update({ primaryColor: e.target.value })}
                className="flex-1 bg-transparent text-sm font-semibold text-[var(--c-text)] outline-none"
              />
            </div>
          </div>

          <div>
            <label className={fieldLabelClass} htmlFor="pdf-border-thickness">
              Border Thickness (px)
            </label>
            <input
              id="pdf-border-thickness"
              type="number"
              min={0}
              max={12}
              step={1}
              className={inputClass}
              value={config.borderThickness}
              onChange={(e) => update({ borderThickness: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
      </section>

      {/* C. Watermark & Safety */}
      <section className={sectionShellClass}>
        <p className={sectionTitleClass}>Watermark &amp; Safety</p>
        <div className="mt-3 flex flex-col gap-2">
          <ToggleRow
            label="Enable Watermark"
            checked={config.enableWatermark}
            onChange={(v) => update({ enableWatermark: v })}
          />

          {config.enableWatermark ? (
            <div className="mt-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--c-text)]">Watermark Opacity</span>
                <span className="text-xs font-bold text-[var(--c-muted)]">{Number(config.watermarkOpacity).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.01}
                max={0.3}
                step={0.01}
                value={config.watermarkOpacity}
                onChange={(e) => update({ watermarkOpacity: Number(e.target.value) })}
                className="mt-3 w-full"
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* D. Financial Options */}
      <section className={sectionShellClass}>
        <p className={sectionTitleClass}>Financial Options</p>
        <div className="mt-3 flex flex-col gap-2">
          <ToggleRow label="Show Payable" checked={config.showPayable} onChange={(v) => update({ showPayable: v })} />
          <ToggleRow
            label="Amount in Words"
            checked={config.showAmountInWords}
            onChange={(v) => update({ showAmountInWords: v })}
          />
          <ToggleRow
            label="Manual Signature"
            checked={config.showSignature}
            onChange={(v) => update({ showSignature: v })}
          />
        </div>
      </section>

      {/* E. Terms & Conditions (Dynamic List) */}
      <section className={sectionShellClass}>
        <p className={sectionTitleClass}>Terms &amp; Conditions</p>
        <div className="mt-3 flex flex-col gap-2">
          {config.terms.map((term, index) => (
            <input
              key={`term-${index}`}
              type="text"
              className={inputClass}
              placeholder={`Term ${index + 1}`}
              value={term}
              onChange={(e) => {
                const nextTerms = config.terms.map((value, i) => (i === index ? e.target.value : value));
                update({ terms: nextTerms });
              }}
            />
          ))}

          <button
            type="button"
            onClick={() => update({ terms: [...config.terms, ''] })}
            className="mt-2 h-10 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 text-sm font-semibold text-[var(--c-text)] transition hover:bg-[color:color-mix(in_srgb,var(--c-panel)_70%,transparent)]"
          >
            + Add Term
          </button>
        </div>
      </section>
    </div>
  );
};

export default PDFStudioConfig;

