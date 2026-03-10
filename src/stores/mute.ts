import { create } from "zustand";
import { fetchMuteList, publishMuteList } from "../lib/nostr";

const STORAGE_KEY = "wrystr_mutes";

function loadLocal(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveLocal(pubkeys: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pubkeys));
}

interface MuteState {
  mutedPubkeys: string[];
  fetchMuteList: (pubkey: string) => Promise<void>;
  mute: (pubkey: string) => Promise<void>;
  unmute: (pubkey: string) => Promise<void>;
}

export const useMuteStore = create<MuteState>((set, get) => ({
  mutedPubkeys: loadLocal(),

  fetchMuteList: async (pubkey: string) => {
    try {
      const pubkeys = await fetchMuteList(pubkey);
      if (pubkeys.length === 0) return;
      // Merge relay list with any local-only mutes (e.g. from npub sessions)
      const local = get().mutedPubkeys;
      const merged = Array.from(new Set([...pubkeys, ...local]));
      set({ mutedPubkeys: merged });
      saveLocal(merged);
    } catch {
      // Non-critical — local mutes still work
    }
  },

  mute: async (pubkey: string) => {
    const { mutedPubkeys } = get();
    if (mutedPubkeys.includes(pubkey)) return;
    const updated = [...mutedPubkeys, pubkey];
    set({ mutedPubkeys: updated });
    saveLocal(updated);
    publishMuteList(updated).catch(() => {}); // best-effort relay publish
  },

  unmute: async (pubkey: string) => {
    const updated = get().mutedPubkeys.filter((p) => p !== pubkey);
    set({ mutedPubkeys: updated });
    saveLocal(updated);
    publishMuteList(updated).catch(() => {});
  },
}));
