import '../../styles/desktop/layout.css';

const overlayPresets = {
  pdf: {
    title: 'Generating Document',
    subtitle: 'Preparing your document with the current workspace style.',
    status: 'Rendering PDF...',
    accent: 'var(--c-accent)',
    accentSoft: 'var(--c-accent-2)',
    glow: 'color-mix(in srgb, var(--c-accent) 32%, transparent)',
    variant: 'pdf',
  },
  email: {
    title: 'Sending Email',
    subtitle: 'Packaging the document and sending it to the selected recipient.',
    status: 'Sending Email...',
    accent: '#00C9A7',
    accentSoft: 'color-mix(in srgb, #00C9A7 72%, var(--c-accent-2) 28%)',
    glow: 'rgba(0, 201, 167, 0.28)',
    variant: 'email',
  },
  process: {
    title: 'Processing Request',
    subtitle: 'Finalizing records and synchronizing your workspace safely.',
    status: 'Processing Transaction...',
    accent: 'color-mix(in srgb, var(--c-accent-2) 58%, #7C3AED 42%)',
    accentSoft: 'color-mix(in srgb, var(--c-accent) 44%, #00f0ff 56%)',
    glow: 'color-mix(in srgb, var(--c-accent-2) 30%, transparent)',
    variant: 'process',
  },
};

