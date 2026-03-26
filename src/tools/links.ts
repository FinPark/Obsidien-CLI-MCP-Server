import { exec, execJson } from '../cli/obsidian-cli.js';
import { VAULT_NAME } from '../config.js';
import { formatObsidianLink } from '../utils/obsidian-links.js';

// ─── list_backlinks ───

export const listBacklinksSchema = {
  name: 'list_backlinks',
  description: `List all backlinks to a specific note (which other notes link to it).
Defaults to the active file if no file/path is specified.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      file: { type: 'string', description: 'File name (resolved like wikilinks)' },
      path: { type: 'string', description: 'Exact vault-relative path' },
      counts: { type: 'boolean', description: 'Include link counts per file' },
    },
  },
};

export async function handleListBacklinks(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = {};
  const flags: string[] = [];

  const resolved = await resolveToPath(args.file as string | undefined, args.path as string | undefined);
  if (resolved) params.path = resolved;
  else if (args.file) params.file = args.file as string;
  else if (args.path) params.path = args.path as string;

  if (args.counts) flags.push('counts');

  params.format = 'json';

  const result = await exec('backlinks', params, flags);
  if (!result) return 'Keine Backlinks gefunden.';

  try {
    const data = JSON.parse(result) as Array<{ path: string; count?: number } | string>;
    if (!data.length) return 'Keine Backlinks gefunden.';
    return data
      .map((item) => {
        const path = typeof item === 'string' ? item : item.path;
        const count = typeof item === 'object' && item.count ? ` (${item.count}x)` : '';
        return `- ${formatObsidianLink(path, VAULT_NAME)}${count}`;
      })
      .join('\n');
  } catch {
    return result;
  }
}

// ─── list_links ───

export const listLinksSchema = {
  name: 'list_links',
  description: `List all outgoing links from a specific note.
Defaults to the active file if no file/path is specified.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      file: { type: 'string', description: 'File name (resolved like wikilinks)' },
      path: { type: 'string', description: 'Exact vault-relative path' },
    },
  },
};

async function resolveToPath(file?: string, path?: string): Promise<string | null> {
  try {
    const params: Record<string, string> = {};
    if (path && path.includes('/')) params.path = path;
    else if (file) params.file = file;
    else if (path) params.file = path; // path without slash = treat as filename

    const info = await exec('file', params);
    for (const line of info.split('\n')) {
      const [key, ...rest] = line.split('\t');
      if (key === 'path') return rest.join('\t').trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function handleListLinks(args: Record<string, unknown>): Promise<string> {
  const resolved = await resolveToPath(args.file as string | undefined, args.path as string | undefined);
  if (!resolved) return 'Notiz nicht gefunden.';

  const result = await exec('links', { path: resolved });
  if (!result) return 'Keine ausgehenden Links.';

  const paths = result.split('\n').filter(Boolean);
  return paths
    .map((path) => `- ${formatObsidianLink(path.trim(), VAULT_NAME)}`)
    .join('\n');
}

// ─── list_orphans ───

export const listOrphansSchema = {
  name: 'list_orphans',
  description: `List orphan notes — files with no incoming links from other notes.
Useful for vault cleanup and finding disconnected content.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      total: { type: 'boolean', description: 'Return only the count' },
    },
  },
};

export async function handleListOrphans(args: Record<string, unknown>): Promise<string> {
  const flags: string[] = [];
  if (args.total) flags.push('total');

  const result = await exec('orphans', {}, flags);
  if (!result) return 'Keine verwaisten Notizen.';
  if (args.total) return result;

  const paths = result.split('\n').filter(Boolean);
  return paths.map((p) => `- ${formatObsidianLink(p.trim(), VAULT_NAME)}`).join('\n');
}

// ─── list_deadends ───

export const listDeadendsSchema = {
  name: 'list_deadends',
  description: `List dead-end notes — files with no outgoing links to other notes.
Useful for finding notes that could benefit from more connections.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      total: { type: 'boolean', description: 'Return only the count' },
    },
  },
};

export async function handleListDeadends(args: Record<string, unknown>): Promise<string> {
  const flags: string[] = [];
  if (args.total) flags.push('total');

  const result = await exec('deadends', {}, flags);
  if (!result) return 'Keine Sackgassen-Notizen.';
  if (args.total) return result;

  const paths = result.split('\n').filter(Boolean);
  return paths.map((p) => `- ${formatObsidianLink(p.trim(), VAULT_NAME)}`).join('\n');
}

// ─── list_unresolved ───

export const listUnresolvedSchema = {
  name: 'list_unresolved',
  description: `List unresolved links in the vault — wikilinks that point to non-existing notes.
Useful for finding broken links and missing notes.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      counts: { type: 'boolean', description: 'Include link counts' },
      verbose: { type: 'boolean', description: 'Include source files' },
    },
  },
};

export async function handleListUnresolved(args: Record<string, unknown>): Promise<string> {
  const flags: string[] = [];
  if (args.counts) flags.push('counts');
  if (args.verbose) flags.push('verbose');

  const params: Record<string, string> = { format: 'json' };

  const result = await exec('unresolved', params, flags);
  return result || '[]';
}
