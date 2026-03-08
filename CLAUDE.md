# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Wrystr is a cross-platform Nostr desktop client built with Tauri 2.0 (Rust) + React + TypeScript. It connects to Nostr relays via NDK (Nostr Dev Kit) and aims for Telegram Desktop-quality UX.

## Commands

```bash
npm run tauri dev       # Run full app with hot reload (recommended for development)
npm run dev             # Vite-only dev server (no Tauri window)
npm run build           # TypeScript compile + Vite build
npm run tauri build     # Production binary
```

Prerequisites: Node.js 20+, Rust stable, `@tauri-apps/cli`

## Architecture

**Frontend** (`src/`): React 19 + TypeScript + Vite + Tailwind CSS 4

- `src/App.tsx` — root component, view routing via UI store
- `src/stores/` — Zustand stores per domain: `feed.ts`, `user.ts`, `ui.ts`
- `src/lib/nostr/` — NDK wrapper; all Nostr calls go through here, never direct NDK in components
- `src/types/nostr.ts` — shared TypeScript interfaces (NostrProfile, NostrNote, RelayInfo)
- `src/components/feed/` — Feed, NoteCard, NoteContent
- `src/components/shared/` — LoginModal, RelaysView, SettingsView
- `src/components/sidebar/` — Sidebar navigation

**Backend** (`src-tauri/`): Rust + Tauri 2.0

- `src-tauri/src/lib.rs` — Tauri app init and command registration
- Rust commands must return `Result<T, String>`
- Future: OS keychain for key storage, SQLite, lightning integration

## Key Conventions (from AGENTS.md)

- Functional React components only — no class components
- Never use `any` — define types in `src/types/`
- Tailwind classes only — no inline styles
- Private keys must never be exposed to JS; use OS keychain via Rust
- New Zustand stores per domain when adding features
- NDK interactions only through `src/lib/nostr/` wrapper

## NIP Priority Reference

- **P1 (core):** NIP-01, 02, 03, 10, 11, 19, 21, 25, 27, 50
- **P2 (monetization):** NIP-47 (NWC/Lightning), NIP-57 (zaps), NIP-65 (relay lists)
- **P3 (advanced):** NIP-04/44 (DMs), NIP-23 (articles), NIP-96 (file storage)

## Current State

Implemented: relay connection, global feed, note rendering, login (nsec/npub), sidebar navigation, Zustand stores.

Not yet implemented: compose/post, reactions, zaps, DMs, profile editing, SQLite storage, OS keychain integration.
