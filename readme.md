# Obsidian Vault MCP Server

A Model Context Protocol (MCP) server that indexes an Obsidian vault into a SQLite/FTS5 database and exposes 9 tools for searching, reading, and managing notes. The server uses the StreamableHTTP transport with per-session management and requires no Supergateway dependency.

## Features

- **SQLite/FTS5 index** for fast full-text search across ~3600 Obsidian notes
- **YAML frontmatter parsing** for structured metadata: Datum, Uhrzeit, Ort, Organisator, Teilnehmer, tags, Inhalt, Art, Vorausgegangen
- **Delta indexing on startup** — compares mtime values, only re-indexes changed files
- **Live file watcher** (chokidar) for real-time index updates when notes change on disk
- **9 MCP tools** covering search, read, write, and vault management
- **MCP Elicitation support** for interactive user forms, confirmations, and dropdown selections
- **Smart folder resolution** with multi-word matching and disambiguation via user interaction
- **StreamableHTTP server** on port 8201 with full session lifecycle (create, reuse, terminate)
- **launchd service** configuration for automatic startup on macOS
- **Robust YAML parser** with fallback line-by-line extraction for malformed frontmatter
- **Time normalization** — YAML parses `10:00` as 600 minutes; the parser converts it back to `"10:00"`
- **FTS5 query escaping** for special characters to prevent query parse errors

## Requirements

- Node.js 22+
- macOS (iCloud vault path assumed; configurable via environment variables)
- An Obsidian vault with YAML frontmatter in markdown files

## Installation

```bash
git clone <repository-url>
cd my-obsidien-mcp
npm install
npm run build
```

## Configuration

The server reads the vault path and database path from environment variables with sensible defaults:

| Variable    | Default                                                                                      | Description                        |
|-------------|----------------------------------------------------------------------------------------------|------------------------------------|
| `VAULT_PATH` | `/Users/aFinken/Library/Mobile Documents/iCloud~md~obsidian/Documents/vault_arbeit` | Absolute path to Obsidian vault    |
| `DB_PATH`    | `<project-root>/data/obsidian.db`                                                            | Absolute path to SQLite database   |
| `PORT`       | `8201`                                                                                       | HTTP port for the MCP server       |

Directories excluded from indexing (configured in `src/config.ts`):

```
.obsidian, .smart-env, .trash, .claude, .makemd, .space,
.smtcmp_json_db, Excalidraw, attachments, 📂 Vorlagen
```

## Running the Server

```bash
# Build and start
npm run build
npm start

# Development (watch mode for TypeScript recompilation)
npm run dev
```

The server logs startup progress to stderr:

```
[obsidian-mcp] Building index (delta)...
[obsidian-mcp] Index ready: 12 indexed, 3588 unchanged, 0 removed
[obsidian-mcp] File watcher started
[obsidian-mcp] StreamableHTTP server running on http://localhost:8201/mcp
```

## Auto-Start with launchd (macOS)

Create a plist at `~/Library/LaunchAgents/com.obsidian-mcp.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.obsidian-mcp</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/my-obsidien-mcp/dist/index.js</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>/tmp/obsidian-mcp.log</string>
</dict>
</plist>
```

Load the service:

```bash
launchctl load ~/Library/LaunchAgents/com.obsidian-mcp.plist
```

## MCP Tools

### `search_notes`

Full-text search combined with structured filters. All filters are optional and combined with AND logic.

| Parameter      | Type       | Description                                                      |
|----------------|------------|------------------------------------------------------------------|
| `query`        | string     | Full-text search across title, content summary, and note body    |
| `dateFrom`     | string     | Start date (YYYY-MM-DD), inclusive                               |
| `dateTo`       | string     | End date (YYYY-MM-DD), inclusive                                 |
| `participants` | string[]   | Filter by participants (AND logic, partial match)                |
| `tags`         | string[]   | Filter by tags (OR logic)                                        |
| `art`          | string[]   | Filter by type: Besprechung, Teams-Besprechung, Telefonat, etc.  |
| `folder`       | string     | Limit to specific folder                                         |
| `limit`        | number     | Max results (default: 20)                                        |

Returns metadata only (no note body). Use `read_note` for the full content.

### `read_note`

Read the full content of one or more notes by their relative vault paths.

