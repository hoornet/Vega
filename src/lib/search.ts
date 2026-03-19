/**
 * Advanced search query parser — inspired by ants (dergigi/ants).
 *
 * Supported modifiers:
 *   by:<nip05|npub|name>    — filter by author
 *   mentions:<npub|name>    — notes that tag a specific pubkey
 *   kind:<number|alias>     — filter by event kind
 *   is:<alias>              — shorthand for kind (article, note, highlight, etc.)
 *   has:<media>             — notes containing specific media (image, video, link)
 *   since:<date>            — events after date (YYYY-MM-DD)
 *   until:<date>            — events before date (YYYY-MM-DD)
 *   #hashtag                — hashtag search
 *   "quoted phrase"         — exact phrase (passed to NIP-50 search)
 *
 * Boolean:
 *   OR between terms        — runs multiple queries (client-side merge)
 *
 * Everything else is passed as NIP-50 full-text search.
 */

import { nip19 } from "@nostr-dev-kit/ndk";

export interface ParsedSearch {
  /** Text terms for NIP-50 search field */
  searchTerms: string[];
  /** Hashtags to filter by (#t tag) */
  hashtags: string[];
  /** Author pubkeys (hex) to filter by */
  authors: string[];
  /** Pubkeys mentioned in events (#p tag) */
  mentions: string[];
  /** Event kinds to search */
  kinds: number[];
  /** Media content filters (applied client-side) */
  hasFilters: string[];
  /** Unix timestamp — events after this */
  since: number | null;
  /** Unix timestamp — events before this */
  until: number | null;
  /** Original raw query for display */
  raw: string;
  /** Whether this is an OR query (multiple sub-queries) */
  orQueries: ParsedSearch[] | null;
  /** Unresolved NIP-05 identifiers that need async resolution */
  unresolvedNip05: string[];
}

const KIND_ALIASES: Record<string, number> = {
  note: 1,
  text: 1,
  article: 30023,
  "long-form": 30023,
  longform: 30023,
  reaction: 7,
  repost: 6,
  dm: 4,
  highlight: 9802,
  bookmark: 10003,
  profile: 0,
  metadata: 0,
  contacts: 3,
  relay: 10002,
  zap: 9735,
};

const IS_ALIASES: Record<string, number> = {
  ...KIND_ALIASES,
  code: 1, // client-side filter for code blocks
};

const MEDIA_PATTERNS: Record<string, RegExp> = {
  image: /\.(jpg|jpeg|png|gif|webp|avif|svg|apng)/i,
  video: /\.(mp4|webm|mov|m4v|ogg)/i,
  audio: /\.(mp3|wav|flac|m4a|ogg)/i,
  link: /https?:\/\//i,
  youtube: /youtu(\.be|be\.com)/i,
};

/**
 * Parse a date string (YYYY-MM-DD) to unix timestamp.
 * Returns null on invalid date.
 */
function parseDateToUnix(dateStr: string): number | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
}

/**
 * Try to resolve an npub to hex pubkey.
 * Returns hex pubkey or null.
 */
function resolveNpub(input: string): string | null {
  if (input.startsWith("npub1")) {
    try {
      const decoded = nip19.decode(input);
      if (decoded.type === "npub") return decoded.data;
    } catch { /* not a valid npub */ }
  }
  return null;
}

/**
 * Tokenize a query string, respecting quoted phrases.
 */
