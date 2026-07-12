"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getMemberPaymentSnapshot } from "@/lib/supabase";
import { memberCache } from "@/lib/member-cache";

/**
 * Returns the number of members with outstanding dues.
 *
 * BEFORE: Polled Supabase every 10 seconds (full members SELECT *).
 * AFTER:  Derived from cache — zero network, re-computes only when cache version bumps.
 */
export function useDuesCount() {
  const cacheVersion = useSyncExternalStore(
    memberCache.subscribe,
    memberCache.getSnapshot,
    // Server snapshot (SSR) — always 0
    () => 0
  );

  return useMemo(() => {
    if (!memberCache.isReady()) return 0;
    const members = memberCache.getAllMembers();
    return members.filter((m) => {
      const snapshot = getMemberPaymentSnapshot(m);
      return snapshot.isDue;
    }).length;
  }, [cacheVersion]);
}
