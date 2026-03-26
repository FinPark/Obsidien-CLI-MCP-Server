import { exec } from '../cli/obsidian-cli.js';
import { VAULT_NAME } from '../config.js';
import { formatObsidianLink } from '../utils/obsidian-links.js';

// ─── list_recents ───

export const listRecentsSchema = {
  name: 'list_recents',
  description: `List recently opened files in Obsidian (paths only, no dates).
NOTE: Does NOT return modification dates. If the user asks for notes created or modified
within a time period (e.g. "last 3 weeks"), use list_modified_notes instead.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      total: { type: 'boolean', description: 'Return only the count' },
    },
  },
};

export async function handleListRecents(args: Record<string, unknown>): Promise<string> {
  const flags: string[] = [];
  if (args.total) flags.push('total');

  const result = await exec('recents', {}, flags);
  if (!result) return 'Keine zuletzt geöffneten Dateien.';
  if (args.total) return result;

  const paths = result.split('\n').filter(Boolean);
  return paths.map((p) => `- ${formatObsidianLink(p.trim(), VAULT_NAME)}`).join('\n');
}

// ─── append_note ───

export const appendNoteSchema = {
  name: 'append_note',
  description: `Append content to the end of an Obsidian note.
Defaults to the active file if no file/path is specified.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      content: { type: 'string', description: 'Content to append (supports \\n for newline, \\t for tab)' },
      file: { type: 'string', description: 'File name (resolved like wikilinks)' },
      path: { type: 'string', description: 'Exact vault-relative path' },
      inline: { type: 'boolean', description: 'Append without leading newline' },
    },
    required: ['content'],
  },
};

export async function handleAppendNote(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = { content: args.content as string };
  const flags: string[] = [];

  if (args.file) params.file = args.file as string;
  if (args.path) params.path = args.path as string;
  if (args.inline) flags.push('inline');

  const result = await exec('append', params, flags);
  return result || 'Inhalt angehängt.';
}

// ─── prepend_note ───

export const prependNoteSchema = {
  name: 'prepend_note',
  description: `Prepend content after frontmatter of an Obsidian note.
Content is inserted after the YAML frontmatter block (if present).
Defaults to the active file if no file/path is specified.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      content: { type: 'string', description: 'Content to prepend (supports \\n for newline, \\t for tab)' },
      file: { type: 'string', description: 'File name (resolved like wikilinks)' },
      path: { type: 'string', description: 'Exact vault-relative path' },
      inline: { type: 'boolean', description: 'Prepend without trailing newline' },
    },
    required: ['content'],
  },
};

export async function handlePrependNote(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = { content: args.content as string };
  const flags: string[] = [];

  if (args.file) params.file = args.file as string;
  if (args.path) params.path = args.path as string;
  if (args.inline) flags.push('inline');

  const result = await exec('prepend', params, flags);
  return result || 'Inhalt vorangestellt.';
}

// ─── rename_note ───

export const renameNoteSchema = {
  name: 'rename_note',
  description: `Rename an Obsidian note. The file extension is preserved automatically.
Internal links are updated automatically if enabled in vault settings.
Defaults to the active file if no file/path is specified.
Use move_note to move AND rename at the same time.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'New file name (without .md extension)' },
      file: { type: 'string', description: 'Current file name (resolved like wikilinks)' },
      path: { type: 'string', description: 'Current exact vault-relative path' },
    },
    required: ['name'],
  },
};

export async function handleRenameNote(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = { name: args.name as string };

  if (args.file) params.file = args.file as string;
  if (args.path) params.path = args.path as string;

  const result = await exec('rename', params);
  return result || `Notiz umbenannt zu "${params.name}".`;
}

// ─── delete_note ───

export const deleteNoteSchema = {
  name: 'delete_note',
  description: `Delete an Obsidian note. By default moves to trash.
Use the "permanent" flag to skip trash and delete permanently.
Defaults to the active file if no file/path is specified.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      file: { type: 'string', description: 'File name (resolved like wikilinks)' },
      path: { type: 'string', description: 'Exact vault-relative path' },
      permanent: { type: 'boolean', description: 'Skip trash, delete permanently (DANGEROUS)' },
    },
  },
};

export async function handleDeleteNote(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = {};
  const flags: string[] = [];

  if (args.file) params.file = args.file as string;
  if (args.path) params.path = args.path as string;
  if (args.permanent) flags.push('permanent');

  const result = await exec('delete', params, flags);
  return result || 'Notiz gelöscht.';
}

// ─── file_info ───

export const fileInfoSchema = {
  name: 'file_info',
  description: `Show info about a SINGLE file: path, name, extension, size, created/modified timestamps.
Defaults to the active file if no file/path is specified.
WARNING: Only use for a single file. NEVER call this in a loop for multiple files —
use list_modified_notes instead which returns dates for many files efficiently.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      file: { type: 'string', description: 'File name (resolved like wikilinks)' },
      path: { type: 'string', description: 'Exact vault-relative path' },
    },
  },
};

