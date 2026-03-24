import { exec } from '../cli/obsidian-cli.js';

export const searchNotesSchema = {
  name: 'search_notes',
  description: `Search Obsidian vault notes via full-text search.
Returns matching file paths. Use read_note to get full content of specific notes.
Uses Obsidian's native search, supporting the same query syntax as the search bar in Obsidian.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query (same syntax as Obsidian search bar)' },
      folder: { type: 'string', description: 'Limit to folder path' },
      limit: { type: 'number', description: 'Max results (default 20)' },
      context: { type: 'boolean', description: 'Include matching line context (grep-style output)' },
    },
    required: ['query'],
  },
};

export async function handleSearchNotes(args: Record<string, unknown>): Promise<string> {
  const query = args.query as string;
  const folder = args.folder as string | undefined;
  const limit = args.limit as number | undefined;
  const context = args.context as boolean | undefined;

  const command = context ? 'search:context' : 'search';
  const params: Record<string, string> = { query };
  if (folder) params.path = folder;
  if (limit) params.limit = String(limit);

  const result = await exec(command, params);

  if (!result) {
    return 'Keine Notizen gefunden.';
  }

  return result;
}
