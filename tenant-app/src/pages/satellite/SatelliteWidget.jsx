import { useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, Target } from 'lucide-react';
import { useTenant } from '../../context/useTenant';
import { useAuth } from '../../context/useAuth';
import { subscribeToSystemCache } from '../../lib/systemCache';
import { computeUsageScore } from '../../lib/satelliteLogic';
import { db, writeBatch, serverTimestamp, increment, doc } from '../../lib/backendStore';

const SatelliteWidget = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [cache, setCache] = useState({ clients: [] });

  useEffect(() => {
    if (!tenantId) return undefined;
    const unsubscribe = subscribeToSystemCache(tenantId, setCache);
    return () => unsubscribe();
  }, [tenantId]);

  const sortedClients = useMemo(() => {
    return [...cache.clients]
      .sort((a, b) => computeUsageScore(b) - computeUsageScore(a))
      .slice(0, 5)
      .map(client => ({
        ...client,
        name: client.tradeName || client.fullName || 'Unknown Client',
        statusText: `${client.status || 'Live'} • ${client.lastAccessed ? 'Active' : 'Idle'}`,
        icon: client.photoURL || client.logoUrl || '/signature/placeholder.png'
      }));
  }, [cache.clients]);

  const recordActivity = async (clientId) => {
    if (!tenantId || !user?.uid || !clientId) return;
    try {
      const batch = writeBatch(db);
      const clientRef = doc(db, 'tenants', tenantId, 'clients', clientId);
      batch.update(clientRef, {
        hitCount: increment(1),
        lastAccessed: serverTimestamp(),
        updatedBy: user.uid // UID Supremacy: Only raw UID
      });
      await batch.commit();
    } catch (error) {
      console.warn('[Satellite] Failed to record activity:', error);
    }
  };

  const handleCopy = async (client) => {
    window.electron?.satellite?.copy?.({ value: client.displayClientId || client.id });
    await recordActivity(client.id);
  };

  const handleTrack = async (client) => {
    window.electron?.satellite?.track?.(client.id);
    await recordActivity(client.id);
  };

  return (
    <div className="w-[320px] overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)]/80 backdrop-blur-xl shadow-2xl">
      <div
        className="flex h-10 items-center justify-between px-3 text-xs font-semibold text-[var(--c-text)]"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <span className="text-[var(--c-muted)]">Frequency List</span>
        <span className="text-[var(--c-accent)]">Top 5 Clients</span>
      </div>

      <div className="space-y-1 border-t border-[var(--c-border)] px-2 pb-3 pt-2">
        {sortedClients.length === 0 ? (
          <div className="flex h-10 items-center justify-center text-[10px] text-[var(--c-muted)]">
            No active clients in cache
          </div>
        ) : null}
        {sortedClients.map((client) => (
          <div
            key={client.id}
            className="flex h-10 items-center gap-2 rounded-2xl px-2 text-[var(--c-text)] transition hover:bg-[var(--c-accent)]/5"
          >
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)]">
              <img src={client.icon} alt={client.name} className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-1 flex-col justify-center truncate">
              <span className="text-xs font-bold truncate leading-none">{client.name}</span>
              <span className="mt-0.5 text-[10px] text-[var(--c-muted)] truncate leading-none">{client.statusText}</span>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--c-muted)] transition hover:bg-[var(--c-accent)]/10 hover:text-[var(--c-accent)]"
                onClick={() => handleCopy(client)}
                aria-label={`Copy ${client.name}`}
                style={{ WebkitAppRegion: 'no-drag' }}
              >
                <ClipboardCopy strokeWidth={1.5} className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--c-muted)] transition hover:bg-[var(--c-accent)]/10 hover:text-[var(--c-accent)]"
                onClick={() => handleTrack(client)}
                aria-label={`Track ${client.name}`}
                style={{ WebkitAppRegion: 'no-drag' }}
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
