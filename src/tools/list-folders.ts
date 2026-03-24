import { exec } from '../cli/obsidian-cli.js';

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
      parent: { type: 'string', description: 'Filter by parent folder path' },
    },
  },
};

export async function handleListFolders(args: Record<string, unknown>): Promise<string> {
  const query = (args.query as string | undefined)?.toLowerCase();
  const parent = args.parent as string | undefined;

  const params: Record<string, string> = {};
  if (parent) params.folder = parent;

  const output = await exec('folders', params);
  const folders = output.split('\n').filter((f) => f && f !== '/');

  const filtered = query
    ? folders.filter((f) => f.toLowerCase().includes(query))
    : folders;

  return JSON.stringify(filtered, null, 2);
}
