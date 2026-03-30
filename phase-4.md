20th March 2026 10h

A series of sprints from Claude.ai:

A few things I noticed that directly informed the suggestions:

Writing: 
The editor is a raw <textarea> with font-family: var(--font-mono) inherited from body. For a client whose entire identity is long-form writing, this is the single biggest gap. Sprint 1 addresses this directly.
Reading: The prose-article class uses 15px monospace at 1.8 line height. That's readable but not comfortable for long articles. Sprint 2 fixes the typography properly.
The 280 char limit in ComposeBox.tsx is a Twitter holdover — Nostr has no protocol limit. That one's a quick win.
WoT is the big unimplemented feature your own ROADMAP flagged as "needs design session" — Sprint 3 provides that design in enough detail for Claude Code to execute on it.
Everything references the actual file names, function names, and CSS class names from your codebase, so Claude Code should be able to follow it without guesswork.



# wrystr — improvement suggestions for v0.9+

Based on a thorough read of the actual v0.8.1 codebase. Goal: make wrystr
the best desktop Nostr client for reading and writing, bar none.

The vision from ROADMAP.md is right: **long-form content is the identity**.
These suggestions push that vision further, fix real gaps observed in the code,
and add the missing pieces that would make this a daily driver people actively
recommend over every alternative.

---

## Sprint 1 — The writing experience deserves to be great

The article editor currently uses a plain `<textarea>` with a markdown toolbar.
That's fine for basics, but for a client whose identity is long-form writing,
it should feel like a joy to use — not a GitHub PR description box.

### 1.1 Replace textarea with a proper rich editor

The current editor in `ArticleEditor.tsx` is a raw `<textarea>` with toolbar
buttons that inject markdown syntax. This works but feels primitive for the
stated vision. Replace it with a CodeMirror 6 or Milkdown instance:

- CodeMirror 6 with `@codemirror/lang-markdown` gives syntax highlighting
  in the editor itself (headings render larger, bold shows bold, links are
  underlined) without losing the raw markdown output needed for NIP-23
- Alternatively, Milkdown gives a WYSIWYG mode that still outputs clean markdown
- Either choice keeps the existing `publishArticle()` flow unchanged —
  the editor just produces better markdown string output
- Add a proper focus mode: hide the toolbar and sidebar, center the text column,
  increase font size, use a proportional serif font instead of JetBrains Mono
  for the writing surface (the body is currently rendered in mono which is
  readable but not ideal for long prose)

### 1.2 Focus / Zen mode for writing

Currently the editor shares the screen with the sidebar and header chrome.
Add a true fullscreen writing mode (Tauri `set_fullscreen` + hide all chrome):

- Triggered by `F11` or a button in the editor header
- Shows only: title input, content area, word count
- Subtle exit hint at the top (disappears after 2s)
- Saves draft on every keystroke as it does now — no data loss risk

### 1.3 Article table of contents (already in ROADMAP backlog)

Already noted as remaining work. Implementation path:
- Parse h2/h3 headings from the rendered article content in `ArticleView.tsx`
- Render a floating TOC panel on the right side (sticky, hidden if article has
  no headings)
- Clicking a heading smoothly scrolls to it
- Highlight the current section as the user scrolls
- The `max-w-2xl mx-auto` container in `ArticleView.tsx` already leaves
  whitespace on the right at normal desktop widths — the TOC fits there
  without layout changes

### 1.4 Article version history

NIP-23 articles are parameterized replaceable events — every publish
overwrites the previous version on relays, but older versions can still be
fetched with a `since`/`until` filter on the `d` tag. Expose this:

- "History" button in the article reader header (only shown for your own articles)
- Shows a list of previous versions with timestamps and word counts
- Click to view any historical version (read-only)
- Useful for writers who want to see their own edits over time

### 1.5 Auto-save indicator and publish confidence

The editor already auto-saves drafts. Surface this more clearly:

