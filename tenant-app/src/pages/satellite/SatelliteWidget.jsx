import { useMemo } from 'react';
import { ClipboardCopy, Target } from 'lucide-react';

const CLIENTS = [
  { id: 'acme', name: 'Acme International', recency: 0.94, frequency: 0.81, status: 'Live • 2m ago', icon: '/signature/acme.png' },
  { id: 'solace', name: 'Solace Banking', recency: 0.88, frequency: 0.79, status: 'Live • 6m ago', icon: '/signature/solace.png' },
  { id: 'haven', name: 'Haven Energy', recency: 0.72, frequency: 0.86, status: 'Queued • 11m ago', icon: '/signature/haven.png' },
  { id: 'aurora', name: 'Aurora Shipping', recency: 0.64, frequency: 0.74, status: 'Syncing • 18m ago', icon: '/signature/aurora.png' },
  { id: 'atlas', name: 'Atlas Logistics', recency: 0.58, frequency: 0.77, status: 'Idle • 34m ago', icon: '/signature/atlas.png' },
];

const computeUsageScore = (client) => client.recency * 0.7 + client.frequency * 0.3;

const SatelliteWidget = () => {
  const sortedClients = useMemo(() => 
    [...CLIENTS]
      .sort((a, b) => computeUsageScore(b) - computeUsageScore(a))
      .slice(0, 5),
    []
  );

  const handleCopy = (client) => {
    window.electron?.satellite?.copy?.({ value: client.id });
  };

  const handleTrack = (client) => {
    window.electron?.satellite?.track?.(client.id);
  };

  return (
    <div className="w-[320px] rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)]/80 backdrop-blur-xl shadow-2xl">
      <div
        className="flex h-10 items-center justify-between rounded-t-2xl px-3 text-xs font-semibold text-[var(--c-text)]"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <span className="text-[var(--c-muted)]">Frequency List</span>
        <span className="text-[var(--c-accent)]">Top 5 Clients</span>
      </div>

      <div className="space-y-1 border-t border-[var(--c-border)] px-2 pb-3 pt-2">
        {sortedClients.map((client) => (
          <div
            key={client.id}
            className="flex h-10 items-center gap-2 rounded-2xl px-2 text-[var(--c-text)]"
          >
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)]">
              <img src={client.icon} alt={client.name} className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-1 flex-col justify-center truncate">
              <span className="text-xs font-bold truncate">{client.name}</span>
              <span className="text-[11px] text-[var(--c-muted)] truncate">{client.status}</span>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--c-muted)] transition hover:bg-[var(--c-accent)]/10 hover:text-[var(--c-accent)]"
                onClick={() => handleCopy(client)}
                aria-label={`Copy ${client.name}`}
                style={{ WebkitAppRegion: 'no-drag' }}
              >
                <ClipboardCopy className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--c-muted)] transition hover:bg-[var(--c-accent)]/10 hover:text-[var(--c-accent)]"
                onClick={() => handleTrack(client)}
                aria-label={`Track ${client.name}`}
                style={{ WebkitAppRegion: 'no-drag' }}
              >
                <Target className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SatelliteWidget;
