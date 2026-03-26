# Project Plan: Obsidian Vault MCP Server

## Overview

Build a production-ready MCP server that exposes the full Obsidian vault via structured tools for AI assistants. The server targets a personal German-language work vault with ~3600 notes containing meeting records, concepts, and project documentation.

## Status: v2.3.0 – list_modified_notes, Tool-Beschreibungen und Config-Bereinigung

Date: 2026-03-26

---

## Completed Milestones

### M1 — Core Infrastructure (v1.0.0)
- [x] TypeScript project setup with ES Module output (`module: Node16`)
- [x] SQLite database with WAL mode and foreign keys via `better-sqlite3`
- [x] Schema: `notes`, `note_participants`, `note_tags`, `note_art`, `notes_fts`
- [x] FTS5 virtual table managed manually for full insert/delete control
- [x] Relational indices for datum, folder, participant name, tag

### M2 — Vault Indexer (v1.0.0)
- [x] Recursive vault scanner respecting SKIP_DIRS
- [x] YAML frontmatter parser via `gray-matter` with fallback manual line-by-line extractor
- [x] Field support: Datum, Uhrzeit, Ort, Organisator, Teilnehmer, tags, Inhalt, Art, Vorausgegangen
- [x] Time normalization and date normalization
- [x] Delta indexing on startup with mtime comparison
- [x] Full rebuild option via `rebuild_index` tool

### M3 — File Watcher (v1.0.0)
- [x] chokidar watcher on vault root with debounce
- [x] `add`/`change` events trigger `indexSingleFile`; `unlink` events trigger `removeFile`

### M4 — MCP Server & Transport (v1.0.0)
- [x] StreamableHTTP transport (no Supergateway required)
- [x] Per-session MCP server instances in `Map<sessionId, transport>`
- [x] Session lifecycle: POST (initialize) → GET (SSE stream) → DELETE (terminate)
- [x] CORS headers, configurable port via `PORT` env variable (default: 8201)
- [x] Graceful shutdown on SIGINT/SIGTERM

### M5 — Initial Tool Set — 12 tools (v1.0.0)
- [x] `search_notes`, `read_note`, `list_participants`, `list_tags`, `vault_stats`, `rebuild_index`
- [x] `create_note`, `move_note`, `list_folders`
- [x] `update_tags`, `rename_tag`, `delete_tag`

### M6 — MCP Elicitation (v1.0.0)
- [x] `tryElicit` helper with 60-second timeout, fallback to defaults
- [x] `create_note` form for title/summary/participants/tags
- [x] `move_note` folder and file disambiguation dropdowns, move confirmation

### M7 — Smart Folder Resolution (v1.0.0)
- [x] Exact match → case-insensitive → substring → multi-word → elicitation dropdown
- [x] Max folder scan depth: 5 levels

### M8 — Tool UX Improvements (v1.1.0)
- [x] `read_note` description: explicit IMPORTANT hint for batched multi-path calls

### M9 — Tag Management Tools (v1.2.0)
- [x] `update_tags`: add/remove tags in one call; handles array/inline/single YAML formats; re-indexes after write
- [x] `rename_tag`: vault-wide rename with elicitation confirmation for bulk changes (> 5 notes)
- [x] `delete_tag`: vault-wide delete with mandatory elicitation confirmation
- [x] Fixed `SQLITE_CONSTRAINT_PRIMARYKEY` in `indexSingleFile` for FTS5 re-index

---

### M10 — Obsidian CLI Migration (v2.0.0) — CURRENT

**Motivation**: Replace the custom SQLite/chokidar/gray-matter indexer with the official Obsidian CLI (v1.12+). This eliminates the shadow database, startup indexing time, YAML parsing edge cases, and all three heavy dependencies. All vault data is now served live from Obsidian itself.

- [x] `src/cli/obsidian-cli.ts` — central CLI wrapper
  - `exec(command, params, flags)` — runs CLI, strips noise, returns stdout
  - `execJson<T>(command, params, flags)` — parses JSON output
  - `ObsidianCLIError` for typed error propagation
  - Startup noise filter (strips `YYYY-MM-DD HH:MM:SS Loading ...` lines and installer warnings)
  - `=>` prefix stripping for `eval` command output
  - 30-second timeout, 10 MB max buffer