- Show "saved locally X seconds ago" in the editor footer
- Distinguish between "draft saved locally" and "published to relays"
- After publishing, show which relays accepted the event
  (NDK's `publish()` returns relay confirmation — wire this up)
- If zero relays confirm, show a warning rather than silent success

---

## Sprint 2 — The reading experience should be world-class

### 2.1 Serif font for the article reader

The current `prose-article` class in `index.css` uses the inherited monospace
font at 15px/1.8. For long-form reading, a proportional serif or sans-serif
reading font is dramatically more comfortable. Specifically:

- Load a reading font via Tauri's asset system (no web request needed):
  `iA Writer Quattro` (open source), `Lora` (Google Fonts, can be bundled),
  or simply fall back to the system serif (`Georgia, 'Times New Roman', serif`)
- Apply it only to `.prose-article` — the rest of the app keeps JetBrains Mono
- Increase base size to 17–18px for reading comfort
- Tighten max-width to ~65ch (roughly 650px) for optimal line length
- The current `max-w-2xl` (42rem / 672px) is close but not precise for the
  actual body text column

### 2.2 Reading progress indicator

A thin progress bar at the top of the article view showing scroll position.
Simple CSS + a scroll event listener on the article container. Takes ~20 lines.
High perceived polish for minimal effort.

### 2.3 Article reading history (ROADMAP backlog item)

Already noted as remaining work. The `markArticleRead()` function exists in the
bookmarks store. Extend it to:

- Track *all* articles opened, not just bookmarked ones (use a separate
  `readingHistory` store backed by SQLite, not localStorage)
- Show a "Recently read" section on the Articles feed idle screen
- Let users clear history
- Show "you read this X days ago" in the article header if applicable

### 2.4 Estimated reading time refinement

Currently uses `words / 230` which is a reasonable default but ignores:

- Code blocks (should be counted differently or excluded)
- Images (add ~12 seconds per image, common practice)
- Show as a range for very long articles: "14–18 min read"

### 2.5 Inline nostr:naddr / nostr:note previews inside articles

Article content can contain `nostr:` links. The feed already renders
`nostr:note1…` as inline cards (`QuotePreview`). Apply the same treatment
inside the article reader's markdown renderer — when a paragraph contains
only a `nostr:` link, render it as an embedded card rather than a plain
hyperlink. This makes cross-referenced articles feel richly interconnected.

---

## Sprint 3 — Web of Trust (ROADMAP: needs design session)

This is the highest-leverage unimplemented feature. The ROADMAP correctly
identifies it as needing a design session — here is that design.

### 3.1 WoT graph computation in Rust

The follows graph (kind:3 events) is already fetched. The missing piece is
computing graph distance:

- Add a Rust command `compute_wot_scores(my_pubkey, follows_json)` that takes
  the serialized follow lists and returns a `HashMap<pubkey, depth>` where
  depth 1 = direct follow, depth 2 = follows-of-follows, etc.
- Store scores in SQLite (`wot_scores` table with pubkey + score + updated_at)
- Refresh on login and every 6 hours in the background
- Expose as a Zustand store `useWotStore` with `getScore(pubkey): number | null`

### 3.2 WoT feed filter

Add a third tab to the feed: **WoT** (alongside Global and Following):

- Shows notes from depth ≤ 2 (configurable in Settings)
- Dramatically better signal-to-noise than Global
- Sort by a simple engagement-weighted score: `recency + (likes * 0.3) + (zaps * 0.5)`
- No external algorithm server — fully local, fully private

### 3.3 WoT trust badges on profiles

- Show a subtle "✓ 2nd degree" or "✓ follows you" badge on profiles and note
  author names
- Use `useWotStore().getScore(pubkey)` — already available once 3.1 is done
- Apply to: note cards, profile view header, DM conversation list

### 3.4 WoT-powered search ranking (ROADMAP backlog item)

When search results come back, re-rank them by WoT score. Notes from people
closer in the graph surface first. Wire into `src/lib/search.ts`.

---

## Sprint 4 — NIP-46 Remote Signer (ROADMAP: listed as incomplete)

### 4.1 NIP-46 connection flow

The ROADMAP notes this as the completion of the multi-account story. NDK has
`NDKNip46Signer` — this is primarily a UX problem, not a protocol problem:

- Add a "Connect remote signer" option in the Add Account flow (alongside
  "New account" and "Login with nsec")
- User pastes a `bunker://` URI or scans a QR code
- Wrystr connects to the relay in the URI and negotiates signing
- On event sign, sends the sign request to the remote signer, waits for approval
- Show a "waiting for approval on your signer…" state in the UI during signing
- Compatible with Nsecbunker, Amber (Android), and any NIP-46 server

---

## Sprint 5 — Notes feed quality of life

These are smaller improvements to the core feed experience based on what
the current code reveals is missing.

### 5.1 Compose box: proportional font option

The compose textarea inherits `font-family: var(--font-mono)` from `body`
in `index.css`. Notes are prose, not code. Consider offering a toggle
(persisted to localStorage) to switch the compose area to a proportional font.
This is a personal preference — make it a setting rather than a hard change.

### 5.2 Note character limit is hardcoded at 280

`ComposeBox.tsx` shows a warning at 280 chars and blocks publish (`overLimit`).
Nostr has no protocol character limit — 280 is a Twitter legacy assumption.
Change the limit to something more generous (e.g. 4000 chars) or remove the
hard block entirely and show a soft warning instead. Many Nostr users write
longer notes than 280 chars.

### 5.3 Thread view: load more replies

The thread view fetches replies with `limit: 200` which is fine for most
threads. Add a "load more" button for popular threads where 200 isn't enough.
Also consider lazy-loading nested replies (replies to replies) on demand rather
than all at once.

### 5.4 Hashtag pages

Clicking a `#hashtag` in a note currently goes to a search result page.
It should go to a dedicated hashtag feed — a live subscription to `#t` filter
showing the stream as it comes in, with a header showing the tag name and
perhaps trending articles with that tag at the top.

### 5.5 OS-level push notifications via Tauri

Currently notifications are in-app only (the 🔔 badge clears on open).
Wrystr already has system tray support. Extend to OS-level notifications:

- Use `tauri-plugin-notification` for DMs, zaps received, and mentions
- Ask for permission on first launch (standard OS notification permission flow)
- Per-type toggle in Settings: "Notify me for DMs / zaps / mentions"
- This is the single biggest advantage desktop has over web clients —
  it should be a headline feature, not an afterthought

---

## Sprint 6 — Polish and trust signals

These are the details that separate "good" from "the one I recommend to everyone".

### 6.1 NIP-05 verification badge on note cards

NIP-05 verification is checked on profile view already. Show a small ✓ badge
next to author names on note cards too (cached, not re-fetched per note).
Only show for verified accounts where the check has succeeded.

### 6.2 Syntax highlighting in code blocks

The article reader renders ` ```code``` ` blocks with a monospace background
but no syntax highlighting. Add `highlight.js` or `prism.js` (small, can be
loaded from local asset):

- Auto-detect language from the fenced code block label (` ```typescript `)
- Apply in `renderMarkdown()` in `src/lib/nostr/` wherever markdown is rendered
- Use a dark theme consistent with the app's `#0a0a0a` background

### 6.3 Article cover image aspect ratio consistency

Currently `max-h-72 object-cover` in `ArticleView.tsx`. On very tall portrait
images this crops aggressively. Use a fixed aspect ratio container (`aspect-video`
/ 16:9) so all cover images present consistently regardless of source dimensions.

### 6.4 Search relay discovery (ROADMAP backlog item)

The ROADMAP notes `kind:10007` search relay discovery as remaining. When a
user runs a search and the connected relays don't support NIP-50, show a hint:
"Your relays may not support full-text search. Discover search-capable relays →"
with a one-click add for known good ones (e.g. relay.nostr.band).

### 6.5 Export / backup improvements

Data export (bookmarks, follows, relay list) was shipped in v0.8.0. Extend to:

- Export all authored notes and articles as JSON or markdown files
- This is a genuine "your data, your keys" feature that differentiates from
  every web client
- Implementation: query the SQLite cache for events authored by the user's pubkey

---

## Context for Claude Code

**Stack:** Tauri 2.0 (Rust) + React 19 + TypeScript + NDK 3.x + Tailwind CSS 4 + Zustand + SQLite (rusqlite)

**Key files:**
- `src/components/article/ArticleEditor.tsx` — article editor (textarea + toolbar)
- `src/components/article/ArticleView.tsx` — article reader
- `src/index.css` — all prose styles (`.prose-article`, `.article-preview`)
- `src/lib/nostr/client.ts` — all Nostr interactions (publishArticle, fetchDMConversations, etc.)
- `src/stores/` — Zustand stores per domain
- `src-tauri/src/lib.rs` — Rust command registration
- `AGENTS.md` — coding conventions (functional components, no `any`, Tailwind only)

**Hard constraints from AGENTS.md:**
- Functional React components only, no class components
- Never use `any` — define types in `src/types/`
- Tailwind classes only — no inline styles (except unavoidable `WebkitUserSelect`)
- Private keys only via Rust `keyring` crate, never in JS
- NDK interactions only through `src/lib/nostr/` wrapper
- New Zustand store per domain for new features

**Priority order:** Reading/writing experience (Sprints 1–2) → WoT (Sprint 3) →
NIP-46 (Sprint 4) → Feed QoL (Sprint 5) → Polish (Sprint 6)


