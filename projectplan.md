# Project Plan: Obsidian Vault MCP Server

## Overview

Build a production-ready MCP server that indexes an Obsidian vault into SQLite/FTS5 and exposes structured query tools for AI assistants. The server targets a personal German-language work vault with ~3600 notes containing meeting records, concepts, and project documentation.

## Status: v1.1.0 – Tool UX Improvements

Date: 2026-03-24

---

## Completed Milestones

### M1 — Core Infrastructure
- [x] TypeScript project setup with ES Module output (`module: Node16`)
- [x] SQLite database with WAL mode and foreign keys via `better-sqlite3`
- [x] Schema: `notes`, `note_participants`, `note_tags`, `note_art`, `notes_fts`
- [x] FTS5 virtual table managed manually for full insert/delete control
- [x] Indexed columns: title, inhalt (summary), body
- [x] Relational indices for datum, folder, participant name, tag

### M2 — Vault Indexer
- [x] Recursive vault scanner respecting SKIP_DIRS
- [x] YAML frontmatter parser via `gray-matter` with fallback manual line-by-line extractor for malformed YAML
- [x] Field support: Datum, Uhrzeit, Ort, Organisator, Teilnehmer, tags, Inhalt, Art, Vorausgegangen
- [x] Time normalization: YAML parses `10:00` as integer 600 (minutes) — converted back to `"10:00"`
- [x] Date normalization: handles JS Date objects and string formats, returns YYYY-MM-DD
- [x] Delta indexing on startup: mtime comparison (1 second tolerance), skips unchanged files
- [x] Full rebuild option via `rebuild_index` tool
- [x] Batch transaction for performance on initial index build
- [x] Error tolerance: up to 5 individual file errors logged, remainder counted silently

### M3 — File Watcher
- [x] chokidar watcher on vault root
- [x] Ignores SKIP_DIRS and dot-files
- [x] Debounce via `awaitWriteFinish` (500ms stability threshold, 100ms poll)
- [x] `add` and `change` events trigger `indexSingleFile`
- [x] `unlink` events trigger `removeFile`
- [x] Singleton pattern — only one watcher instance

### M4 — MCP Server & Transport
- [x] StreamableHTTP transport (no Supergateway required)
- [x] Per-session MCP server instances stored in a `Map<sessionId, transport>`
- [x] Session lifecycle: POST (initialize) → GET (SSE stream) → DELETE (terminate)
- [x] CORS headers for all origins
- [x] Graceful shutdown on SIGINT/SIGTERM: closes all sessions, stops HTTP, closes DB
- [x] Configurable port via `PORT` env variable (default: 8201)

### M5 — MCP Tools (9 total)
- [x] `search_notes` — FTS5 + structured filters (date range, participants, tags, art, folder), sorted by relevance or date
- [x] `read_note` — full note content by relative path; accepts `paths` array for bulk reads in a single call
- [x] `list_participants` — all participants with frequency, optional filter
- [x] `list_tags` — all tags with frequency, optional filter
- [x] `vault_stats` — total count, date range, top participants, top tags, folder breakdown
- [x] `rebuild_index` — full index rebuild triggered on demand
- [x] `create_note` — creates note in `📥 Inbox` with elicitation form for metadata
- [x] `move_note` — moves note between folders with smart resolution and confirmation
- [x] `list_folders` — lists all vault folders with optional filter

### M6 — MCP Elicitation
- [x] `tryElicit` helper with 60-second timeout
- [x] Returns `null` on timeout, unsupported client, or user cancel — tools fall back to defaults
- [x] `create_note`: form asking for title, summary, participants, tags
- [x] `move_note`: folder disambiguation dropdown, file disambiguation dropdown, move confirmation

### M7 — Smart Folder Resolution (move_note)
- [x] Exact match first
- [x] Case-insensitive last-segment match
- [x] Substring match anywhere in path
- [x] Multi-word: all words must appear in path
- [x] Disambiguation via elicitation dropdown when multiple matches found
- [x] Max folder scan depth: 5 levels

### M8 — Query Engine
- [x] FTS5 query escaping: each term quoted with `"..."`, internal quotes doubled
- [x] Participant filter: AND logic with LIKE `%term%` partial matching (one JOIN per participant)
- [x] Tag filter: OR logic with IN clause
- [x] Art filter: OR logic with IN clause
- [x] Correct binding order: JOIN bindings before WHERE bindings before LIMIT

### M9 — Configuration & Operations
- [x] Environment variable overrides for `VAULT_PATH`, `DB_PATH`, `PORT`
- [x] launchd plist configuration documented for macOS auto-start
- [x] `data/obsidian.db` and `dist/` excluded from git
- [x] `node_modules/` excluded from git

---

### M10 — Tool UX Improvements (v1.1.0)
- [x] `read_note` description strengthened: explicit IMPORTANT hint to always pass all paths in a single array call rather than calling once per note; prevents unnecessary round trips in AI-driven workflows

---

## Known Limitations

- Vault path defaults to a hardcoded macOS iCloud path; must be set via `VAULT_PATH` env var on other machines
- No authentication on the HTTP endpoint (suitable for localhost use only)
- FTS5 table is not content-synced — a crash between note write and FTS insert could leave stale data (resolved by `rebuild_index`)
- `search_notes` `folder` filter requires exact folder name (no partial matching); use `list_folders` first to find the exact name

---

## Potential Future Improvements

- [ ] Add full-text search for body content in `search_notes` result previews (snippets)
- [ ] Add `delete_note` tool with elicitation confirmation
- [ ] Add `rename_note` tool
- [ ] HTTP Basic Auth or token-based auth for non-localhost deployments
- [ ] Docker container with configurable vault mount
- [ ] Test suite for frontmatter parser edge cases
- [ ] Test suite for FTS5 query escaping
- [ ] Periodic index consistency check (verify FTS rows match notes table)
- [ ] Support for multiple vault paths
- [ ] Markdown link graph indexing (backlinks, forward links)

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| StreamableHTTP transport | No external process required; cleaner than stdio+Supergateway for HTTP-native deployment |
| Per-session MCP server instances | Avoids shared state across concurrent AI sessions |
| Synchronous `better-sqlite3` | Simpler code in indexer and query layer; SQLite is fast enough for single-user local use |
| Manual FTS5 management | Allows precise control over when rows appear in FTS vs notes table; avoids FTS content-table sync issues |
| Delta index on startup | Startup time stays fast (<200ms for unchanged vault); no need for a separate "index freshness" mechanism |
| chokidar file watcher | Cross-platform, battle-tested; handles atomic saves and write debouncing |
| Elicitation with fallback to defaults | Tools remain functional even when the MCP client doesn't support elicitation |
| SKIP_DIRS as a Set | O(1) lookup when scanning tens of thousands of files |
