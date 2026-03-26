import { exec } from '../cli/obsidian-cli.js';
import { VAULT_NAME } from '../config.js';
import { formatObsidianLink } from '../utils/obsidian-links.js';

// ─── list_recents ───

export const listRecentsSchema = {
  name: 'list_recents',
  description: `List recently opened files in Obsidian.`,
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
  description: `Show info about a file: path, name, extension, size, created/modified timestamps.
Defaults to the active file if no file/path is specified.`,
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
