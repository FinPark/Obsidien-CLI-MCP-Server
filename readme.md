# Obsidian CLI MCP Server

Ein MCP-Server der alle Vault-Operationen an die offizielle **Obsidian CLI (v1.12+)** delegiert und **31 Tools** bereitstellt. Kein eigener Index, keine Datenbank — der Server kommuniziert direkt mit einer laufenden Obsidian-Instanz.

## Voraussetzungen

| Voraussetzung | Details |
|---|---|
| **Obsidian Desktop** | Version **1.12+** muss installiert UND **gestartet** sein |
| **Obsidian CLI aktiviert** | In Obsidian: *Settings > General > Command line interface* aktivieren und registrieren |
| **Node.js** | Version 20+ |
| **macOS** | CLI-Binary liegt standardmässig unter `/Applications/Obsidian.app/Contents/MacOS/Obsidian` |

> **Wichtig**: Die CLI verbindet sich zur laufenden Obsidian-App. Ohne gestartetes Obsidian geben alle Tools Fehler zurueck. Der Server startet trotzdem und loggt eine Warnung.

## Installation

```bash
git clone https://github.com/FinPark/Obsidien-CLI-MCP-Server.git
cd Obsidien-CLI-MCP-Server
npm install
npm run build
```

## Konfiguration

Alle Einstellungen sind optional und ueber Umgebungsvariablen steuerbar:

| Variable | Default | Beschreibung |
|---|---|---|
| `VAULT_NAME` | `vault_arbeit` | Name des Obsidian-Vaults |
| `OBSIDIAN_BIN` | `/Applications/Obsidian.app/Contents/MacOS/Obsidian` | Pfad zum CLI-Binary |
| `PORT` | `8201` | HTTP-Port fuer den MCP-Server |

## Server starten

```bash
npm start
```

Ausgabe bei erfolgreichem Start:

```
[obsidian-mcp] Connected to Obsidian 1.12.7
[obsidian-mcp] StreamableHTTP server running on http://localhost:8201/mcp
```

## MCP Tools (31)

### Suche & Lesen

| Tool | Beschreibung |
|---|---|
| `search_notes` | Volltextsuche (gleiche Syntax wie Obsidians Suchleiste) |
| `read_note` | Notizen lesen (bulk, per paths-Array) |
| `vault_stats` | Vault-Uebersicht: Name, Dateien, Ordner, Groesse, Top-Tags |

### Notiz-Management

| Tool | Beschreibung |
|---|---|
| `create_note` | Notiz erstellen (mit interaktivem Formular fuer Metadaten) |
| `append_note` | Inhalt an Notiz anhaengen |
| `prepend_note` | Inhalt nach Frontmatter einfuegen |
| `rename_note` | Notiz umbenennen (Links werden automatisch aktualisiert) |
| `move_note` | Notiz verschieben (Smart-Matching, Link-Updates) |
| `delete_note` | Notiz loeschen (Papierkorb oder permanent) |
| `file_info` | Datei-Info (Groesse, Erstellt, Geaendert) |
| `list_files` | Dateien auflisten (Folder/Extension-Filter) |
| `list_recents` | Zuletzt geoeffnete Dateien |

### Ordner

| Tool | Beschreibung |
|---|---|
| `list_folders` | Ordner auflisten (mit optionalem Filter) |

### Teilnehmer & Tags

| Tool | Beschreibung |
|---|---|
| `list_participants` | Alle Teilnehmer mit Haeufigkeit |
| `list_tags` | Alle Tags mit Haeufigkeit |
| `update_tags` | Tags auf Notizen aendern (add/remove) |
| `rename_tag` | Tag vault-weit umbenennen |
| `delete_tag` | Tag vault-weit loeschen |

### Tasks

| Tool | Beschreibung |
|---|---|
| `list_tasks` | Tasks auflisten (todo/done/daily, per Datei) |
| `toggle_task` | Task-Status aendern (toggle/done/todo) |

### Link-Analyse

| Tool | Beschreibung |
|---|---|
| `list_backlinks` | Backlinks zu einer Notiz |
| `list_links` | Ausgehende Links einer Notiz |
| `list_orphans` | Verwaiste Notizen (keine eingehenden Links) |
| `list_deadends` | Sackgassen (keine ausgehenden Links) |
| `list_unresolved` | Broken Links im Vault |

