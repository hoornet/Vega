import { describe, it, expect, vi, beforeEach } from "vitest";
import { NDKEvent } from "@nostr-dev-kit/ndk";

// Mock the nostr module
vi.mock("../lib/nostr", () => ({
  connectToRelays: vi.fn(),
  fetchGlobalFeed: vi.fn(),
  fetchBatchEngagement: vi.fn(),
  getNDK: vi.fn(() => ({ pool: { relays: new Map() } })),
}));

// Mock the db module
vi.mock("../lib/db", () => ({
  dbLoadFeed: vi.fn().mockResolvedValue([]),
  dbSaveNotes: vi.fn(),
}));

import { useFeedStore } from "./feed";
import { fetchGlobalFeed, fetchBatchEngagement } from "../lib/nostr";

function makeMockNote(id: string, created_at: number): NDKEvent {
  const event = { id, created_at, content: "test", kind: 1, pubkey: "pk", tags: [], sig: "", rawEvent: () => ({ id, created_at, content: "test", kind: 1, pubkey: "pk", tags: [], sig: "" }) } as unknown as NDKEvent;
  return event;
}

describe("useFeedStore - loadTrendingFeed", () => {
  beforeEach(() => {
    useFeedStore.setState({
      notes: [],
      trendingNotes: [],
      trendingLoading: false,
      loading: false,
      connected: false,
      error: null,
      focusedNoteIndex: -1,
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("scores and sorts notes by engagement", async () => {
    const notes = [
      makeMockNote("a", 1000),
      makeMockNote("b", 1001),
      makeMockNote("c", 1002),
    ];

    const engagement = new Map([
      ["a", { reactions: 10, replies: 0, zapSats: 0 }],  // score: 10
      ["b", { reactions: 0, replies: 5, zapSats: 0 }],   // score: 15
      ["c", { reactions: 1, replies: 1, zapSats: 100 }],  // score: 5
    ]);

    vi.mocked(fetchGlobalFeed).mockResolvedValue(notes);
    vi.mocked(fetchBatchEngagement).mockResolvedValue(engagement);

    await useFeedStore.getState().loadTrendingFeed(true);

    const trending = useFeedStore.getState().trendingNotes;
    expect(trending).toHaveLength(3);
    expect(trending[0].id).toBe("b"); // highest score: 15
    expect(trending[1].id).toBe("a"); // score: 10
    expect(trending[2].id).toBe("c"); // score: 5
  });

  it("filters out notes with zero engagement", async () => {
    const notes = [
      makeMockNote("a", 1000),
      makeMockNote("b", 1001),
    ];

    const engagement = new Map([
      ["a", { reactions: 5, replies: 0, zapSats: 0 }],
      ["b", { reactions: 0, replies: 0, zapSats: 0 }],
    ]);

    vi.mocked(fetchGlobalFeed).mockResolvedValue(notes);
    vi.mocked(fetchBatchEngagement).mockResolvedValue(engagement);

    await useFeedStore.getState().loadTrendingFeed(true);

    const trending = useFeedStore.getState().trendingNotes;
    expect(trending).toHaveLength(1);
    expect(trending[0].id).toBe("a");
  });

  it("limits results to 50", async () => {
    const notes = Array.from({ length: 60 }, (_, i) => makeMockNote(`n${i}`, i));
    const engagement = new Map(
      notes.map((n) => [n.id, { reactions: 10, replies: 1, zapSats: 0 }])
    );

    vi.mocked(fetchGlobalFeed).mockResolvedValue(notes);
    vi.mocked(fetchBatchEngagement).mockResolvedValue(engagement);

    await useFeedStore.getState().loadTrendingFeed(true);

    expect(useFeedStore.getState().trendingNotes).toHaveLength(50);
  });

  it("handles empty feed gracefully", async () => {
    vi.mocked(fetchGlobalFeed).mockResolvedValue([]);

    await useFeedStore.getState().loadTrendingFeed(true);

    expect(useFeedStore.getState().trendingNotes).toHaveLength(0);
    expect(useFeedStore.getState().trendingLoading).toBe(false);
  });
});
