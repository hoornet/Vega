import "@testing-library/jest-dom";
import { vi } from "vitest";

// Ensure localStorage is available (jsdom may not provide it in all configurations)
const store = new Map<string, string>();
const localStorageShim: Storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: (index: number) => [...store.keys()][index] ?? null,
};

if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage?.getItem) {
  Object.defineProperty(globalThis, "localStorage", { value: localStorageShim, writable: true });
}

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/plugin-opener
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));