function tokenize(query: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    if (char === '"') {
      if (inQuote) {
        tokens.push(`"${current}"`);
        current = "";
        inQuote = false;
      } else {
        if (current.trim()) tokens.push(current.trim());
        current = "";
        inQuote = true;
      }
    } else if (char === " " && !inQuote) {
      if (current.trim()) tokens.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

/**
 * Parse a search query into structured search parameters.
 */
export function parseSearchQuery(raw: string): ParsedSearch {
  const trimmed = raw.trim();

  // Handle OR queries — split on top-level OR
  if (/\bOR\b/i.test(trimmed)) {
    // Simple OR split (doesn't handle OR inside quotes, good enough)
    const parts = trimmed.split(/\s+OR\s+/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return {
        searchTerms: [],
        hashtags: [],
        authors: [],
        mentions: [],
        kinds: [],
        hasFilters: [],
        since: null,
        until: null,
        raw: trimmed,
        orQueries: parts.map(parseSearchQuery),
        unresolvedNip05: [],
      };
    }
  }

  const tokens = tokenize(trimmed);
  const result: ParsedSearch = {
    searchTerms: [],
    hashtags: [],
    authors: [],
    mentions: [],
    kinds: [],
    hasFilters: [],
    since: null,
    until: null,
    raw: trimmed,
    orQueries: null,
    unresolvedNip05: [],
  };

  for (const token of tokens) {
    const lower = token.toLowerCase();

    // by:<author>
    if (lower.startsWith("by:")) {
      const value = token.slice(3);
      const hex = resolveNpub(value);
      if (hex) {
        result.authors.push(hex);
      } else if (value.includes(".") || value.includes("@")) {
        // Looks like a NIP-05 — needs async resolution
        result.unresolvedNip05.push(value);
      } else {
        // Treat as a search term for now (name-based lookup needs profile search)
        result.unresolvedNip05.push(value);
      }
      continue;
    }

    // mentions:<pubkey>
    if (lower.startsWith("mentions:")) {
      const value = token.slice(9);
      const hex = resolveNpub(value);
      if (hex) {
        result.mentions.push(hex);
      }
      continue;
    }

    // kind:<number|alias>
    if (lower.startsWith("kind:")) {
      const value = token.slice(5).toLowerCase();
      const num = parseInt(value);
      if (!isNaN(num)) {
        result.kinds.push(num);
      } else if (KIND_ALIASES[value] !== undefined) {
        result.kinds.push(KIND_ALIASES[value]);
      }
      continue;
    }

    // is:<alias>
    if (lower.startsWith("is:")) {
      const value = token.slice(3).toLowerCase();
      if (IS_ALIASES[value] !== undefined) {
        result.kinds.push(IS_ALIASES[value]);
      }
      if (value === "code") {
        result.hasFilters.push("code");
      }
      continue;
    }

    // has:<media>
    if (lower.startsWith("has:")) {
      const value = token.slice(4).toLowerCase();
      result.hasFilters.push(value);
      continue;
    }

    // since:<date>
    if (lower.startsWith("since:")) {
      const ts = parseDateToUnix(token.slice(6));
      if (ts) result.since = ts;
      continue;
    }

    // until:<date>
    if (lower.startsWith("until:")) {
      const ts = parseDateToUnix(token.slice(6));
      if (ts) result.until = ts;
      continue;
    }

    // #hashtag
    if (token.startsWith("#") && token.length > 1) {
      result.hashtags.push(token.slice(1).toLowerCase());
      continue;
    }

    // Quoted phrase — keep quotes for NIP-50
    if (token.startsWith('"') && token.endsWith('"')) {
      result.searchTerms.push(token);
      continue;
    }

    // Regular search term
    result.searchTerms.push(token);
  }

  return result;
}

/**
 * Check if an event's content matches a "has:" filter.
 */
export function matchesHasFilter(content: string, filter: string): boolean {
  if (filter === "code") {
    return content.includes("```") || content.includes("`");
  }
  const pattern = MEDIA_PATTERNS[filter];
  if (pattern) return pattern.test(content);
  // Generic: just check if the filter text appears in content
  return content.toLowerCase().includes(filter);
}

/**
 * Format a ParsedSearch back into a human-readable hint.
 */
export function describeSearch(parsed: ParsedSearch): string {
  const parts: string[] = [];
  if (parsed.searchTerms.length > 0) parts.push(parsed.searchTerms.join(" "));
  if (parsed.hashtags.length > 0) parts.push(parsed.hashtags.map((h) => `#${h}`).join(" "));
  if (parsed.authors.length > 0) parts.push(`by ${parsed.authors.length} author(s)`);
  if (parsed.kinds.length > 0) parts.push(`kind: ${parsed.kinds.join(", ")}`);
  if (parsed.hasFilters.length > 0) parts.push(`has: ${parsed.hasFilters.join(", ")}`);
  if (parsed.since) parts.push(`since ${new Date(parsed.since * 1000).toLocaleDateString()}`);
  if (parsed.until) parts.push(`until ${new Date(parsed.until * 1000).toLocaleDateString()}`);
  return parts.join(" · ") || "empty search";
}