IMPORTANT: Always pass all paths in a single call using the `paths` array. Never call this tool once per note — batch all reads into one request.

| Parameter | Type     | Description                                                          |
|-----------|----------|----------------------------------------------------------------------|
| `paths`   | string[] | Relative paths within the vault (e.g. `["📥 Inbox/Note.md"]`)      |

Returns fields: `path`, `title`, `datum`, `uhrzeit`, `ort`, `organisator`, `inhalt` (summary), `teilnehmer`, `tags`, `art`, and full `body` content.

### `list_participants`

List all participants indexed across the vault, sorted by frequency.

| Parameter | Type   | Description                        |
|-----------|--------|------------------------------------|
| `query`   | string | Optional filter (partial match)    |

### `list_tags`

List all tags indexed across the vault, sorted by frequency.

| Parameter | Type   | Description                        |
|-----------|--------|------------------------------------|
| `query`   | string | Optional filter (partial match)    |

### `vault_stats`

Return an overview of the vault: total note count, date range, top participants, top tags, and folder breakdown.

### `rebuild_index`

Trigger a full rebuild of the SQLite index. Useful after bulk vault changes.

### `create_note`

Create a new markdown note in the `📥 Inbox` folder. Uses MCP Elicitation to ask the user for metadata (title, summary, participants, tags) via an interactive form. Falls back to defaults if the client does not support elicitation.

| Parameter | Type   | Description                           |
|-----------|--------|---------------------------------------|
| `content` | string | Note body in markdown (required)      |

### `move_note`

Move a note from one folder to another with smart folder resolution and user confirmation via elicitation.

| Parameter           | Type   | Description                                        |
|---------------------|--------|----------------------------------------------------|
| `filename`          | string | Full or partial filename (without `.md`)           |
| `sourceFolder`      | string | Source folder (default: `📥 Inbox`)               |
| `destinationFolder` | string | Destination folder in the user's own words         |

If multiple folders or files match, the tool asks the user to pick via a dropdown form.

### `list_folders`

List all folders in the vault with optional name filter. Note: do not use this to pre-resolve folders for `move_note` — `move_note` handles disambiguation itself.

| Parameter | Type   | Description                                    |
|-----------|--------|------------------------------------------------|
| `query`   | string | Optional filter (partial, case-insensitive)    |

## Database Schema

The SQLite database (`data/obsidian.db`) has the following structure:

```sql
notes           -- core note metadata + body text
note_participants -- many-to-many: notes <-> participants
note_tags        -- many-to-many: notes <-> tags
note_art         -- many-to-many: notes <-> types (Art)
notes_fts        -- FTS5 virtual table (title, inhalt, body)
```

WAL journal mode and foreign keys are enabled. The FTS5 table is managed manually (not content-synced) to allow fine-grained control over inserts and deletes.

## Project Structure

```
src/
  index.ts              # HTTP server entry point, session management
  server.ts             # MCP server factory, tool routing
  config.ts             # VAULT_PATH, DB_PATH, SKIP_DIRS
  database/
    db.ts               # SQLite connection, schema initialization
    queries.ts          # searchNotes, readNote, listParticipants, etc.
  indexer/
    indexer.ts          # buildIndex (delta), indexSingleFile, removeFile
    vault-scanner.ts    # Recursive vault file scan
    frontmatter.ts      # YAML parsing, time/date normalization
    watcher.ts          # chokidar file watcher
  tools/
    search-notes.ts     # search_notes tool
    read-note.ts        # read_note tool
    list-participants.ts
    list-tags.ts
    vault-stats.ts
    rebuild-index.ts
    create-note.ts      # create_note tool with elicitation
    move-note.ts        # move_note tool with elicitation + smart matching
    list-folders.ts
    elicitation.ts      # tryElicit helper (timeout, error handling)
data/
  obsidian.db           # SQLite database (not committed)
dist/                   # Compiled JavaScript output (not committed)
```

## Development

```bash
# TypeScript watch mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Dependencies

| Package                        | Purpose                              |
|--------------------------------|--------------------------------------|
| `@modelcontextprotocol/sdk`    | MCP server, transport, elicitation   |
| `better-sqlite3`               | Synchronous SQLite with FTS5 support |
| `chokidar`                     | Cross-platform file watcher          |
| `gray-matter`                  | YAML frontmatter parser              |
| `zod`                          | Schema validation                    |
