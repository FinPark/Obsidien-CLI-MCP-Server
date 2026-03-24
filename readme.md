# Obsidian Vault MCP Server

A Model Context Protocol (MCP) server that delegates all vault operations to the official **Obsidian CLI (v1.12+)** and exposes **31 tools** for searching, reading, writing, and managing notes. No custom indexer, no SQLite database — the server connects directly to a running Obsidian instance via its CLI binary.

## Features

- **Obsidian CLI backend** — all queries and mutations go through the official `obsidian` binary; no shadow database to maintain
- **Instant startup** — no index build phase; the server is ready as soon as Obsidian CLI responds
- **31 MCP tools** covering search, read, write, tag management, task management, link analysis, property management, note lifecycle, and research chains
- **MCP Elicitation support** for interactive user forms, confirmations, and dropdown selections
- **Smart folder resolution** with multi-word matching and disambiguation via user interaction
- **StreamableHTTP server** on port 8201 with full session lifecycle (create, reuse, terminate)
- **launchd service** configuration for automatic startup on macOS
- **CLI noise filtering** — strips Obsidian startup lines that leak into stdout
- **research_chain tool** — traces the `Vorausgegangen` predecessor chain of a note and collects full link/backlink context

## Requirements

- Node.js 22+
- macOS with Obsidian (v1.12+) installed and **running**
- The Obsidian CLI binary located at `/Applications/Obsidian.app/Contents/MacOS/Obsidian` (default, configurable)
- A named Obsidian vault (default vault name: `vault_arbeit`)

## Installation

```bash
git clone <repository-url>
cd my-obsidien-mcp
npm install
npm run build
```

## Configuration

| Variable       | Default                                                  | Description                                 |
|----------------|----------------------------------------------------------|---------------------------------------------|
| `VAULT_NAME`   | `vault_arbeit`                                           | Name of the Obsidian vault to operate on    |
| `OBSIDIAN_BIN` | `/Applications/Obsidian.app/Contents/MacOS/Obsidian`    | Path to the Obsidian CLI binary             |
| `PORT`         | `8201`                                                   | HTTP port for the MCP server                |

## Running the Server

```bash
# Build and start
npm run build
npm start

# Development (TypeScript watch mode)
npm run dev
```

Startup output:

```
[obsidian-mcp] Connected to Obsidian 1.x.x
[obsidian-mcp] StreamableHTTP server running on http://localhost:8201/mcp
```

Obsidian must be running before starting the server. If it is not reachable, the server logs a warning but continues — tools will return errors until Obsidian is launched.

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

## MCP Tools (31 total)

### Search & Read

#### `search_notes`
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

#### `read_note`
Read the full content of one or more notes by their relative vault paths.

IMPORTANT: Always pass all paths in a single call using the `paths` array. Never call this tool once per note.

| Parameter | Type     | Description                                                          |
|-----------|----------|----------------------------------------------------------------------|
| `paths`   | string[] | Relative paths within the vault (e.g. `["📥 Inbox/Note.md"]`)      |

#### `vault_stats`
Return an overview of the vault: total note count, date range, top participants, top tags, and folder breakdown.

### Note Creation & Management

#### `create_note`
Create a new markdown note in the `📥 Inbox` folder. Uses MCP Elicitation to ask the user for metadata (title, summary, participants, tags) via an interactive form.

| Parameter | Type   | Description                           |
|-----------|--------|---------------------------------------|
| `content` | string | Note body in markdown (required)      |

#### `move_note`
Move a note from one folder to another with smart folder resolution and user confirmation via elicitation.

| Parameter           | Type   | Description                                        |
|---------------------|--------|----------------------------------------------------|
| `filename`          | string | Full or partial filename (without `.md`)           |
| `sourceFolder`      | string | Source folder (default: `📥 Inbox`)               |
| `destinationFolder` | string | Destination folder in the user's own words         |

#### `append_note`
Append content to the end of a note.

| Parameter | Type    | Description                                         |
|-----------|---------|-----------------------------------------------------|
| `content` | string  | Content to append (required)                        |
| `file`    | string  | File name (resolved like wikilinks)                 |
| `path`    | string  | Exact vault-relative path                           |
| `inline`  | boolean | Append without leading newline                      |

#### `prepend_note`
Prepend content after the frontmatter of a note.

| Parameter | Type    | Description                                         |
|-----------|---------|-----------------------------------------------------|
| `content` | string  | Content to prepend (required)                       |
| `file`    | string  | File name (resolved like wikilinks)                 |
| `path`    | string  | Exact vault-relative path                           |
| `inline`  | boolean | Prepend without trailing newline                    |

#### `rename_note`
Rename a note. Internal links are updated automatically if enabled in vault settings.

| Parameter | Type   | Description                              |
|-----------|--------|------------------------------------------|
| `name`    | string | New file name without `.md` (required)   |
| `file`    | string | Current file name                        |
| `path`    | string | Current exact vault-relative path        |

#### `delete_note`
Delete a note (moves to trash by default).

| Parameter   | Type    | Description                                     |
|-------------|---------|-------------------------------------------------|
| `file`      | string  | File name                                       |
| `path`      | string  | Exact vault-relative path                       |
| `permanent` | boolean | Skip trash and delete permanently (DANGEROUS)   |

#### `file_info`
Show file info: path, name, extension, size, created/modified timestamps.

#### `list_files`
List files in the vault, with optional folder and extension filters.

#### `list_recents`
List recently opened files in Obsidian.

### Folders

#### `list_folders`
List all folders in the vault with optional name filter.

| Parameter | Type   | Description                                    |
|-----------|--------|------------------------------------------------|
| `query`   | string | Optional filter (partial, case-insensitive)    |

### Participants & Tags

