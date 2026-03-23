import fs from 'node:fs';
import path from 'node:path';
import { VAULT_PATH, SKIP_DIRS } from '../config.js';

export const listFoldersSchema = {
  name: 'list_folders',
  description: `List all folders in the Obsidian vault.
Returns the full relative folder paths (e.g. "📘 Arbeit/👨‍👨‍👦 Teams/🏛 KI/KI Client").
Optionally filter by name (partial match, case-insensitive).
NOTE: Do NOT use this to pre-resolve folders for move_note. move_note handles folder resolution
and user disambiguation itself. Use list_folders only when the user explicitly asks to see folders.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Filter folders by name (partial match, case-insensitive)' },
    },
  },
};

export function handleListFolders(args: Record<string, unknown>): string {
  const query = (args.query as string | undefined)?.toLowerCase();
  const folders = scanFolders(VAULT_PATH, '', 0);

  const filtered = query
    ? folders.filter(f => f.toLowerCase().includes(query))
    : folders;

  return JSON.stringify(filtered, null, 2);
}

function scanFolders(base: string, rel: string, depth: number): string[] {
  if (depth > 5) return [];
  const dir = rel ? path.join(base, rel) : base;
  const result: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;

    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    result.push(relPath);
    result.push(...scanFolders(base, relPath, depth + 1));
  }

  return result;
}