- [x] `src/config.ts` — simplified to `VAULT_NAME` + `OBSIDIAN_BIN` (removed `VAULT_PATH`, `DB_PATH`, `SKIP_DIRS`)
- [x] Removed `src/database/` (`db.ts`, `queries.ts`) — SQLite layer deleted
- [x] Removed `src/indexer/` (`indexer.ts`, `vault-scanner.ts`, `frontmatter.ts`, `watcher.ts`) — file indexer deleted
- [x] Removed `src/tools/rebuild-index.ts` — no longer applicable
- [x] Removed `data/` directory
- [x] Removed dependencies: `better-sqlite3`, `chokidar`, `gray-matter`, `@types/better-sqlite3`
- [x] All existing 11 tools migrated to use CLI (`search-notes`, `read-note`, `list-participants`, `list-tags`, `vault-stats`, `create-note`, `move-note`, `list-folders`, `manage-tags`)
- [x] `src/index.ts` — no more DB init or watcher, instant startup with CLI connectivity check
- [x] `src/server.ts` — version `2.0.0`, 31 tools registered

### M11 — New Tool Set — 20 new tools (v2.0.0)

**Tasks (2 tools)**
- [x] `list_tasks` — list tasks by status, file, folder, or daily note; supports `todo/done/all` filter
- [x] `toggle_task` — toggle or set task status by file+line or ref

**Link Analysis (5 tools)**
- [x] `list_backlinks` — all notes linking to a specific note
- [x] `list_links` — all outgoing links from a specific note
- [x] `list_orphans` — notes with no incoming links
- [x] `list_deadends` — notes with no outgoing links
- [x] `list_unresolved` — wikilinks pointing to non-existing notes

**Properties / Frontmatter (4 tools)**
- [x] `list_properties` — all frontmatter keys vault-wide with types and counts; or per-file
- [x] `get_property` — read one property value from a note
- [x] `set_property` — write one property value to a note (typed)
- [x] `remove_property` — remove a property from a note's frontmatter

**Outline (1 tool)**
- [x] `get_outline` — note heading structure in `tree`, `json`, or `md` format

**Note Management (7 tools)**
- [x] `append_note` — append content to end of note (with optional inline mode)
- [x] `prepend_note` — insert content after frontmatter (with optional inline mode)
- [x] `rename_note` — rename a note, Obsidian updates internal links automatically
- [x] `delete_note` — delete note (trash by default; permanent flag available)
- [x] `file_info` — path, name, extension, size, created/modified timestamps
- [x] `list_files` — list files by folder and/or extension with optional count
- [x] `list_recents` — recently opened files in Obsidian

**Research (1 tool)**
- [x] `research_chain` — traces `Vorausgegangen` predecessor chain backwards to root; collects outgoing links and backlinks from all chain notes; 3-level fallback resolution (CLI → folder search → full-text search)

---

### M14 — list_modified_notes, Tool-Beschreibungen & Config-Bereinigung (v2.3.0) — CURRENT

- [x] `src/config.ts` — Filesystem-Bypass entfernt (`readFileSync`/`detectVaultPath`); zurueck zum sauberen Stand mit reinen Env-Variablen
- [x] `src/tools/note-management.ts` — `list_recents` Beschreibung: Hinweis dass kein Datum enthalten, stattdessen `list_modified_notes` nutzen
- [x] `src/tools/note-management.ts` — `file_info` Beschreibung: Warnung gegen Loop-Nutzung, stattdessen `list_modified_notes`
- [x] `src/tools/note-management.ts` — Neues Tool `list_modified_notes`: nutzt `eval`-Befehl mit `app.vault.getMarkdownFiles()` und `f.stat.mtime` — ein einziger CLI-Call statt N x `file_info`-Calls; gibt Ergebnis als Markdown-Tabelle mit Datum und Notizlink aus
- [x] `src/server.ts` — `list_modified_notes` registriert (Schema + Handler)

---

### M13 — Obsidian Deep Links, dotenv Config & Prompt Improvements (v2.2.0)