const ActionProgressOverlay = ({
  open = false,
  kind = 'process',
  title,
  subtitle,
  status,
  logoSrc = '/ACIS Icon/appIconx256.png',
}) => {
  if (!open) return null;

  const preset = overlayPresets[kind] || overlayPresets.process;
  const heading = title || preset.title;
  const detail = subtitle || preset.subtitle;
  const statusLabel = status || preset.status;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center px-4 py-6"
      style={{
        background:
          'radial-gradient(circle at center, color-mix(in srgb, var(--c-bg) 22%, rgba(2, 6, 23, 0.82)) 0%, rgba(2, 6, 23, 0.94) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="acis-action-loader-wrap flex w-full max-w-[28rem] flex-col items-center text-center">
        <div
          className="acis-action-loader-shell glass relative flex h-[18rem] w-[18rem] items-center justify-center overflow-hidden rounded-[2.2rem] border"
          style={{
            borderColor: 'color-mix(in srgb, var(--glass-border) 70%, white 30%)',
            boxShadow: `0 24px 70px -34px ${preset.glow}, var(--glass-shadow)`,
          }}
        >
          <div
            className="acis-action-loader-ambient"
            style={{
              background: `radial-gradient(circle, ${preset.glow} 0%, transparent 72%)`,
            }}
          />
          <svg viewBox="0 0 220 220" className="relative z-[1] h-[14.5rem] w-[14.5rem]" aria-hidden="true">
            <defs>
              <linearGradient id="acisActionAccent" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={preset.accent} />
                <stop offset="100%" stopColor={preset.accentSoft} />
              </linearGradient>
              <linearGradient id="acisActionDoc" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
                <stop offset="100%" stopColor="color-mix(in srgb, var(--c-surface) 72%, #dbeafe 28%)" />
              </linearGradient>
              <linearGradient id="acisTrail" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="100%" stopColor={preset.accentSoft} />
              </linearGradient>
              <filter id="acisSoftShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="rgba(15,23,42,0.35)" />
              </filter>
            </defs>

            <path className="acis-loader-tech-bg" d="M110 18 L176 56 L176 146 L110 184 L44 146 L44 56 Z" />
            <path className="acis-loader-tech-glow" d="M110 18 L176 56 L176 146 L110 184 L44 146 L44 56 Z" style={{ stroke: preset.accentSoft }} />

            {preset.variant === 'pdf' ? (
              <g className="acis-loader-doc-float" filter="url(#acisSoftShadow)">
                <path d="M76 52 L124 52 L146 74 L146 160 L76 160 Z" fill="url(#acisActionDoc)" />
                <path d="M124 52 L124 74 L146 74 Z" fill="color-mix(in srgb, var(--c-accent) 18%, #dbeafe 82%)" />
                <line x1="88" y1="92" x2="126" y2="92" className="acis-loader-doc-line" />
                <line x1="88" y1="108" x2="130" y2="108" className="acis-loader-doc-line" style={{ animationDelay: '0.18s' }} />
                <line x1="88" y1="124" x2="116" y2="124" className="acis-loader-doc-line" style={{ animationDelay: '0.34s' }} />
                <rect x="70" y="0" width="84" height="18" className="acis-loader-scanner" />
                <rect x="98" y="134" width="30" height="14" rx="4" fill="url(#acisActionAccent)" />
              </g>
            ) : null}

            {preset.variant === 'email' ? (
              <g>
                <g className="acis-loader-doc-fade" filter="url(#acisSoftShadow)">
                  <path d="M78 56 L124 56 L144 76 L144 150 L78 150 Z" fill="url(#acisActionDoc)" />
                  <line x1="90" y1="92" x2="126" y2="92" className="acis-loader-doc-line" />
                </g>
                <g className="acis-loader-envelope" filter="url(#acisSoftShadow)">
                  <path d="M 52 84 L 168 84 L 168 146 L 52 146 Z" fill="rgba(255,255,255,0.96)" stroke={preset.accent} strokeWidth="2.5" />
                  <path d="M 52 84 L 110 124 L 168 84" fill="rgba(255,255,255,0.92)" stroke={preset.accent} strokeWidth="2.5" />
                  <path d="M 52 146 L 102 114 M 168 146 L 118 114" fill="none" stroke={preset.accent} strokeWidth="2" opacity="0.34" />
                </g>
                <path d="M 118 112 L 52 178" className="acis-loader-trail" style={{ stroke: 'url(#acisTrail)' }} />
                <path d="M 136 94 L 70 160" className="acis-loader-trail" style={{ stroke: 'url(#acisTrail)', animationDelay: '0.12s' }} />
                <path d="M 88 112 L 102 126 L 132 90" className="acis-loader-check" style={{ stroke: preset.accentSoft }} />
              </g>
            ) : null}

            {preset.variant === 'process' ? (
              <g>
                <path d="M 44 110 L 76 110" className="acis-loader-data-stream" style={{ stroke: preset.accentSoft }} />
                <path d="M 176 110 L 144 110" className="acis-loader-data-stream" style={{ stroke: preset.accent }} />
                <path d="M 110 20 L 110 50" className="acis-loader-data-stream" style={{ stroke: preset.accentSoft, animationDelay: '0.18s' }} />
                <circle cx="110" cy="106" r="38" className="acis-loader-gear-primary" style={{ stroke: preset.accentSoft }} />
                <circle cx="110" cy="106" r="48" className="acis-loader-gear-secondary" style={{ stroke: preset.accent }} />
                <g className="acis-loader-server-stack" filter="url(#acisSoftShadow)">
                  <path d="M78 50 L142 50 L142 154 L78 154 Z" fill="rgba(255,255,255,0.97)" stroke={preset.accent} strokeWidth="2" />
                  <rect x="84" y="68" width="52" height="14" rx="3" fill="color-mix(in srgb, var(--c-surface) 84%, #dbeafe 16%)" stroke={preset.accent} strokeWidth="1.35" />
                  <rect x="84" y="93" width="52" height="14" rx="3" fill="color-mix(in srgb, var(--c-surface) 84%, #dbeafe 16%)" stroke={preset.accent} strokeWidth="1.35" />
                  <rect x="84" y="118" width="52" height="14" rx="3" fill="color-mix(in srgb, var(--c-surface) 84%, #dbeafe 16%)" stroke={preset.accent} strokeWidth="1.35" />
                  <circle cx="92" cy="75" r="2.5" className="acis-loader-server-light" style={{ fill: preset.accentSoft }} />
                  <circle cx="92" cy="100" r="2.5" className="acis-loader-server-light" style={{ fill: preset.accentSoft, animationDelay: '0.35s' }} />
                  <circle cx="92" cy="125" r="2.5" className="acis-loader-server-light" style={{ fill: preset.accentSoft, animationDelay: '0.7s' }} />
                </g>
              </g>
            ) : null}

            <g transform="translate(52, 156)">
              <rect width="116" height="40" rx="14" fill="rgba(255,255,255,0.96)" stroke={preset.accent} strokeWidth="2" />
              <image href={logoSrc} x="18" y="6" width="80" height="28" preserveAspectRatio="xMidYMid meet" />
              <rect className="acis-loader-pill-shine" width="44" height="48" y="-4" rx="14" fill="rgba(255,255,255,0.7)" />
            </g>
          </svg>
        </div>

        <div className="mt-5 space-y-1">
          <p className="text-lg font-black text-white">{heading}</p>
          {detail ? <p className="mx-auto max-w-md text-sm font-medium text-white/72">{detail}</p> : null}
          <p
            className="acis-loader-status mt-2 text-xs font-black uppercase tracking-[0.28em]"
            style={{ color: preset.accentSoft }}
          >
            {statusLabel}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ActionProgressOverlay;
