import { create } from "zustand";
import { checkAllRelays, type RelayHealthResult } from "../lib/nostr/relayHealth";
import { getStoredRelayUrls } from "../lib/nostr";

interface RelayHealthState {
  results: RelayHealthResult[];
  checking: boolean;
  lastChecked: number | null;
  checkAll: () => Promise<void>;
}

export const useRelayHealthStore = create<RelayHealthState>((set, get) => ({
  results: [],
  checking: false,
  lastChecked: null,

  checkAll: async () => {
    if (get().checking) return;
    set({ checking: true });
    try {
      const urls = getStoredRelayUrls();
      const results = await checkAllRelays(urls);
      set({ results, lastChecked: Date.now(), checking: false });
    } catch {
      set({ checking: false });
    }
  },
}));
