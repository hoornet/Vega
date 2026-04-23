import { useEffect, useState } from "react";
import { fetchZapCount } from "../lib/nostr";
import { useWoTStore } from "../stores/wot";

interface ZapData { count: number; totalSats: number; }

// Cache key embeds WoT state so filtered / unfiltered totals don't collide.
const cache = new Map<string, ZapData>();
const pending = new Map<string, Promise<ZapData>>();
let activeCount = 0;
const MAX_CONCURRENT = 4;
const queue: Array<() => void> = [];

function keyFor(eventId: string, wotActive: boolean): string {
  return wotActive ? `${eventId}|wot` : eventId;
}

function runNext() {
  if (queue.length > 0 && activeCount < MAX_CONCURRENT) {
    const next = queue.shift()!;
    next();
  }
}

function throttledFetch(cacheKey: string, eventId: string, wotSet?: Set<string>): Promise<ZapData> {
  if (pending.has(cacheKey)) return pending.get(cacheKey)!;

  const promise = new Promise<ZapData>((resolve) => {
    const doFetch = () => {
      activeCount++;
      fetchZapCount(eventId, wotSet)
        .then(resolve)
        .catch(() => resolve({ count: 0, totalSats: 0 }))
        .finally(() => {
          activeCount--;
          pending.delete(cacheKey);
          runNext();
        });
    };

    if (activeCount < MAX_CONCURRENT) {
      doFetch();
    } else {
      queue.push(doFetch);
    }
  });

  pending.set(cacheKey, promise);
  return promise;
}

export function useZapCount(eventId: string, enabled = true): ZapData | null {
  const wotEnabled = useWoTStore((s) => s.enabled);
  const wotSet = useWoTStore((s) => s.wotSet);
  const wotActive = wotEnabled && wotSet.size > 0;
  const cacheKey = keyFor(eventId, wotActive);

  const [data, setData] = useState<ZapData | null>(() => cache.get(cacheKey) ?? null);

  useEffect(() => {
    if (!enabled) return;
    if (cache.has(cacheKey)) {
      setData(cache.get(cacheKey)!);
      return;
    }
    let cancelled = false;
    throttledFetch(cacheKey, eventId, wotActive ? wotSet : undefined).then((d) => {
      if (!cancelled) {
        cache.set(cacheKey, d);
        setData(d);
      }
    });
    return () => { cancelled = true; };
  }, [cacheKey, enabled]);

  return data;
}
