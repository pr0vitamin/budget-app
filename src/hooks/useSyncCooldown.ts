'use client';

import { useEffect, useState } from 'react';

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * Milliseconds remaining on the 1-hour sync cooldown, computed from the last
 * sync time and a LIVE clock — it ticks down and reaches 0 on its own, so
 * pull-to-refresh re-enables when the hour elapses without needing a reload.
 * (The previous implementation captured Date.now() once in a useMemo, so the
 * value froze for the whole session and the cooldown never released.)
 */
export function useSyncCooldown(lastSyncAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  if (!lastSyncAt) return 0;
  return Math.max(0, new Date(lastSyncAt).getTime() + COOLDOWN_MS - now);
}
