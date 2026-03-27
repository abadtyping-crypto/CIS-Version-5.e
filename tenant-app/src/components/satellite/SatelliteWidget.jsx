import { ClipboardCopy, Target, Pin, X } from 'lucide-react';

const FREQUENCY_ROWS = [
  {
    id: 'now',
    title: 'Latest Signature',
    subtitle: 'Active • 2m ago',
    icon: '/signature/primary.png',
  },
  {
    id: 'today',
    title: 'Today's Resonance',
    subtitle: 'Scheduled • 09:30',
    icon: '/signature/today.png',
  },
  {
    id: 'queue',
    title: 'Queued Pulses',
    subtitle: 'Awaiting field confirmation',
    icon: '/signature/queue.png',
  },
];

const SatelliteWidget = () => {
  return (
    <div className="w-[320px] rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)]/80 backdrop-blur-xl shadow-2xl">
      <div
        className="flex h-10 items-center justify-between rounded-t-2xl bg-[color:color-mix(in_srgb,var(--c-panel)_90%,var(--c-surface)_80%)] px-3 text-xs font-semibold text-[var(--c-text)]"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex items-center gap-2">
          <Pin strokeWidth={1.5} className="h-4 w-4 text-[var(--c-accent)]" />
          <span>Always on Top</span>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--c-muted)] transition hover:bg-[var(--c-accent)]/10 hover:text-[var(--c-text)]"
          style={{ WebkitAppRegion: 'no-drag' }}
          aria-label="Close to tray"
        >
          <X strokeWidth={1.5} className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1 px-2 pb-3 pt-1">
        {FREQUENCY_ROWS.map((row) => (
          <div
            key={row.id}
            className="flex h-10 items-center gap-2 rounded-2xl border border-transparent px-2 text-xs text-[var(--c-text)] transition hover:border-[var(--c-border)]"
          >
            <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)]">
              <img
                src={row.icon}
                alt={row.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col justify-center leading-tight">
              <span className="truncate font-semibold text-[var(--c-text)]">{row.title}</span>
              <span className="truncate text-[var(--c-muted)]">{row.subtitle}</span>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--c-muted)] transition hover:bg-[var(--c-accent)]/10 hover:text-[var(--c-accent)]"
                aria-label="Copy"
              >
                <ClipboardCopy strokeWidth={1.5} className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--c-muted)] transition hover:bg-[var(--c-accent)]/10 hover:text-[var(--c-accent)]"
                aria-label="Track"
              >
                <Target strokeWidth={1.5} className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SatelliteWidget;