export async function handleFileInfo(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = {};

  if (args.file) params.file = args.file as string;
  if (args.path) params.path = args.path as string;

  const result = await exec('file', params);
  return result || 'Keine Datei-Info verfügbar.';
}

// ─── list_files ───

export const listFilesSchema = {
  name: 'list_files',
  description: `List files in the vault. Can filter by folder and/or file extension.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      folder: { type: 'string', description: 'Filter by folder path' },
      ext: { type: 'string', description: 'Filter by extension (e.g. "md", "png")' },
      total: { type: 'boolean', description: 'Return only the file count' },
    },
  },
};

export async function handleListFiles(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = {};
  const flags: string[] = [];

  if (args.folder) params.folder = args.folder as string;
  if (args.ext) params.ext = args.ext as string;
  if (args.total) flags.push('total');

  const result = await exec('files', params, flags);
  if (!result) return 'Keine Dateien gefunden.';
  if (args.total) return result;

  // Only linkify markdown files
  const ext = (args.ext as string | undefined) ?? 'md';
  if (ext !== 'md') return result;

  const paths = result.split('\n').filter(Boolean);
  return paths.map((p) => `- ${formatObsidianLink(p.trim(), VAULT_NAME)}`).join('\n');
}

// ─── list_modified_notes ───

export const listModifiedNotesSchema = {
  name: 'list_modified_notes',
  description: `List notes that were created or modified within a time period.
Returns a table with modification date (dd.mm.yyyy), time (HH:MM), and note name with link.
Use this for queries like "which notes did I change in the last 3 weeks?" or "recently modified notes".
Much more efficient than calling file_info repeatedly — fetches all dates in parallel.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      days: { type: 'number', description: 'How many days back to look (default: 21 = 3 weeks)' },
      since: { type: 'string', description: 'Alternatively: start date in YYYY-MM-DD format' },
      folder: { type: 'string', description: 'Limit to a specific vault folder' },
      limit: { type: 'number', description: 'Max results (default: 50)' },
    },
  },
};

export async function handleListModifiedNotes(args: Record<string, unknown>): Promise<string> {
  const days = (args.days as number | undefined) ?? 21;
  const limit = (args.limit as number | undefined) ?? 100;
  const folder = args.folder as string | undefined;

  let cutoff: Date;
  if (args.since) {
    cutoff = new Date(args.since as string);
  } else {
    cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
  }
  cutoff.setHours(0, 0, 0, 0);
  const cutoffMs = cutoff.getTime();

  // Single CLI call: get all markdown files with mtime via Obsidian API
  const folderFilter = folder ? `.filter(f=>f.path.startsWith(${JSON.stringify(folder + '/')}))` : '';
  const code = `JSON.stringify(app.vault.getMarkdownFiles()${folderFilter}.map(f=>({path:f.path,mtime:f.stat.mtime})))`;

  const raw = await exec('eval', { code });
  if (!raw) return 'Keine Notizen im Vault gefunden.';

  const allFiles = JSON.parse(raw) as Array<{ path: string; mtime: number }>;

  const results = allFiles
    .filter((f) => f.mtime >= cutoffMs)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  if (results.length === 0) {
    return `Keine Notizen seit ${cutoff.toLocaleDateString('de-DE')} erstellt oder geändert.`;
  }

  const header = '| Datum | Notizname |\n|---|---|';
  const rows = results.map((f) => {
    const date = new Date(f.mtime).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const urlMatch = formatObsidianLink(f.path, VAULT_NAME).match(/\(([^)]+)\)/);
    const url = urlMatch ? urlMatch[1] : '#';
    const noteName = f.path.split('/').pop()?.replace('.md', '') ?? f.path;
    return `| ${date} | [${noteName}](${url}) |`;
  });

  const total = allFiles.filter((f) => f.mtime >= cutoffMs).length;
  return `${total} Notizen gefunden (zeige ${results.length}):\n\n${header}\n${rows.join('\n')}`;
}