### Properties (Frontmatter)

| Tool | Beschreibung |
|---|---|
| `list_properties` | Alle Properties mit Typ und Haeufigkeit |
| `get_property` | Property-Wert einer Notiz lesen |
| `set_property` | Property setzen (text, list, number, checkbox, date, datetime) |
| `remove_property` | Property entfernen |

### Outline

| Tool | Beschreibung |
|---|---|
| `get_outline` | Heading-Struktur einer Notiz (tree, json, md) |

### Recherche

| Tool | Beschreibung |
|---|---|
| `research_chain` | Verfolgt die Vorgaenger-Kette (Frontmatter "Vorausgegangen") rueckwaerts bis zur Wurzel-Notiz. Liefert die komplette Kette chronologisch, plus alle Links und Backlinks der Ketten-Notizen. |

## Architektur

```
HTTP Request (Port 8201)
    |
    v
StreamableHTTP Transport (Session-Management)
    |
    v
MCP Server (31 Tools registriert)
    |
    v
CLI Executor (src/cli/obsidian-cli.ts)
    |
    v
/Applications/Obsidian.app/Contents/MacOS/Obsidian
    |
    v
Laufende Obsidian-Instanz
```

Der CLI-Executor:
- Fuehrt Befehle per `execFile` aus (kein Shell, sicher gegen Injection)
- Filtert Startup-Noise aus stdout (Loading-Messages, Installer-Warnungen)
- Stripped `=> ` Prefix bei `eval`-Befehlen
- 30 Sekunden Timeout pro Befehl
- 10 MB Buffer fuer grosse Ausgaben

## Projektstruktur

```
src/
  index.ts              HTTP-Server, Session-Management
  server.ts             MCP-Server, Tool-Routing (v2.0.0, 31 Tools)
  config.ts             VAULT_NAME, OBSIDIAN_BIN
  cli/
    obsidian-cli.ts     CLI-Wrapper: exec(), execJson(), Noise-Filtering
  tools/
    search-notes.ts     search_notes
    read-note.ts        read_note
    list-participants.ts
    list-tags.ts
    vault-stats.ts
    create-note.ts      mit Elicitation-Formular
    move-note.ts        mit Smart-Matching und Elicitation
    list-folders.ts
    manage-tags.ts      update_tags, rename_tag, delete_tag
    tasks.ts            list_tasks, toggle_task
    links.ts            list_backlinks, list_links, list_orphans, list_deadends, list_unresolved
    properties.ts       list_properties, get_property, set_property, remove_property
    outline.ts          get_outline
    note-management.ts  append_note, prepend_note, rename_note, delete_note, file_info, list_files, list_recents
    research-chain.ts   research_chain (Vorgaenger-Kette mit Links/Backlinks)
    elicitation.ts      tryElicit() Helper
```

## Auto-Start mit launchd (macOS)

`~/Library/LaunchAgents/com.obsidian-mcp.plist`:

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
    <string>/path/to/Obsidien-CLI-MCP-Server/dist/index.js</string>
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

```bash
launchctl load ~/Library/LaunchAgents/com.obsidian-mcp.plist
```

## Dependencies

| Package | Zweck |
|---|---|
| `@modelcontextprotocol/sdk` | MCP-Server, Transport, Elicitation |

Keine weiteren Runtime-Dependencies. Alles laeuft ueber die Obsidian CLI.

## Troubleshooting

| Problem | Loesung |
|---|---|
| `Obsidian CLI timed out` | Obsidian Desktop starten |
| `File "X" not found` | Dateiname pruefen — `file=` loest wie Wikilinks auf, `path=` erwartet den exakten Vault-Pfad |
| `EADDRINUSE: port 8201` | `lsof -ti:8201 \| xargs kill -9` |
| CLI gibt Warnings aus | Normal bei aelterem Installer — werden automatisch gefiltert |
| `search` gibt leere Ergebnisse | Obsidian-Suche nutzt andere Syntax als grep — z.B. `tag:#AI` statt `#AI` |