- [x] `src/tools/links.ts` — `resolveToPath()` helper; `formatObsidianLink(path)` generates `obsidian://open?vault=...&file=...` links for all path returns
- [x] `src/tools/search-notes.ts` — `search_notes` results include `obsidian://` link per result
- [x] `src/tools/note-management.ts` — `list_recents` and `list_files` results include `obsidian://` links
- [x] `src/config.ts` — `dotenv/config` import added; `vault_arbeit` set as default vault name
- [x] `src/prompts/index.ts` — prompt improvements
- [x] `src/server.ts` — updated server registration and tool routing
- [x] `package.json` + `package-lock.json` — dotenv dependency added
- [x] `src/tools/research-chain.ts` — improvements to research chain tool

### M12 — MCP Resources, Prompts & Progress Notifications (v2.1.0)

**MCP Resources**
- [x] `src/resources/notes.ts` — `handleListResources`: lists all `.md` vault files as `obsidian://note/{path}` URIs via CLI `files` command
- [x] `src/resources/notes.ts` — `handleReadResource`: reads note content by resolving the URI path via CLI `read` command
- [x] `src/server.ts` — registered `ListResourcesRequestSchema` + `ReadResourceRequestSchema` handlers
- [x] `src/server.ts` — `capabilities` extended to include `resources: {}` and `prompts: {}`

**MCP Prompts**
- [x] `src/prompts/index.ts` — 4 predefined prompts: `meeting-summary`, `research-topic`, `daily-review`, `link-suggestions`
- [x] `getPromptMessages()` — returns typed `PromptMessage[]` with `role: 'user'` and `type: 'text'` content for each prompt
- [x] `src/server.ts` — registered `ListPromptsRequestSchema` + `GetPromptRequestSchema` handlers

**Progress Notifications in `research_chain`**
- [x] `sendProgress()` helper in `research-chain.ts` — sends `notifications/progress` via `server.notification()`
- [x] `ToolHandler` type in `server.ts` updated to accept optional `meta?: Record<string, unknown>` parameter
- [x] `progressToken` extracted from `request.params._meta` in `CallToolRequest` handler and forwarded to tool handlers
- [x] 3-step progress: step 1 after input validation, step 2 after note resolution, step 3 after eval completes

---

## Known Limitations

- Obsidian must be running for tools to work; the server starts but all tool calls fail if Obsidian is not reachable
- No authentication on the HTTP endpoint (suitable for localhost use only)
- `OBSIDIAN_BIN` defaults to the macOS application path; must be configured on other platforms
- The `research_chain` tool works best with exact note names; uses fallback strategies for folder names or partial matches

---

## Potential Future Improvements

- [ ] HTTP Basic Auth or token-based auth for non-localhost deployments
- [ ] Docker container with configurable vault mount (requires Obsidian CLI headless mode)
- [ ] Test suite for CLI wrapper edge cases (timeout, malformed JSON, noise filtering)
- [ ] Periodic connectivity health check with reconnect hint
- [ ] Support for multiple vault names (multi-vault routing)
- [ ] `daily_note` tool — create or open today's daily note
- [ ] `template_note` tool — create a note from an Obsidian template
- [ ] Resource subscriptions (`resources/subscribe`) for live-updating note content in compatible clients
- [ ] Prompt arguments with enum validation (e.g. `depth: full | short`)
- [ ] Progress notifications for other long-running tools (e.g. `list_orphans` on large vaults)

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Obsidian CLI as sole backend | Eliminates shadow database, startup indexing, YAML parsing bugs, and 3 heavy dependencies; vault data is always live |
| Central `obsidian-cli.ts` wrapper | All tools share one place for timeout, buffer limit, noise filtering, and error normalization |
| `execJson` helper | Reduces boilerplate in tools that need structured data; handles empty output gracefully |
| StreamableHTTP transport | No external process required; cleaner than stdio+Supergateway for HTTP-native deployment |
| Per-session MCP server instances | Avoids shared state across concurrent AI sessions |
| Elicitation with fallback to defaults | Tools remain functional even when the MCP client does not support elicitation |
| `research_chain` multi-level fallback | Handles cases where the AI passes a folder name or partial name instead of a precise file reference |
