import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDeletedEntities } from '../lib/backendStore';
import { useRecycleBin } from '../context/useRecycleBin';

const toCount = (value) => (Number.isFinite(value) ? value : 0);

export const useRecycleBinSummary = (tenantId, domains) => {
  const { registerRestoreListener } = useRecycleBin();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);

  const safeDomains = useMemo(
    () => (Array.isArray(domains) ? domains.filter(Boolean) : []),
    [domains],
  );

  const refresh = useCallback(async () => {
    if (!tenantId || safeDomains.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        safeDomains.map(async (domain) => {
          const res = await fetchDeletedEntities(tenantId, domain);
          return {
            domain,
            count: res.ok && Array.isArray(res.rows) ? res.rows.length : 0,
          };
        }),
      );
      const next = results.reduce((acc, item) => {
        acc[item.domain] = item.count;
        return acc;
      }, {});
      setCounts(next);
    } finally {
      setLoading(false);
    }
  }, [tenantId, safeDomains]);

  useEffect(() => {
    let active = true;
    if (!active) return;
    void refresh();
    const unsubscribe = registerRestoreListener(() => {
      void refresh();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refresh, registerRestoreListener]);

  const total = useMemo(
    () => safeDomains.reduce((sum, domain) => sum + toCount(counts[domain]), 0),
    [counts, safeDomains],
  );

  return { counts, total, loading, refresh };
};