#### `list_participants`
List all participants indexed across the vault, sorted by frequency.

#### `list_tags`
List all tags indexed across the vault, sorted by frequency.

#### `update_tags`
Add or remove tags on one or more notes by modifying their YAML frontmatter. Supports hierarchical tags and both array and inline tag formats.

| Parameter    | Type     | Description                                          |
|--------------|----------|------------------------------------------------------|
| `paths`      | string[] | Relative vault paths of notes to modify (required)   |
| `addTags`    | string[] | Tags to add (e.g. `["AI/MCP", "Knowledge"]`)         |
| `removeTags` | string[] | Tags to remove (exact match, case-sensitive)         |

#### `rename_tag`
Rename a tag across all notes in the vault. Requests elicitation confirmation when more than 5 notes are affected.

| Parameter | Type   | Description                              |
|-----------|--------|------------------------------------------|
| `oldTag`  | string | Current tag name (exact match)           |
| `newTag`  | string | New tag name (hierarchical paths allowed) |

#### `delete_tag`
Remove a tag from all notes in the vault. Always requests elicitation confirmation.

| Parameter | Type   | Description                     |
|-----------|--------|---------------------------------|
| `tag`     | string | Tag to delete (exact match)     |

### Tasks

#### `list_tasks`
List tasks in the vault or in a specific file.

| Parameter | Type    | Description                                            |
|-----------|---------|--------------------------------------------------------|
| `file`    | string  | Filter by file name                                    |
| `path`    | string  | Filter by file path                                    |
| `status`  | string  | `todo`, `done`, or `all` (default)                    |
| `daily`   | boolean | Show tasks from today's daily note                     |
| `verbose` | boolean | Group by file with line numbers                        |
| `format`  | string  | Output format: `text`, `json`, `tsv`, `csv`           |

#### `toggle_task`
Toggle or update a task's status by file+line or ref.

| Parameter | Type    | Description                                              |
|-----------|---------|----------------------------------------------------------|
| `file`    | string  | File name containing the task                            |
| `path`    | string  | File path containing the task                            |
| `line`    | number  | Line number of the task                                  |
| `ref`     | string  | Task reference as `path:line`                            |
| `action`  | string  | `toggle` (default), `done`, or `todo`                   |
| `status`  | string  | Set a custom status character (e.g. `-`, `?`, `/`)      |
| `daily`   | boolean | Target task in today's daily note                        |

### Link Analysis

#### `list_backlinks`
List all notes that link to a specific note.

#### `list_links`
List all outgoing links from a specific note.

#### `list_orphans`
List orphan notes — files with no incoming links.

#### `list_deadends`
List dead-end notes — files with no outgoing links.

#### `list_unresolved`
List unresolved wikilinks that point to non-existing notes.

### Properties (Frontmatter)

#### `list_properties`
List all frontmatter properties used across the vault with types and occurrence counts. Can also target a specific file.

#### `get_property`
Read a specific property value from a note's frontmatter.

| Parameter | Type   | Description           |
|-----------|--------|-----------------------|
| `name`    | string | Property name (required) |
| `file`    | string | File name             |
| `path`    | string | File path             |

#### `set_property`
Set a property value on a note's frontmatter. Creates the property if it does not exist.

| Parameter | Type   | Description                                                    |
|-----------|--------|----------------------------------------------------------------|
| `name`    | string | Property name (required)                                       |
| `value`   | string | Property value (required)                                      |
| `type`    | string | `text`, `list`, `number`, `checkbox`, `date`, `datetime`      |
| `file`    | string | File name                                                      |
| `path`    | string | File path                                                      |

#### `remove_property`
Remove a property from a note's frontmatter.

### Outline

#### `get_outline`
Get the heading structure of a note. Returns all headings with their levels.

| Parameter | Type   | Description                                       |
|-----------|--------|---------------------------------------------------|
| `file`    | string | File name                                         |
| `path`    | string | Exact vault-relative path                         |
| `format`  | string | `tree` (default), `json`, or `md`                |

### Research

#### `research_chain`
Trace the full predecessor chain (`Vorausgegangen` frontmatter) of a note and collect context.

Follows the chain backwards to the root note. Returns:
1. **chain** — Full note chain from oldest to newest with title, path, and date
2. **links** — All outgoing links from chain notes (deduplicated)
3. **backlinks** — All backlinks to chain notes (deduplicated, excluding chain-internal links)

| Parameter | Type   | Description                                           |
|-----------|--------|-------------------------------------------------------|
| `file`    | string | File name of the starting note                        |
| `path`    | string | Exact vault-relative path of the starting note        |

## Project Structure

```
src/
  index.ts              # HTTP server entry point, session management
  server.ts             # MCP server factory, tool routing (v2.0.0)
  config.ts             # VAULT_NAME, OBSIDIAN_BIN
  cli/
    obsidian-cli.ts     # Central CLI wrapper: exec, execJson, noise filtering
  tools/
    search-notes.ts     # search_notes tool
    read-note.ts        # read_note tool
    list-participants.ts
    list-tags.ts
    vault-stats.ts
    create-note.ts      # create_note tool with elicitation
    move-note.ts        # move_note tool with elicitation + smart matching
    list-folders.ts
    manage-tags.ts      # update_tags, rename_tag, delete_tag tools
    tasks.ts            # list_tasks, toggle_task tools
    links.ts            # list_backlinks, list_links, list_orphans, list_deadends, list_unresolved
    properties.ts       # list_properties, get_property, set_property, remove_property
    outline.ts          # get_outline tool
    note-management.ts  # append_note, prepend_note, rename_note, delete_note, file_info, list_files, list_recents
    research-chain.ts   # research_chain tool
    elicitation.ts      # tryElicit helper (timeout, error handling)
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
| `zod`                          | Schema validation                    |
