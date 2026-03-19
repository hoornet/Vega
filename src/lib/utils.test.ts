import { describe, it, expect, vi, afterEach } from "vitest";
import { timeAgo, shortenPubkey } from "./utils";

describe("timeAgo", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns seconds for < 60s", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 30)).toBe("30s");
  });

  it("returns minutes for < 1h", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 300)).toBe("5m");
  });

  it("returns hours for < 1d", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 7200)).toBe("2h");
  });

  it("returns days for < 1w", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 86400 * 3)).toBe("3d");
  });

  it("returns weeks for >= 1w", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 604800 * 2)).toBe("2w");
  });

  it("returns 0s for current timestamp", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now)).toBe("0s");
  });
});

describe("shortenPubkey", () => {
  it("shortens a standard hex pubkey", () => {
    const key = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    expect(shortenPubkey(key)).toBe("abcdef12…7890");
  });

  it("handles short strings gracefully", () => {
    expect(shortenPubkey("abcd")).toBe("abcd…abcd");
  });
});
